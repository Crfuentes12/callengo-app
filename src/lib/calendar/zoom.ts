// lib/calendar/zoom.ts
// Zoom Meeting API service - Server-to-Server OAuth (account_credentials flow)
// Uses ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID env vars

import axios from 'axios';
import type { ZoomTokenResponse, ZoomMeeting, CalendarEvent } from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

function getZoomConfig() {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  if (!clientId || !clientSecret || !accountId) {
    throw new Error('Missing ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, or ZOOM_ACCOUNT_ID environment variables');
  }
  return { clientId, clientSecret, accountId };
}

/**
 * Build the Base64-encoded Basic Auth header for Zoom OAuth token requests.
 */
function getBasicAuthHeader(): string {
  const { clientId, clientSecret } = getZoomConfig();
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// ============================================================================
// TOKEN MANAGEMENT (Server-to-Server OAuth)
// ============================================================================

// In-memory token cache — avoids hitting Zoom's token endpoint on every request
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid Zoom access token using the Server-to-Server OAuth flow.
 *
 * Uses the account_credentials grant type with the Account ID.
 * Tokens are cached in memory and refreshed automatically when expired.
 *
 * Returns null if Zoom env vars are not configured.
 */
export async function getZoomAccessToken(): Promise<string | null> {
  // Check if env vars are configured
  try {
    getZoomConfig();
  } catch {
    return null;
  }

  // Return cached token if still valid (5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const { accountId } = getZoomConfig();

  try {
    const response = await axios.post<ZoomTokenResponse>(
      ZOOM_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${getBasicAuthHeader()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    cachedToken = {
      token: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000,
    };

    return cachedToken.token;
  } catch (err) {
    console.error('Failed to get Zoom Server-to-Server token:', err);
    cachedToken = null;
    return null;
  }
}

/**
 * Verify that Zoom Server-to-Server credentials are valid.
 * Returns user info if successful, null otherwise.
 */
export async function verifyZoomCredentials(): Promise<{
  email: string | null;
  id: string | null;
} | null> {
  const token = await getZoomAccessToken();
  if (!token) return null;

  try {
    const response = await axios.get<{ id: string; email: string }>(
      `${ZOOM_API_BASE}/users/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return {
      email: response.data.email || null,
      id: response.data.id || null,
    };
  } catch (err) {
    console.error('Failed to verify Zoom credentials:', err);
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
