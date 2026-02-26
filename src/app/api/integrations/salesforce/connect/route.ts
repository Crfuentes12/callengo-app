// app/api/integrations/salesforce/connect/route.ts
// Initiates the Salesforce OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getSalesforceAuthUrl } from '@/lib/salesforce';

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

    // Check plan access (business+ required)
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans ( slug )')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.subscription_plans as unknown as { slug: string })?.slug || 'free';
    if (!['business', 'teams', 'enterprise'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'Salesforce integration requires Business plan or higher' },
        { status: 403 }
      );
    }

    const returnTo = request.nextUrl.searchParams.get('return_to') || '/integrations';
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        company_id: userData.company_id,
        provider: 'salesforce',
        timestamp: Date.now(),
        return_to: returnTo,
      })
    ).toString('base64url');

    const authUrl = getSalesforceAuthUrl(state);

    const returnUrl = request.nextUrl.searchParams.get('return_url');
    if (returnUrl === 'json') {
      return NextResponse.json({ url: authUrl });
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Salesforce connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
