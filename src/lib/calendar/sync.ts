// lib/calendar/sync.ts
// Calendar sync manager - orchestrates sync between Callengo and external calendars

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { syncGoogleCalendarToCallengo, pushEventToGoogle } from './google';
import type { CalendarIntegration, CalendarEvent, CalendarProvider } from '@/types/calendar';

// ============================================================================
// SYNC ORCHESTRATION
// ============================================================================

/**
 * Get all active integrations for a company
 */
export async function getActiveIntegrations(
  companyId: string,
  provider?: CalendarProvider
): Promise<CalendarIntegration[]> {
  let query = supabaseAdmin
    .from('calendar_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching integrations:', error);
    return [];
  }

  return (data || []) as unknown as CalendarIntegration[];
}

/**
 * Get a specific integration by ID
 */
export async function getIntegration(
  integrationId: string
): Promise<CalendarIntegration | null> {
  const { data, error } = await supabaseAdmin
    .from('calendar_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (error) {
    console.error('Error fetching integration:', error);
    return null;
  }

  return data as unknown as CalendarIntegration;
}

/**
 * Run a full sync for a specific integration
 */
export async function runSync(
  integrationId: string
): Promise<{
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  error?: string;
}> {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    return { success: false, created: 0, updated: 0, deleted: 0, error: 'Integration not found' };
  }

  if (!integration.is_active) {
    return { success: false, created: 0, updated: 0, deleted: 0, error: 'Integration is not active' };
  }

  // Create sync log entry
  const { data: syncLog } = await supabaseAdmin
    .from('calendar_sync_log')
    .insert({
      company_id: integration.company_id,
      integration_id: integration.id,
      sync_type: integration.sync_token ? 'incremental' : 'full',
      sync_direction: 'inbound',
      status: 'running',
    })
    .select('id')
    .single();

  try {
    let result: { created: number; updated: number; deleted: number };

    switch (integration.provider) {
      case 'google_calendar':
        result = await syncGoogleCalendarToCallengo(integration);
        break;
      case 'microsoft_outlook': {
        const { syncMicrosoftToCallengo } = await import('./microsoft');
        result = await syncMicrosoftToCallengo(integration);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${integration.provider}`);
    }

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('calendar_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          events_created: result.created,
          events_updated: result.updated,
          events_deleted: result.deleted,
        })
        .eq('id', syncLog.id);
    }

    // Update last_synced_at on the integration record
    await supabaseAdmin
      .from('calendar_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integrationId);

    return { success: true, ...result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('calendar_sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', syncLog.id);
    }

    return { success: false, created: 0, updated: 0, deleted: 0, error: errorMessage };
  }
}

/**
 * Run sync for all active integrations of a company
 */
export async function runSyncAll(
  companyId: string
): Promise<{ results: Array<{ provider: string; success: boolean; error?: string }> }> {
  const integrations = await getActiveIntegrations(companyId);
  const results = [];

  for (const integration of integrations) {
    const result = await runSync(integration.id);
    results.push({
      provider: integration.provider,
      success: result.success,
      error: result.error,
    });
  }

  return { results };
}

// ============================================================================
// EVENT OPERATIONS (Create/Update/Delete with sync)
// ============================================================================

/**
 * Create a calendar event in Callengo and optionally push to external calendars
 */
export async function createCalendarEvent(
  companyId: string,
  eventData: Partial<CalendarEvent> & {
    title: string;
    start_time: string;
    end_time: string;
  },
  options: {
    syncToGoogle?: boolean;
    syncToMicrosoft?: boolean;
  } = {}
): Promise<CalendarEvent | null> {
  // Insert event into database
  const { data: event, error } = await supabaseAdmin
    .from('calendar_events')
    .insert({
      company_id: companyId,
      title: eventData.title,
      description: eventData.description || null,
      location: eventData.location || null,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      timezone: eventData.timezone || 'UTC',
      all_day: eventData.all_day || false,
      event_type: eventData.event_type || 'meeting',
      status: eventData.status || 'scheduled',
      source: eventData.source || 'manual',
      video_link: eventData.video_link || null,
      video_provider: eventData.video_provider || null,
      contact_id: eventData.contact_id || null,
      contact_name: eventData.contact_name || null,
      contact_phone: eventData.contact_phone || null,
      contact_email: eventData.contact_email || null,
      agent_run_id: eventData.agent_run_id || null,
      call_log_id: eventData.call_log_id || null,
      follow_up_id: eventData.follow_up_id || null,
      agent_name: eventData.agent_name || null,
      ai_notes: eventData.ai_notes || null,
      notes: eventData.notes || null,
      confirmation_status: eventData.confirmation_status || 'unconfirmed',
      created_by_feature: eventData.created_by_feature || null,
      attendees: eventData.attendees || [],
      metadata: eventData.metadata || {},
      sync_status: 'pending_push',
    })
    .select('*')
    .single();

  if (error || !event) {
    console.error('Error creating calendar event:', error);
    return null;
  }

  const createdEvent = event as unknown as CalendarEvent;

  // Push to Google Calendar if requested
  if (options.syncToGoogle) {
    const googleIntegrations = await getActiveIntegrations(companyId, 'google_calendar');
    for (const integration of googleIntegrations) {
      await pushEventToGoogle(integration, createdEvent);
    }
  }

  // Push to Microsoft if requested
  if (options.syncToMicrosoft) {
    try {
      const { pushEventToMicrosoft } = await import('./microsoft');
      const msIntegrations = await getActiveIntegrations(companyId, 'microsoft_outlook');
      for (const integration of msIntegrations) {
        await pushEventToMicrosoft(integration, createdEvent);
      }
    } catch (e) {
      console.error('Failed to push to Microsoft:', e);
    }
  }

  return createdEvent;
}

/**
 * Update a calendar event and sync changes to external calendars
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEvent>,
  options: {
    syncToExternal?: boolean;
  } = { syncToExternal: true }
): Promise<CalendarEvent | null> {
  // Handle rescheduling
  if (updates.start_time || updates.end_time) {
    const { data: current } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (current && !current.original_start_time) {
      updates.original_start_time = current.start_time;
    }
    if (current) {
      updates.rescheduled_count = (current.rescheduled_count || 0) + 1;
    }
    if (updates.status !== 'cancelled') {
      updates.status = 'rescheduled';
    }
  }

  const { data: event, error } = await supabaseAdmin
    .from('calendar_events')
    .update({
      ...updates,
      sync_status: options.syncToExternal ? 'pending_push' : 'synced',
    })
    .eq('id', eventId)
    .select('*')
    .single();

  if (error || !event) {
    console.error('Error updating calendar event:', error);
    return null;
  }

  const updatedEvent = event as unknown as CalendarEvent;

  // Push to external calendars if needed
  if (options.syncToExternal && updatedEvent.external_event_id) {
    const googleIntegrations = await getActiveIntegrations(
      updatedEvent.company_id,
      'google_calendar'
    );
    for (const integration of googleIntegrations) {
      await pushEventToGoogle(integration, updatedEvent);
    }

    try {
      const { pushEventToMicrosoft } = await import('./microsoft');
      const msIntegrations = await getActiveIntegrations(
        updatedEvent.company_id,
        'microsoft_outlook'
      );
      for (const integration of msIntegrations) {
        await pushEventToMicrosoft(integration, updatedEvent);
      }
    } catch (e) {
      console.error('Failed to push update to Microsoft:', e);
    }
  }

  return updatedEvent;
}

/**
 * Cancel a calendar event and sync to external calendars
 */
export async function cancelCalendarEvent(
  eventId: string,
  reason?: string
): Promise<boolean> {
  const result = await updateCalendarEvent(eventId, {
    status: 'cancelled',
    notes: reason || undefined,
  });

  return !!result;
}

/**
 * Mark an event as no-show and optionally schedule a retry
 */
export async function markEventNoShow(
  eventId: string,
  options: {
    scheduleRetry?: boolean;
    retryDate?: string;
    retryNotes?: string;
  } = {}
): Promise<CalendarEvent | null> {
  const updated = await updateCalendarEvent(eventId, {
    status: 'no_show',
    confirmation_status: 'no_response',
  });

  if (!updated) return null;

  if (options.scheduleRetry) {
    const retryStart = options.retryDate
      ? new Date(options.retryDate)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    retryStart.setHours(10, 0, 0, 0);

    const retryEnd = new Date(retryStart);
    retryEnd.setMinutes(retryEnd.getMinutes() + 15);

    await createCalendarEvent(
      updated.company_id,
      {
        title: `No-Show Retry: ${updated.contact_name || 'Unknown'}`,
        description: `Retry call after no-show. Original event: ${updated.title}`,
        start_time: retryStart.toISOString(),
        end_time: retryEnd.toISOString(),
        timezone: updated.timezone,
        event_type: 'no_show_retry',
        status: 'scheduled',
        source: 'ai_agent',
        contact_id: updated.contact_id,
        contact_name: updated.contact_name,
        contact_phone: updated.contact_phone,
        contact_email: updated.contact_email,
        agent_name: updated.agent_name,
        notes: options.retryNotes || `Auto-scheduled retry after no-show for: ${updated.title}`,
        created_by_feature: 'appointment_confirmation',
      },
      { syncToGoogle: true, syncToMicrosoft: true }
    );
  }

  return updated;
}

/**
 * Confirm an appointment
 */
export async function confirmAppointment(
  eventId: string
): Promise<CalendarEvent | null> {
  return updateCalendarEvent(eventId, {
    status: 'confirmed',
    confirmation_status: 'confirmed',
    last_confirmation_at: new Date().toISOString(),
  });
}

/**
 * Reschedule an appointment to a new time
 */
export async function rescheduleAppointment(
  eventId: string,
  newStartTime: string,
  newEndTime: string,
  reason?: string
): Promise<CalendarEvent | null> {
  return updateCalendarEvent(eventId, {
    start_time: newStartTime,
    end_time: newEndTime,
    status: 'rescheduled',
    rescheduled_reason: reason || 'Rescheduled by user',
  });
}

// ============================================================================
// AI AGENT HELPERS
// ============================================================================

/**
 * Create a follow-up event from an AI agent action.
 */
export async function createAgentFollowUp(
  companyId: string,
  params: {
    contactId?: string;
    contactName: string;
    contactPhone?: string;
    contactEmail?: string;
    agentName: string;
    followUpDate: string;
    reason: string;
    notes?: string;
    eventType?: CalendarEvent['event_type'];
    isPremium?: boolean;
  }
): Promise<CalendarEvent | null> {
  const startTime = new Date(params.followUpDate);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 15);

  return createCalendarEvent(
    companyId,
    {
      title: `Follow-up: ${params.contactName}`,
      description: `Reason: ${params.reason}`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_type: params.eventType || 'follow_up',
      status: 'scheduled',
      source: 'ai_agent',
      contact_id: params.contactId,
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      contact_email: params.contactEmail,
      agent_name: params.agentName,
      ai_notes: params.reason,
      notes: params.notes,
      created_by_feature: params.isPremium ? 'smart_followup' : 'follow_up',
    },
    { syncToGoogle: true, syncToMicrosoft: true }
  );
}

/**
 * Create a callback event from an AI agent action.
 */
export async function createAgentCallback(
  companyId: string,
  params: {
    contactId?: string;
    contactName: string;
    contactPhone?: string;
    callbackDate: string;
    agentName: string;
    reason: 'for_callback' | 'voicemail' | 'no_answer' | 'requested';
    notes?: string;
  }
): Promise<CalendarEvent | null> {
  const startTime = new Date(params.callbackDate);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 10);

  const reasonLabels: Record<string, string> = {
    for_callback: 'Contact requested callback',
    voicemail: 'Voicemail left - follow-up call',
    no_answer: 'No answer - retry call',
    requested: 'Callback requested during call',
  };

  return createCalendarEvent(
    companyId,
    {
      title: `Callback: ${params.contactName}`,
      description: reasonLabels[params.reason] || params.reason,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_type: params.reason === 'voicemail' ? 'voicemail_followup' : 'callback',
      status: 'scheduled',
      source: 'ai_agent',
      contact_id: params.contactId,
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      agent_name: params.agentName,
      ai_notes: reasonLabels[params.reason],
      notes: params.notes,
      created_by_feature: 'callback_scheduling',
    },
    { syncToGoogle: true, syncToMicrosoft: true }
  );
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get all calendar events for a company within a date range
 */
export async function getCalendarEvents(
  companyId: string,
  options: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
    status?: string;
    source?: string;
    contactId?: string;
    limit?: number;
  } = {}
): Promise<CalendarEvent[]> {
  let query = supabaseAdmin
    .from('calendar_events')
    .select('*')
    .eq('company_id', companyId)
    .order('start_time', { ascending: true });

  if (options.startDate) {
    query = query.gte('start_time', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('end_time', options.endDate);
  }
  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }
  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.source) {
    query = query.eq('source', options.source);
  }
  if (options.contactId) {
    query = query.eq('contact_id', options.contactId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }

  return (data || []) as unknown as CalendarEvent[];
}

/**
 * Get integration status for a company (for the frontend)
 */
export async function getIntegrationStatuses(
  companyId: string
): Promise<
  Array<{
    provider: CalendarProvider;
    connected: boolean;
    email?: string;
    userName?: string;
    lastSynced?: string;
    integrationId?: string;
  }>
> {
  const integrations = await getActiveIntegrations(companyId);

  const statuses: Array<{
    provider: CalendarProvider;
    connected: boolean;
    email?: string;
    userName?: string;
    lastSynced?: string;
    integrationId?: string;
  }> = [
    { provider: 'google_calendar', connected: false },
    { provider: 'microsoft_outlook', connected: false },
  ];

  for (const integration of integrations) {
    const idx = statuses.findIndex((s) => s.provider === integration.provider);
    if (idx !== -1) {
      statuses[idx] = {
        provider: integration.provider,
        connected: true,
        email: integration.provider_email || undefined,
        userName: integration.provider_user_name || undefined,
        lastSynced: integration.last_synced_at || undefined,
        integrationId: integration.id,
      };
    }
  }

  return statuses;
}
