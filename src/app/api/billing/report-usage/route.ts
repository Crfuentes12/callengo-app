import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { reportUsage } from '@/lib/stripe';

/**
 * API endpoint to report usage to Stripe for metered billing
 * This is called after a call is completed to track overage usage
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user (this could also be called by a system service)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { companyId, minutes, callId } = body;

    if (!companyId || !minutes) {
      return NextResponse.json(
        { error: 'Company ID and minutes are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company (if authenticated)
    if (user) {
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
    const overageMinutes = Math.max(0, newMinutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    // Update usage tracking
    const { error: updateError } = await supabase
      .from('usage_tracking')
      .update({
        minutes_used: newMinutesUsed,
        overage_minutes: overageMinutes,
        total_cost: overageCost,
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

    // Update company subscription overage tracking
    const { error: subUpdateError } = await supabase
      .from('company_subscriptions')
      .update({
        overage_spent: overageCost,
      })
      .eq('id', subscription.id);

    if (subUpdateError) {
      console.error('Error updating subscription overage:', subUpdateError);
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
        overage_minutes: overageMinutes,
      },
      minutes_consumed: minutes,
      cost_usd: minutes > minutesIncluded ? minutes * pricePerMinute : 0,
    });

    // Check if overage is enabled and if we need to report to Stripe
    const shouldReportToStripe =
      subscription.overage_enabled &&
      overageMinutes > 0 &&
      subscription.stripe_subscription_item_id;

    if (shouldReportToStripe) {
      try {
        // Report usage to Stripe for metered billing
        await reportUsage({
          subscriptionItemId: subscription.stripe_subscription_item_id!,
          quantity: Math.ceil(overageMinutes), // Round up to whole minutes
          action: 'set', // Use 'set' to replace the current total
        });

        console.log(`✅ Reported ${overageMinutes} overage minutes to Stripe`);
      } catch (stripeError) {
        console.error('Error reporting to Stripe:', stripeError);
        // Don't fail the request if Stripe reporting fails
      }
    }

    // Check overage budget alerts
    if (subscription.overage_enabled && subscription.overage_budget) {
      const budgetUsagePercent = (overageCost / subscription.overage_budget) * 100;
      let alertLevel = 0;

      if (budgetUsagePercent >= 90) alertLevel = 3; // 90%+
      else if (budgetUsagePercent >= 75) alertLevel = 2; // 75%+
      else if (budgetUsagePercent >= 50) alertLevel = 1; // 50%+

      // Only send alert if level increased
      if (alertLevel > (subscription.overage_alert_level || 0)) {
        await supabase
          .from('company_subscriptions')
          .update({
            overage_alert_level: alertLevel,
            last_overage_alert_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        // Log alert event
        await supabase.from('billing_events').insert({
          company_id: companyId,
          subscription_id: subscription.id,
          event_type: 'overage_alert',
          event_data: {
            level: alertLevel,
            budget: subscription.overage_budget,
            spent: overageCost,
            percent: budgetUsagePercent,
          },
          minutes_consumed: 0,
          cost_usd: 0,
        });
      }

      // Check if budget exceeded
      if (overageCost >= subscription.overage_budget) {
        // Disable future calls by updating status
        await supabase.from('billing_events').insert({
          company_id: companyId,
          subscription_id: subscription.id,
          event_type: 'overage_budget_exceeded',
          event_data: {
            budget: subscription.overage_budget,
            spent: overageCost,
          },
          minutes_consumed: 0,
          cost_usd: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      usage: {
        minutes_used: newMinutesUsed,
        minutes_included: minutesIncluded,
        overage_minutes: overageMinutes,
        overage_cost: overageCost,
        budget_remaining: subscription.overage_budget
          ? Math.max(0, subscription.overage_budget - overageCost)
          : null,
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

    return NextResponse.json({
      usage: usage || {
        minutes_used: 0,
        minutes_included: subscription.subscription_plans?.minutes_included || 0,
        overage_minutes: 0,
        total_cost: 0,
      },
      subscription: {
        overage_enabled: subscription.overage_enabled,
        overage_budget: subscription.overage_budget,
        overage_spent: subscription.overage_spent,
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
