// app/api/integrations/dynamics/callback/route.ts
// Handles the Microsoft Dynamics OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeDynamicsCode, getDynamicsUserInfo, getDynamicsOrgInfo } from '@/lib/dynamics';
import { verifyAndDecodeState, validateReturnTo } from '@/lib/oauth-state';
import { encryptToken } from '@/lib/oauth-tokens';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Dynamics OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=dynamics_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=dynamics_auth_missing_params', request.url)
      );
    }

    // Decode and verify state parameter
    const stateData = verifyAndDecodeState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/integrations?error=dynamics_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id } = stateData;
    const instance_url = stateData.instance_url as string | undefined;
    const return_to = validateReturnTo(stateData.return_to);
    const redirectBase = return_to;

    // ALTA-005: Verify authenticated user matches the OAuth state
    const supabaseAuth = await createServerClient();
    const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();
    if (!currentUser || currentUser.id !== user_id) {
      return NextResponse.redirect(new URL(`${return_to}?error=user_mismatch`, request.url));
    }

    // Exchange code for tokens
    const tokens = await exchangeDynamicsCode(code, instance_url);

    // Get user profile info via Microsoft Graph
    const userInfo = await getDynamicsUserInfo(tokens.access_token);

    // Get org info from Dynamics instance (optional, may fail if instance_url not set)
    let orgInfo = null;
    if (instance_url) {
      orgInfo = await getDynamicsOrgInfo(tokens.access_token, instance_url);
    }

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('dynamics_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const integrationData = {
      company_id,
      user_id,
      access_token: encryptToken(tokens.access_token)!,
      refresh_token: encryptToken(tokens.refresh_token || '') || '',
      token_expires_at: expiresAt,
      dynamics_user_id: String(userInfo.id),
      dynamics_user_name: userInfo.displayName || null,
      dynamics_user_email: userInfo.mail || userInfo.userPrincipalName || null,
      dynamics_org_name: orgInfo?.organizationName || null,
      dynamics_org_id: orgInfo?.id || null,
      dynamics_instance_url: instance_url || orgInfo?.instanceUrl || '',
      tenant_id: orgInfo?.tenantId || null,
      token_issued_at: new Date().toISOString(),
      is_active: true,
      scopes: null as string[] | null,
      raw_profile: { user: userInfo, org: orgInfo } as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('dynamics_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Dynamics integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('dynamics_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Dynamics integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=dynamics&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Dynamics callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=dynamics_auth_failed', request.url)
    );
  }
}
