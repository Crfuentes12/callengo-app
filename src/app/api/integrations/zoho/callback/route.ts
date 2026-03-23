// app/api/integrations/zoho/callback/route.ts
// Handles the Zoho CRM OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeZohoCode, getZohoUserInfo, getZohoOrgInfo } from '@/lib/zoho';
import { verifySignedState } from '@/lib/oauth-state';
import { encryptToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Zoho OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=zoho_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=zoho_auth_missing_params', request.url)
      );
    }

    // Verify signed state parameter (HMAC-SHA256)
    const stateData = verifySignedState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/integrations?error=zoho_auth_invalid_state', request.url)
      );
    }

    const user_id = stateData.user_id as string;
    const company_id = stateData.company_id as string;
    const return_to = stateData.return_to as string | undefined;
    const safeReturnTo = (return_to && return_to.startsWith('/') && !return_to.startsWith('//')) ? return_to : '/integrations';
    const redirectBase = safeReturnTo;

    // ALTA-005: Verify authenticated user matches the OAuth state
    const supabaseAuth = await createServerClient();
    const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();
    if (!currentUser || currentUser.id !== user_id) {
      return NextResponse.redirect(new URL(`${safeReturnTo}?error=user_mismatch`, request.url));
    }

    // Verify company_id matches authenticated user's actual company
    const { data: userData } = await supabaseAuth.from('users').select('company_id').eq('id', currentUser.id).single();
    if (!userData || userData.company_id !== company_id) {
      return NextResponse.redirect(new URL(`${safeReturnTo}?error=company_mismatch`, request.url));
    }

    // Exchange code for tokens
    const tokens = await exchangeZohoCode(code);
    const apiDomain = tokens.api_domain || 'https://www.zohoapis.com';

    // Get user profile info
    const userInfo = await getZohoUserInfo(tokens.access_token, apiDomain);

    // Get org info (optional, may fail)
    const orgInfo = await getZohoOrgInfo(tokens.access_token, apiDomain);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('zoho_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const integrationData = {
      company_id,
      user_id,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token || ''),
      token_expires_at: expiresAt,
      zoho_user_id: String(userInfo.id),
      zoho_user_name: userInfo.full_name || null,
      zoho_user_email: userInfo.email || null,
      zoho_org_name: orgInfo?.company_name || null,
      zoho_org_id: orgInfo?.id || null,
      zoho_domain: apiDomain,
      token_issued_at: new Date().toISOString(),
      is_active: true,
      scopes: null as string[] | null,
      raw_profile: { user: userInfo, org: orgInfo } as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('zoho_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Zoho integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('zoho_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Zoho integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=zoho&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Zoho callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=zoho_auth_failed', request.url)
    );
  }
}
