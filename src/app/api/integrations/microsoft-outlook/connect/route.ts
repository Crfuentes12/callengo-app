// app/api/integrations/microsoft-outlook/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const returnTo = request.nextUrl.searchParams.get('return_to') || '/calendar';

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.redirect(new URL(`${returnTo}?error=no_company`, request.url));
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

    if (!clientId) {
      return NextResponse.redirect(new URL(`${returnTo}?error=not_configured`, request.url));
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/integrations/microsoft-outlook/callback`;

    const state = JSON.stringify({
      userId: user.id,
      companyId: userData.company_id,
      returnTo,
    });

    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Calendars.ReadWrite',
      'User.Read',
    ];

    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', Buffer.from(state).toString('base64'));
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Microsoft connect error:', error);
    return NextResponse.redirect(new URL('/calendar?error=connect_failed', request.url));
  }
}
