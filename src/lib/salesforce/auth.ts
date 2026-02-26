// lib/salesforce/auth.ts
// Salesforce OAuth and API client helpers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  SalesforceIntegration,
  SalesforceTokenResponse,
  SalesforceUserInfo,
} from '@/types/salesforce';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

export function getSalesforceConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing SALESFORCE_CLIENT_ID or SALESFORCE_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/salesforce/callback`,
  };
}

// Default Salesforce login URL (production). Sandbox uses test.salesforce.com.
const SF_LOGIN_URL = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

const SCOPES = [
  'api',
  'refresh_token',
  'id',
  'full',
];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Salesforce OAuth consent URL
 */
export function getSalesforceAuthUrl(state: string): string {
  const { clientId, redirectUri } = getSalesforceConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
    prompt: 'login consent',
  });
  return `${SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeSalesforceCode(code: string): Promise<SalesforceTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getSalesforceConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Salesforce token exchange failed: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<SalesforceTokenResponse>;
}

/**
 * Get Salesforce user profile info from the identity URL
 */
export async function getSalesforceUserInfo(
  accessToken: string,
  identityUrl: string
): Promise<SalesforceUserInfo> {
  const res = await fetch(identityUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Salesforce user info: ${res.status}`);
  }

  return res.json() as Promise<SalesforceUserInfo>;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired Salesforce access token
 */
export async function refreshSalesforceToken(
  integration: SalesforceIntegration
): Promise<{ access_token: string; instance_url: string }> {
  const { clientId, clientSecret } = getSalesforceConfig();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refresh_token,
  });

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    // Mark integration as inactive if refresh fails
    await supabaseAdmin
      .from('salesforce_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('Salesforce token refresh failed. Please reconnect.');
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const newInstanceUrl = (data.instance_url as string) || integration.instance_url;

  // Update token in DB
  await supabaseAdmin
    .from('salesforce_integrations')
    .update({
      access_token: newAccessToken,
      instance_url: newInstanceUrl,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { access_token: newAccessToken, instance_url: newInstanceUrl };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for Salesforce REST API.
 * Automatically refreshes tokens when they expire (401).
 */
export async function getSalesforceClient(integration: SalesforceIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  instanceUrl: string;
}> {
  let accessToken = integration.access_token;
  let instanceUrl = integration.instance_url;

  const sfFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${instanceUrl}${path}`;
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
      const refreshed = await refreshSalesforceToken(integration);
      accessToken = refreshed.access_token;
      instanceUrl = refreshed.instance_url;

      const retryUrl = path.startsWith('http') ? path : `${instanceUrl}${path}`;
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

  return { fetch: sfFetch, instanceUrl };
}
