import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * API endpoint to report usage after a call is completed.
 * Tracks minutes consumed — no overage billing.
 * Free trial users get blocked after 15 minutes; paid users after plan limit.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Verify authentication - either user session or service role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check for internal service key header as alternative auth for server-to-server calls
    const serviceKey = req.headers.get('x-service-key');
    const isServiceCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!user && !isServiceCall) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { companyId, minutes, callId } = body;

    if (!companyId || !minutes) {
      return NextResponse.json(
        { error: 'Company ID and minutes are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company (if user-authenticated, not service call)
    if (user && !isServiceCall) {
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userData?.company_id !== companyId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    // Get company subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get current usage tracking
    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (usageError || !usage) {
      return NextResponse.json(
        { error: 'Usage tracking not found' },
        { status: 404 }
      );
    }

    // Calculate new usage
    const newMinutesUsed = usage.minutes_used + minutes;
    const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
    const minutesRemaining = Math.max(0, minutesIncluded - newMinutesUsed);

    // Update usage tracking
    const { error: updateError } = await supabase
      .from('usage_tracking')
      .update({
        minutes_used: newMinutesUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usage.id);

    if (updateError) {
      console.error('Error updating usage:', updateError);
      return NextResponse.json(
        { error: 'Failed to update usage' },
        { status: 500 }
      );
    }

    // Log billing event
    await supabase.from('billing_events').insert({
      company_id: companyId,
      subscription_id: subscription.id,
      event_type: 'usage_recorded',
      event_data: {
        call_id: callId,
        minutes: minutes,
        total_minutes: newMinutesUsed,
        minutes_remaining: minutesRemaining,
      },
      minutes_consumed: minutes,
      cost_usd: 0,
    });

    return NextResponse.json({
      success: true,
      usage: {
        minutes_used: newMinutesUsed,
        minutes_included: minutesIncluded,
        minutes_remaining: minutesRemaining,
      },
    });
  } catch (error) {
    console.error('Error reporting usage:', error);
    return NextResponse.json(
      {
        error: 'Failed to report usage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve current usage
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', userData.company_id)
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 404 }
      );
    }

    // Get current usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('subscription_id', subscription.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
    const minutesUsed = usage?.minutes_used || 0;

    return NextResponse.json({
      usage: {
        minutes_used: minutesUsed,
        minutes_included: minutesIncluded,
        minutes_remaining: Math.max(0, minutesIncluded - minutesUsed),
      },
      subscription: {
        planSlug: subscription.subscription_plans?.slug || 'free',
        isTrial: subscription.subscription_plans?.slug === 'free',
      },
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    return NextResponse.json(
      {
        error: 'Failed to get usage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
