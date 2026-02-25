// lib/calendar/campaign-sync.ts
// Synchronized update system for campaign-related changes.
// When an appointment is rescheduled, a callback is created, or a no-show happens,
// this module ensures all related records across the system are updated atomically:
// - calendar_events (local + external via sync)
// - contacts (appointment date, status, custom fields)
// - call_logs (metadata updates)
// - agent_runs (campaign stats)
// - follow_up_queue (new entries or updates)

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  rescheduleAppointment,
  confirmAppointment,
  markEventNoShow,
  createAgentFollowUp,
  createAgentCallback,
} from './sync';
import { getNextAvailableSlot } from './availability';
import type { CalendarEvent, CalendarStepConfig } from '@/types/calendar';

// Re-export CalendarStepConfig for convenience
export type { CalendarStepConfig } from '@/types/calendar';

// ============================================================================
// TYPES
// ============================================================================

interface AppointmentRescheduleParams {
  companyId: string;
  eventId: string;
  contactId: string;
  agentRunId?: string;
  callLogId?: string;
  newStartTime: string;
  newEndTime: string;
  reason: string;
  videoProvider?: 'none' | 'google_meet' | 'zoom' | 'microsoft_teams';
  videoLink?: string;
  agentName?: string;
}

interface AppointmentConfirmParams {
  companyId: string;
  eventId: string;
  contactId: string;
  agentRunId?: string;
  callLogId?: string;
  agentName?: string;
}

interface NoShowParams {
  companyId: string;
  eventId: string;
  contactId: string;
  agentRunId?: string;
  callLogId?: string;
  calendarConfig?: Partial<CalendarStepConfig>;
  agentName?: string;
}

interface ScheduleMeetingParams {
  companyId: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  agentRunId?: string;
  callLogId?: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  videoProvider?: 'none' | 'google_meet' | 'zoom' | 'microsoft_teams';
  agentName?: string;
  meetingType?: 'appointment' | 'meeting' | 'callback';
}

interface ScheduleCallbackParams {
  companyId: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  agentRunId?: string;
  callLogId?: string;
  callbackDate: string;
  reason: 'for_callback' | 'voicemail' | 'no_answer' | 'requested';
  agentName?: string;
  notes?: string;
}

// ============================================================================
// APPOINTMENT OPERATIONS (Appointment Confirmation Agent)
// ============================================================================

/**
 * Reschedule an appointment and synchronize all related records.
 *
 * Updates: calendar_events, contacts, call_logs, agent_runs
 * Syncs to: Google Calendar, Microsoft Outlook
 */
export async function syncRescheduleAppointment(
  params: AppointmentRescheduleParams
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    // 1. Reschedule the calendar event (syncs to external calendars)
    const updatedEvent = await rescheduleAppointment(
      params.eventId,
      params.newStartTime,
      params.newEndTime,
      params.reason
    );

    if (!updatedEvent) {
      return { success: false, error: 'Failed to reschedule calendar event' };
    }

    // 2. Update video link if provider changed
    if (params.videoProvider && params.videoProvider !== 'none') {
      const videoUpdates: Partial<CalendarEvent> = {};
      if (params.videoLink) {
        videoUpdates.video_link = params.videoLink;
      }
      videoUpdates.video_provider = params.videoProvider as string === 'none' ? null : params.videoProvider;
      if (Object.keys(videoUpdates).length > 0) {
        await updateCalendarEvent(params.eventId, videoUpdates);
      }
    }

    // 3. Update the contact record with new appointment time
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields')
      .eq('id', params.contactId)
      .single();

    const existingFields = (contact?.custom_fields as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('contacts')
      .update({
        custom_fields: {
          ...existingFields,
          appointment_date: params.newStartTime,
          appointment_rescheduled: true,
          appointment_rescheduled_at: new Date().toISOString(),
          appointment_rescheduled_reason: params.reason,
          original_appointment_date: existingFields.appointment_date || existingFields.original_appointment_date,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.contactId);

    // 4. Update call_log if present
    if (params.callLogId) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('metadata')
        .eq('id', params.callLogId)
        .single();

      const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('call_logs')
        .update({
          metadata: {
            ...existingMeta,
            appointment_rescheduled: true,
            new_appointment_time: params.newStartTime,
            reschedule_reason: params.reason,
          },
        })
        .eq('id', params.callLogId);
    }

    // 5. Update agent_run stats if present
    if (params.agentRunId) {
      const { data: run } = await supabaseAdmin
        .from('agent_runs')
        .select('settings')
        .eq('id', params.agentRunId)
        .single();

      const runSettings = (run?.settings as Record<string, unknown>) || {};
      const rescheduleCount = ((runSettings.reschedule_count as number) || 0) + 1;
      await supabaseAdmin
        .from('agent_runs')
        .update({
          settings: { ...runSettings, reschedule_count: rescheduleCount },
        })
        .eq('id', params.agentRunId);
    }

    return { success: true, event: updatedEvent };
  } catch (error) {
    console.error('[campaign-sync] Error rescheduling appointment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Confirm an appointment and synchronize all related records.
 */
export async function syncConfirmAppointment(
  params: AppointmentConfirmParams
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    // 1. Confirm the calendar event
    const updatedEvent = await confirmAppointment(params.eventId);
    if (!updatedEvent) {
      return { success: false, error: 'Failed to confirm calendar event' };
    }

    // 2. Update the contact record
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields')
      .eq('id', params.contactId)
      .single();

    const existingFields = (contact?.custom_fields as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('contacts')
      .update({
        status: 'contacted',
        call_outcome: 'Appointment Confirmed',
        custom_fields: {
          ...existingFields,
          appointment_confirmed: true,
          appointment_confirmed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.contactId);

    // 3. Update call_log if present
    if (params.callLogId) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('metadata')
        .eq('id', params.callLogId)
        .single();

      const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('call_logs')
        .update({
          metadata: {
            ...existingMeta,
            appointment_confirmed: true,
            confirmed_at: new Date().toISOString(),
          },
        })
        .eq('id', params.callLogId);
    }

    // 4. Increment successful_calls in agent_run
    if (params.agentRunId) {
      try {
        await supabaseAdmin.rpc('increment_agent_run_stat', {
          run_id: params.agentRunId,
          stat_name: 'successful_calls',
        });
      } catch {
        // Fallback: manual increment if RPC doesn't exist
        const { data } = await supabaseAdmin
          .from('agent_runs')
          .select('successful_calls')
          .eq('id', params.agentRunId)
          .single();
        if (data) {
          await supabaseAdmin
            .from('agent_runs')
            .update({ successful_calls: (data.successful_calls || 0) + 1 })
            .eq('id', params.agentRunId);
        }
      }
    }

    return { success: true, event: updatedEvent };
  } catch (error) {
    console.error('[campaign-sync] Error confirming appointment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle a no-show and optionally schedule a retry.
 * Uses the campaign's calendar config for retry timing.
 */
export async function syncHandleNoShow(
  params: NoShowParams
): Promise<{ success: boolean; event?: CalendarEvent; retryEvent?: CalendarEvent; error?: string }> {
  try {
    const calConfig = params.calendarConfig || {};
    const shouldRetry = calConfig.noShowAutoRetry !== false;
    const retryDelayHours = calConfig.noShowRetryDelayHours || 24;

    // 1. Mark event as no-show
    const updatedEvent = await markEventNoShow(params.eventId, {
      scheduleRetry: shouldRetry,
      retryDate: shouldRetry
        ? new Date(Date.now() + retryDelayHours * 60 * 60 * 1000).toISOString()
        : undefined,
      retryNotes: `Auto-retry after no-show (delay: ${retryDelayHours}h)`,
    });

    if (!updatedEvent) {
      return { success: false, error: 'Failed to mark no-show' };
    }

    // 2. Update the contact record
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields')
      .eq('id', params.contactId)
      .single();

    const existingFields = (contact?.custom_fields as Record<string, unknown>) || {};
    const noShowCount = ((existingFields.no_show_count as number) || 0) + 1;

    await supabaseAdmin
      .from('contacts')
      .update({
        call_outcome: 'No Show',
        custom_fields: {
          ...existingFields,
          no_show: true,
          no_show_count: noShowCount,
          last_no_show_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.contactId);

    // 3. Update call_log if present
    if (params.callLogId) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('metadata')
        .eq('id', params.callLogId)
        .single();

      const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('call_logs')
        .update({
          metadata: {
            ...existingMeta,
            no_show: true,
            retry_scheduled: shouldRetry,
          },
        })
        .eq('id', params.callLogId);
    }

    return { success: true, event: updatedEvent };
  } catch (error) {
    console.error('[campaign-sync] Error handling no-show:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// MEETING SCHEDULING (Lead Qualification Agent)
// ============================================================================

/**
 * Schedule a new meeting from a lead qualification call.
 * Creates the calendar event with optional video conferencing link
 * and updates the contact record.
 */
export async function syncScheduleMeeting(
  params: ScheduleMeetingParams
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    const videoProvider = params.videoProvider !== 'none' ? params.videoProvider : null;

    // 1. Create the calendar event
    const event = await createCalendarEvent(
      params.companyId,
      {
        title: params.title,
        description: params.description || `Meeting with ${params.contactName}`,
        start_time: params.startTime,
        end_time: params.endTime,
        event_type: params.meetingType || 'meeting',
        status: 'scheduled',
        source: 'ai_agent',
        video_provider: videoProvider || undefined,
        contact_id: params.contactId,
        contact_name: params.contactName,
        contact_phone: params.contactPhone,
        contact_email: params.contactEmail,
        agent_run_id: params.agentRunId,
        call_log_id: params.callLogId,
        agent_name: params.agentName,
        created_by_feature: 'lead_qualification',
      },
      { syncToGoogle: true, syncToMicrosoft: true }
    );

    if (!event) {
      return { success: false, error: 'Failed to create calendar event' };
    }

    // 2. Update the contact record
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields')
      .eq('id', params.contactId)
      .single();

    const existingFields = (contact?.custom_fields as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('contacts')
      .update({
        status: 'qualified',
        call_outcome: 'Meeting Scheduled',
        custom_fields: {
          ...existingFields,
          meeting_scheduled: true,
          meeting_date: params.startTime,
          meeting_type: params.meetingType || 'meeting',
          video_link: event.video_link || undefined,
          video_provider: videoProvider || undefined,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.contactId);

    // 3. Update call_log if present
    if (params.callLogId) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('metadata')
        .eq('id', params.callLogId)
        .single();

      const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('call_logs')
        .update({
          metadata: {
            ...existingMeta,
            meeting_scheduled: true,
            meeting_event_id: event.id,
            meeting_date: params.startTime,
            video_link: event.video_link,
          },
        })
        .eq('id', params.callLogId);
    }

    // 4. Update agent_run stats
    if (params.agentRunId) {
      await supabaseAdmin
        .from('agent_runs')
        .select('successful_calls, settings')
        .eq('id', params.agentRunId)
        .single()
        .then(({ data }) => {
          if (data) {
            const settings = (data.settings as Record<string, unknown>) || {};
            supabaseAdmin
              .from('agent_runs')
              .update({
                successful_calls: (data.successful_calls || 0) + 1,
                settings: {
                  ...settings,
                  meetings_scheduled: ((settings.meetings_scheduled as number) || 0) + 1,
                },
              })
              .eq('id', params.agentRunId!);
          }
        });
    }

    return { success: true, event };
  } catch (error) {
    console.error('[campaign-sync] Error scheduling meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// CALLBACK SCHEDULING (All Agents)
// ============================================================================

/**
 * Schedule a callback and synchronize all records.
 * Used by all agent types when a contact needs to be called back.
 */
export async function syncScheduleCallback(
  params: ScheduleCallbackParams
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    // 1. Create the callback calendar event
    const event = await createAgentCallback(params.companyId, {
      contactId: params.contactId,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      callbackDate: params.callbackDate,
      agentName: params.agentName || 'AI Agent',
      reason: params.reason,
      notes: params.notes,
    });

    if (!event) {
      return { success: false, error: 'Failed to create callback event' };
    }

    // 2. Update the contact record
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields, call_attempts')
      .eq('id', params.contactId)
      .single();

    const existingFields = (contact?.custom_fields as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('contacts')
      .update({
        status: 'Pending',
        call_outcome: `Callback Scheduled (${params.reason})`,
        custom_fields: {
          ...existingFields,
          callback_scheduled: true,
          callback_date: params.callbackDate,
          callback_reason: params.reason,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.contactId);

    // 3. Create follow-up queue entry if agent_run is present
    if (params.agentRunId) {
      await supabaseAdmin.from('follow_up_queue').insert({
        company_id: params.companyId,
        agent_run_id: params.agentRunId,
        contact_id: params.contactId,
        original_call_id: params.callLogId || null,
        attempt_number: (contact?.call_attempts || 0) + 1,
        max_attempts: 3,
        next_attempt_at: params.callbackDate,
        status: 'pending',
        reason: params.reason,
        metadata: {
          calendar_event_id: event.id,
          scheduled_by: 'ai_agent',
        },
      });

      // Update agent_run follow-up stats
      await supabaseAdmin
        .from('agent_runs')
        .select('follow_ups_scheduled')
        .eq('id', params.agentRunId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabaseAdmin
              .from('agent_runs')
              .update({
                follow_ups_scheduled: (data.follow_ups_scheduled || 0) + 1,
              })
              .eq('id', params.agentRunId!);
          }
        });
    }

    // 4. Update call_log if present
    if (params.callLogId) {
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('metadata')
        .eq('id', params.callLogId)
        .single();

      const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('call_logs')
        .update({
          metadata: {
            ...existingMeta,
            callback_scheduled: true,
            callback_event_id: event.id,
            callback_date: params.callbackDate,
            callback_reason: params.reason,
          },
        })
        .eq('id', params.callLogId);
    }

    return { success: true, event };
  } catch (error) {
    console.error('[campaign-sync] Error scheduling callback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SMART AVAILABILITY FINDER
// ============================================================================

/**
 * Find the next available slot based on campaign calendar config.
 * Used by agents when they need to suggest alternative times.
 */
export async function findNextAvailableSlot(
  companyId: string,
  calendarConfig: Partial<CalendarStepConfig>,
  durationMinutes?: number
): Promise<{ start: string; end: string } | null> {
  const duration = durationMinutes || calendarConfig.defaultMeetingDuration || 30;

  const slot = await getNextAvailableSlot(
    companyId,
    new Date().toISOString(),
    duration,
    { maxDaysToSearch: 14 }
  );

  return slot;
}
