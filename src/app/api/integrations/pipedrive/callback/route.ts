// app/api/integrations/pipedrive/callback/route.ts
// Handles the Pipedrive OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { exchangePipedriveCode, getPipedriveUserInfo } from '@/lib/pipedrive';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Pipedrive OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=pipedrive_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=pipedrive_auth_missing_params', request.url)
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
        new URL('/integrations?error=pipedrive_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id, return_to } = stateData;
    const redirectBase = return_to || '/integrations';

    // Exchange code for tokens
    const tokens = await exchangePipedriveCode(code);

    // Get user profile info
    const apiDomain = tokens.api_domain || 'https://api.pipedrive.com';
    const userInfo = await getPipedriveUserInfo(tokens.access_token, apiDomain);

    const pdUser = userInfo.data;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('pipedrive_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const integrationData = {
      company_id,
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      pd_company_id: String(pdUser.company_id),
      pd_company_name: pdUser.company_name || null,
      pd_company_domain: pdUser.company_domain || null,
      pd_user_id: String(pdUser.id),
      pd_user_email: pdUser.email || null,
      pd_user_name: pdUser.name || null,
      token_issued_at: new Date().toISOString(),
      is_active: true,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      raw_profile: pdUser as unknown as Record<string, unknown>,
      api_domain: apiDomain,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('pipedrive_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Pipedrive integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('pipedrive_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Pipedrive integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=pipedrive&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Pipedrive callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=pipedrive_auth_failed', request.url)
    );
  }
}
