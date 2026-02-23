// app/api/integrations/slack/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const returnTo = request.nextUrl.searchParams.get('return_to') || '/integrations';

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.redirect(new URL(`${returnTo}?error=no_company`, request.url));
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(new URL(`${returnTo}?error=not_configured`, request.url));
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/integrations/slack/callback`;

    const state = JSON.stringify({
      userId: user.id,
      companyId: userData.company_id,
      returnTo,
    });

    const scopes = [
      'chat:write',
      'channels:read',
      'commands',
      'incoming-webhook',
      'users:read',
      'groups:read',
    ];

    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', scopes.join(','));
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', Buffer.from(state).toString('base64'));

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Slack connect error:', error);
    return NextResponse.redirect(new URL('/integrations?error=connect_failed', request.url));
  }
}
