// app/api/integrations/google-calendar/callback/route.ts
// Handles the Google OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { exchangeGoogleCode, getGoogleUserInfo } from '@/lib/calendar/google';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=google_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=google_auth_missing_params', request.url)
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
        new URL('/integrations?error=google_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id, return_to } = stateData;
    const redirectBase = return_to || '/integrations';

    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);

    // Get user profile info
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('calendar_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    const integrationData = {
      company_id,
      user_id,
      provider: 'google_calendar',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      provider_email: userInfo.email,
      provider_user_id: userInfo.id || null,
      provider_user_name: userInfo.name,
      google_calendar_id: 'primary',
      is_active: true,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      raw_profile: userInfo as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('calendar_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Google Calendar integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('calendar_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Google Calendar integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    // Redirect back to origin page with success message
    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=google_calendar&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Google Calendar callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=google_auth_failed', request.url)
    );
  }
}
