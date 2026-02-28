// app/api/integrations/google-sheets/connect/route.ts
// Initiates the Google OAuth flow for Sheets access

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getGoogleSheetsAuthUrl } from '@/lib/google-sheets';

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

    const returnTo = request.nextUrl.searchParams.get('return_to') || '/contacts';
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        company_id: userData.company_id,
        provider: 'google_sheets',
        timestamp: Date.now(),
        return_to: returnTo,
      })
    ).toString('base64url');

    const authUrl = getGoogleSheetsAuthUrl(state);

    const returnUrl = request.nextUrl.searchParams.get('return_url');
    if (returnUrl === 'json') {
      return NextResponse.json({ url: authUrl });
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google Sheets connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
