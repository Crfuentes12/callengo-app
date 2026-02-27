// lib/hubspot/auth.ts
// HubSpot OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  HubSpotIntegration,
  HubSpotTokenResponse,
  HubSpotUserInfo,
} from '@/types/hubspot';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

export function getHubSpotConfig() {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/hubspot/callback`,
  };
}

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_TOKEN_INFO_URL = 'https://api.hubapi.com/oauth/v1/access-tokens';

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.objects.owners.read',
  'crm.lists.read',
  'oauth',
];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the HubSpot OAuth consent URL
 */
export function getHubSpotAuthUrl(state: string): string {
  const { clientId, redirectUri } = getHubSpotConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  });
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeHubSpotCode(code: string): Promise<HubSpotTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getHubSpotConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<HubSpotTokenResponse>;
}

/**
 * Get HubSpot token info (user/portal details) from the access token
 */
export async function getHubSpotTokenInfo(
  accessToken: string
): Promise<HubSpotUserInfo> {
  const res = await fetch(`${HUBSPOT_TOKEN_INFO_URL}/${accessToken}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch HubSpot token info: ${res.status}`);
  }

  return res.json() as Promise<HubSpotUserInfo>;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired HubSpot access token
 */
export async function refreshHubSpotToken(
  integration: HubSpotIntegration
): Promise<{ access_token: string; expires_at: string }> {
  const { clientId, clientSecret } = getHubSpotConfig();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refresh_token,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    // Mark integration as inactive if refresh fails
    await supabaseAdmin
      .from('hubspot_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('HubSpot token refresh failed. Please reconnect.');
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const newRefreshToken = data.refresh_token as string;
  const expiresIn = data.expires_in as number; // seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update tokens in DB
  await supabaseAdmin
    .from('hubspot_integrations')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { access_token: newAccessToken, expires_at: expiresAt };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for HubSpot REST API.
 * Automatically refreshes tokens when they expire (401).
 */
export async function getHubSpotClient(integration: HubSpotIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}> {
  let accessToken = integration.access_token;

  // Check if token is about to expire (within 5 minutes)
  if (integration.expires_at) {
    const expiresAt = new Date(integration.expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now < 5 * 60 * 1000) {
      const refreshed = await refreshHubSpotToken(integration);
      accessToken = refreshed.access_token;
    }
  }

  const baseUrl = 'https://api.hubapi.com';

  const hsFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    // If 401, try refreshing the token once
    if (res.status === 401) {
      const refreshed = await refreshHubSpotToken(integration);
      accessToken = refreshed.access_token;

      const retryUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
      return fetch(retryUrl, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    }

    return res;
  };

  return { fetch: hsFetch };
}
