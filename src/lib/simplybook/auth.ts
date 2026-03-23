// lib/simplybook/auth.ts
// SimplyBook.me authentication and API client helpers
// Uses REST API v2 with username/password token-based auth (NOT OAuth)

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { encryptToken, decryptToken } from '@/lib/encryption';
import type {
  SimplyBookIntegration,
  SimplyBookTokenResponse,
  SimplyBookUserInfo,
} from '@/types/simplybook';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SB_API_BASE = 'https://user-api-v2.simplybook.me';

export function getSimplyBookConfig() {
  return {
    apiBase: SB_API_BASE,
    adminBase: `${SB_API_BASE}/admin`,
  };
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with SimplyBook.me Admin API v2.
 * Returns a token + refresh_token pair.
 */
export async function authenticateSimplyBook(
  companyLogin: string,
  userLogin: string,
  userPassword: string
): Promise<SimplyBookTokenResponse> {
  const { adminBase } = getSimplyBookConfig();

  const res = await fetch(`${adminBase}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: companyLogin,
      login: userLogin,
      password: userPassword,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me authentication failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();

  if (data.require2fa) {
    throw new Error('SimplyBook.me 2FA is enabled. Please disable it or use an API-specific account without 2FA.');
  }

  return data as SimplyBookTokenResponse;
}

/**
 * Get current user details from SimplyBook.me Admin API
 */
export async function getSimplyBookUserInfo(
  token: string,
  companyLogin: string
): Promise<SimplyBookUserInfo> {
  const { adminBase } = getSimplyBookConfig();

  const res = await fetch(`${adminBase}/auth/current-user`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Login': companyLogin,
      'X-Token': token,
    },
  });

  // If /current-user is not available, try the getCurrentUserDetails approach
  if (!res.ok) {
    // Fall back: return minimal info from the token response
    return {
      id: 0,
      login: '',
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      company: {
        login: companyLogin,
        name: companyLogin,
        dashboard_url: `https://${companyLogin}.simplybook.me/v2/`,
        public_url: `https://${companyLogin}.simplybook.me/`,
      },
    };
  }

  return res.json() as Promise<SimplyBookUserInfo>;
}

/**
 * Get company information from SimplyBook.me
 */
export async function getSimplyBookCompanyInfo(
  token: string,
  companyLogin: string
): Promise<{ name: string; login: string; domain: string } | null> {
  const { adminBase } = getSimplyBookConfig();

  try {
    const res = await fetch(`${adminBase}/statistic`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': companyLogin,
        'X-Token': token,
      },
    });

    if (!res.ok) return null;

    // The statistic endpoint confirms the token works.
    // Company info is derived from the company login.
    return {
      name: companyLogin,
      login: companyLogin,
      domain: `${companyLogin}.simplybook.me`,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired SimplyBook.me token using refresh_token
 */
export async function refreshSimplyBookToken(
  integration: SimplyBookIntegration
): Promise<{ token: string; refresh_token: string | null; expires_at: string }> {
  const { adminBase } = getSimplyBookConfig();

  if (!integration.sb_refresh_token) {
    // No refresh token available — re-authentication required
    await supabaseAdmin
      .from('simplybook_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('SimplyBook.me refresh token not available. Please reconnect.');
  }

  const decryptedRefreshToken = decryptToken(integration.sb_refresh_token);

  const res = await fetch(`${adminBase}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: integration.sb_company_login,
      refresh_token: decryptedRefreshToken,
    }),
  });

  if (!res.ok) {
    await supabaseAdmin
      .from('simplybook_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    throw new Error('SimplyBook.me token refresh failed. Please reconnect.');
  }

  const data = await res.json();
  const newToken = data.token as string;
  const newRefreshToken = (data.refresh_token as string) || integration.sb_refresh_token;
  // SimplyBook tokens typically expire in ~24 hours; set conservative 20h window
  const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('simplybook_integrations')
    .update({
      sb_token: encryptToken(newToken),
      sb_refresh_token: encryptToken(newRefreshToken),
      token_expires_at: expiresAt,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { token: newToken, refresh_token: newRefreshToken, expires_at: expiresAt };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Get an authenticated API client (fetch wrapper) for SimplyBook.me Admin REST API v2.
 * Automatically refreshes tokens when they are near expiry or on 401.
 */
export async function getSimplyBookClient(integration: SimplyBookIntegration): Promise<{
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  companyLogin: string;
}> {
  let token = decryptToken(integration.sb_token);
  const companyLogin = integration.sb_company_login;

  // Proactively refresh if token expires within 30 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const thirtyMinFromNow = Date.now() + 30 * 60 * 1000;
    if (expiresAt < thirtyMinFromNow) {
      try {
        const refreshed = await refreshSimplyBookToken(integration);
        token = refreshed.token;
      } catch {
        // If refresh fails, try with current token anyway
      }
    }
  }

  const sbFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const { adminBase } = getSimplyBookConfig();
    const url = path.startsWith('http') ? path : `${adminBase}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': companyLogin,
        'X-Token': token,
        ...init?.headers,
      },
    });

    // On 401/403, try refreshing the token once
    if (res.status === 401 || res.status === 403) {
      try {
        const refreshed = await refreshSimplyBookToken(integration);
        token = refreshed.token;

        return fetch(url, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            'X-Company-Login': companyLogin,
            'X-Token': token,
            ...init?.headers,
          },
        });
      } catch {
        return res;
      }
    }

    return res;
  };

  return { fetch: sbFetch, companyLogin };
}
