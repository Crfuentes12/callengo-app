// lib/calendar/microsoft.ts
// Microsoft 365/Outlook Calendar API service via Microsoft Graph
// Handles OAuth, event CRUD, and sync with Callengo

import axios, { AxiosInstance } from 'axios';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  CalendarIntegration,
  CalendarEvent,
  MicrosoftCalendarEvent,
  MicrosoftTokenResponse,
} from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET environment variables'
    );
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri: `${getAppUrl()}/api/integrations/microsoft-outlook/callback`,
    authorizeEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

const SCOPES = ['Calendars.ReadWrite', 'User.Read', 'offline_access'];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Microsoft OAuth consent URL
 */
export function createMicrosoftAuthUrl(state: string): string {
  const config = getMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    prompt: 'consent', // force consent to always get refresh_token
  });

  return `${config.authorizeEndpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(
  code: string
): Promise<MicrosoftTokenResponse> {
  const config = getMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES.join(' '),
  });

  const response = await axios.post<MicrosoftTokenResponse>(
    config.tokenEndpoint,
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token || undefined,
    expires_in: response.data.expires_in || 3600,
    token_type: response.data.token_type || 'Bearer',
    scope: response.data.scope || SCOPES.join(' '),
  } as MicrosoftTokenResponse;
}

/**
 * Get Microsoft user profile info
 */
export async function getMicrosoftUserInfo(accessToken: string) {
  const response = await axios.get<{
    id: string;
    displayName: string;
    mail: string | null;
    userPrincipalName: string;
    jobTitle?: string;
  }>(`${GRAPH_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = response.data;

  return {
    email: data.mail || data.userPrincipalName,
    name: data.displayName || data.userPrincipalName,
    id: data.id,
  };
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Microsoft access token using the refresh token
 */
async function refreshMicrosoftToken(
  integration: CalendarIntegration
): Promise<{ access_token: string; expires_at: string }> {
  if (!integration.refresh_token) {
    throw new Error('No refresh token available. Please reconnect Microsoft Outlook.');
  }

  const config = getMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: integration.refresh_token,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });

  const response = await axios.post<MicrosoftTokenResponse>(
    config.tokenEndpoint,
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const newAccessToken = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update tokens in database
  const updatePayload: Record<string, unknown> = {
    access_token: newAccessToken,
    token_expires_at: expiresAt,
  };

  // Microsoft may issue a new refresh token on each refresh
  if (response.data.refresh_token) {
    updatePayload.refresh_token = response.data.refresh_token;
  }

  await supabaseAdmin
    .from('calendar_integrations')
    .update(updatePayload)
    .eq('id', integration.id);

  return { access_token: newAccessToken, expires_at: expiresAt };
}

/**
 * Get an authenticated axios client for Microsoft Graph API.
 * Automatically refreshes tokens if expired.
 */
export async function getMicrosoftCalendarClient(
  integration: CalendarIntegration
): Promise<AxiosInstance> {
  let accessToken = integration.access_token;

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  const isExpired = expiresAt < Date.now() + 5 * 60 * 1000;

  if (isExpired && integration.refresh_token) {
    try {
      const refreshed = await refreshMicrosoftToken(integration);
      accessToken = refreshed.access_token;
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error);
      // Mark integration as inactive if refresh fails
      await supabaseAdmin
        .from('calendar_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      throw new Error('Microsoft Outlook token refresh failed. Please reconnect.');
    }
  }

  return axios.create({
    baseURL: GRAPH_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

// ============================================================================
// EVENT OPERATIONS
// ============================================================================

/**
 * List events from Microsoft Outlook Calendar
 */
export async function listMicrosoftEvents(
  integration: CalendarIntegration,
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    deltaLink?: string;
    nextLink?: string;
  } = {}
): Promise<{
  events: MicrosoftCalendarEvent[];
  deltaLink?: string;
  nextLink?: string;
}> {
  const client = await getMicrosoftCalendarClient(integration);
  const calendarId = integration.microsoft_calendar_id;

  // Build the request URL
  let url: string;

  if (options.nextLink) {
    // Follow pagination link (already a full URL, use it directly)
    const response = await axios.get<{
      value: MicrosoftCalendarEvent[];
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    }>(options.nextLink, {
      headers: client.defaults.headers as Record<string, string>,
    });

    return {
      events: response.data.value || [],
      nextLink: response.data['@odata.nextLink'] || undefined,
      deltaLink: response.data['@odata.deltaLink'] || undefined,
    };
  }

  if (options.deltaLink) {
    // Use delta link for incremental sync (already a full URL)
    try {
      const response = await axios.get<{
        value: MicrosoftCalendarEvent[];
        '@odata.nextLink'?: string;
        '@odata.deltaLink'?: string;
      }>(options.deltaLink, {
        headers: client.defaults.headers as Record<string, string>,
      });

      return {
        events: response.data.value || [],
        nextLink: response.data['@odata.nextLink'] || undefined,
        deltaLink: response.data['@odata.deltaLink'] || undefined,
      };
    } catch (error: unknown) {
      // If delta token is invalid (410 Gone or 404), do a full sync
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 410 || error.response?.status === 404)
      ) {
        return listMicrosoftEvents(integration, {
          ...options,
          deltaLink: undefined,
        });
      }
      throw error;
    }
  }

  // Build calendar events endpoint
  const basePath = calendarId
    ? `/me/calendars/${calendarId}/events`
    : '/me/calendar/events';

  // Use calendarView for time-ranged queries (expands recurring events)
  const timeMin =
    options.timeMin || new Date().toISOString();
  const timeMax =
    options.timeMax ||
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

  const viewPath = calendarId
    ? `/me/calendars/${calendarId}/calendarView`
    : '/me/calendarView';

  url = viewPath;

  const params: Record<string, string> = {
    startDateTime: timeMin,
    endDateTime: timeMax,
    $top: String(options.maxResults || 250),
    $orderby: 'start/dateTime',
    $select: [
      'id',
      'subject',
      'body',
      'start',
      'end',
      'location',
      'attendees',
      'organizer',
      'onlineMeeting',
      'isOnlineMeeting',
      'onlineMeetingProvider',
      'webLink',
      'isCancelled',
      'isAllDay',
      'recurrence',
      'seriesMasterId',
      'createdDateTime',
      'lastModifiedDateTime',
    ].join(','),
  };

  const response = await client.get<{
    value: MicrosoftCalendarEvent[];
    '@odata.nextLink'?: string;
    '@odata.deltaLink'?: string;
  }>(url, { params });

  return {
    events: response.data.value || [],
    nextLink: response.data['@odata.nextLink'] || undefined,
    deltaLink: response.data['@odata.deltaLink'] || undefined,
  };
}

/**
 * Create an event in Microsoft Outlook Calendar.
 * Supports Teams meeting links via isOnlineMeeting flag.
 */
export async function createMicrosoftEvent(
  integration: CalendarIntegration,
  event: CalendarEvent
): Promise<MicrosoftCalendarEvent> {
  const client = await getMicrosoftCalendarClient(integration);
  const calendarId = integration.microsoft_calendar_id;

  const basePath = calendarId
    ? `/me/calendars/${calendarId}/events`
    : '/me/calendar/events';

  const microsoftEvent = callengoEventToMicrosoftEvent(event);

  const response = await client.post<MicrosoftCalendarEvent>(
    basePath,
    microsoftEvent
  );

  return response.data;
}

/**
 * Update an event in Microsoft Outlook Calendar
 */
export async function updateMicrosoftEvent(
  integration: CalendarIntegration,
  externalEventId: string,
  updates: Partial<CalendarEvent>
): Promise<MicrosoftCalendarEvent> {
  const client = await getMicrosoftCalendarClient(integration);

  const patchData: Record<string, unknown> = {};

  if (updates.title) {
    patchData.subject = updates.title;
  }

  if (updates.description !== undefined) {
    patchData.body = {
      contentType: 'text',
      content: updates.description || '',
    };
  }

  if (updates.location !== undefined) {
    patchData.location = {
      displayName: updates.location || '',
    };
  }

  if (updates.start_time) {
    patchData.start = updates.all_day
      ? {
          dateTime: updates.start_time.split('T')[0] + 'T00:00:00',
          timeZone: 'UTC',
        }
      : {
          dateTime: updates.start_time,
          timeZone: updates.timezone || 'UTC',
        };
  }

  if (updates.end_time) {
    patchData.end = updates.all_day
      ? {
          dateTime: updates.end_time.split('T')[0] + 'T00:00:00',
          timeZone: 'UTC',
        }
      : {
          dateTime: updates.end_time,
          timeZone: updates.timezone || 'UTC',
        };
  }

  if (updates.all_day !== undefined) {
    patchData.isAllDay = updates.all_day;
  }

  if (updates.attendees) {
    patchData.attendees = updates.attendees.map((a) => ({
      emailAddress: {
        address: a.email,
        name: a.name || undefined,
      },
      type: 'required' as const,
    }));
  }

  // Microsoft Graph uses PATCH to cancel; alternatively set showAs to 'free'
  // but typically cancellation is done via a separate cancel endpoint.
  // For status updates, we note that in extensions.
  if (updates.status || updates.event_type) {
    patchData.singleValueExtendedProperties = [
      ...(updates.status
        ? [
            {
              id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_status',
              value: updates.status,
            },
          ]
        : []),
      ...(updates.event_type
        ? [
            {
              id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_type',
              value: updates.event_type,
            },
          ]
        : []),
    ];
  }

  const response = await client.patch<MicrosoftCalendarEvent>(
    `/me/events/${externalEventId}`,
    patchData
  );

  return response.data;
}

/**
 * Delete (cancel) an event from Microsoft Outlook Calendar
 */
export async function deleteMicrosoftEvent(
  integration: CalendarIntegration,
  externalEventId: string
): Promise<void> {
  const client = await getMicrosoftCalendarClient(integration);

  await client.delete(`/me/events/${externalEventId}`);
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Full sync: Pull all events from Microsoft Outlook Calendar into Callengo.
 * Uses delta queries for incremental sync when a sync_token (deltaLink) is available.
 */
export async function syncMicrosoftToCallengo(
  integration: CalendarIntegration
): Promise<{
  created: number;
  updated: number;
  deleted: number;
  newSyncToken?: string;
}> {
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let nextLink: string | undefined;
  let newDeltaLink: string | undefined;

  do {
    const result = await listMicrosoftEvents(integration, {
      deltaLink: integration.sync_token || undefined,
      nextLink,
    });

    for (const msEvent of result.events) {
      if (!msEvent.id) continue;

      // Check if event already exists in Callengo
      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id, external_event_id')
        .eq('external_event_id', msEvent.id)
        .eq('company_id', integration.company_id)
        .maybeSingle();

      if (msEvent.isCancelled) {
        if (existing) {
          await supabaseAdmin
            .from('calendar_events')
            .update({
              status: 'cancelled',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          deleted++;
        }
        continue;
      }

      const eventData = microsoftEventToCallengoEvent(msEvent, integration);

      if (existing) {
        await supabaseAdmin
          .from('calendar_events')
          .update({
            ...eventData,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated++;
      } else {
        await supabaseAdmin.from('calendar_events').insert({
          ...eventData,
          company_id: integration.company_id,
          integration_id: integration.id,
          source: 'microsoft_outlook',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        created++;
      }
    }

    nextLink = result.nextLink;
    if (result.deltaLink) {
      newDeltaLink = result.deltaLink;
    }
  } while (nextLink);

  // Update sync token (deltaLink) for incremental sync next time
  if (newDeltaLink) {
    await supabaseAdmin
      .from('calendar_integrations')
      .update({
        sync_token: newDeltaLink,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', integration.id);
  }

  return { created, updated, deleted, newSyncToken: newDeltaLink };
}

/**
 * Push a Callengo event to Microsoft Outlook Calendar.
 * Stores the Microsoft event ID in metadata.microsoft_event_id for independent tracking.
 */
export async function pushEventToMicrosoft(
  integration: CalendarIntegration,
  event: CalendarEvent
): Promise<string | null> {
  const meta = (event.metadata || {}) as Record<string, unknown>;
  const existingMsEventId = meta.microsoft_event_id as string | undefined;

  try {
    if (existingMsEventId) {
      // Update existing Microsoft event
      await updateMicrosoftEvent(integration, existingMsEventId, event);
      return existingMsEventId;
    } else {
      // Create new Microsoft event
      const msEvent = await createMicrosoftEvent(integration, event);

      // Extract Teams link only if Teams was the chosen provider
      const teamsLink = event.video_provider === 'microsoft_teams'
        ? msEvent.onlineMeeting?.joinUrl || null
        : null;

      if (event.video_provider === 'microsoft_teams' && !teamsLink) {
        console.warn(
          'Teams meeting requested but no joinUrl returned. isOnlineMeeting:',
          msEvent.isOnlineMeeting,
          'onlineMeetingProvider:',
          msEvent.onlineMeetingProvider,
          'onlineMeeting:',
          JSON.stringify(msEvent.onlineMeeting)
        );
      }

      // Store the Microsoft event ID in metadata and update sync status
      const updatedMeta = { ...meta, microsoft_event_id: msEvent.id };
      await supabaseAdmin
        .from('calendar_events')
        .update({
          external_event_id: msEvent.id,
          external_calendar_id:
            integration.microsoft_calendar_id || 'primary',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          metadata: updatedMeta,
          // Only set video_link if Teams was the chosen provider and a link was generated
          ...(teamsLink && { video_link: teamsLink }),
        })
        .eq('id', event.id);

      return msEvent.id || null;
    }
  } catch (error) {
    console.error('Failed to push event to Microsoft Outlook:', error);

    await supabaseAdmin
      .from('calendar_events')
      .update({
        sync_status: 'error',
        sync_error:
          error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', event.id);

    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a Microsoft Graph calendar event to Callengo CalendarEvent format
 */
function microsoftEventToCallengoEvent(
  msEvent: MicrosoftCalendarEvent,
  integration: CalendarIntegration
): Partial<CalendarEvent> {
  const isAllDay = !!msEvent.isAllDay;

  // Microsoft Graph returns dateTime in the event's timeZone
  const startTime = isAllDay
    ? new Date(msEvent.start.dateTime).toISOString()
    : msEvent.start.dateTime.endsWith('Z')
      ? msEvent.start.dateTime
      : new Date(msEvent.start.dateTime + 'Z').toISOString();

  const endTime = isAllDay
    ? new Date(msEvent.end.dateTime).toISOString()
    : msEvent.end.dateTime.endsWith('Z')
      ? msEvent.end.dateTime
      : new Date(msEvent.end.dateTime + 'Z').toISOString();

  // Determine event type and status - default to 'meeting' and 'scheduled'
  const callengoType = 'meeting';
  const callengoStatus = msEvent.isCancelled ? 'cancelled' : 'scheduled';

  // Map Microsoft attendee response status to Callengo format
  const attendees = (msEvent.attendees || []).map((a) => {
    const responseStatus = mapMicrosoftResponseStatus(
      a.status?.response
    );
    const isOrganizer =
      msEvent.organizer?.emailAddress?.address === a.emailAddress.address;

    return {
      email: a.emailAddress.address,
      name: a.emailAddress.name || undefined,
      response_status: responseStatus,
      organizer: isOrganizer,
    };
  });

  // Extract video meeting link
  const videoLink = msEvent.onlineMeeting?.joinUrl || null;
  const videoProvider: CalendarEvent['video_provider'] = msEvent.isOnlineMeeting
    ? 'microsoft_teams'
    : null;

  return {
    external_event_id: msEvent.id || undefined,
    external_calendar_id:
      integration.microsoft_calendar_id || 'primary',
    title: msEvent.subject || 'Untitled Event',
    description: msEvent.body?.content || null,
    location: msEvent.location?.displayName || null,
    start_time: startTime,
    end_time: endTime,
    timezone: msEvent.start.timeZone || 'UTC',
    all_day: isAllDay,
    event_type: callengoType as CalendarEvent['event_type'],
    status: callengoStatus as CalendarEvent['status'],
    attendees,
    video_link: videoLink,
    video_provider: videoProvider,
    recurrence_rule: msEvent.recurrence
      ? JSON.stringify(msEvent.recurrence)
      : null,
    recurring_event_id: msEvent.seriesMasterId || null,
  };
}

/**
 * Convert a Callengo CalendarEvent to Microsoft Graph event format.
 * Only enables Teams meeting creation when video_provider is 'microsoft_teams'.
 */
function callengoEventToMicrosoftEvent(
  event: CalendarEvent
): Record<string, unknown> {
  const description = buildEventDescription(event);
  const wantsTeams = event.video_provider === 'microsoft_teams';

  const msEvent: Record<string, unknown> = {
    subject: event.title,
    body: {
      contentType: 'text',
      content: description,
    },
    start: event.all_day
      ? {
          dateTime: event.start_time.split('T')[0] + 'T00:00:00',
          timeZone: 'UTC',
        }
      : {
          dateTime: event.start_time,
          timeZone: event.timezone || 'UTC',
        },
    end: event.all_day
      ? {
          dateTime: event.end_time.split('T')[0] + 'T00:00:00',
          timeZone: 'UTC',
        }
      : {
          dateTime: event.end_time,
          timeZone: event.timezone || 'UTC',
        },
    isAllDay: event.all_day || false,
    // Only create Teams meeting when explicitly selected.
    // Don't specify onlineMeetingProvider — let Microsoft auto-detect
    // the correct provider for the user's account type
    // (teamsForBusiness, teamsForConsumer, etc.)
    isOnlineMeeting: wantsTeams,
    reminderMinutesBeforeStart: 10,
  };

  if (event.location) {
    msEvent.location = {
      displayName: event.location,
    };
  }

  if (event.attendees && event.attendees.length > 0) {
    msEvent.attendees = event.attendees.map((a) => ({
      emailAddress: {
        address: a.email,
        name: a.name || undefined,
      },
      type: 'required',
    }));
  }

  // Store Callengo metadata as single-value extended properties
  msEvent.singleValueExtendedProperties = [
    {
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_event_id',
      value: event.id,
    },
    {
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_type',
      value: event.event_type,
    },
    {
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_status',
      value: event.status,
    },
    {
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_contact_id',
      value: event.contact_id || '',
    },
    {
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name callengo_source',
      value: event.source,
    },
  ];

  return msEvent;
}

/**
 * Map Microsoft Graph attendee response status to Callengo format
 */
function mapMicrosoftResponseStatus(
  msStatus: string | undefined
): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
  switch (msStatus) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyAccepted':
      return 'tentative';
    case 'none':
    case 'notResponded':
    default:
      return 'needsAction';
  }
}

/**
 * Build a descriptive text for the Microsoft Outlook Calendar event.
 * Includes video call link when the provider is not Microsoft Teams
 * (Teams links are handled natively via isOnlineMeeting).
 */
function buildEventDescription(event: CalendarEvent): string {
  const lines: string[] = [];

  lines.push(`[Callengo ${event.event_type.replace(/_/g, ' ').toUpperCase()}]`);

  // Include video link for non-Teams providers (Zoom, Google Meet)
  if (event.video_link && event.video_provider && event.video_provider !== 'microsoft_teams') {
    const providerLabel = event.video_provider === 'zoom' ? 'Zoom' : 'Google Meet';
    lines.push('');
    lines.push(`${providerLabel} Meeting: ${event.video_link}`);
  }

  if (event.contact_name) lines.push(`Contact: ${event.contact_name}`);
  if (event.contact_phone) lines.push(`Phone: ${event.contact_phone}`);
  if (event.contact_email) lines.push(`Email: ${event.contact_email}`);
  if (event.agent_name) lines.push(`Agent: ${event.agent_name}`);

  if (
    event.confirmation_status &&
    event.confirmation_status !== 'unconfirmed'
  ) {
    lines.push(`Confirmation: ${event.confirmation_status}`);
  }

  if (event.notes) {
    lines.push('');
    lines.push(`Notes: ${event.notes}`);
  }

  if (event.ai_notes) {
    lines.push('');
    lines.push(`AI Notes: ${event.ai_notes}`);
  }

  if (event.description) {
    lines.push('');
    lines.push(event.description);
  }

  lines.push('');
  lines.push('---');
  lines.push('Managed by Callengo');

  return lines.join('\n');
}
