// app/api/campaigns/dispatch/route.ts
// Server-side campaign batch dispatch — single master API key architecture
// Processes contacts sequentially with throttling and Redis concurrency control.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { checkCallAllowed, getMaxCallDuration } from '@/lib/billing/call-throttle';
import { expensiveLimiter } from '@/lib/rate-limit';
import { dispatchCall } from '@/lib/bland/master-client';
import { getCompanyCallerNumber } from '@/lib/bland/phone-numbers';
import { acquireCallSlot, releaseCallSlot } from '@/lib/redis/concurrency-manager';

const dispatchSchema = z.object({
  company_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  agent_run_id: z.string().uuid().optional(),
  contacts: z.array(z.object({
    contact_id: z.string().uuid(),
    phone_number: z.string().min(7),
    contact_name: z.string().optional(),
  })).min(1).max(500),
  call_config: z.object({
    task: z.string().min(1).max(5000),
    voice: z.string().default('maya'),
    first_sentence: z.string().max(500).optional(),
    voicemail_action: z.enum(['leave_message', 'hangup', 'ignore']).default('leave_message'),
    voicemail_message: z.string().max(1000).optional(),
    max_duration: z.number().int().min(1).max(600).optional(),
    agent_template_slug: z.string().optional(),
    agent_name: z.string().optional(),
  }),
  webhook_url: z.string().url().optional(),
  delay_between_calls_ms: z.number().int().min(500).max(30000).default(2000),
});

// Minimum 5 minutes (300s) between calls to the same contact — handled by Redis contactCooldown
// The delay_between_calls_ms is for sequential dispatch pacing (not same-contact protection)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 2 campaign dispatches per minute per user
    const rateLimit = await expensiveLimiter.check(2, `campaign_dispatch_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many dispatch requests. Please wait.' }, { status: 429 });
    }

    const rawBody = await request.json();
    const parseResult = dispatchSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { company_id, campaign_id, agent_run_id, contacts, call_config, webhook_url, delay_between_calls_ms } = parseResult.data;

    // Verify user belongs to the company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized for this company' }, { status: 403 });
    }

    // Initial throttle check before starting
    const initialCheck = await checkCallAllowed(company_id);
    if (!initialCheck.allowed) {
      return NextResponse.json(
        { error: initialCheck.reason, code: initialCheck.reasonCode },
        { status: 429 }
      );
    }

    const planMaxDuration = getMaxCallDuration(initialCheck.planSlug || 'free');
    const effectiveMaxDuration = call_config.max_duration
      ? Math.min(call_config.max_duration, planMaxDuration)
      : planMaxDuration;

    // Build the base webhook URL (use company's custom webhook or the platform webhook)
    const platformWebhook = `${request.nextUrl.origin}/api/bland/webhook`;

    // Get dedicated number if company has one
    const dedicatedNumber = await getCompanyCallerNumber(company_id);

    // Process contacts sequentially with delays
    const results: { contact_id: string; status: 'dispatched' | 'throttled' | 'failed' | 'cooldown'; call_id?: string; error?: string }[] = [];
    let dispatched = 0;
    let throttled = 0;
    let failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        // FIX: Pre-register call_log BEFORE throttle re-check to prevent TOCTOU race.
        const preCallId = `pre_${Date.now()}_${crypto.randomUUID()}`;
        const { data: preLog } = await supabaseAdmin.from('call_logs').insert({
          company_id,
          contact_id: contact.contact_id,
          call_id: preCallId,
          status: 'queued',
          completed: false,
        }).select('id').single();

        // Re-check throttle AFTER pre-registration (entry is already counted)
        if (i > 0) {
          const throttleRecheck = await checkCallAllowed(company_id);
          if (!throttleRecheck.allowed) {
            // Clean up pre-registered entry
            if (preLog?.id) {
              await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
            }
            // Mark remaining contacts as throttled
            results.push({ contact_id: contact.contact_id, status: 'throttled', error: throttleRecheck.reason });
            throttled++;
            for (let j = i + 1; j < contacts.length; j++) {
              results.push({ contact_id: contacts[j].contact_id, status: 'throttled', error: throttleRecheck.reason });
              throttled++;
            }
            break;
          }
        }

        // Acquire Redis call slot (checks contact cooldown + all limits)
        const slot = await acquireCallSlot(company_id, preCallId, contact.contact_id);
        if (!slot.acquired) {
          if (preLog?.id) {
            await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
          }
          results.push({ contact_id: contact.contact_id, status: 'cooldown', error: slot.error || 'Call slot unavailable' });
          continue; // Skip this contact but try next
        }

        // Dispatch via master API key
        const result = await dispatchCall({
          phone_number: contact.phone_number,
          task: call_config.task,
          voice: call_config.voice,
          wait_for_greeting: true,
          record: true,
          max_duration: effectiveMaxDuration,
          voicemail_action: call_config.voicemail_action,
          answered_by_enabled: true,
          webhook: webhook_url || platformWebhook,
          metadata: {
            company_id,
            contact_id: contact.contact_id,
            campaign_id: campaign_id || null,
            agent_run_id: agent_run_id || null,
            agent_name: call_config.agent_name || 'AI Agent',
            agent_template_slug: call_config.agent_template_slug || null,
            contact_name: contact.contact_name || null,
          },
          first_sentence: call_config.first_sentence,
          voicemail_message: call_config.voicemail_message,
          from: dedicatedNumber || undefined,
        });

        if (result.success && result.callId) {
          // Update pre-registered call_log with real call_id
          if (preLog?.id) {
            await supabaseAdmin.from('call_logs')
              .update({ call_id: result.callId, status: 'in_progress' })
              .eq('id', preLog.id);
          }
          results.push({ contact_id: contact.contact_id, status: 'dispatched', call_id: result.callId });
          dispatched++;
        } else {
          // Remove pre-registered call_log and release slot
          if (preLog?.id) {
            await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id);
          }
          await releaseCallSlot(company_id, preCallId);
          results.push({ contact_id: contact.contact_id, status: 'failed', error: result.error || 'Bland API error' });
          failed++;
        }
      } catch (callError) {
        results.push({ contact_id: contact.contact_id, status: 'failed', error: 'Dispatch error' });
        failed++;
        console.error(`[dispatch] Failed to dispatch call to ${contact.phone_number}:`, callError);
      }

      // Delay between calls (except for the last one)
      if (i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay_between_calls_ms));
      }
    }

    // Update campaign/agent_run status if provided
    if (agent_run_id) {
      await supabaseAdmin
        .from('agent_runs')
        .update({
          status: throttled > 0 ? 'partially_completed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', agent_run_id);
    }

    return NextResponse.json({
      status: 'completed',
      summary: {
        total: contacts.length,
        dispatched,
        throttled,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('[dispatch] Campaign dispatch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
