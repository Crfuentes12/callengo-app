// app/api/integrations/hubspot/callback/route.ts
// Handles the HubSpot OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { exchangeHubSpotCode, getHubSpotTokenInfo } from '@/lib/hubspot';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('HubSpot OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=hubspot_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=hubspot_auth_missing_params', request.url)
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
        new URL('/integrations?error=hubspot_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id, return_to } = stateData;
    const redirectBase = return_to || '/integrations';

    // Exchange code for tokens
    const tokens = await exchangeHubSpotCode(code);

    // Get user/portal info from token
    const tokenInfo = await getHubSpotTokenInfo(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('hubspot_integrations')
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
      hub_id: String(tokenInfo.hub_id),
      hub_domain: tokenInfo.hub_domain || null,
      hs_user_id: String(tokenInfo.user_id),
      hs_user_email: tokenInfo.user || null,
      hs_display_name: tokenInfo.user || null,
      token_issued_at: new Date().toISOString(),
      is_active: true,
      scopes: tokenInfo.scopes || [],
      raw_profile: tokenInfo as unknown as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('hubspot_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update HubSpot integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('hubspot_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert HubSpot integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=hubspot&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing HubSpot callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=hubspot_auth_failed', request.url)
    );
  }
}
