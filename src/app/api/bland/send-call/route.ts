// app/api/bland/send-call/route.ts
// Single master API key architecture — all calls go through one Bland account
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { expensiveLimiter } from '@/lib/rate-limit';
import { checkCallAllowed, getMaxCallDuration } from '@/lib/billing/call-throttle';
import { dispatchCall } from '@/lib/bland/master-client';
import { getCompanyCallerNumber } from '@/lib/bland/phone-numbers';
import { acquireCallSlot } from '@/lib/redis/concurrency-manager';

// ALTA-006 + ALTA-007: Zod schema for input validation
const sendCallSchema = z.object({
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format (E.164 expected)'),
  task: z.string().min(1, 'Task is required').max(5000),
  voice: z.string().default('maya'),
  first_sentence: z.string().max(500).optional(),
  wait_for_greeting: z.boolean().default(true),
  record: z.boolean().default(true),
  max_duration: z.number().int().min(1).max(600).optional(), // Plan limit enforced server-side
  voicemail_action: z.enum(['leave_message', 'hangup', 'ignore']).default('leave_message'),
  voicemail_message: z.string().max(1000).optional(),
  answered_by_enabled: z.boolean().default(true),
  webhook: z.string().url().refine(val => val.startsWith('https://'), { message: 'Webhook URL must use HTTPS' }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  company_id: z.string().uuid({ message: 'Invalid company ID' }),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: max 10 calls per minute per user
    const { success: rateLimitOk } = await expensiveLimiter.check(10, user.id);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const rawBody = await request.json();
    const parseResult = sendCallSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      phone_number,
      task,
      voice,
      first_sentence,
      wait_for_greeting,
      record,
      max_duration,
      voicemail_action,
      voicemail_message,
      answered_by_enabled,
      webhook,
      metadata,
      company_id,
    } = parseResult.data;

    // Verify user belongs to the specified company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized for this company' }, { status: 403 });
    }

    // ================================================================
    // AUDIT FIX: Pre-register call_log BEFORE throttle check to prevent
    // TOCTOU race condition. The pre-registered 'queued' entry is counted
    // by getActiveCalls(), so concurrent requests see each other's entries.
    // If throttle rejects, we delete the pre-registered entry.
    // ================================================================
    const preCallId = `pre_${Date.now()}_${crypto.randomUUID()}`;
    const { data: preLog } = await supabaseAdmin.from('call_logs').insert({
      company_id: company_id,
      contact_id: metadata?.contact_id as string || null,
      call_id: preCallId,
      status: 'queued',
      completed: false,
    }).select('id').single();

    // Now check throttle — the pre-registered entry is already visible to concurrent requests
    const throttleCheck = await checkCallAllowed(company_id);
    if (!throttleCheck.allowed) {
      // Clean up pre-registered entry
      if (preLog?.id) {
        await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
      }
      return NextResponse.json(
        {
          error: throttleCheck.reason,
          code: throttleCheck.reasonCode,
          upgrade: throttleCheck.suggestedUpgrade,
          limits: {
            concurrent: throttleCheck.maxConcurrent,
            currentConcurrent: throttleCheck.currentConcurrent,
            dailyCap: throttleCheck.dailyCap,
            dailyCallsToday: throttleCheck.dailyCallsToday,
          },
        },
        { status: 429 }
      );
    }

    // Acquire Redis call slot (atomic increment of all counters)
    const slot = await acquireCallSlot(
      company_id,
      preCallId,
      metadata?.contact_id as string | undefined
    );
    if (!slot.acquired) {
      if (preLog?.id) {
        await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
      }
      return NextResponse.json(
        { error: slot.error || 'Call slot unavailable', code: 'concurrent_limit' },
        { status: 429 }
      );
    }

    // Enforce plan-specific max call duration
    const planMaxDuration = getMaxCallDuration(throttleCheck.planSlug || 'free');
    const effectiveMaxDuration = max_duration
      ? Math.min(max_duration, planMaxDuration)
      : planMaxDuration;

    // Get dedicated number if company has one (for caller ID)
    const dedicatedNumber = await getCompanyCallerNumber(company_id);

    // Dispatch via master API key — wrapped in try-catch to guarantee slot release on ANY exception
    let dispatchSuccess = false;
    try {
      const result = await dispatchCall({
        phone_number,
        task,
        voice,
        first_sentence,
        wait_for_greeting,
        record,
        max_duration: effectiveMaxDuration,
        voicemail_action,
        voicemail_message,
        answered_by_enabled,
        webhook,
        metadata: {
          ...metadata,
          company_id,
        },
        from: dedicatedNumber || undefined,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to initiate call', details: result },
          { status: result.statusCode || 500 }
        );
      }

      dispatchSuccess = true;

      // Update pre-registered call_log with actual Bland call_id
      if (preLog?.id && result.callId) {
        await supabaseAdmin.from('call_logs')
          .update({ call_id: result.callId, status: 'in_progress' })
          .eq('id', preLog.id);
      }

      return NextResponse.json({
        status: 'success',
        call_id: result.callId,
        message: result.message || 'Call initiated successfully',
        limits: {
          concurrent: `${(throttleCheck.currentConcurrent || 0) + 1}/${throttleCheck.maxConcurrent || '∞'}`,
          dailyCalls: `${(throttleCheck.dailyCallsToday || 0) + 1}/${throttleCheck.dailyCap || '∞'}`,
          maxDuration: `${effectiveMaxDuration} min`,
        },
      });
    } finally {
      // CRITICAL: Always clean up on failure to prevent Redis slot leaks
      if (!dispatchSuccess) {
        try {
          if (preLog?.id) {
            await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
          }
          const { releaseCallSlot } = await import('@/lib/redis/concurrency-manager');
          await releaseCallSlot(company_id, preCallId);
        } catch { /* cleanup errors are non-fatal */ }
      }
    }

  } catch (error) {
    console.error('Error in send-call route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
