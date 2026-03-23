// lib/dynamics/auth.ts
// Microsoft Dynamics OAuth and API client helpers
// Uses Azure AD / Microsoft Identity Platform for OAuth 2.0

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  DynamicsIntegration,
  DynamicsTokenResponse,
  DynamicsUserInfo,
  DynamicsOrgInfo,
} from '@/types/dynamics';
import { getAppUrl } from '@/lib/config';
import { encryptToken, decryptToken } from '@/lib/encryption';

// ============================================================================
// CONFIGURATION
// ============================================================================

export function getDynamicsConfig() {
  const clientId = process.env.DYNAMICS_CLIENT_ID;
  const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
  const tenantId = process.env.DYNAMICS_TENANT_ID || 'common';
  if (!clientId || !clientSecret) {
    throw new Error('Missing DYNAMICS_CLIENT_ID or DYNAMICS_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri: `${getAppUrl()}/api/integrations/dynamics/callback`,
  };
}

// Microsoft Identity Platform OAuth URLs
const getAuthUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
const getTokenUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/User.Read',
];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Microsoft OAuth consent URL.
 * The Dynamics CRM resource URL is added dynamically after we know the instance URL.
 */
export function getDynamicsAuthUrl(state: string, instanceUrl?: string): string {
  const { clientId, redirectUri, tenantId } = getDynamicsConfig();

  const scopes = [...SCOPES];
  if (instanceUrl) {
    scopes.push(`${instanceUrl.replace(/\/+$/, '')}/user_impersonation`);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    response_mode: 'query',
    prompt: 'consent',
  });
  return `${getAuthUrl(tenantId)}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeDynamicsCode(
  code: string,
  instanceUrl?: string
): Promise<DynamicsTokenResponse> {
  const { clientId, clientSecret, redirectUri, tenantId } = getDynamicsConfig();

  const scopes = [...SCOPES];
  if (instanceUrl) {
    scopes.push(`${instanceUrl.replace(/\/+$/, '')}/user_impersonation`);
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    scope: scopes.join(' '),
  });

  const res = await fetch(getTokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Dynamics token exchange failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Dynamics token exchange error: ${data.error} - ${data.error_description || ''}`);
  }

  return data as DynamicsTokenResponse;
}

/**
 * Get Microsoft Graph user profile info
 */
export async function getDynamicsUserInfo(accessToken: string): Promise<DynamicsUserInfo> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Dynamics user info: ${res.status}`);
  }

  const user = await res.json();

  return {
    id: user.id,
    displayName: user.displayName || '',
    mail: user.mail || user.userPrincipalName || null,
    userPrincipalName: user.userPrincipalName || '',
    jobTitle: user.jobTitle || null,
    officeLocation: user.officeLocation || null,
  };
}

/**
 * Get Dynamics CRM organization info via WhoAmI and organization endpoints
 */
export async function getDynamicsOrgInfo(
  accessToken: string,
  instanceUrl: string
): Promise<DynamicsOrgInfo | null> {
  try {
    const baseUrl = instanceUrl.replace(/\/+$/, '');

    // WhoAmI to get org and user IDs
    const whoAmIRes = await fetch(`${baseUrl}/api/data/v9.2/WhoAmI`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!whoAmIRes.ok) return null;

    const whoAmI = await whoAmIRes.json();
    const organizationId = whoAmI.OrganizationId;

    // Get organization details
    let orgName = '';
    let uniqueName = '';
    let version = '';
    try {
      const orgRes = await fetch(
        `${baseUrl}/api/data/v9.2/organizations(${organizationId})?$select=name,uniquename,version`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        orgName = orgData.name || '';
        uniqueName = orgData.uniquename || '';
        version = orgData.version || '';
      }
    } catch {
      // Org details are optional
    }

    return {
      id: organizationId || '',
      organizationName: orgName,
      uniqueName,
      version,
      instanceUrl: baseUrl,
      tenantId: null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Dynamics access token
 */
export async function refreshDynamicsToken(
  integration: DynamicsIntegration
): Promise<{ access_token: string; expires_at: string }> {
  // --- Race condition guard: re-read from DB to check if another request already refreshed ---
  const originalTokenIssuedAt = integration.token_issued_at;
  const { data: latestRow } = await supabaseAdmin
    .from('dynamics_integrations')
    .select('access_token, refresh_token, token_expires_at, token_issued_at')
    .eq('id', integration.id)
    .single();

  if (latestRow && latestRow.token_issued_at && originalTokenIssuedAt &&
      latestRow.token_issued_at !== originalTokenIssuedAt) {
    // Token was already refreshed by a concurrent request — use the latest token
    const latestExpiresAt = latestRow.token_expires_at && new Date(latestRow.token_expires_at).getTime() > Date.now()
      ? latestRow.token_expires_at : integration.token_expires_at ?? '';
    return {
      access_token: decryptToken(latestRow.access_token),
      expires_at: latestExpiresAt,
    };
  }

  // Use the latest refresh_token from DB in case it was rotated
  const currentRefreshToken = decryptToken(latestRow?.refresh_token ?? integration.refresh_token);

  const { clientId, clientSecret, tenantId } = getDynamicsConfig();

  const scopes = [...SCOPES];
  const instanceUrl = integration.dynamics_instance_url;
  if (instanceUrl) {
    scopes.push(`${instanceUrl.replace(/\/+$/, '')}/user_impersonation`);
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: currentRefreshToken,
    scope: scopes.join(' '),
  });

  const res = await fetch(getTokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    await supabaseAdmin
      .from('dynamics_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Dynamics token refresh failed. Please reconnect.');
  }

  const data = await res.json();

  if (data.error) {
    await supabaseAdmin
      .from('dynamics_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error(`Dynamics token refresh error: ${data.error}`);
  }

  const newAccessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const newTokenIssuedAt = new Date().toISOString();

  // Update tokens in DB with optimistic locking on token_issued_at to prevent double-writes
  const updateData: Record<string, unknown> = {
    access_token: encryptToken(newAccessToken),
    token_expires_at: expiresAt,
    token_issued_at: newTokenIssuedAt,
  };

  // If a new refresh token was provided, store it
  if (data.refresh_token) {
    updateData.refresh_token = encryptToken(data.refresh_token);
  }

  const { data: updateResult } = await supabaseAdmin
    .from('dynamics_integrations')
    .update(updateData)
    .eq('id', integration.id)
    .eq('token_issued_at', originalTokenIssuedAt ?? '')
    .select('access_token, token_expires_at');

  // If optimistic lock failed (another request won the race), re-read latest token
  if (!updateResult || updateResult.length === 0) {
    const { data: fallbackRow } = await supabaseAdmin
      .from('dynamics_integrations')
      .select('access_token, token_expires_at')
      .eq('id', integration.id)
      .single();
    if (fallbackRow) {
      return {
        access_token: decryptToken(fallbackRow.access_token),
        expires_at: fallbackRow.token_expires_at ?? expiresAt,
      };
    }
  }

  return { access_token: newAccessToken, expires_at: expiresAt };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for Dynamics CRM Web API.
 * Automatically refreshes tokens when they are near expiry or on 401.
 */
export async function getDynamicsClient(integration: DynamicsIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  instanceUrl: string;
}> {
  let accessToken = decryptToken(integration.access_token);
  const instanceUrl = integration.dynamics_instance_url.replace(/\/+$/, '');

  // Proactively refresh if token expires within 5 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (expiresAt < fiveMinFromNow) {
      const refreshed = await refreshDynamicsToken(integration);
      accessToken = refreshed.access_token;
    }
  }

  const dynamicsFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const baseUrl = `${instanceUrl}/api/data/v9.2`;
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'odata.include-annotations="*"',
        ...init?.headers,
      },
    });

    // If 401, try refreshing the token once
    if (res.status === 401) {
      const refreshed = await refreshDynamicsToken(integration);
      accessToken = refreshed.access_token;

      const retryUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
      return fetch(retryUrl, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          Prefer: 'odata.include-annotations="*"',
          ...init?.headers,
        },
      });
    }

    return res;
  };

  return { fetch: dynamicsFetch, instanceUrl };
}
