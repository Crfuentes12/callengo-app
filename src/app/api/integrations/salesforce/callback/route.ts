// app/api/integrations/salesforce/callback/route.ts
// Handles the Salesforce OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeSalesforceCode, getSalesforceUserInfo } from '@/lib/salesforce';
import { verifySignedState } from '@/lib/oauth-state';
import { encryptToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Salesforce OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=salesforce_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=salesforce_auth_missing_params', request.url)
      );
    }

    // Verify signed state parameter (HMAC-SHA256)
    const stateData = verifySignedState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/integrations?error=salesforce_auth_invalid_state', request.url)
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
    const tokens = await exchangeSalesforceCode(code);

    // Get user profile info from identity URL
    const userInfo = await getSalesforceUserInfo(tokens.access_token, tokens.id);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('salesforce_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const integrationData = {
      company_id,
      user_id,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      instance_url: tokens.instance_url,
      sf_org_id: userInfo.organization_id,
      sf_user_id: userInfo.user_id,
      sf_username: userInfo.username,
      sf_display_name: userInfo.display_name || null,
      sf_email: userInfo.email || null,
      token_issued_at: tokens.issued_at
        ? new Date(parseInt(tokens.issued_at)).toISOString()
        : new Date().toISOString(),
      is_active: true,
      scopes: tokens.scope ? tokens.scope.split(' ') : ['api', 'refresh_token', 'id', 'full'],
      raw_profile: userInfo as unknown as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('salesforce_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Salesforce integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('salesforce_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Salesforce integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=salesforce&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Salesforce callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=salesforce_auth_failed', request.url)
    );
  }
}
