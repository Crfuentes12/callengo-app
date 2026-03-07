import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { reportUsage } from '@/lib/stripe';

/**
 * API endpoint to report usage to Stripe for metered billing
 * This is called after a call is completed to track overage usage
 */

// CRIT-005: Use a dedicated internal token instead of exposing Supabase service role key
function verifyInternalToken(provided: string | null): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!provided || !expected) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Verify authentication - either user session or internal service token
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // CRIT-005: Use dedicated internal API token, NOT the Supabase service role key
    const serviceKey = req.headers.get('x-service-key');
    const isServiceCall = verifyInternalToken(serviceKey);

    if (!user && !isServiceCall) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { companyId, minutes, callId } = body;

    if (!companyId || !minutes || typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json(
        { error: 'Company ID and a positive minutes value are required' },
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
    const { data: subscription, error: subError } = await supabaseAdmin
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

    // Get current usage tracking (for current billing period)
    const now = new Date().toISOString();
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .lte('period_start', now)
      .gte('period_end', now)
      .limit(1)
      .single();

    if (usageError || !usage) {
      return NextResponse.json(
        { error: 'Usage tracking not found' },
        { status: 404 }
      );
    }

    // CRIT-004: Atomic increment to prevent race condition.
    // Use a raw SQL increment via Supabase RPC or direct update with SQL expression.
    // Since Supabase JS client doesn't support SQL expressions in .update(),
    // we use a two-step approach with optimistic locking via updated_at check.
    const previousUpdatedAt = usage.updated_at;
    const newMinutesUsed = usage.minutes_used + minutes;
    const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
    const overageMinutes = Math.max(0, newMinutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    const newUpdatedAt = new Date().toISOString();

    // Optimistic locking: only update if the record hasn't been modified since we read it
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('usage_tracking')
      .update({
        minutes_used: newMinutesUsed,
        total_cost: overageCost,
        updated_at: newUpdatedAt,
      })
      .eq('id', usage.id)
      .eq('updated_at', previousUpdatedAt)
      .select('id');

    if (updateError) {
      console.error('Error updating usage:', updateError);
      return NextResponse.json(
        { error: 'Failed to update usage' },
        { status: 500 }
      );
    }

    // If no rows were updated, another request modified the record — retry once
    if (!updatedRows || updatedRows.length === 0) {
      // Re-read and retry
      const { data: freshUsage } = await supabaseAdmin
        .from('usage_tracking')
        .select('*')
        .eq('id', usage.id)
        .single();

      if (!freshUsage) {
        return NextResponse.json({ error: 'Usage tracking not found on retry' }, { status: 404 });
      }

      const retryMinutesUsed = freshUsage.minutes_used + minutes;
      const retryOverageMinutes = Math.max(0, retryMinutesUsed - minutesIncluded);
      const retryOverageCost = retryOverageMinutes * pricePerMinute;

      const { error: retryError } = await supabaseAdmin
        .from('usage_tracking')
        .update({
          minutes_used: retryMinutesUsed,
          total_cost: retryOverageCost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', freshUsage.id)
        .eq('updated_at', freshUsage.updated_at);

      if (retryError) {
        console.error('Error on usage update retry:', retryError);
        return NextResponse.json({ error: 'Usage update conflict — please retry' }, { status: 409 });
      }

      // Use retried values for the rest of the flow
      const retryResult = await processUsagePostUpdate(
        supabaseAdmin, subscription, companyId, callId, minutes,
        retryMinutesUsed, minutesIncluded, retryOverageMinutes, pricePerMinute, retryOverageCost
      );
      return NextResponse.json(retryResult);
    }

    // Proceed with post-update operations
    const result = await processUsagePostUpdate(
      supabaseAdmin, subscription, companyId, callId, minutes,
      newMinutesUsed, minutesIncluded, overageMinutes, pricePerMinute, overageCost
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reporting usage:', error);
    return NextResponse.json(
      {
        error: 'Failed to report usage',
      },
      { status: 500 }
    );
  }
}

 
async function processUsagePostUpdate(
  supabase: typeof supabaseAdmin,
  subscription: Record<string, unknown>,
  companyId: string,
  callId: string | undefined,
  minutes: number,
  newMinutesUsed: number,
  minutesIncluded: number,
  overageMinutes: number,
  pricePerMinute: number,
  overageCost: number,
) {
  const subId = subscription.id as string;
  const overageEnabled = subscription.overage_enabled as boolean | null;
  const stripeSubItemId = subscription.stripe_subscription_item_id as string | null;
  const overageBudget = subscription.overage_budget as number | null;
  const overageAlertLevel = subscription.overage_alert_level as number | null;

  // Update company subscription overage tracking
  await supabase
    .from('company_subscriptions')
    .update({ overage_spent: overageCost })
    .eq('id', subId);

  // Log billing event
  await supabase.from('billing_events').insert({
    company_id: companyId,
    subscription_id: subId,
    event_type: 'usage_recorded',
    event_data: {
      call_id: callId,
      minutes,
      total_minutes: newMinutesUsed,
      overage_minutes: overageMinutes,
    },
    minutes_consumed: minutes,
    cost_usd: newMinutesUsed > minutesIncluded ? minutes * pricePerMinute : 0,
  });

  // Report to Stripe if needed
  if (overageEnabled && overageMinutes > 0 && stripeSubItemId) {
    try {
      await reportUsage({
        subscriptionItemId: stripeSubItemId,
        quantity: Math.ceil(overageMinutes),
        action: 'set',
      });
    } catch (stripeError) {
      console.error('Error reporting to Stripe:', stripeError);
    }
  }

  // Check overage budget alerts
  if (overageEnabled && overageBudget) {
    const budgetUsagePercent = (overageCost / overageBudget) * 100;
    let alertLevel = 0;
    if (budgetUsagePercent >= 90) alertLevel = 3;
    else if (budgetUsagePercent >= 75) alertLevel = 2;
    else if (budgetUsagePercent >= 50) alertLevel = 1;

    if (alertLevel > (overageAlertLevel || 0)) {
      await supabase
        .from('company_subscriptions')
        .update({
          overage_alert_level: alertLevel,
          last_overage_alert_at: new Date().toISOString(),
        })
        .eq('id', subId);

      await supabase.from('billing_events').insert({
        company_id: companyId,
        subscription_id: subId,
        event_type: 'overage_alert',
        event_data: { level: alertLevel, budget: overageBudget, spent: overageCost, percent: budgetUsagePercent },
        minutes_consumed: 0,
        cost_usd: 0,
      });
    }

    if (overageCost >= overageBudget) {
      await supabase.from('billing_events').insert({
        company_id: companyId,
        subscription_id: subId,
        event_type: 'overage_budget_exceeded',
        event_data: { budget: overageBudget, spent: overageCost },
        minutes_consumed: 0,
        cost_usd: 0,
      });
    }
  }

  return {
    success: true,
    usage: {
      minutes_used: newMinutesUsed,
      minutes_included: minutesIncluded,
      overage_minutes: overageMinutes,
      overage_cost: overageCost,
      budget_remaining: overageBudget
        ? Math.max(0, overageBudget - overageCost)
        : null,
    },
  };
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

    // Get current usage (for current billing period)
    const getNow = new Date().toISOString();
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('subscription_id', subscription.id)
      .lte('period_start', getNow)
      .gte('period_end', getNow)
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
      },
      { status: 500 }
    );
  }
}
