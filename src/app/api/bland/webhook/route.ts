// app/api/bland/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
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
import type { CalendarStepConfig } from '@/types/calendar';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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
    } = body;

    console.log('Webhook received for call:', call_id);

    // Extract company_id and contact_id from metadata
    const companyId = metadata?.company_id;
    const contactId = metadata?.contact_id;

    if (!companyId) {
      console.error('No company_id in webhook metadata');
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    // Log the call
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
      metadata: body,
    });

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

        // ---- Appointment Confirmation Agent ----
        if (templateSlug === 'appointment-confirmation' && contactId) {
          // Check if the transcript indicates confirmation, rescheduling, or no-show
          const transcript = (concatenated_transcript || '').toLowerCase();
          const appointmentConfirmed =
            transcript.includes('confirm') ||
            transcript.includes('i\'ll be there') ||
            transcript.includes('yes') ||
            metadata?.appointment_confirmed;
          const needsReschedule =
            transcript.includes('reschedule') ||
            transcript.includes('move') ||
            transcript.includes('different time') ||
            transcript.includes('can\'t make it') ||
            metadata?.needs_reschedule;
          const isNoShow =
            metadata?.no_show ||
            (status === 'no_answer' && calendarConfig.noShowAutoRetry);

          if (appointmentConfirmed && metadata?.calendar_event_id) {
            await syncConfirmAppointment({
              companyId,
              eventId: metadata.calendar_event_id,
              contactId,
              agentRunId,
              callLogId,
              agentName: metadata?.agent_name,
            });
          } else if (needsReschedule && metadata?.calendar_event_id) {
            // Use new time from metadata if agent extracted it, otherwise use next available
            const newStart = metadata?.new_appointment_time;
            const duration = calendarConfig.defaultMeetingDuration || 30;
            if (newStart) {
              const newEnd = new Date(new Date(newStart).getTime() + duration * 60000).toISOString();
              await syncRescheduleAppointment({
                companyId,
                eventId: metadata.calendar_event_id,
                contactId,
                agentRunId,
                callLogId,
                newStartTime: newStart,
                newEndTime: newEnd,
                reason: metadata?.reschedule_reason || 'Contact requested reschedule',
                videoProvider: calendarConfig.preferredVideoProvider || 'none',
                agentName: metadata?.agent_name,
              });
            }
          } else if (isNoShow && metadata?.calendar_event_id) {
            await syncHandleNoShow({
              companyId,
              eventId: metadata.calendar_event_id,
              contactId,
              agentRunId,
              callLogId,
              calendarConfig,
              agentName: metadata?.agent_name,
            });
          }
        }

        // ---- Lead Qualification Agent ----
        if (templateSlug === 'lead-qualification' && contactId) {
          const meetingRequested =
            metadata?.meeting_scheduled ||
            metadata?.meeting_requested;

          if (meetingRequested && metadata?.meeting_time) {
            const duration = calendarConfig.defaultMeetingDuration || 30;
            const startTime = metadata.meeting_time;
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
              description: `Qualified lead meeting with ${contactName}`,
              videoProvider: calendarConfig.preferredVideoProvider || 'none',
              agentName: metadata?.agent_name,
              meetingType: 'meeting',
            });
          }
        }

        // ---- Data Validation Agent (and all agents) ----
        // Handle callback requests from any agent type
        if (contactId && (calendarConfig.callbackEnabled || calendarConfig.followUpEnabled)) {
          const callbackRequested =
            metadata?.callback_requested ||
            metadata?.for_callback;

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