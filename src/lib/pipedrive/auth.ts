// lib/pipedrive/auth.ts
// Pipedrive OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  PipedriveIntegration,
  PipedriveTokenResponse,
  PipedriveUserInfo,
} from '@/types/pipedrive';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

export function getPipedriveConfig() {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing PIPEDRIVE_CLIENT_ID or PIPEDRIVE_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/pipedrive/callback`,
  };
}

const PIPEDRIVE_AUTH_URL = 'https://oauth.pipedrive.com/oauth/authorize';
const PIPEDRIVE_TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Pipedrive OAuth consent URL
 */
export function getPipedriveAuthUrl(state: string): string {
  const { clientId, redirectUri } = getPipedriveConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${PIPEDRIVE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangePipedriveCode(code: string): Promise<PipedriveTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getPipedriveConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(PIPEDRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Pipedrive token exchange failed: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<PipedriveTokenResponse>;
}

/**
 * Get Pipedrive user profile info from the API
 */
export async function getPipedriveUserInfo(
  accessToken: string,
  apiDomain: string
): Promise<PipedriveUserInfo> {
  const res = await fetch(`${apiDomain}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Pipedrive user info: ${res.status}`);
  }

  return res.json() as Promise<PipedriveUserInfo>;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Pipedrive access token
 */
export async function refreshPipedriveToken(
  integration: PipedriveIntegration
): Promise<{ access_token: string; expires_at: string; api_domain: string }> {
  const { clientId, clientSecret } = getPipedriveConfig();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(PIPEDRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    // Mark integration as inactive if refresh fails
    await supabaseAdmin
      .from('pipedrive_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Pipedrive token refresh failed. Please reconnect.');
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const newRefreshToken = data.refresh_token as string;
  const expiresIn = data.expires_in as number; // seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const apiDomain = (data.api_domain as string) || integration.api_domain || 'https://api.pipedrive.com';

  // Update tokens in DB
  await supabaseAdmin
    .from('pipedrive_integrations')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      api_domain: apiDomain,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { access_token: newAccessToken, expires_at: expiresAt, api_domain: apiDomain };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for Pipedrive REST API.
 * Automatically refreshes tokens when they expire (401) or proactively before expiry.
 */
export async function getPipedriveClient(integration: PipedriveIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  apiDomain: string;
}> {
  let accessToken = integration.access_token;
  let apiDomain = integration.api_domain || 'https://api.pipedrive.com';

  // Check if token is about to expire (within 5 minutes)
  if (integration.expires_at) {
    const expiresAt = new Date(integration.expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now < 5 * 60 * 1000) {
      const refreshed = await refreshPipedriveToken(integration);
      accessToken = refreshed.access_token;
      apiDomain = refreshed.api_domain;
    }
  }

  const pdFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${apiDomain}${path}`;
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
      const refreshed = await refreshPipedriveToken(integration);
      accessToken = refreshed.access_token;
      apiDomain = refreshed.api_domain;

      const retryUrl = path.startsWith('http') ? path : `${apiDomain}${path}`;
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

  return { fetch: pdFetch, apiDomain };
}
