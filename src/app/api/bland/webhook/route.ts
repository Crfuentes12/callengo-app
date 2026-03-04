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
// Google Sheets is import-only — no outbound push from webhooks
import type { CalendarStepConfig } from '@/types/calendar';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import {
  analyzeCallIntent,
  type AppointmentIntentResult,
  type LeadQualificationResult,
  type DataValidationResult,
} from '@/lib/ai/intent-analyzer';

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
    // Verify webhook signature if BLAND_WEBHOOK_SECRET is configured
    const webhookSecret = process.env.BLAND_WEBHOOK_SECRET;
    let body: Record<string, unknown>;

    if (webhookSecret) {
      const rawBody = await request.text();
      const signature = request.headers.get('x-bland-signature') || request.headers.get('x-webhook-signature');
      if (!verifyBlandSignature(rawBody, signature, webhookSecret)) {
        console.error('Invalid Bland webhook signature');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      body = JSON.parse(rawBody);
    } else {
      body = await request.json();
      console.warn('BLAND_WEBHOOK_SECRET not configured — webhook signature verification skipped');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedBody = body as any;
    const {
      call_id,
      status,
      completed,
      call_length,
      to,
      from,
      answered_by,
      recording_url,
      concatenated_transcript,
      summary,
      error_message,
      price,
      metadata,
    } = typedBody;

    console.log('Webhook received for call:', call_id);

    // Extract company_id and contact_id from metadata
    const companyId = metadata?.company_id as string | undefined;
    const contactId = metadata?.contact_id as string | undefined;

    if (!companyId) {
      console.error('No company_id in webhook metadata');
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    // Log the call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabaseAdmin.from('call_logs').insert({
      company_id: companyId,
      contact_id: contactId || null,
      call_id,
      status,
      completed: completed || false,
      call_length,
      price,
      answered_by,
      recording_url,
      transcript: concatenated_transcript,
      summary,
      error_message,
      metadata: typedBody,
    } as any);

    // Lock the contact during processing to prevent user edits
    if (contactId) {
      const { data: lockContact } = await supabaseAdmin
        .from('contacts')
        .select('custom_fields')
        .eq('id', contactId)
        .single();
      const lockCf = (lockContact?.custom_fields as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('contacts')
        .update({
          custom_fields: {
            ...lockCf,
            _locked: true,
            _locked_at: new Date().toISOString(),
            _locked_by: 'webhook_processing',
            _lock_call_id: call_id,
          },
        })
        .eq('id', contactId);
    }

    // If there's a contact_id, update the contact
    if (contactId && completed) {
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
        .eq('id', contactId);
    }

    // ================================================================
    // CALENDAR INTEGRATION: Create calendar events based on call outcome
    // ================================================================
    try {
      const contactName = contactId
        ? await getContactName(contactId)
        : to || 'Unknown';

      // If call was not answered or voicemail, schedule a callback event
      if (answered_by === 'voicemail' || status === 'no_answer' || status === 'voicemail') {
        const callbackDate = new Date();
        callbackDate.setDate(callbackDate.getDate() + 1);
        callbackDate.setHours(10, 0, 0, 0);

        await createAgentCallback(companyId, {
          contactId: contactId || undefined,
          contactName,
          contactPhone: to || undefined,
          callbackDate: callbackDate.toISOString(),
          agentName: metadata?.agent_name || 'AI Agent',
          reason: answered_by === 'voicemail' ? 'voicemail' : 'no_answer',
          notes: summary || `Auto-scheduled callback after ${answered_by === 'voicemail' ? 'voicemail' : 'no answer'}`,
        });
      }

      // If call completed and follow-up is needed (based on analysis/metadata)
      if (completed && metadata?.follow_up_needed) {
        const followUpDate = metadata?.follow_up_date
          ? new Date(metadata.follow_up_date)
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

      // If call completed successfully, log it as a completed event
      if (completed && status === 'completed') {
        const callStart = new Date(metadata?.started_at || new Date());
        const callEnd = new Date(callStart);
        callEnd.setSeconds(callEnd.getSeconds() + (call_length || 0));

        await supabaseAdmin.from('calendar_events').insert({
          company_id: companyId,
          title: `Call Completed: ${contactName}`,
          description: summary || `Outbound call to ${contactName}`,
          start_time: callStart.toISOString(),
          end_time: callEnd.toISOString(),
          event_type: 'call',
          status: 'completed',
          source: 'campaign',
          contact_id: contactId || null,
          contact_name: contactName,
          contact_phone: to || null,
          agent_name: metadata?.agent_name || null,
          ai_notes: summary || null,
          confirmation_status: 'confirmed',
          metadata: {
            call_id,
            call_length,
            answered_by,
            recording_url,
          },
        });
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
      const agentRunId = metadata?.agent_run_id;
      const agentTemplateSlug = metadata?.agent_template_slug;

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
          .eq('call_id', call_id)
          .single();
        const callLogId = callLogData?.id;

        const contactName = contactId
          ? await getContactName(contactId)
          : to || 'Unknown';

        // ---- AI-POWERED INTENT ANALYSIS ----
        // Replaces keyword-based detection with semantic GPT-4o-mini analysis
        const transcript = concatenated_transcript || '';
        let intentResult;

        if (templateSlug && transcript.length > 10) {
          try {
            intentResult = await analyzeCallIntent(templateSlug, transcript, {
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
                  },
                })
                .eq('id', callLogId);
            }
          } catch (aiError) {
            console.error('[webhook] AI intent analysis failed (non-fatal):', aiError);
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

          if (appointmentConfirmed && metadata?.calendar_event_id) {
            // Update calendar event title with confirmation status
            await supabaseAdmin
              .from('calendar_events')
              .update({
                confirmation_status: 'confirmed',
                title: `Confirmed: ${contactName}`,
                ai_notes: apptResult?.summary || summary || null,
              })
              .eq('id', metadata.calendar_event_id);

            await syncConfirmAppointment({
              companyId,
              eventId: metadata.calendar_event_id,
              contactId,
              agentRunId,
              callLogId,
              agentName: metadata?.agent_name,
            });

            // Store extracted data in contact custom_fields
            if (apptResult?.extractedData && Object.keys(apptResult.extractedData).length > 0) {
              const { data: contactData } = await supabaseAdmin
                .from('contacts')
                .select('custom_fields')
                .eq('id', contactId)
                .single();
              const cf = (contactData?.custom_fields as Record<string, unknown>) || {};
              await supabaseAdmin
                .from('contacts')
                .update({
                  custom_fields: { ...cf, ...apptResult.extractedData, ai_sentiment: apptResult.patientSentiment },
                })
                .eq('id', contactId);
            }

            dispatchWebhookEvent(companyId, 'appointment.confirmed', {
              event_id: metadata.calendar_event_id,
              contact_id: contactId,
              contact_name: contactName,
              agent_name: metadata?.agent_name,
              ai_confidence: apptResult?.confidence,
            }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
          } else if (needsReschedule && metadata?.calendar_event_id) {
            // Use AI-extracted time, then metadata, then null (requires manual)
            const newStart = apptResult?.newAppointmentTime || metadata?.new_appointment_time;
            const duration = calendarConfig.defaultMeetingDuration || 30;
            if (newStart) {
              const newEnd = new Date(new Date(newStart as string).getTime() + duration * 60000).toISOString();
              await syncRescheduleAppointment({
                companyId,
                eventId: metadata.calendar_event_id,
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
                .eq('id', metadata.calendar_event_id);

              dispatchWebhookEvent(companyId, 'appointment.rescheduled', {
                event_id: metadata.calendar_event_id,
                contact_id: contactId,
                contact_name: contactName,
                new_start: newStart,
                new_end: newEnd,
                reason: apptResult?.rescheduleReason || 'Contact requested reschedule',
                ai_confidence: apptResult?.confidence,
              }).catch((err) => console.warn('Webhook dispatch failed (non-fatal):', err?.message));
            }
          } else if (isNoShow && metadata?.calendar_event_id) {
            await supabaseAdmin
              .from('calendar_events')
              .update({
                title: `No-Show: ${contactName}`,
                confirmation_status: 'no_response',
              })
              .eq('id', metadata.calendar_event_id);

            await syncHandleNoShow({
              companyId,
              eventId: metadata.calendar_event_id,
              contactId,
              agentRunId,
              callLogId,
              calendarConfig,
              agentName: metadata?.agent_name,
            });
            dispatchWebhookEvent(companyId, 'appointment.no_show', {
              event_id: metadata.calendar_event_id,
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
              .eq('id', contactId);
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
              .eq('id', contactId);
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

    // Unlock the contact after all processing is complete
    if (contactId) {
      try {
        const { data: unlockContact } = await supabaseAdmin
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .single();
        const unlockCf = (unlockContact?.custom_fields as Record<string, unknown>) || {};
        // Remove lock fields
        const { _locked, _locked_at, _locked_by, _lock_call_id, ...restFields } = unlockCf;
        await supabaseAdmin
          .from('contacts')
          .update({ custom_fields: JSON.parse(JSON.stringify(restFields)) })
          .eq('id', contactId);
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
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function getContactName(contactId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('contact_name, phone_number')
    .eq('id', contactId)
    .maybeSingle();
  return data?.contact_name || data?.phone_number || 'Unknown';
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Bland AI webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}