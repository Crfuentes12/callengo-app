// lib/calendar/zoom.ts
// Zoom Meeting API service - handles OAuth, meeting CRUD, and token management

import axios from 'axios';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type { ZoomTokenResponse, ZoomMeeting, CalendarEvent } from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

const ZOOM_SCOPES = ['meeting:write', 'meeting:read', 'user:read'];

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

function getZoomConfig() {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/zoom/callback`,
  };
}

/**
 * Build the Base64-encoded Basic Auth header for Zoom OAuth token requests.
 */
function getBasicAuthHeader(): string {
  const { clientId, clientSecret } = getZoomConfig();
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Zoom OAuth authorization URL.
 * The user will be redirected here to grant access.
 */
export function getZoomAuthUrl(state: string): string {
  const { clientId, redirectUri } = getZoomConfig();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  return `${ZOOM_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeZoomCode(code: string): Promise<ZoomTokenResponse> {
  const { redirectUri } = getZoomConfig();

  const response = await axios.post<ZoomTokenResponse>(
    ZOOM_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${getBasicAuthHeader()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Zoom access token using the refresh token.
 */
export async function refreshZoomToken(refreshToken: string): Promise<ZoomTokenResponse> {
  const response = await axios.post<ZoomTokenResponse>(
    ZOOM_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${getBasicAuthHeader()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

/**
 * Get a valid Zoom access token for a company.
 * Reads stored credentials from company_settings and automatically
 * refreshes the token if it has expired.
 *
 * Returns null if no Zoom credentials are stored for the company.
 */
export async function getZoomAccessToken(companyId: string): Promise<string | null> {
  const { data: settings, error } = await supabaseAdmin
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !settings) {
    console.error('Failed to fetch company settings for Zoom token:', error);
    return null;
  }

  const accessToken = settings.zoom_access_token as string | null;
  const refreshToken = settings.zoom_refresh_token as string | null;
  const expiresAt = settings.zoom_token_expires_at as string | null;

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  const isExpired = expiresAt
    ? new Date(expiresAt).getTime() < Date.now() + 5 * 60 * 1000
    : true;

  if (!isExpired) {
    return accessToken;
  }

  // Token is expired - refresh it
  try {
    const tokens = await refreshZoomToken(refreshToken);

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from('company_settings')
      .update({
        zoom_access_token: tokens.access_token,
        zoom_refresh_token: tokens.refresh_token,
        zoom_token_expires_at: newExpiresAt,
      })
      .eq('company_id', companyId);

    return tokens.access_token;
  } catch (err) {
    console.error('Failed to refresh Zoom token for company:', companyId, err);

    // Clear stale tokens so the user knows to reconnect
    await supabaseAdmin
      .from('company_settings')
      .update({
        zoom_access_token: null,
        zoom_refresh_token: null,
        zoom_token_expires_at: null,
      })
      .eq('company_id', companyId);

    return null;
  }
}

// ============================================================================
// MEETING OPERATIONS
// ============================================================================

/**
 * Create a Zoom meeting from a CalendarEvent.
 *
 * Duration is computed from the event start/end times.
 * Meeting settings default to: join_before_host, no waiting room, mute on entry.
 */
export async function createZoomMeeting(
  accessToken: string,
  event: CalendarEvent
): Promise<ZoomMeeting> {
  const startMs = new Date(event.start_time).getTime();
  const endMs = new Date(event.end_time).getTime();
  const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

  const response = await axios.post<ZoomMeeting>(
    `${ZOOM_API_BASE}/users/me/meetings`,
    {
      topic: event.title,
      type: 2, // Scheduled meeting
      start_time: event.start_time,
      duration: durationMinutes,
      timezone: event.timezone || 'UTC',
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        host_video: true,
        participant_video: true,
        auto_recording: 'none',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Retrieve details for an existing Zoom meeting.
 */
export async function getZoomMeeting(
  accessToken: string,
  meetingId: number
): Promise<ZoomMeeting> {
  const response = await axios.get<ZoomMeeting>(
    `${ZOOM_API_BASE}/meetings/${meetingId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}

/**
 * Update an existing Zoom meeting with partial data.
 * Only the fields provided will be updated.
 */
export async function updateZoomMeeting(
  accessToken: string,
  meetingId: number,
  updates: Partial<{
    topic: string;
    start_time: string;
    duration: number;
    timezone: string;
    settings: Partial<ZoomMeeting['settings']>;
  }>
): Promise<void> {
  await axios.patch(
    `${ZOOM_API_BASE}/meetings/${meetingId}`,
    updates,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Delete (cancel) a Zoom meeting.
 */
export async function deleteZoomMeeting(
  accessToken: string,
  meetingId: number
): Promise<void> {
  await axios.delete(
    `${ZOOM_API_BASE}/meetings/${meetingId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}
