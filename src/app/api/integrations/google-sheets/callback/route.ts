// app/api/integrations/google-sheets/callback/route.ts
// Handles the Google OAuth callback for Sheets integration

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeGoogleSheetsCode, getGoogleSheetsUserInfo } from '@/lib/google-sheets';
import { verifySignedState } from '@/lib/oauth-state';

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

    // Verify signed state parameter (HMAC-SHA256)
    const stateData = verifySignedState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/contacts?error=google_sheets_invalid_state', request.url)
      );
    }

    const user_id = stateData.user_id as string;
    const company_id = stateData.company_id as string;
    const return_to = stateData.return_to as string | undefined;
    const safeReturnTo = (return_to && return_to.startsWith('/') && !return_to.startsWith('//')) ? return_to : '/contacts';
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
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
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
