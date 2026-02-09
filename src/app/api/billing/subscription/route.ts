// app/api/billing/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Fetch current subscription with plan details
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('company_id', companyId)
      .single();

    // If table doesn't exist or other error, return empty data
    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json({
        subscription: null,
        usage: null
      });
    }

    // Fetch current period usage
    let usage = null;
    if (subscription) {
      const { data: usageData, error: usageError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('company_id', companyId)
        .gte('period_end', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage:', usageError);
      }

      // If no usage tracking exists for current period, create one
      if (!usageData && subscription) {
        const { data: newUsage } = await supabase
          .from('usage_tracking')
          .insert({
            company_id: companyId,
            subscription_id: subscription.id,
            period_start: subscription.current_period_start,
            period_end: subscription.current_period_end,
            minutes_used: 0,
            minutes_included: subscription.plan.minutes_included,
          })
          .select()
          .single();

        usage = newUsage;
      } else {
        usage = usageData;
      }

      // Always ensure minutes_included matches the current plan
      // (usage record may be stale if plan changed but usage wasn't updated)
      if (usage && subscription?.plan) {
        usage.minutes_included = subscription.plan.minutes_included;
      }
    }

    return NextResponse.json({
      subscription,
      usage
    });

  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
