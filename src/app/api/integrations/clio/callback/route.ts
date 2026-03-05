// app/api/integrations/clio/callback/route.ts
// Handles the Clio OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { createServerClient } from '@/lib/supabase/server';
import { exchangeClioCode, getClioUserInfo } from '@/lib/clio';
import { verifyAndDecodeState, validateReturnTo } from '@/lib/oauth-state';
import { encryptToken } from '@/lib/oauth-tokens';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Clio OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=clio_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=clio_auth_missing_params', request.url)
      );
    }

    // Decode and verify state parameter
    const stateData = verifyAndDecodeState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/integrations?error=clio_auth_invalid_state', request.url)
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
    const tokens = await exchangeClioCode(code);

    // Get user profile info
    const userInfo = await getClioUserInfo(tokens.access_token);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('clio_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const integrationData = {
      company_id,
      user_id,
      access_token: encryptToken(tokens.access_token)!,
      refresh_token: encryptToken(tokens.refresh_token)!,
      token_expires_at: expiresAt,
      clio_user_id: String(userInfo.id),
      clio_user_name: userInfo.name || null,
      clio_user_email: userInfo.email || null,
      clio_subscription_type: userInfo.subscription_type || null,
      clio_firm_name: null as string | null,
      clio_firm_id: null as string | null,
      token_issued_at: new Date().toISOString(),
      is_active: true,
      scopes: null as string[] | null,
      raw_profile: userInfo as unknown as Record<string, unknown>,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('clio_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Clio integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('clio_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Failed to insert Clio integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError.message}`);
      }
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=clio&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Clio callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=clio_auth_failed', request.url)
    );
  }
}
