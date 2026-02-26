// app/api/integrations/salesforce/callback/route.ts
// Handles the Salesforce OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { exchangeSalesforceCode, getSalesforceUserInfo } from '@/lib/salesforce';

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

    // Decode state parameter
    let stateData: { user_id: string; company_id: string; return_to?: string };
    try {
      stateData = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf-8')
      );
    } catch {
      return NextResponse.redirect(
        new URL('/integrations?error=salesforce_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id, return_to } = stateData;
    const redirectBase = return_to || '/integrations';

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
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
