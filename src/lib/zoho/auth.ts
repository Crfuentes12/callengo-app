// lib/zoho/auth.ts
// Zoho CRM OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  ZohoIntegration,
  ZohoTokenResponse,
  ZohoUserInfo,
  ZohoOrgInfo,
} from '@/types/zoho';
import { getAppUrl } from '@/lib/config';

// ============================================================================
// CONFIGURATION
// ============================================================================

export function getZohoConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/zoho/callback`,
  };
}

// Zoho OAuth URLs — use accounts.zoho.com for global
const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v5';

const SCOPES = [
  'ZohoCRM.modules.ALL',
  'ZohoCRM.settings.ALL',
  'ZohoCRM.users.ALL',
  'ZohoCRM.org.ALL',
  'ZohoCRM.notifications.ALL',
];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Zoho OAuth consent URL
 */
export function getZohoAuthUrl(state: string): string {
  const { clientId, redirectUri } = getZohoConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(','),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${ZOHO_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeZohoCode(code: string): Promise<ZohoTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getZohoConfig();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${ZOHO_TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Zoho token exchange failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Zoho token exchange error: ${data.error}`);
  }

  return data as ZohoTokenResponse;
}

/**
 * Get Zoho CRM user profile info
 */
export async function getZohoUserInfo(accessToken: string, apiDomain: string): Promise<ZohoUserInfo> {
  const res = await fetch(`${apiDomain}/crm/v5/users?type=CurrentUser`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Zoho user info: ${res.status}`);
  }

  const data = await res.json();
  const user = data.users?.[0];
  if (!user) {
    throw new Error('No user data returned from Zoho');
  }

  return {
    id: user.id,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    email: user.email,
    status: user.status || 'active',
    role: user.role || { name: '', id: '' },
    profile: user.profile || { name: '', id: '' },
  };
}

/**
 * Get Zoho CRM organization info
 */
export async function getZohoOrgInfo(accessToken: string, apiDomain: string): Promise<ZohoOrgInfo | null> {
  try {
    const res = await fetch(`${apiDomain}/crm/v5/org`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const org = data.org?.[0];
    if (!org) return null;

    return {
      id: org.id || '',
      company_name: org.company_name || '',
      alias: org.alias || null,
      primary_email: org.primary_email || null,
      domain_name: org.domain_name || null,
      time_zone: org.time_zone || null,
      currency: org.currency || null,
      country_code: org.country_code || null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Zoho access token
 */
export async function refreshZohoToken(
  integration: ZohoIntegration
): Promise<{ access_token: string; expires_at: string; api_domain: string }> {
  // --- Race condition guard: re-read from DB to check if another request already refreshed ---
  const originalTokenIssuedAt = integration.token_issued_at;
  const { data: latestRow } = await supabaseAdmin
    .from('zoho_integrations')
    .select('access_token, refresh_token, token_expires_at, zoho_domain, token_issued_at')
    .eq('id', integration.id)
    .single();

  if (latestRow && latestRow.token_issued_at && originalTokenIssuedAt &&
      latestRow.token_issued_at !== originalTokenIssuedAt) {
    // Token was already refreshed by a concurrent request — use the latest token
    const latestExpiresAt = latestRow.token_expires_at && new Date(latestRow.token_expires_at).getTime() > Date.now()
      ? latestRow.token_expires_at : integration.token_expires_at ?? '';
    return {
      access_token: latestRow.access_token,
      expires_at: latestExpiresAt,
      api_domain: latestRow.zoho_domain ?? integration.zoho_domain,
    };
  }

  // Use the latest refresh_token from DB in case it was rotated
  const currentRefreshToken = latestRow?.refresh_token ?? integration.refresh_token;

  const { clientId, clientSecret } = getZohoConfig();

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: currentRefreshToken,
  });

  const res = await fetch(`${ZOHO_TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
  });

  if (!res.ok) {
    // Mark integration as inactive if refresh fails
    await supabaseAdmin
      .from('zoho_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Zoho token refresh failed. Please reconnect.');
  }

  const data = await res.json();

  if (data.error) {
    await supabaseAdmin
      .from('zoho_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error(`Zoho token refresh error: ${data.error}`);
  }

  const newAccessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const apiDomain = (data.api_domain as string) || integration.zoho_domain;
  const newTokenIssuedAt = new Date().toISOString();

  // Update tokens in DB (store new refresh_token if Zoho returns one)
  // Use optimistic locking on token_issued_at to prevent double-writes
  const newRefreshToken = data.refresh_token as string | undefined;
  const { data: updateResult } = await supabaseAdmin
    .from('zoho_integrations')
    .update({
      access_token: newAccessToken,
      ...(newRefreshToken ? { refresh_token: newRefreshToken } : {}),
      token_expires_at: expiresAt,
      zoho_domain: apiDomain,
      token_issued_at: newTokenIssuedAt,
    })
    .eq('id', integration.id)
    .eq('token_issued_at', originalTokenIssuedAt ?? '')
    .select('access_token, token_expires_at, zoho_domain');

  // If optimistic lock failed (another request won the race), re-read latest token
  if (!updateResult || updateResult.length === 0) {
    const { data: fallbackRow } = await supabaseAdmin
      .from('zoho_integrations')
      .select('access_token, token_expires_at, zoho_domain')
      .eq('id', integration.id)
      .single();
    if (fallbackRow) {
      return {
        access_token: fallbackRow.access_token,
        expires_at: fallbackRow.token_expires_at ?? expiresAt,
        api_domain: fallbackRow.zoho_domain ?? apiDomain,
      };
    }
  }

  return { access_token: newAccessToken, expires_at: expiresAt, api_domain: apiDomain };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for Zoho CRM REST API.
 * Automatically refreshes tokens when they are near expiry or on 401.
 */
export async function getZohoClient(integration: ZohoIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  apiDomain: string;
}> {
  let accessToken = integration.access_token;
  let apiDomain = integration.zoho_domain || 'https://www.zohoapis.com';

  // Proactively refresh if token expires within 5 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (expiresAt < fiveMinFromNow) {
      const refreshed = await refreshZohoToken(integration);
      accessToken = refreshed.access_token;
      apiDomain = refreshed.api_domain;
    }
  }

  const zohoFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const baseUrl = `${apiDomain}/crm/v5`;
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    // If 401, try refreshing the token once
    if (res.status === 401) {
      const refreshed = await refreshZohoToken(integration);
      accessToken = refreshed.access_token;
      apiDomain = refreshed.api_domain;

      const retryBaseUrl = `${apiDomain}/crm/v5`;
      const retryUrl = path.startsWith('http') ? path : `${retryBaseUrl}${path}`;
      return fetch(retryUrl, {
        ...init,
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    }

    return res;
  };

  return { fetch: zohoFetch, apiDomain };
}
