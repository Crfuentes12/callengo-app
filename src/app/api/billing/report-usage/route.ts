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

    // Get current usage tracking (for current billing period, most recent first)
    const now = new Date().toISOString();
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .lte('period_start', now)
      .gte('period_end', now)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // If no rows were updated, another request modified the record — retry with backoff
    if (!updatedRows || updatedRows.length === 0) {
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // Re-read fresh data
        const { data: freshUsage } = await supabaseAdmin
          .from('usage_tracking')
          .select('*')
          .eq('id', usage.id)
          .single();

        if (!freshUsage) {
          return NextResponse.json({ error: 'Usage tracking not found on retry' }, { status: 404 });
        }

        // Recalculate with fresh data
        const retryMinutesUsed = freshUsage.minutes_used + minutes;
        const retryMinutesIncluded = subscription.subscription_plans?.minutes_included || 0;
        const retryOverageMinutes = Math.max(0, retryMinutesUsed - retryMinutesIncluded);
        const retryPricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
        const retryOverageCost = retryOverageMinutes * retryPricePerMinute;

        const { data: retryRows } = await supabaseAdmin
          .from('usage_tracking')
          .update({
            minutes_used: retryMinutesUsed,
            total_cost: retryOverageCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', freshUsage.id)
          .eq('updated_at', freshUsage.updated_at)
          .select('id');

        if (retryRows && retryRows.length > 0) {
          // Retry succeeded
          const retryResult = await processUsagePostUpdate(
            supabaseAdmin, subscription, companyId, callId, minutes,
            retryMinutesUsed, retryMinutesIncluded, retryOverageMinutes, retryPricePerMinute, retryOverageCost
          );
          return NextResponse.json(retryResult);
        }
        // Exponential backoff before next attempt
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
      }
      return NextResponse.json({ error: 'Usage update conflict after retries — please retry' }, { status: 409 });
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

  // ================================================================
  // AUDIT FIX: Progressive usage alerts (70%, 90%, 100% of included minutes)
  // These track plan usage, separate from overage budget alerts above.
  // ================================================================
  if (minutesIncluded > 0) {
    const usagePercent = (newMinutesUsed / minutesIncluded) * 100;
    let usageAlertLevel = 0;
    if (usagePercent >= 100) usageAlertLevel = 3;
    else if (usagePercent >= 90) usageAlertLevel = 2;
    else if (usagePercent >= 70) usageAlertLevel = 1;

    // Only emit alert if level increased (avoid duplicate alerts)
    const currentAlertLevel = overageAlertLevel || 0;
    if (usageAlertLevel > currentAlertLevel && !overageEnabled) {
      // Only alert non-overage users about plan usage (overage users get budget alerts instead)
      await supabase
        .from('company_subscriptions')
        .update({ overage_alert_level: usageAlertLevel })
        .eq('id', subId);

      const alertMessages: Record<number, string> = {
        1: '70% of included minutes used',
        2: '90% of included minutes used — consider upgrading or enabling overage',
        3: '100% of included minutes used — calls are now blocked',
      };

      await supabase.from('billing_events').insert({
        company_id: companyId,
        subscription_id: subId,
        event_type: 'usage_alert',
        event_data: {
          level: usageAlertLevel,
          percent: Math.round(usagePercent),
          minutes_used: newMinutesUsed,
          minutes_included: minutesIncluded,
          message: alertMessages[usageAlertLevel],
        },
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
      percent_used: minutesIncluded > 0 ? Math.round((newMinutesUsed / minutesIncluded) * 100) : 0,
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

    // Get current usage (for current billing period, most recent first)
    const getNow = new Date().toISOString();
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('subscription_id', subscription.id)
      .lte('period_start', getNow)
      .gte('period_end', getNow)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

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
