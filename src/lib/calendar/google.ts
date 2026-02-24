// lib/calendar/google.ts
// Google Calendar API service - handles OAuth, event CRUD, and sync

import { google, calendar_v3 } from 'googleapis';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  CalendarIntegration,
  CalendarEvent,
  GoogleCalendarEvent,
  GoogleTokenResponse,
} from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
  }
  return { clientId, clientSecret, redirectUri: `${getAppUrl()}/api/integrations/google-calendar/callback` };
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Google Meet conference request ID prefix
const CONFERENCE_REQUEST_ID_PREFIX = 'callengo-meet-';

// ============================================================================
// OAUTH HELPERS
// ============================================================================

function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the Google OAuth consent URL
 */
export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // force consent to always get refresh_token
    include_granted_scopes: true,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || undefined,
    expires_in: tokens.expiry_date
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 3600,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope || SCOPES.join(' '),
  } as GoogleTokenResponse;
}

/**
 * Get Google user profile info
 */
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    email: data.email!,
    name: data.name || data.email!,
    picture: data.picture,
    id: data.id,
  };
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get an authenticated Google Calendar client for a given integration.
 * Automatically refreshes tokens if expired.
 */
export async function getGoogleCalendarClient(
  integration: CalendarIntegration
): Promise<calendar_v3.Calendar> {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime()
      : undefined,
  });

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  const isExpired = expiresAt < Date.now() + 5 * 60 * 1000;

  if (isExpired && integration.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in database
      await supabaseAdmin
        .from('calendar_integrations')
        .update({
          access_token: credentials.access_token!,
          token_expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        })
        .eq('id', integration.id);

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      // Mark integration as inactive if refresh fails
      await supabaseAdmin
        .from('calendar_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      throw new Error('Google Calendar token refresh failed. Please reconnect.');
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// ============================================================================
// EVENT OPERATIONS
// ============================================================================

/**
 * List events from Google Calendar
 */
export async function listGoogleEvents(
  integration: CalendarIntegration,
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    syncToken?: string;
    pageToken?: string;
  } = {}
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken?: string;
  nextPageToken?: string;
}> {
  const calendar = await getGoogleCalendarClient(integration);

  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: integration.google_calendar_id || 'primary',
    maxResults: options.maxResults || 250,
    singleEvents: true,
    orderBy: 'startTime',
  };

  // Use sync token for incremental sync, otherwise use time range
  if (options.syncToken) {
    params.syncToken = options.syncToken;
  } else {
    params.timeMin = options.timeMin || new Date().toISOString();
    params.timeMax =
      options.timeMax ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
  }

  if (options.pageToken) {
    params.pageToken = options.pageToken;
  }

  try {
    const response = await calendar.events.list(params);

    return {
      events: response.data.items || [],
      nextSyncToken: response.data.nextSyncToken || undefined,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: unknown) {
    // If sync token is invalid (410 Gone), do a full sync
    if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 410) {
      return listGoogleEvents(integration, {
        ...options,
        syncToken: undefined,
      });
    }
    throw error;
  }
}

/**
 * Create an event in Google Calendar.
 * - If video_provider is 'google_meet': creates a Meet conference link via Google API
 * - If video_provider is 'zoom' or 'microsoft_teams' and video_link exists: adds it to the description
 */
export async function createGoogleEvent(
  integration: CalendarIntegration,
  event: CalendarEvent
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getGoogleCalendarClient(integration);

  const googleEvent: calendar_v3.Schema$Event = {
    summary: event.title,
    description: buildEventDescription(event),
    location: event.location || undefined,
    start: event.all_day
      ? { date: event.start_time.split('T')[0] }
      : { dateTime: event.start_time, timeZone: event.timezone },
    end: event.all_day
      ? { date: event.end_time.split('T')[0] }
      : { dateTime: event.end_time, timeZone: event.timezone },
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.name,
    })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 10 },
      ],
    },
    // Add Callengo metadata as extended properties
    extendedProperties: {
      private: {
        callengo_event_id: event.id,
        callengo_type: event.event_type,
        callengo_status: event.status,
        callengo_contact_id: event.contact_id || '',
        callengo_source: event.source,
      },
    },
  };

  // Only create Google Meet conference when explicitly selected
  const wantsMeet = event.video_provider === 'google_meet';
  if (wantsMeet && !event.all_day) {
    googleEvent.conferenceData = {
      createRequest: {
        requestId: `${CONFERENCE_REQUEST_ID_PREFIX}${event.id || Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const calendarId = integration.google_calendar_id || 'primary';

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: googleEvent,
      conferenceDataVersion: wantsMeet ? 1 : 0,
      sendUpdates: 'all',
    });
    return response.data;
  } catch (err: unknown) {
    // If 404 (calendar not found), retry with 'primary'
    if (calendarId !== 'primary' && err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 404) {
      console.warn(`Google Calendar ID "${calendarId}" not found, retrying with 'primary'`);
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEvent,
        conferenceDataVersion: wantsMeet ? 1 : 0,
        sendUpdates: 'all',
      });
      return response.data;
    }
    throw err;
  }
}

/**
 * Update an event in Google Calendar
 */
export async function updateGoogleEvent(
  integration: CalendarIntegration,
  externalEventId: string,
  updates: Partial<CalendarEvent>
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getGoogleCalendarClient(integration);

  const patchData: calendar_v3.Schema$Event = {};

  if (updates.title) patchData.summary = updates.title;
  if (updates.description !== undefined)
    patchData.description = updates.description || undefined;
  if (updates.location !== undefined)
    patchData.location = updates.location || undefined;

  if (updates.start_time) {
    patchData.start = updates.all_day
      ? { date: updates.start_time.split('T')[0] }
      : { dateTime: updates.start_time, timeZone: updates.timezone || 'UTC' };
  }

  if (updates.end_time) {
    patchData.end = updates.all_day
      ? { date: updates.end_time.split('T')[0] }
      : { dateTime: updates.end_time, timeZone: updates.timezone || 'UTC' };
  }

  if (updates.status === 'cancelled') {
    patchData.status = 'cancelled';
  }

  if (updates.attendees) {
    patchData.attendees = updates.attendees.map((a) => ({
      email: a.email,
      displayName: a.name,
    }));
  }

  // Update Callengo metadata
  if (updates.status || updates.event_type) {
    patchData.extendedProperties = {
      private: {
        ...(updates.status && { callengo_status: updates.status }),
        ...(updates.event_type && { callengo_type: updates.event_type }),
      },
    };
  }

  const response = await calendar.events.patch({
    calendarId: integration.google_calendar_id || 'primary',
    eventId: externalEventId,
    requestBody: patchData,
    sendUpdates: 'all',
  });

  return response.data;
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleEvent(
  integration: CalendarIntegration,
  externalEventId: string
): Promise<void> {
  const calendar = await getGoogleCalendarClient(integration);

  await calendar.events.delete({
    calendarId: integration.google_calendar_id || 'primary',
    eventId: externalEventId,
    sendUpdates: 'all',
  });
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Full sync: Pull all events from Google Calendar into Callengo
 */
export async function syncGoogleCalendarToCallengo(
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
  let nextPageToken: string | undefined;
  let newSyncToken: string | undefined;

  do {
    const result = await listGoogleEvents(integration, {
      syncToken: integration.sync_token || undefined,
      pageToken: nextPageToken,
    });

    for (const gEvent of result.events) {
      if (!gEvent.id) continue;

      // Check if event already exists in Callengo
      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id, external_event_id')
        .eq('external_event_id', gEvent.id)
        .eq('company_id', integration.company_id)
        .maybeSingle();

      if (gEvent.status === 'cancelled') {
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

      const eventData = googleEventToCalengoEvent(gEvent, integration);

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
          source: 'google_calendar',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        created++;
      }
    }

    nextPageToken = result.nextPageToken;
    if (result.nextSyncToken) {
      newSyncToken = result.nextSyncToken;
    }
  } while (nextPageToken);

  // Update sync token for incremental sync next time
  if (newSyncToken) {
    await supabaseAdmin
      .from('calendar_integrations')
      .update({
        sync_token: newSyncToken,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', integration.id);
  }

  return { created, updated, deleted, newSyncToken };
}

/**
 * Push a Callengo event to Google Calendar.
 * Stores the Google event ID in metadata.google_event_id for independent tracking.
 */
export async function pushEventToGoogle(
  integration: CalendarIntegration,
  event: CalendarEvent
): Promise<string | null> {
  const meta = (event.metadata || {}) as Record<string, unknown>;
  const existingGoogleEventId = meta.google_event_id as string | undefined;

  try {
    if (existingGoogleEventId) {
      // Update existing Google event
      await updateGoogleEvent(integration, existingGoogleEventId, event);
      return existingGoogleEventId;
    } else {
      // Create new Google event
      const gEvent = await createGoogleEvent(integration, event);

      // Extract Google Meet link if present (only when Meet was requested)
      const meetLink = event.video_provider === 'google_meet'
        ? gEvent.conferenceData?.entryPoints?.find(
            (ep) => ep.entryPointType === 'video'
          )?.uri || null
        : null;

      // Store the Google event ID in metadata and update sync status
      const updatedMeta = { ...meta, google_event_id: gEvent.id };
      await supabaseAdmin
        .from('calendar_events')
        .update({
          external_event_id: gEvent.id,
          external_calendar_id: integration.google_calendar_id || 'primary',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          metadata: updatedMeta,
          // Only set video_link if Meet was the chosen provider and a link was generated
          ...(meetLink && { video_link: meetLink }),
        })
        .eq('id', event.id);

      return gEvent.id || null;
    }
  } catch (error) {
    console.error('Failed to push event to Google Calendar:', error);

    await supabaseAdmin
      .from('calendar_events')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', event.id);

    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a Google Calendar event to Callengo CalendarEvent format
 */
function googleEventToCalengoEvent(
  gEvent: calendar_v3.Schema$Event,
  integration: CalendarIntegration
): Partial<CalendarEvent> {
  const isAllDay = !!gEvent.start?.date;
  const startTime = isAllDay
    ? new Date(gEvent.start!.date!).toISOString()
    : gEvent.start?.dateTime || new Date().toISOString();
  const endTime = isAllDay
    ? new Date(gEvent.end!.date!).toISOString()
    : gEvent.end?.dateTime || new Date().toISOString();

  // Try to determine event type from Callengo metadata
  const callengoType =
    gEvent.extendedProperties?.private?.callengo_type || 'meeting';
  const callengoStatus =
    gEvent.extendedProperties?.private?.callengo_status || 'scheduled';

  // Extract video link from conference data
  const meetEntry = gEvent.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video'
  );
  const videoLink = meetEntry?.uri || null;
  const videoProvider = videoLink ? 'google_meet' as const : null;

  return {
    external_event_id: gEvent.id || undefined,
    external_calendar_id: integration.google_calendar_id || 'primary',
    title: gEvent.summary || 'Untitled Event',
    description: gEvent.description || null,
    location: gEvent.location || null,
    start_time: startTime,
    end_time: endTime,
    timezone: gEvent.start?.timeZone || 'UTC',
    all_day: isAllDay,
    event_type: callengoType as CalendarEvent['event_type'],
    status: callengoStatus as CalendarEvent['status'],
    video_link: videoLink,
    video_provider: videoProvider,
    attendees: (gEvent.attendees || []).map((a) => ({
      email: a.email!,
      name: a.displayName || undefined,
      response_status: a.responseStatus as CalendarEvent['attendees'][0]['response_status'],
      organizer: a.organizer || false,
    })),
    recurrence_rule: gEvent.recurrence?.[0] || null,
    recurring_event_id: gEvent.recurringEventId || null,
  };
}

/**
 * Build a descriptive text for the Google Calendar event.
 * Includes video call link when the provider is not Google Meet
 * (Meet links are handled natively via conferenceData).
 */
function buildEventDescription(event: CalendarEvent): string {
  const lines: string[] = [];

  lines.push(`[Callengo ${event.event_type.replace(/_/g, ' ').toUpperCase()}]`);

  // Include video link for non-Meet providers (Zoom, Teams)
  if (event.video_link && event.video_provider && event.video_provider !== 'google_meet') {
    const providerLabel = event.video_provider === 'zoom' ? 'Zoom' : 'Microsoft Teams';
    lines.push('');
    lines.push(`${providerLabel} Meeting: ${event.video_link}`);
  }

  if (event.contact_name) lines.push(`Contact: ${event.contact_name}`);
  if (event.contact_phone) lines.push(`Phone: ${event.contact_phone}`);
  if (event.contact_email) lines.push(`Email: ${event.contact_email}`);
  if (event.agent_name) lines.push(`Agent: ${event.agent_name}`);

  if (event.confirmation_status && event.confirmation_status !== 'unconfirmed') {
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
