// app/api/bland/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/service';
import { createAgentCallback, createAgentFollowUp } from '@/lib/calendar/sync';
import {
  syncRescheduleAppointment,
  syncConfirmAppointment,
  syncHandleNoShow,
  syncScheduleMeeting,
  syncScheduleCallback,
} from '@/lib/calendar/campaign-sync';
import {
  getActivePipedriveIntegration,
  pushCallResultToPipedrive,
} from '@/lib/pipedrive';
import {
  getActiveClioIntegration,
  pushCallResultToClio,
} from '@/lib/clio';
import {
  getActiveHubSpotIntegration,
  pushCallResultToHubSpot,
} from '@/lib/hubspot';
import {
  getActiveSalesforceIntegration,
  pushCallResultToSalesforce,
} from '@/lib/salesforce';
// Google Sheets is import-only — no outbound push from webhooks
import type { CalendarStepConfig } from '@/types/calendar';
import type { Json } from '@/types/supabase';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import {
  analyzeCallIntent,
  type AppointmentIntentResult,
  type LeadQualificationResult,
  type DataValidationResult,
} from '@/lib/ai/intent-analyzer';
import { enqueueAnalysis } from '@/lib/queue/analysis-queue';
import { autoAssignEvent } from '@/lib/calendar/resource-routing';
import { getNextAvailableSlot } from '@/lib/calendar/availability';
import { trackCallUsage } from '@/lib/billing/usage-tracker';
import { trackServerEvent } from '@/lib/analytics';
import { captureServerEvent } from '@/lib/posthog-server';
import { releaseCallSlot } from '@/lib/redis/concurrency-manager';

interface WebhookMetadata {
  company_id?: string;
  contact_id?: string;
  agent_name?: string;
  agent_run_id?: string;
  agent_template_slug?: string;
  campaign_id?: string;
  calendar_event_id?: string;
  follow_up_needed?: boolean;
  follow_up_date?: string;
  follow_up_reason?: string;
  started_at?: string;
  no_show?: boolean;
  appointment_confirmed?: boolean;
  needs_reschedule?: boolean;
  new_appointment_time?: string;
  reschedule_reason?: string;
  callback_requested?: boolean;
  for_callback?: boolean;
  callback_date?: string;
  meeting_scheduled?: boolean;
  meeting_requested?: boolean;
  meeting_time?: string;
  contact_email?: string;
  [key: string]: unknown;
}

function verifyBlandSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // FIX #5: Require webhook signature in ALL environments (not just production).
    // This prevents forged webhook payloads in staging/preview deployments.
    const webhookSecret = process.env.BLAND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('BLAND_WEBHOOK_SECRET is required — set it in all environments');
      return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-bland-signature') || request.headers.get('x-webhook-signature');
    if (!verifyBlandSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid Bland webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    const body: Record<string, unknown> = JSON.parse(rawBody);

    const call_id = body.call_id as string | undefined;
    const status = body.status as string | undefined;
    const completed = body.completed as boolean | undefined;
    const call_length = body.call_length as number | undefined;
    const to = body.to as string | undefined;
    const from = body.from as string | undefined;
    const answered_by = body.answered_by as string | undefined;
    const recording_url = body.recording_url as string | undefined;
    const concatenated_transcript = body.concatenated_transcript as string | undefined;
    const summary = body.summary as string | undefined;
    const error_message = body.error_message as string | undefined;
    const price = body.price as number | undefined;
    const metadata = body.metadata as WebhookMetadata | undefined;

    console.log('Webhook received for call:', call_id);

    // Extract company_id and contact_id from metadata
    const companyId = metadata?.company_id as string | undefined;
    const contactId = metadata?.contact_id as string | undefined;

    if (!companyId) {
      console.error('No company_id in webhook metadata');
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    // Idempotency check: skip if this call_id was already fully processed
    // Also guard against concurrent webhook processing for the same call
    if (call_id) {
      const { data: existingLog } = await supabaseAdmin
        .from('call_logs')
        .select('id, completed, status')
        .eq('call_id', call_id)
        .maybeSingle();

      if (existingLog?.completed) {
        console.log(`[webhook] Call ${call_id} already processed, skipping`);
        return NextResponse.json({ status: 'already_processed', call_id });
      }

      // Guard against duplicate in-flight webhooks: if this call is already being
      // processed (status matches what we're about to set), skip to prevent
      // duplicate calendar events, contact locks, and usage tracking
      if (existingLog && completed && existingLog.status === status) {
        console.log(`[webhook] Call ${call_id} appears to be duplicate webhook (same status: ${status}), skipping`);
        return NextResponse.json({ status: 'duplicate_skipped', call_id });
      }

      // Atomic: try to set completed=true only if it's currently false
      // This prevents race conditions when multiple webhook deliveries arrive simultaneously
      if (existingLog && completed) {
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from('call_logs')
          .update({ completed: true })
          .eq('call_id', call_id)
          .eq('completed', false)
          .select('id')
          .maybeSingle();

        if (!claimed && !claimError) {
          // Another webhook already claimed this call
          return NextResponse.json({ status: 'already_processed', call_id });
        }
      }
    }

    // Upsert call_log (insert or update if call_id already exists from pre-dispatch)
    // For calls without a pre-registered log: use atomic claim via upsert + completed check
    // to prevent duplicate downstream processing when concurrent webhooks arrive
    const isVoicemail = answered_by === 'voicemail' || status === 'voicemail';
    const voicemailMessageLeft = isVoicemail && !!(call_length && call_length > 5);
    const { data: upsertedCallLog, error: upsertError } = await supabaseAdmin.from('call_logs').upsert({
      company_id: companyId,
      contact_id: contactId || null,
      call_id: call_id as string,
      status: status || null,
      completed: completed || false,
      call_length: call_length || null,
      price: price || null,
      answered_by: answered_by || null,
      recording_url: recording_url || null,
      transcript: concatenated_transcript || null,
      summary: summary || null,
      error_message: error_message || null,
      metadata: body as unknown as Json,
      voicemail_detected: isVoicemail,
      voicemail_left: voicemailMessageLeft,
    }, { onConflict: 'call_id', ignoreDuplicates: false }).select('id').single();

    const callLogId = upsertedCallLog?.id;

    // Log voicemail detection to voicemail_logs and update agent_run counters
    let voicemailLogId: string | null = null;
    if (isVoicemail && callLogId) {
      try {
        const agentRunId = metadata?.agent_run_id as string | undefined;

        const { data: vmLog } = await supabaseAdmin.from('voicemail_logs').insert({
          company_id: companyId,
          call_id: callLogId,
          agent_run_id: agentRunId || null,
          contact_id: contactId || null,
          detected_at: new Date().toISOString(),
          detection_method: 'bland_ai',
          message_left: voicemailMessageLeft,
          message_duration: voicemailMessageLeft ? (call_length || 0) : null,
          message_audio_url: voicemailMessageLeft ? (recording_url || null) : null,
          follow_up_scheduled: false,
          metadata: JSON.parse(JSON.stringify({ call_id, answered_by, status })),
        }).select('id').single();
        voicemailLogId = vmLog?.id || null;

        // Increment voicemail counters on agent_run
        if (agentRunId) {
          const { data: agentRun } = await supabaseAdmin
            .from('agent_runs')
            .select('voicemails_detected, voicemails_left')
            .eq('id', agentRunId)
            .single();

          if (agentRun) {
            await supabaseAdmin
              .from('agent_runs')
              .update({
                voicemails_detected: (agentRun.voicemails_detected || 0) + 1,
                voicemails_left: (agentRun.voicemails_left || 0) + (voicemailMessageLeft ? 1 : 0),
              })
              .eq('id', agentRunId);
          }
        }
      } catch (vmError) {
        console.error('[webhook] Failed to log voicemail (non-fatal):', vmError);
      }
    }

    // Release Redis concurrency slot when call completes
    if (call_id && companyId && (completed || status === 'completed' || status === 'failed' || status === 'error' || status === 'no-answer')) {
      try {
        await releaseCallSlot(companyId, call_id);
      } catch (releaseError) {
        console.error('[webhook] Failed to release call slot (non-fatal):', releaseError);
      }
    }

    // GA4 server-side event: call completed
    trackServerEvent(
      companyId,
      null,
      'server_call_completed',
      {
        agent_type: metadata?.agent_template_slug || 'unknown',
        call_status: status || 'unknown',
        duration_seconds: call_length || 0,
        answered_by: answered_by || 'unknown',
        completed: completed || false,
      }
    );
    await captureServerEvent(companyId, 'server_call_completed', {
      agent_type: metadata?.agent_template_slug || 'unknown',
      call_status: status || 'unknown',
      duration_seconds: call_length || 0,
      answered_by: answered_by || 'unknown',
      completed: completed || false,
    }, { company: companyId });

    // Lock the contact during processing to prevent user edits (5-min TTL)
    if (contactId && companyId) {
      const { data: lockContact } = await supabaseAdmin
        .from('contacts')
        .select('custom_fields')
        .eq('id', contactId)
        .eq('company_id', companyId)
        .single();
      const lockCf = (lockContact?.custom_fields as Record<string, unknown>) || {};

      // Strip any existing lock fields before setting our new lock
      // This handles stale locks from crashed webhooks
       
      const { _locked, _locked_at, _locked_by: __locked_by, _lock_call_id: __lock_call_id, _lock_expires_at: __expiry, ...cleanFields } = lockCf;

      if (_locked && _locked_at) {
        const lockAge = Date.now() - new Date(_locked_at as string).getTime();
        if (lockAge > 5 * 60 * 1000) {
          console.warn(`[webhook] Stale lock cleared on contact ${contactId} (${Math.round(lockAge / 1000)}s old)`);
        }
      }

      const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from('contacts')
        .update({
          custom_fields: JSON.parse(JSON.stringify({
            ...cleanFields,
            _locked: true,
            _locked_at: new Date().toISOString(),
            _lock_expires_at: lockExpiry,
            _locked_by: 'webhook_processing',
            _lock_call_id: call_id,
          })),
        })
        .eq('id', contactId)
        .eq('company_id', companyId);
    }

    // If there's a contact_id, update the contact
    if (contactId && completed && companyId) {
      const updates: Record<string, unknown> = {
        call_status: status,
        call_duration: call_length,
        recording_url,
        transcript_text: concatenated_transcript,
        updated_at: new Date().toISOString(),
      };

      // Add call metadata
      if (answered_by) {
        updates.call_metadata = {
          price,
          answered_by,
          from,
          to,
          summary,
          error_message,
        };
      }

      await supabaseAdmin
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .eq('company_id', companyId);
    }

    // ================================================================
    // CALENDAR INTEGRATION: Create calendar events based on call outcome
    // ================================================================
    try {
      const contactName: string = contactId
        ? await getContactName(contactId, companyId)
        : (to as string) || 'Unknown';

      // If call was not answered or voicemail, schedule a callback event
      if (answered_by === 'voicemail' || status === 'no_answer' || status === 'voicemail') {
        // Idempotency: check if a callback was already scheduled for this call
        const { data: existingCallback } = await supabaseAdmin
          .from('calendar_events')
          .select('id')
          .eq('company_id', companyId)
          .eq('contact_id', contactId || '')
          .in('event_type', ['callback', 'voicemail_followup'])
          .eq('status', 'scheduled')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingCallback) {
          // Use availability API to find next available slot respecting company working hours
          const campaignTimezone = (metadata?.calendar_timezone as string) || 'UTC';
          let callbackDateStr: string;

          const nextSlot = await getNextAvailableSlot(
            companyId,
            new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Start searching from 1 hour from now
            10 // 10-minute callback slot
          );

          if (nextSlot) {
            callbackDateStr = nextSlot.start;
          } else {
            // Fallback: next business day at 10 AM if no availability data
            const callbackDate = new Date();
            callbackDate.setDate(callbackDate.getDate() + 1);
            const dayOfWeek = callbackDate.getDay();
            if (dayOfWeek === 6) callbackDate.setDate(callbackDate.getDate() + 2);
            else if (dayOfWeek === 0) callbackDate.setDate(callbackDate.getDate() + 1);
            callbackDate.setHours(10, 0, 0, 0);
            callbackDateStr = callbackDate.toISOString();
          }

          const callbackEvent = await createAgentCallback(companyId, {
            contactId: contactId || undefined,
            contactName,
            contactPhone: to || undefined,
            callbackDate: callbackDateStr,
            agentName: metadata?.agent_name || 'AI Agent',
            reason: answered_by === 'voicemail' ? 'voicemail' : 'no_answer',
            notes: summary || `Auto-scheduled callback after ${answered_by === 'voicemail' ? 'voicemail' : 'no answer'}`,
            timezone: campaignTimezone,
          });

          // Link voicemail log to follow-up if this was a voicemail callback
          if (callbackEvent && voicemailLogId && isVoicemail) {
            await supabaseAdmin
              .from('voicemail_logs')
              .update({
                follow_up_scheduled: true,
                follow_up_id: callbackEvent.id,
              })
              .eq('id', voicemailLogId);
          }
        }
      }

      // If call completed and follow-up is needed (based on analysis/metadata)
      if (completed && metadata?.follow_up_needed) {
        // Idempotency: check if a follow-up was already created for this call
        const { data: existingFollowUp } = await supabaseAdmin
          .from('calendar_events')
          .select('id')
          .eq('company_id', companyId)
          .eq('contact_id', contactId || '')
          .eq('event_type', 'follow_up')
          .eq('status', 'scheduled')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingFollowUp) {
          const followUpDate = metadata?.follow_up_date
            ? new Date(metadata.follow_up_date as string)
            : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default 3 days

          await createAgentFollowUp(companyId, {
            contactId: contactId || undefined,
            contactName,
            contactPhone: to || undefined,
            agentName: metadata?.agent_name || 'AI Agent',
            followUpDate: followUpDate.toISOString(),
            reason: metadata?.follow_up_reason || 'Follow-up scheduled after call',
            notes: summary || undefined,
          });
        }
      }

      // If call completed successfully, log it as a completed event
      if (completed && status === 'completed') {
        const callStart = new Date((metadata?.started_at as string) || new Date());
        const callEnd = new Date(callStart);
        callEnd.setSeconds(callEnd.getSeconds() + (call_length || 0));

        const completedEventTimezone = (metadata?.calendar_timezone as string) || 'UTC';
        const { data: completedEvent } = await supabaseAdmin.from('calendar_events').insert({
          company_id: companyId,
          title: `Call Completed: ${contactName}`,
          description: summary || `Outbound call to ${contactName}`,
          start_time: callStart.toISOString(),
          end_time: callEnd.toISOString(),
          event_type: 'call' as const,
          status: 'completed',
          source: 'campaign',
          contact_id: contactId || null,
          contact_name: contactName,
          contact_phone: to || null,
          agent_name: metadata?.agent_name || null,
          ai_notes: summary || null,
          confirmation_status: 'confirmed',
          timezone: completedEventTimezone,
          metadata: JSON.parse(JSON.stringify({
            call_id,
            call_length,
            answered_by,
            recording_url,
          })),
        }).select('id').single();

        // Auto-assign to team member based on contact's doctor_assigned
        if (completedEvent?.id && contactId) {
          autoAssignEvent(companyId, completedEvent.id, contactId)
            .catch(err => console.warn('[webhook] Auto-assign failed (non-fatal):', err?.message));
        }
      }
    } catch (calendarError) {
      // Don't fail the webhook if calendar event creation fails
      console.error('Failed to create calendar event (non-fatal):', calendarError);
    }

    // ================================================================
    // CAMPAIGN-AWARE AGENT OPERATIONS
    // Use the campaign's calendar config for intelligent scheduling
    // ================================================================
    try {
      const agentRunId = metadata?.agent_run_id as string | undefined;
      const agentTemplateSlug = metadata?.agent_template_slug as string | undefined;

      if (agentRunId && completed) {
        // Fetch the campaign's calendar config and agent template slug
        const { data: agentRun } = await supabaseAdmin
          .from('agent_runs')
          .select('settings, agent_template_id, agent_templates(slug)')
          .eq('id', agentRunId)
          .single();

        const runSettings = (agentRun?.settings as Record<string, unknown>) || {};
        const calendarConfig = (runSettings.calendarConfig as Partial<CalendarStepConfig>) || {};
        const templateSlug = (agentRun as Record<string, unknown>)?.agent_templates
          ? ((agentRun as Record<string, unknown>).agent_templates as Record<string, string>)?.slug
          : agentTemplateSlug;

        // Get the call log ID for linking
        const { data: callLogData } = await supabaseAdmin
          .from('call_logs')
          .select('id')
          .eq('call_id', call_id as string)
          .single();
        const callLogId = callLogData?.id;

        const contactName: string = contactId
          ? await getContactName(contactId, companyId)
          : (to as string) || 'Unknown';

        // ---- AI-POWERED INTENT ANALYSIS ----
        // Dual-mode: async queue for high volume, sync for real-time needs
        const transcript = concatenated_transcript || '';
        let intentResult;
        const useAsyncQueue = process.env.AI_ANALYSIS_MODE === 'async';

        if (templateSlug && (transcript as string).length > 10) {
          if (useAsyncQueue && callLogId) {
            // ASYNC MODE: Enqueue for background processing (< 50ms)
            // The queue worker will process this and apply results later
            try {
              const jobId = await enqueueAnalysis({
                companyId,
                callLogId,
                contactId: contactId || null,
                agentRunId: agentRunId || null,
                templateSlug: templateSlug as string,
                transcript,
                callMetadata: {
                  ...((metadata || {}) as Record<string, unknown>),
                  contact_name: contactName,
                  calendar_event_id: metadata?.calendar_event_id,
                  company_timezone: (metadata?.calendar_timezone as string) || 'UTC',
                },
              });
              if (jobId) {
                // Tag the call log so we know analysis is pending
                const { data: callLog } = await supabaseAdmin
                  .from('call_logs')
                  .select('metadata')
                  .eq('id', callLogId)
                  .single();
                const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
                await supabaseAdmin
                  .from('call_logs')
                  .update({
                    metadata: {
                      ...existingMeta,
                      analysis_mode: 'async_queue',
                      analysis_job_id: jobId,
                      analysis_status: 'pending',
                    },
                  })
                  .eq('id', callLogId);
              }
            } catch (queueError) {
              console.warn('[webhook] Async queue enqueue failed, falling back to sync:', queueError);
              // Fall through to sync mode below
            }
          }

          // SYNC MODE: Analyze inline (default, or fallback if queue fails)
          if (!useAsyncQueue || !callLogId) {
            try {
              intentResult = await analyzeCallIntent(templateSlug as string, transcript, {
                ...((metadata || {}) as Record<string, unknown>),
                contact_name: contactName,
              });

              // Store AI analysis in call_log metadata
              if (callLogId) {
                const { data: callLog } = await supabaseAdmin
                  .from('call_logs')
                  .select('metadata')
                  .eq('id', callLogId)
                  .single();
                const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
                await supabaseAdmin
                  .from('call_logs')
                  .update({
                    metadata: {
                      ...existingMeta,
                      ai_intent_analysis: JSON.parse(JSON.stringify(intentResult)),
                      analysis_timestamp: new Date().toISOString(),
                      analysis_mode: 'sync',
                    },
                  })
                  .eq('id', callLogId);
              }
            } catch (aiError) {
              console.error('[webhook] AI intent analysis failed (non-fatal):', aiError);
            }
          }
        }

        // ---- Appointment Confirmation Agent ----
        if (templateSlug === 'appointment-confirmation' && contactId) {
          const apptResult = intentResult as AppointmentIntentResult | undefined;
          const isNoShow = metadata?.no_show ||
            (status === 'no_answer' && calendarConfig.noShowAutoRetry);

          // Use AI intent with confidence threshold, fall back to metadata flags
          const appointmentConfirmed = apptResult?.intent === 'confirmed' && apptResult.confidence >= 0.6
            || metadata?.appointment_confirmed;
          const needsReschedule = apptResult?.intent === 'reschedule' && apptResult.confidence >= 0.6
            || metadata?.needs_reschedule;
          const callbackRequested = apptResult?.intent === 'callback_requested' && apptResult.confidence >= 0.5;

          // Try to resolve calendar_event_id if missing — look up by contact + status
          let resolvedEventId = metadata?.calendar_event_id as string | undefined;
          if (!resolvedEventId && contactId && (appointmentConfirmed || needsReschedule || isNoShow)) {
            const { data: matchedEvent } = await supabaseAdmin
              .from('calendar_events')
              .select('id')
              .eq('company_id', companyId)
              .eq('contact_id', contactId)
              .in('status', ['scheduled', 'pending_confirmation'])
              .in('event_type', ['appointment', 'meeting', 'callback'])
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle();
            resolvedEventId = matchedEvent?.id || undefined;
          }

          if (appointmentConfirmed && resolvedEventId) {
            // Update calendar event title with confirmation status
            await supabaseAdmin
              .from('calendar_events')
              .update({
                confirmation_status: 'confirmed',
                title: `Confirmed: ${contactName}`,
                ai_notes: apptResult?.summary || summary || null,
              })
              .eq('id', resolvedEventId);

            await syncConfirmAppointment({
              companyId,
              eventId: resolvedEventId,
              contactId,
              agentRunId,
              callLogId,
              agentName: metadata?.agent_name,
            });

            // Mark any pending follow-ups for this contact as completed
            await supabaseAdmin
              .from('follow_up_queue')
              .update({
                status: 'completed',
                last_attempt_at: new Date().toISOString(),
              })
              .eq('company_id', companyId)
              .eq('contact_id', contactId)
              .eq('status', 'pending');

            // Store extracted data in contact custom_fields
            if (apptResult?.extractedData && Object.keys(apptResult.extractedData).length > 0) {
              const { data: contactData } = await supabaseAdmin
                .from('contacts')
                .select('custom_fields')
                .eq('id', contactId)
                .eq('company_id', companyId)
                .single();
              const cf = (contactData?.custom_fields as Record<string, unknown>) || {};
              await supabaseAdmin
                .from('contacts')
                .update({
                  custom_fields: { ...cf, ...apptResult.extractedData, ai_sentiment: apptResult.patientSentiment },
                })
                .eq('id', contactId)
                .eq('company_id', companyId);
            }

            dispatchWebhookEvent(companyId, 'appointment.confirmed', {
              event_id: resolvedEventId,
              contact_id: contactId,
              contact_name: contactName,
              agent_name: metadata?.agent_name,
              ai_confidence: apptResult?.confidence,
            }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
          } else if (needsReschedule && resolvedEventId) {
            // Use AI-extracted time, then metadata, then null (requires manual)
            const newStart = apptResult?.newAppointmentTime || metadata?.new_appointment_time;
            const duration = calendarConfig.defaultMeetingDuration || 30;
            if (newStart) {
              const newEnd = new Date(new Date(newStart as string).getTime() + duration * 60000).toISOString();
              await syncRescheduleAppointment({
                companyId,
                eventId: resolvedEventId,
                contactId,
                agentRunId,
                callLogId,
                newStartTime: newStart as string,
                newEndTime: newEnd,
                reason: apptResult?.rescheduleReason || metadata?.reschedule_reason || 'Contact requested reschedule',
                videoProvider: calendarConfig.preferredVideoProvider || 'none',
                agentName: metadata?.agent_name,
              });

              // Update calendar title
              await supabaseAdmin
                .from('calendar_events')
                .update({
                  title: `Rescheduled: ${contactName}`,
                  ai_notes: apptResult?.summary || null,
                })
                .eq('id', resolvedEventId);

              dispatchWebhookEvent(companyId, 'appointment.rescheduled', {
                event_id: resolvedEventId,
                contact_id: contactId,
                contact_name: contactName,
                new_start: newStart,
                new_end: newEnd,
                reason: apptResult?.rescheduleReason || 'Contact requested reschedule',
                ai_confidence: apptResult?.confidence,
              }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
            }
          } else if (isNoShow && resolvedEventId) {
            await supabaseAdmin
              .from('calendar_events')
              .update({
                title: `No-Show: ${contactName}`,
                confirmation_status: 'no_response',
              })
              .eq('id', resolvedEventId);

            await syncHandleNoShow({
              companyId,
              eventId: resolvedEventId,
              contactId,
              agentRunId,
              callLogId,
              calendarConfig,
              agentName: metadata?.agent_name,
            });
            dispatchWebhookEvent(companyId, 'appointment.no_show', {
              event_id: resolvedEventId,
              contact_id: contactId,
              contact_name: contactName,
              agent_name: metadata?.agent_name,
            }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
          } else if (callbackRequested) {
            const callbackDate = new Date(Date.now() + (calendarConfig.followUpIntervalHours || 24) * 60 * 60 * 1000).toISOString();
            await syncScheduleCallback({
              companyId,
              contactId,
              contactName,
              contactPhone: to,
              agentRunId,
              callLogId,
              callbackDate,
              reason: 'requested',
              agentName: metadata?.agent_name,
              notes: apptResult?.summary || summary || undefined,
            });
          }
        }

        // ---- Lead Qualification Agent ----
        if (templateSlug === 'lead-qualification' && contactId) {
          const leadResult = intentResult as LeadQualificationResult | undefined;

          // Use AI-detected meeting request or metadata flags
          const meetingRequested = leadResult?.intent === 'meeting_requested' && leadResult.confidence >= 0.5
            || metadata?.meeting_scheduled
            || metadata?.meeting_requested;
          const meetingTime = leadResult?.meetingTime || metadata?.meeting_time;

          if (meetingRequested && meetingTime) {
            const duration = calendarConfig.defaultMeetingDuration || 30;
            const startTime = meetingTime as string;
            const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

            await syncScheduleMeeting({
              companyId,
              contactId,
              contactName,
              contactPhone: to,
              contactEmail: metadata?.contact_email,
              agentRunId,
              callLogId,
              startTime,
              endTime,
              title: `Meeting: ${contactName}`,
              description: leadResult?.summary || `Qualified lead meeting with ${contactName}`,
              videoProvider: calendarConfig.preferredVideoProvider || 'none',
              agentName: metadata?.agent_name,
              meetingType: 'meeting',
            });
            // Mark any pending follow-ups for this contact as completed
            await supabaseAdmin
              .from('follow_up_queue')
              .update({
                status: 'completed',
                last_attempt_at: new Date().toISOString(),
              })
              .eq('company_id', companyId)
              .eq('contact_id', contactId)
              .eq('status', 'pending');

            dispatchWebhookEvent(companyId, 'appointment.scheduled', {
              contact_id: contactId,
              contact_name: contactName,
              contact_phone: to,
              start_time: startTime,
              end_time: endTime,
              agent_name: metadata?.agent_name,
              type: 'meeting',
              qualification_score: leadResult?.qualificationScore,
            }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
          }

          // Store BANT data and qualification score in contact
          if (leadResult && contactId) {
            const { data: contactData } = await supabaseAdmin
              .from('contacts')
              .select('custom_fields')
              .eq('id', contactId)
              .eq('company_id', companyId)
              .single();
            const cf = (contactData?.custom_fields as Record<string, unknown>) || {};
            await supabaseAdmin
              .from('contacts')
              .update({
                custom_fields: JSON.parse(JSON.stringify({
                  ...cf,
                  qualification_score: leadResult.qualificationScore,
                  budget: leadResult.budget || cf.budget,
                  authority: leadResult.authority || cf.authority,
                  need: leadResult.need || cf.need,
                  timeline: leadResult.timeline || cf.timeline,
                  ...leadResult.extractedData,
                })),
                updated_at: new Date().toISOString(),
              })
              .eq('id', contactId)
              .eq('company_id', companyId);
          }
        }

        // ---- Data Validation Agent ----
        // Auto-update contact fields with validated/new data from the call
        if (templateSlug === 'data-validation' && contactId) {
          const dvResult = intentResult as DataValidationResult | undefined;

          if (dvResult && (dvResult.intent === 'data_confirmed' || dvResult.intent === 'data_updated' || dvResult.intent === 'partial')) {
            // Build updates from AI-extracted data
            const contactUpdates: Record<string, unknown> = {};
            const extracted = dvResult.extractedData || {};
            const newFields = dvResult.newFields || {};

            // Map AI-extracted fields to contact columns
            if (extracted.contact_name) contactUpdates.contact_name = extracted.contact_name;
            if (extracted.email) contactUpdates.email = extracted.email;
            if (extracted.address) contactUpdates.address = extracted.address;
            if (extracted.city) contactUpdates.city = extracted.city;
            if (extracted.state) contactUpdates.state = extracted.state;
            if (extracted.zip_code) contactUpdates.zip_code = extracted.zip_code;
            if (extracted.company_name) contactUpdates.company_name = extracted.company_name;

            // Store all other fields (decision_maker, corporate_email, etc.) in custom_fields
            const { data: contactData } = await supabaseAdmin
              .from('contacts')
              .select('custom_fields')
              .eq('id', contactId)
              .eq('company_id', companyId)
              .single();
            const cf = (contactData?.custom_fields as Record<string, unknown>) || {};

            const extraFields: Record<string, unknown> = {};
            for (const [key, value] of Object.entries({ ...extracted, ...newFields })) {
              if (!['contact_name', 'email', 'address', 'city', 'state', 'zip_code', 'company_name', 'phone'].includes(key) && value) {
                extraFields[key] = value;
              }
            }

            // Merge validated field updates
            for (const [field, validation] of Object.entries(dvResult.validatedFields)) {
              if (validation.status === 'updated' && validation.newValue) {
                extraFields[`validated_${field}`] = validation.newValue;
              }
              extraFields[`validation_status_${field}`] = validation.status;
            }

            contactUpdates.custom_fields = {
              ...cf,
              ...extraFields,
              data_validated: true,
              data_validated_at: new Date().toISOString(),
              validation_summary: dvResult.summary,
            };
            contactUpdates.updated_at = new Date().toISOString();

            if (dvResult.intent === 'data_confirmed') {
              contactUpdates.status = 'Fully Verified';
              contactUpdates.call_outcome = 'Data Confirmed';
            } else if (dvResult.intent === 'data_updated') {
              contactUpdates.status = 'Fully Verified';
              contactUpdates.call_outcome = 'Data Updated';
            }

            await supabaseAdmin
              .from('contacts')
              .update(contactUpdates)
              .eq('id', contactId)
              .eq('company_id', companyId);
          }
        }

        // ---- All Agents: Handle callback requests ----
        if (contactId && (calendarConfig.callbackEnabled || calendarConfig.followUpEnabled)) {
          const callbackRequested =
            metadata?.callback_requested ||
            metadata?.for_callback ||
            (intentResult && 'intent' in intentResult && intentResult.intent === 'callback_requested');

          if (callbackRequested) {
            const callbackDate = metadata?.callback_date
              || new Date(Date.now() + (calendarConfig.followUpIntervalHours || 24) * 60 * 60 * 1000).toISOString();

            await syncScheduleCallback({
              companyId,
              contactId,
              contactName,
              contactPhone: to,
              agentRunId,
              callLogId,
              callbackDate,
              reason: 'requested',
              agentName: metadata?.agent_name,
              notes: summary || undefined,
            });
          }
        }
      }
    } catch (campaignCalendarError) {
      // Don't fail the webhook if campaign calendar operations fail
      console.error('Failed campaign calendar operation (non-fatal):', campaignCalendarError);
    }

    // ================================================================
    // PIPEDRIVE CRM SYNC: Push call results to Pipedrive
    // ================================================================
    if (contactId && completed && companyId) {
      try {
        const pdIntegration = await getActivePipedriveIntegration(companyId);
        if (pdIntegration) {
          const pdResult = await pushCallResultToPipedrive(pdIntegration, contactId);
          if (!pdResult.success) {
            console.warn('Pipedrive sync skipped:', pdResult.error);
          }
        }
      } catch (pipedriveError) {
        // Don't fail the webhook if Pipedrive sync fails
        console.error('Pipedrive outbound sync failed (non-fatal):', pipedriveError);
      }
    }

    // ================================================================
    // CLIO CRM SYNC: Push call results to Clio
    // ================================================================
    if (contactId && completed && companyId) {
      try {
        const clioIntegration = await getActiveClioIntegration(companyId);
        if (clioIntegration) {
          const clioResult = await pushCallResultToClio(clioIntegration, contactId);
          if (!clioResult.success) {
            console.warn('Clio sync skipped:', clioResult.error);
          }
        }
      } catch (clioError) {
        // Don't fail the webhook if Clio sync fails
        console.error('Clio outbound sync failed (non-fatal):', clioError);
      }
    }

    // Google Sheets: import-only — no outbound push to sheets from webhooks

    // ================================================================
    // HUBSPOT CRM SYNC: Push call results to HubSpot
    // ================================================================
    if (contactId && completed && companyId) {
      try {
        const hsIntegration = await getActiveHubSpotIntegration(companyId);
        if (hsIntegration) {
          const hsResult = await pushCallResultToHubSpot(hsIntegration, contactId);
          if (!hsResult.success) {
            console.warn('HubSpot sync skipped:', hsResult.error);
          }
        }
      } catch (hubspotError) {
        // Don't fail the webhook if HubSpot sync fails
        console.error('HubSpot outbound sync failed (non-fatal):', hubspotError);
      }
    }

    // ================================================================
    // SALESFORCE CRM SYNC: Push call results to Salesforce
    // ================================================================
    if (contactId && completed && companyId) {
      try {
        const sfIntegration = await getActiveSalesforceIntegration(companyId);
        if (sfIntegration) {
          const sfResult = await pushCallResultToSalesforce(sfIntegration, contactId);
          if (!sfResult.success) {
            console.warn('Salesforce sync skipped:', sfResult.error);
          }
        }
      } catch (salesforceError) {
        // Don't fail the webhook if Salesforce sync fails
        console.error('Salesforce outbound sync failed (non-fatal):', salesforceError);
      }
    }

    // ================================================================
    // OUTBOUND WEBHOOKS: Dispatch events to user-configured endpoints
    // ================================================================
    try {
      const webhookData = {
        call_id,
        status,
        completed: completed || false,
        call_length,
        to,
        from,
        answered_by,
        recording_url,
        transcript: concatenated_transcript,
        summary,
        contact_id: contactId || null,
        agent_name: metadata?.agent_name || null,
        campaign_id: metadata?.campaign_id || null,
        price,
      };

      if (completed && status === 'completed') {
        await dispatchWebhookEvent(companyId, 'call.completed', webhookData);
      } else if (status === 'no_answer' || answered_by === 'no_answer') {
        await dispatchWebhookEvent(companyId, 'call.no_answer', webhookData);
      } else if (answered_by === 'voicemail' || status === 'voicemail') {
        await dispatchWebhookEvent(companyId, 'call.voicemail', webhookData);
      } else if (error_message || status === 'error' || status === 'failed') {
        await dispatchWebhookEvent(companyId, 'call.failed', {
          ...webhookData,
          error_message,
        });
      }

      // Dispatch contact.updated if contact was updated
      if (contactId && completed) {
        await dispatchWebhookEvent(companyId, 'contact.updated', {
          contact_id: contactId,
          call_id,
          updates: {
            call_status: status,
            call_duration: call_length,
            summary,
          },
        });
      }
    } catch (webhookError) {
      // Don't fail the main webhook if outbound dispatch fails
      console.error('Outbound webhook dispatch failed (non-fatal):', webhookError);
    }

    // ================================================================
    // USAGE TRACKING: Report call minutes to billing system
    // ================================================================
    // Only track usage for completed calls with actual call duration
    // Skip failed/error calls to avoid charging customers for unsuccessful calls
    if (completed && call_length && call_length > 0 && companyId && status !== 'failed' && status !== 'error') {
      try {
        const callMinutes = Math.ceil((call_length as number) / 60); // Convert seconds to minutes (round up)
        if (callMinutes > 0) {
          await trackCallUsage({
            companyId,
            minutes: callMinutes,
            callId: call_id as string,
            metadata: {
              contact_id: contactId,
              agent_name: metadata?.agent_name,
              agent_run_id: metadata?.agent_run_id,
            },
          });
        }
      } catch (usageError) {
        // Don't fail the webhook if usage tracking fails
        console.error('Usage tracking failed (non-fatal):', usageError);
      }
    }

    // Unlock the contact after all processing is complete
    if (contactId && companyId) {
      try {
        const { data: unlockContact } = await supabaseAdmin
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .eq('company_id', companyId)
          .single();
        const unlockCf = (unlockContact?.custom_fields as Record<string, unknown>) || {};
        // Remove lock fields
         
        const { _locked: _uLocked, _locked_at: _uLockedAt, _locked_by: _uLockedBy, _lock_call_id: _uLockCallId, _lock_expires_at: _uLockExpiresAt, ...restFields } = unlockCf;
        await supabaseAdmin
          .from('contacts')
          .update({ custom_fields: JSON.parse(JSON.stringify(restFields)) })
          .eq('id', contactId)
          .eq('company_id', companyId);
      } catch (unlockErr) {
        console.error('Failed to unlock contact (non-fatal):', unlockErr);
      }
    }

    return NextResponse.json({
      status: 'success',
      message: 'Webhook processed',
      call_id,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function getContactName(contactId: string, companyId?: string): Promise<string> {
  let query = supabaseAdmin
    .from('contacts')
    .select('contact_name, phone_number')
    .eq('id', contactId);
  if (companyId) query = query.eq('company_id', companyId);
  const { data } = await query.maybeSingle();
  return data?.contact_name || data?.phone_number || 'Unknown';
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Bland AI webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}