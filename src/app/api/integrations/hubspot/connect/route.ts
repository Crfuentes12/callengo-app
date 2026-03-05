// app/api/integrations/hubspot/connect/route.ts
// Initiates the HubSpot OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getHubSpotAuthUrl } from '@/lib/hubspot';
import { createSignedState, validateReturnTo } from '@/lib/oauth-state';
import { apiLimiter, applyRateLimit } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, apiLimiter, 30);
  if (rateLimitResult) return rateLimitResult;

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
        { error: 'HubSpot integration requires Business plan or higher' },
        { status: 403 }
      );
    }

    const returnTo = validateReturnTo(request.nextUrl.searchParams.get('return_to'));
    const state = createSignedState({
      user_id: user.id,
      company_id: userData.company_id,
      provider: 'hubspot',
      timestamp: Date.now(),
      return_to: returnTo,
    });

    const authUrl = getHubSpotAuthUrl(state);

    await logAuditEvent({
      company_id: userData.company_id,
      user_id: user.id,
      action: 'integration.connect',
      entity_type: 'integration',
      entity_id: 'hubspot',
      changes: { provider: 'hubspot' },
      request,
    });

    const returnUrl = request.nextUrl.searchParams.get('return_url');
    if (returnUrl === 'json') {
      return NextResponse.json({ url: authUrl });
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating HubSpot connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
