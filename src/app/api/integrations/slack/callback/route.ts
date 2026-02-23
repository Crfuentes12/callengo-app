// app/api/integrations/slack/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateB64 = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/integrations?error=${error}`, request.url));
    }

    if (!code || !stateB64) {
      return NextResponse.redirect(new URL('/integrations?error=missing_params', request.url));
    }

    const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
    const { userId, companyId, returnTo } = state;

    const clientId = process.env.SLACK_CLIENT_ID!;
    const clientSecret = process.env.SLACK_CLIENT_SECRET!;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/integrations/slack/callback`;

    // Exchange code for token
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData.error);
      return NextResponse.redirect(new URL(`${returnTo}?error=token_exchange_failed`, request.url));
    }

    // Get current company settings
    const { data: currentSettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', companyId)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    // Store Slack integration in company_settings
    await supabaseAdmin
      .from('company_settings')
      .update({
        settings: {
          ...existingSettings,
          slack_access_token: tokenData.access_token,
          slack_bot_user_id: tokenData.bot_user_id,
          slack_team_id: tokenData.team?.id,
          slack_team_name: tokenData.team?.name,
          slack_channel_id: tokenData.incoming_webhook?.channel_id || null,
          slack_channel_name: tokenData.incoming_webhook?.channel || null,
          slack_webhook_url: tokenData.incoming_webhook?.url || null,
          slack_scopes: tokenData.scope?.split(',') || [],
          slack_connected: true,
          slack_connected_at: new Date().toISOString(),
          slack_authed_user_id: tokenData.authed_user?.id || userId,
        },
      })
      .eq('company_id', companyId);

    return NextResponse.redirect(
      new URL(`${returnTo}?integration=slack&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Slack callback error:', error);
    return NextResponse.redirect(new URL('/integrations?error=callback_failed', request.url));
  }
}
