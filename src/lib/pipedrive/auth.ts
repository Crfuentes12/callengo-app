// lib/pipedrive/auth.ts
// Pipedrive OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  PipedriveIntegration,
  PipedriveTokenResponse,
  PipedriveUserInfo,
} from '@/types/pipedrive';
import { getAppUrl } from '@/lib/config';

// ============================================================================
// CONFIGURATION
// ============================================================================

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
    signal: AbortSignal.timeout(10000),
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
    signal: AbortSignal.timeout(10000),
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
  // --- Race condition guard: re-read from DB to check if another request already refreshed ---
  const originalTokenIssuedAt = integration.token_issued_at;
  const { data: latestRow } = await supabaseAdmin
    .from('pipedrive_integrations')
    .select('access_token, refresh_token, expires_at, api_domain, token_issued_at')
    .eq('id', integration.id)
    .single();

  if (latestRow && latestRow.token_issued_at && originalTokenIssuedAt &&
      latestRow.token_issued_at !== originalTokenIssuedAt) {
    // Token was already refreshed by a concurrent request — use the latest token
    const latestExpiresAt = latestRow.expires_at && new Date(latestRow.expires_at).getTime() > Date.now()
      ? latestRow.expires_at : integration.expires_at ?? '';
    return {
      access_token: latestRow.access_token,
      expires_at: latestExpiresAt,
      api_domain: latestRow.api_domain ?? integration.api_domain ?? 'https://api.pipedrive.com',
    };
  }

  // Use the latest refresh_token from DB in case it was rotated
  const currentRefreshToken = latestRow?.refresh_token ?? integration.refresh_token;

  const { clientId, clientSecret } = getPipedriveConfig();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(PIPEDRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
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
  const newTokenIssuedAt = new Date().toISOString();

  // Update tokens in DB with optimistic locking on token_issued_at to prevent double-writes
  const { data: updateResult } = await supabaseAdmin
    .from('pipedrive_integrations')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      api_domain: apiDomain,
      token_issued_at: newTokenIssuedAt,
    })
    .eq('id', integration.id)
    .eq('token_issued_at', originalTokenIssuedAt ?? '')
    .select('access_token, expires_at, api_domain');

  // If optimistic lock failed (another request won the race), re-read latest token
  if (!updateResult || updateResult.length === 0) {
    const { data: fallbackRow } = await supabaseAdmin
      .from('pipedrive_integrations')
      .select('access_token, expires_at, api_domain')
      .eq('id', integration.id)
      .single();
    if (fallbackRow) {
      return {
        access_token: fallbackRow.access_token,
        expires_at: fallbackRow.expires_at ?? expiresAt,
        api_domain: fallbackRow.api_domain ?? apiDomain,
      };
    }
  }

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
    const timeoutSignal = AbortSignal.timeout(15000);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    const res = await fetch(url, {
      ...init,
      signal,
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
      const retryTimeoutSignal = AbortSignal.timeout(15000);
      const retrySignal = init?.signal
        ? AbortSignal.any([init.signal, retryTimeoutSignal])
        : retryTimeoutSignal;
      return fetch(retryUrl, {
        ...init,
        signal: retrySignal,
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
