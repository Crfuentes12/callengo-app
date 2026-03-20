// app/api/bland/send-call/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { expensiveLimiter } from '@/lib/rate-limit';
import { checkCallAllowed, getMaxCallDuration } from '@/lib/billing/call-throttle';

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
    const { success: rateLimitOk } = expensiveLimiter.check(10, user.id);
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
    // AUDIT FIX: Pre-dispatch throttle checks
    // Enforces concurrent limits, daily caps, hourly caps, and usage limits
    // BEFORE calling Bland. Callengo is responsible for all plan limits.
    // ================================================================
    const throttleCheck = await checkCallAllowed(company_id);
    if (!throttleCheck.allowed) {
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

    // Get company-specific API key (sub-account key) or fall back to master key
    const { data: settings } = await supabaseAdmin
      .from('company_settings')
      .select('bland_api_key, bland_subaccount_id')
      .eq('company_id', company_id)
      .single();

    const apiKey = settings?.bland_api_key || process.env.BLAND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Bland API key not configured' },
        { status: 500 }
      );
    }

    // AUDIT FIX: Enforce plan-specific max call duration
    // The client can request a duration, but it's capped by the plan's max
    const planMaxDuration = getMaxCallDuration(throttleCheck.planSlug || 'free');
    const effectiveMaxDuration = max_duration
      ? Math.min(max_duration, planMaxDuration)
      : planMaxDuration;

    const blandPayload: Record<string, unknown> = {
      phone_number,
      task,
      voice,
      wait_for_greeting,
      record,
      max_duration: effectiveMaxDuration,
      voicemail_action,
      answered_by_enabled,
      model: 'enhanced',
      language: 'en',
      temperature: 0.7,
      background_track: 'office',
    };

    if (first_sentence) blandPayload.first_sentence = first_sentence;
    if (voicemail_message) blandPayload.voicemail_message = voicemail_message;
    if (webhook) blandPayload.webhook = webhook;
    if (metadata) blandPayload.metadata = metadata;

    const response = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blandPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to initiate call', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      call_id: data.call_id,
      message: data.message || 'Call initiated successfully',
      limits: {
        concurrent: `${(throttleCheck.currentConcurrent || 0) + 1}/${throttleCheck.maxConcurrent || '∞'}`,
        dailyCalls: `${(throttleCheck.dailyCallsToday || 0) + 1}/${throttleCheck.dailyCap || '∞'}`,
        maxDuration: `${effectiveMaxDuration} min`,
      },
    });

  } catch (error) {
    console.error('Error in send-call route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
