// app/api/integrations/google-sheets/callback/route.ts
// Handles the Google OAuth callback for Sheets integration

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeGoogleSheetsCode, getGoogleSheetsUserInfo } from '@/lib/google-sheets';
import { verifyAndDecodeState, validateReturnTo } from '@/lib/oauth-state';
import { encryptToken } from '@/lib/oauth-tokens';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Google Sheets OAuth error:', error);
      return NextResponse.redirect(
        new URL('/contacts?error=google_sheets_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/contacts?error=google_sheets_missing_params', request.url)
      );
    }

    // Decode and verify state parameter
    const stateData = verifyAndDecodeState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/contacts?error=google_sheets_invalid_state', request.url)
      );
    }

    const { user_id, company_id } = stateData;
    const return_to = validateReturnTo(stateData.return_to);
    const redirectBase = return_to;

    // ALTA-005: Verify authenticated user matches the OAuth state
    const supabaseAuth = await createServerClient();
    const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();
    if (!currentUser || currentUser.id !== user_id) {
      return NextResponse.redirect(new URL(`${return_to}?error=user_mismatch`, request.url));
    }

    // Exchange code for tokens
    const tokens = await exchangeGoogleSheetsCode(code);

    // Get user profile info
    const userInfo = await getGoogleSheetsUserInfo(tokens.access_token);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('google_sheets_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const integrationData = {
      company_id,
      user_id,
      access_token: encryptToken(tokens.access_token)!,
      refresh_token: encryptToken(tokens.refresh_token || null),
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      google_email: userInfo.email,
      google_user_id: userInfo.id || null,
      google_user_name: userInfo.name,
      is_active: true,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('google_sheets_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) throw new Error(`Failed to update integration: ${updateError.message}`);
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('google_sheets_integrations')
        .insert(integrationData);
      if (insertError) throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=google_sheets&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Google Sheets callback:', error);
    return NextResponse.redirect(
      new URL('/contacts?error=google_sheets_auth_failed', request.url)
    );
  }
}
