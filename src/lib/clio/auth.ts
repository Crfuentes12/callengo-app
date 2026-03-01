// lib/clio/auth.ts
// Clio OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  ClioIntegration,
  ClioTokenResponse,
  ClioUserInfo,
} from '@/types/clio';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

export function getClioConfig() {
  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing CLIO_CLIENT_ID or CLIO_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/clio/callback`,
  };
}

// Clio OAuth base URL
const CLIO_AUTH_URL = 'https://app.clio.com/oauth/authorize';
const CLIO_TOKEN_URL = 'https://app.clio.com/oauth/token';
const CLIO_API_URL = 'https://app.clio.com/api/v4';

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Clio OAuth consent URL
 */
export function getClioAuthUrl(state: string): string {
  const { clientId, redirectUri } = getClioConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${CLIO_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeClioCode(code: string): Promise<ClioTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getClioConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(CLIO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Clio token exchange failed: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<ClioTokenResponse>;
}

/**
 * Get Clio user profile info
 */
export async function getClioUserInfo(accessToken: string): Promise<ClioUserInfo> {
  const res = await fetch(`${CLIO_API_URL}/users/who_am_i.json?fields=id,name,first_name,last_name,email,enabled,subscription_type,account_owner`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Clio user info: ${res.status}`);
  }

  const data = await res.json();
  return data.data as ClioUserInfo;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Clio access token
 */
export async function refreshClioToken(
  integration: ClioIntegration
): Promise<{ access_token: string; expires_at: string }> {
  const { clientId, clientSecret, redirectUri } = getClioConfig();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    refresh_token: integration.refresh_token,
  });

  const res = await fetch(CLIO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    // Mark integration as inactive if refresh fails
    await supabaseAdmin
      .from('clio_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Clio token refresh failed. Please reconnect.');
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const newRefreshToken = data.refresh_token as string;
  const expiresIn = data.expires_in as number;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update tokens in DB
  await supabaseAdmin
    .from('clio_integrations')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_at: expiresAt,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { access_token: newAccessToken, expires_at: expiresAt };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for Clio REST API.
 * Automatically refreshes tokens when they are near expiry or on 401.
 */
export async function getClioClient(integration: ClioIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}> {
  let accessToken = integration.access_token;

  // Proactively refresh if token expires within 5 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (expiresAt < fiveMinFromNow) {
      const refreshed = await refreshClioToken(integration);
      accessToken = refreshed.access_token;
    }
  }

  const clioFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${CLIO_API_URL}${path}`;
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
      const refreshed = await refreshClioToken(integration);
      accessToken = refreshed.access_token;

      const retryUrl = path.startsWith('http') ? path : `${CLIO_API_URL}${path}`;
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

  return { fetch: clioFetch };
}
