// app/api/integrations/microsoft-outlook/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateB64 = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/calendar?error=${error}`, request.url));
    }

    if (!code || !stateB64) {
      return NextResponse.redirect(new URL('/calendar?error=missing_params', request.url));
    }

    const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
    const { userId, companyId, returnTo } = state;

    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/integrations/microsoft-outlook/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
      }),
    });

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text();
      console.error('Microsoft token exchange failed:', tokenError);
      return NextResponse.redirect(new URL(`${returnTo}?error=token_exchange_failed`, request.url));
    }

    const tokens = await tokenRes.json();

    // Get user profile
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = profileRes.ok ? await profileRes.json() : {};

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // Upsert integration
    const { error: dbError } = await supabaseAdmin
      .from('calendar_integrations')
      .upsert(
        {
          company_id: companyId,
          user_id: userId,
          provider: 'microsoft_outlook',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: expiresAt,
          provider_email: profile.mail || profile.userPrincipalName || null,
          provider_user_id: profile.id || null,
          provider_user_name: profile.displayName || null,
          microsoft_tenant_id: tenantId,
          is_active: true,
          scopes: ['Calendars.ReadWrite', 'User.Read', 'offline_access'],
          raw_profile: profile,
        },
        { onConflict: 'company_id,user_id,provider' }
      );

    if (dbError) {
      console.error('Failed to save Microsoft integration:', dbError);
      return NextResponse.redirect(new URL(`${returnTo}?error=save_failed`, request.url));
    }

    return NextResponse.redirect(
      new URL(`${returnTo}?integration=microsoft_outlook&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Microsoft callback error:', error);
    return NextResponse.redirect(new URL('/calendar?error=callback_failed', request.url));
  }
}
