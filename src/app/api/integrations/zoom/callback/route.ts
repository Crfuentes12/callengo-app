// app/api/integrations/zoom/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateB64 = request.nextUrl.searchParams.get('state');

    if (!code || !stateB64) {
      return NextResponse.redirect(new URL('/integrations?error=missing_params', request.url));
    }

    const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
    const { companyId, returnTo } = state;

    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/integrations/zoom/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text();
      console.error('Zoom token exchange failed:', tokenError);
      return NextResponse.redirect(new URL(`${returnTo}?error=token_exchange_failed`, request.url));
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userRes = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = userRes.ok ? await userRes.json() : {};

    // Store Zoom tokens in company_settings
    const { data: currentSettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', companyId)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    await supabaseAdmin
      .from('company_settings')
      .update({
        settings: {
          ...existingSettings,
          zoom_access_token: tokens.access_token,
          zoom_refresh_token: tokens.refresh_token,
          zoom_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          zoom_user_email: userInfo.email || null,
          zoom_user_id: userInfo.id || null,
          zoom_connected: true,
          zoom_connected_at: new Date().toISOString(),
        },
      })
      .eq('company_id', companyId);

    return NextResponse.redirect(
      new URL(`${returnTo}?integration=zoom&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Zoom callback error:', error);
    return NextResponse.redirect(new URL('/integrations?error=callback_failed', request.url));
  }
}
