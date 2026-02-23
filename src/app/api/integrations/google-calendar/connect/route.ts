// app/api/integrations/google-calendar/connect/route.ts
// Initiates the Google Calendar OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getGoogleAuthUrl } from '@/lib/calendar/google';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    // Create a state parameter with user/company info for the callback
    const returnTo = request.nextUrl.searchParams.get('return_to') || '/integrations';
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        company_id: userData.company_id,
        provider: 'google_calendar',
        timestamp: Date.now(),
        return_to: returnTo,
      })
    ).toString('base64url');

    const authUrl = getGoogleAuthUrl(state);

    // Check if this is an API call or a redirect request
    const returnUrl = request.nextUrl.searchParams.get('return_url');
    if (returnUrl === 'json') {
      return NextResponse.json({ url: authUrl });
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google Calendar connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
