// lib/queue/dispatch-queue.ts
// Background processor for campaign dispatch queue.
// Processes queued contacts one at a time with throttling and Redis concurrency control.

import crypto from 'crypto';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { checkCallAllowed, getMaxCallDuration } from '@/lib/billing/call-throttle';
import { dispatchCall } from '@/lib/bland/master-client';
import { getCompanyCallerNumber } from '@/lib/bland/phone-numbers';
import { acquireCallSlot, releaseCallSlot, transferCallSlot } from '@/lib/redis/concurrency-manager';
import { getAvailability } from '@/lib/calendar/availability';

// ─── Calendar context injection for appointment confirmation calls ────────────
// Fetches live availability from all connected calendars and formats it as a
// human-readable block that gets appended to the Bland AI task prompt.
// This ensures every call goes out with fresh, accurate slot data — the agent
// already knows the options before the patient picks up.

const CALENDAR_CONTEXT_MARKER = '--- CALENDAR CONTEXT ---';

async function buildCalendarContext(companyId: string): Promise<string> {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC',
  });

  const lines: string[] = [
    `Today is ${todayStr} (${timeStr} UTC).`,
    '',
    'Available rescheduling slots (next 5 business days):',
  ];

  // Walk forward up to 14 days to find 5 business days
  let found = 0;
  const d = new Date(now);
  for (let i = 1; i <= 14 && found < 5; i++) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const dateStr = d.toISOString().split('T')[0];
    try {
      const avail = await getAvailability(companyId, dateStr, { slotDurationMinutes: 60 });
      if (!avail.is_working_day || avail.is_holiday) continue;
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      if (avail.available_slots.length === 0) {
        lines.push(`- ${dayLabel}: fully booked`);
      } else {
        const slots = avail.available_slots.slice(0, 5).map(s =>
          new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
        );
        lines.push(`- ${dayLabel}: ${slots.join(', ')}`);
      }
      found++;
    } catch {
      // non-fatal — skip this day
    }
  }

  if (found === 0) {
    lines.push('- No availability data available. Offer to check and call back.');
  }

  lines.push('');
  lines.push('When the patient wants to reschedule: ask morning or afternoon preference, then offer 2-3 specific times from the list above. Confirm the exact slot before ending the call.');

  return lines.join('\n');
}

function injectCalendarContext(task: string, context: string): string {
  if (task.includes(CALENDAR_CONTEXT_MARKER)) return task; // already injected
  return `${task}\n\n${CALENDAR_CONTEXT_MARKER}\n${context}\n${CALENDAR_CONTEXT_MARKER}`;
}

/**
 * Process up to `batchSize` pending dispatch queue entries.
 * Each entry represents a single contact to call.
 */
export async function processDispatchBatch(batchSize: number = 5): Promise<{
  processed: number;
  failed: number;
  throttled: number;
  remaining: number;
}> {
  let processed = 0;
  let failed = 0;
  let throttled = 0;

  // Fetch pending entries ordered by priority (preserves original dispatch order)
  const { data: pendingEntries, error: fetchError } = await supabaseAdmin
    .from('campaign_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchError || !pendingEntries || pendingEntries.length === 0) {
    const { count } = await supabaseAdmin
      .from('campaign_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return { processed: 0, failed: 0, throttled: 0, remaining: count || 0 };
  }

  for (const entry of pendingEntries) {
    // Claim the entry
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('campaign_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (claimError || !claimed) continue; // Someone else claimed it

    try {
      // Check throttle
      const throttleCheck = await checkCallAllowed(entry.company_id);
      if (!throttleCheck.allowed) {
        // Put back as pending for later retry
        await supabaseAdmin
          .from('campaign_queue')
          .update({ status: 'pending', error_message: throttleCheck.reason })
          .eq('id', entry.id);
        throttled++;
        continue;
      }

      const callConfig = entry.call_config as Record<string, unknown>;
      const effectiveMaxDuration = (entry.effective_max_duration as number) ||
        getMaxCallDuration(throttleCheck.planSlug || 'free');

      // Pre-register call log
      const preCallId = `pre_${Date.now()}_${crypto.randomUUID()}`;
      const { data: preLog } = await supabaseAdmin.from('call_logs').insert({
        company_id: entry.company_id,
        contact_id: entry.contact_id,
        call_id: preCallId,
        status: 'queued',
        completed: false,
      }).select('id').single();

      // Acquire Redis call slot
      const slot = await acquireCallSlot(entry.company_id, preCallId, entry.contact_id);
      if (!slot.acquired) {
        if (preLog?.id) {
          try { await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id); } catch {}
        }
        await supabaseAdmin
          .from('campaign_queue')
          .update({ status: 'pending', error_message: slot.error || 'Call slot unavailable' })
          .eq('id', entry.id);
        continue;
      }

      // Dispatch the call
      let dispatchSuccess = false;
      try {
        const dedicatedNumber = entry.dedicated_number as string | null || await getCompanyCallerNumber(entry.company_id);
        const webhookUrl = entry.webhook_url as string;

        // Inject live calendar context + contact appointment data for appointment confirmation agents.
        // Fetched fresh per-call so the agent has up-to-date availability and knows exactly
        // which appointment it is confirming for this specific contact.
        const agentSlug = (callConfig.agent_template_slug as string) || '';
        let finalTask = callConfig.task as string;
        if (agentSlug.includes('appointment') || agentSlug.includes('confirmation')) {
          try {
            // Fetch contact's specific appointment data (stored after previous calls or CRM sync)
            const { data: contactRow } = await supabaseAdmin
              .from('contacts')
              .select('custom_fields, contact_name')
              .eq('id', entry.contact_id)
              .single();
            const cf = (contactRow?.custom_fields as Record<string, unknown>) || {};
            const contactApptLines: string[] = [];
            if (cf.appointment_date) contactApptLines.push(`Appointment date/time: ${cf.appointment_date}`);
            if (cf.appointment_type) contactApptLines.push(`Appointment type: ${cf.appointment_type}`);
            if (cf.appointment_rescheduled) contactApptLines.push('Note: this appointment was previously rescheduled.');
            const contactApptContext = contactApptLines.length > 0
              ? `\nCONTACT APPOINTMENT DATA:\n${contactApptLines.join('\n')}\n`
              : '';

            const calCtx = await buildCalendarContext(entry.company_id);
            finalTask = injectCalendarContext(finalTask, `${contactApptContext}${calCtx}`);
          } catch (ctxErr) {
            console.error('[dispatch] Calendar context fetch failed (non-fatal):', ctxErr);
          }
        }

        const result = await dispatchCall({
          phone_number: entry.phone_number,
          task: finalTask,
          voice: (callConfig.voice as string) || 'maya',
          wait_for_greeting: true,
          record: true,
          max_duration: effectiveMaxDuration,
          voicemail_action: ((callConfig.voicemail_action as string) || 'leave_message') as 'leave_message' | 'hangup' | 'ignore',
          answered_by_enabled: true,
          webhook: webhookUrl,
          metadata: {
            company_id: entry.company_id,
            contact_id: entry.contact_id,
            campaign_id: entry.campaign_id || null,
            agent_run_id: entry.agent_run_id || null,
            agent_name: (callConfig.agent_name as string) || 'AI Agent',
            agent_template_slug: (callConfig.agent_template_slug as string) || null,
            contact_name: entry.contact_name || null,
          },
          first_sentence: callConfig.first_sentence as string | undefined,
          voicemail_message: callConfig.voicemail_message as string | undefined,
          from: dedicatedNumber || undefined,
        });

        if (result.success && result.callId) {
          dispatchSuccess = true;
          if (preLog?.id) {
            await supabaseAdmin.from('call_logs')
              .update({ call_id: result.callId, status: 'in_progress' })
              .eq('id', preLog.id);
          }
          // Transfer Redis slot from pre_* ID to real Bland call_id
          await transferCallSlot(entry.company_id, preCallId, result.callId);
          await supabaseAdmin
            .from('campaign_queue')
            .update({ status: 'completed', call_id: result.callId, completed_at: new Date().toISOString() })
            .eq('id', entry.id);
          processed++;
        } else {
          await supabaseAdmin
            .from('campaign_queue')
            .update({ status: 'failed', error_message: result.error || 'Bland API error', completed_at: new Date().toISOString() })
            .eq('id', entry.id);
          failed++;
        }
      } finally {
        if (!dispatchSuccess) {
          if (preLog?.id) {
            try { await supabaseAdmin.from('call_logs').delete().eq('id', preLog.id); } catch {}
          }
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await releaseCallSlot(entry.company_id, preCallId);
              break;
            } catch {
              if (attempt < 2) await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
            }
          }
        }
      }
    } catch (err) {
      console.error(`[dispatch-queue] Error processing entry ${entry.id}:`, err);
      await supabaseAdmin
        .from('campaign_queue')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', entry.id);
      failed++;
    }
  }

  // Count remaining
  const { count } = await supabaseAdmin
    .from('campaign_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return { processed, failed, throttled, remaining: count || 0 };
}
