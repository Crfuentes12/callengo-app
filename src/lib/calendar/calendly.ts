// lib/calendar/calendly.ts
// Calendly API service - handles OAuth, event sync, and webhook processing

import axios from 'axios';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  CalendarIntegration,
  CalendarEvent,
  CalendlyUser,
  CalendlyScheduledEvent,
  CalendlyInvitee,
  CalendlyTokenResponse,
  CalendlyWebhookPayload,
} from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID!;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET!;
const CALENDLY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendly/callback`;
const CALENDLY_API_BASE = 'https://api.calendly.com';
const CALENDLY_AUTH_BASE = 'https://auth.calendly.com';

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Calendly OAuth consent URL
 */
export function getCalendlyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CALENDLY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: CALENDLY_REDIRECT_URI,
    state,
  });

  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCalendlyCode(
  code: string
): Promise<CalendlyTokenResponse> {
  const response = await axios.post(
    `${CALENDLY_AUTH_BASE}/oauth/token`,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: CALENDLY_REDIRECT_URI,
      client_id: CALENDLY_CLIENT_ID,
      client_secret: CALENDLY_CLIENT_SECRET,
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data;
}

/**
 * Refresh Calendly access token
 */
export async function refreshCalendlyToken(
  refreshToken: string
): Promise<CalendlyTokenResponse> {
  const response = await axios.post(
    `${CALENDLY_AUTH_BASE}/oauth/token`,
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CALENDLY_CLIENT_ID,
      client_secret: CALENDLY_CLIENT_SECRET,
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get a valid access token for a Calendly integration.
 * Automatically refreshes if expired.
 */
async function getValidToken(
  integration: CalendarIntegration
): Promise<string> {
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  const isExpired = expiresAt < Date.now() + 5 * 60 * 1000; // 5 min buffer

  if (!isExpired) {
    return integration.access_token;
  }

  if (!integration.refresh_token) {
    throw new Error('Calendly token expired and no refresh token available. Please reconnect.');
  }

  try {
    const tokens = await refreshCalendlyToken(integration.refresh_token);

    // Update tokens in database
    await supabaseAdmin
      .from('calendar_integrations')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
      })
      .eq('id', integration.id);

    return tokens.access_token;
  } catch (error) {
    console.error('Failed to refresh Calendly token:', error);
    await supabaseAdmin
      .from('calendar_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Calendly token refresh failed. Please reconnect.');
  }
}

/**
 * Make an authenticated API call to Calendly
 */
async function calendlyApi(
  integration: CalendarIntegration,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  data?: Record<string, unknown>
) {
  const token = await getValidToken(integration);

  const response = await axios({
    method,
    url: path.startsWith('http') ? path : `${CALENDLY_API_BASE}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data,
  });

  return response.data;
}

// ============================================================================
// USER & ORGANIZATION
// ============================================================================

/**
 * Get the current Calendly user profile
 */
export async function getCalendlyCurrentUser(
  accessToken: string
): Promise<CalendlyUser> {
  const response = await axios.get(`${CALENDLY_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data.resource;
}

// ============================================================================
// SCHEDULED EVENTS
// ============================================================================

/**
 * List scheduled events from Calendly
 */
export async function listCalendlyEvents(
  integration: CalendarIntegration,
  options: {
    minStartTime?: string;
    maxStartTime?: string;
    status?: 'active' | 'canceled';
    count?: number;
    pageToken?: string;
  } = {}
): Promise<{
  events: CalendlyScheduledEvent[];
  nextPageToken?: string;
}> {
  const userUri =
    integration.provider_user_id || integration.calendly_organization_uri;
  if (!userUri) {
    throw new Error('Calendly user URI not found in integration');
  }

  const params: Record<string, string> = {
    user: integration.provider_user_id!,
    count: String(options.count || 100),
    status: options.status || 'active',
    sort: 'start_time:asc',
  };

  if (options.minStartTime) params.min_start_time = options.minStartTime;
  if (options.maxStartTime) params.max_start_time = options.maxStartTime;
  if (options.pageToken) params.page_token = options.pageToken;

  // If user belongs to an organization, also filter by organization
  if (integration.calendly_organization_uri) {
    params.organization = integration.calendly_organization_uri;
  }

  const queryString = new URLSearchParams(params).toString();

  const response = await calendlyApi(
    integration,
    'GET',
    `/scheduled_events?${queryString}`
  );

  return {
    events: response.collection || [],
    nextPageToken: response.pagination?.next_page_token || undefined,
  };
}

/**
 * Get invitees for a scheduled event
 */
export async function getCalendlyInvitees(
  integration: CalendarIntegration,
  eventUri: string
): Promise<CalendlyInvitee[]> {
  // Extract event UUID from URI
  const eventUuid = eventUri.split('/').pop();

  const response = await calendlyApi(
    integration,
    'GET',
    `/scheduled_events/${eventUuid}/invitees`
  );

  return response.collection || [];
}

/**
 * Mark a Calendly invitee as no-show
 */
export async function markCalendlyNoShow(
  integration: CalendarIntegration,
  inviteeUri: string
): Promise<void> {
  await calendlyApi(integration, 'POST', '/invitee_no_shows', {
    invitee: inviteeUri,
  });
}

// ============================================================================
// WEBHOOK MANAGEMENT
// ============================================================================

/**
 * Create a webhook subscription in Calendly
 */
export async function createCalendlyWebhook(
  integration: CalendarIntegration,
  webhookUrl: string
): Promise<string> {
  const response = await calendlyApi(
    integration,
    'POST',
    '/webhook_subscriptions',
    {
      url: webhookUrl,
      events: [
        'invitee.created',
        'invitee.canceled',
      ],
      organization: integration.calendly_organization_uri,
      user: integration.provider_user_id,
      scope: 'user',
      signing_key: process.env.CALENDLY_WEBHOOK_SIGNING_KEY || undefined,
    }
  );

  return response.resource.uri;
}

/**
 * Delete a webhook subscription from Calendly
 */
export async function deleteCalendlyWebhook(
  integration: CalendarIntegration,
  webhookUri: string
): Promise<void> {
  const webhookUuid = webhookUri.split('/').pop();
  await calendlyApi(
    integration,
    'DELETE',
    `/webhook_subscriptions/${webhookUuid}`
  );
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Sync Calendly events to Callengo
 */
export async function syncCalendlyToCallengo(
  integration: CalendarIntegration
): Promise<{
  created: number;
  updated: number;
  deleted: number;
}> {
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let nextPageToken: string | undefined;

  // Fetch events from the last 7 days to 90 days in the future
  const minStartTime = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const maxStartTime = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  do {
    const result = await listCalendlyEvents(integration, {
      minStartTime,
      maxStartTime,
      status: 'active',
      pageToken: nextPageToken,
    });

    for (const cEvent of result.events) {
      // Use Calendly event URI as external ID
      const eventUri = cEvent.uri;

      // Check if event already exists
      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id')
        .eq('external_event_id', eventUri)
        .eq('company_id', integration.company_id)
        .maybeSingle();

      // Get invitees for contact info
      let invitees: CalendlyInvitee[] = [];
      try {
        invitees = await getCalendlyInvitees(integration, eventUri);
      } catch {
        // Some events may not have invitees accessible
      }

      const eventData = calendlyEventToCalengoEvent(
        cEvent,
        invitees,
        integration
      );

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
          source: 'calendly',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        created++;
      }
    }

    nextPageToken = result.nextPageToken;
  } while (nextPageToken);

  // Also sync cancelled events
  nextPageToken = undefined;
  do {
    const result = await listCalendlyEvents(integration, {
      minStartTime,
      maxStartTime,
      status: 'canceled',
      pageToken: nextPageToken,
    });

    for (const cEvent of result.events) {
      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id')
        .eq('external_event_id', cEvent.uri)
        .eq('company_id', integration.company_id)
        .maybeSingle();

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
    }

    nextPageToken = result.nextPageToken;
  } while (nextPageToken);

  // Update last synced timestamp
  await supabaseAdmin
    .from('calendar_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integration.id);

  return { created, updated, deleted };
}

// ============================================================================
// WEBHOOK PROCESSING
// ============================================================================

/**
 * Process a Calendly webhook event
 */
export async function processCalendlyWebhook(
  payload: CalendlyWebhookPayload,
  companyId: string,
  integrationId: string
): Promise<{ action: string; eventId?: string }> {
  const { event: eventType, payload: data } = payload;

  switch (eventType) {
    case 'invitee.created': {
      // New booking - create or update calendar event
      const scheduledEvent = data.scheduled_event;
      if (!scheduledEvent) {
        return { action: 'skipped - no scheduled_event' };
      }

      // Check if this event already exists
      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id')
        .eq('external_event_id', scheduledEvent.uri)
        .eq('company_id', companyId)
        .maybeSingle();

      const eventData: Record<string, unknown> = {
        title: `${scheduledEvent.name}: ${data.name}`,
        description: buildCalendlyDescription(data),
        start_time: scheduledEvent.start_time,
        end_time: scheduledEvent.end_time,
        timezone: data.timezone || 'UTC',
        event_type: 'appointment',
        status: 'scheduled',
        source: 'calendly',
        contact_name: data.name,
        contact_email: data.email,
        external_event_id: scheduledEvent.uri,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          calendly_invitee_uri: data.uri,
          calendly_cancel_url: data.cancel_url,
          calendly_reschedule_url: data.reschedule_url,
          calendly_questions: data.questions_and_answers,
          calendly_tracking: data.tracking,
        },
      };

      // Try to match the invitee to an existing contact
      const { data: matchedContact } = await supabaseAdmin
        .from('contacts')
        .select('id, phone_number')
        .eq('company_id', companyId)
        .eq('email', data.email)
        .maybeSingle();

      if (matchedContact) {
        eventData.contact_id = matchedContact.id;
        eventData.contact_phone = matchedContact.phone_number;
      }

      if (existing) {
        await supabaseAdmin
          .from('calendar_events')
          .update(eventData)
          .eq('id', existing.id);
        return { action: 'updated', eventId: existing.id };
      } else {
        const { data: inserted } = await supabaseAdmin
          .from('calendar_events')
          .insert({
            ...eventData,
            company_id: companyId,
            integration_id: integrationId,
          })
          .select('id')
          .single();
        return { action: 'created', eventId: inserted?.id };
      }
    }

    case 'invitee.canceled': {
      // Cancellation - update event status
      const scheduledEvent = data.scheduled_event;
      if (!scheduledEvent) {
        return { action: 'skipped - no scheduled_event' };
      }

      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id')
        .eq('external_event_id', scheduledEvent.uri)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        // Check if this is a reschedule (new_invitee present)
        if (data.rescheduled && data.new_invitee) {
          await supabaseAdmin
            .from('calendar_events')
            .update({
              status: 'rescheduled',
              rescheduled_count: 1, // Will be incremented in actual implementation
              rescheduled_reason: 'Rescheduled via Calendly',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          return { action: 'rescheduled', eventId: existing.id };
        } else {
          await supabaseAdmin
            .from('calendar_events')
            .update({
              status: 'cancelled',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          return { action: 'cancelled', eventId: existing.id };
        }
      }

      return { action: 'skipped - event not found' };
    }

    default:
      return { action: `skipped - unknown event type: ${eventType}` };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a Calendly event to Callengo CalendarEvent format
 */
function calendlyEventToCalengoEvent(
  cEvent: CalendlyScheduledEvent,
  invitees: CalendlyInvitee[],
  integration: CalendarIntegration
): Partial<CalendarEvent> {
  const primaryInvitee = invitees[0];

  return {
    external_event_id: cEvent.uri,
    external_calendar_id: cEvent.event_type,
    title: primaryInvitee
      ? `${cEvent.name}: ${primaryInvitee.name}`
      : cEvent.name,
    description: primaryInvitee
      ? buildCalendlyDescription({
          name: primaryInvitee.name,
          email: primaryInvitee.email,
          questions_and_answers: primaryInvitee.questions_and_answers,
          no_show: primaryInvitee.no_show,
        })
      : null,
    location: cEvent.location?.location || cEvent.location?.join_url || null,
    start_time: cEvent.start_time,
    end_time: cEvent.end_time,
    timezone: primaryInvitee?.timezone || 'UTC',
    all_day: false,
    event_type: 'appointment',
    status: cEvent.status === 'canceled' ? 'cancelled' : 'scheduled',
    contact_name: primaryInvitee?.name || null,
    contact_email: primaryInvitee?.email || null,
    confirmation_status: primaryInvitee?.no_show
      ? 'declined'
      : 'unconfirmed',
    attendees: invitees.map((inv) => ({
      email: inv.email,
      name: inv.name,
      response_status: inv.status === 'active' ? 'accepted' as const : 'declined' as const,
    })),
    metadata: {
      calendly_event_uri: cEvent.uri,
      calendly_event_type: cEvent.event_type,
      calendly_invitees: invitees.map((inv) => ({
        uri: inv.uri,
        email: inv.email,
        name: inv.name,
        cancel_url: inv.cancel_url,
        reschedule_url: inv.reschedule_url,
      })),
      calendly_memberships: cEvent.event_memberships,
    },
  };
}

/**
 * Build description from Calendly invitee data
 */
function buildCalendlyDescription(data: {
  name: string;
  email: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
    position: number;
  }>;
  no_show?: { uri: string; created_at: string } | null;
}): string {
  const lines: string[] = [];

  lines.push(`[Calendly Booking]`);
  lines.push(`Invitee: ${data.name}`);
  lines.push(`Email: ${data.email}`);

  if (data.no_show) {
    lines.push(`Status: NO SHOW`);
  }

  if (data.questions_and_answers && data.questions_and_answers.length > 0) {
    lines.push('');
    lines.push('Responses:');
    data.questions_and_answers
      .sort((a, b) => a.position - b.position)
      .forEach((qa) => {
        lines.push(`  Q: ${qa.question}`);
        lines.push(`  A: ${qa.answer}`);
      });
  }

  lines.push('');
  lines.push('---');
  lines.push('Synced by Callengo');

  return lines.join('\n');
}
