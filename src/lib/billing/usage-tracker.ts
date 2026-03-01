/**
 * Usage Tracker Service
 * Tracks call usage and enforces plan limits.
 *
 * For free trial users: blocks calls once 15 minutes are exhausted.
 * No overage, no recharge — users must upgrade to a paid plan.
 *
 * For paid users: tracks usage against plan-included minutes.
 */

import { supabaseAdmin as supabase } from '@/lib/supabase/service';

export interface UsageReport {
  companyId: string;
  minutes: number;
  callId?: string;
  metadata?: Record<string, any>;
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  usage: {
    minutesUsed: number;
    minutesIncluded: number;
    minutesRemaining: number;
  };
  subscription: {
    status: string;
    planSlug: string;
    isTrial: boolean;
  };
}

/**
 * Track call usage and report to billing system
 */
export async function trackCallUsage(params: UsageReport): Promise<void> {
  const { companyId, minutes, callId, metadata = {} } = params;

  try {
    // Call the report-usage API endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/billing/report-usage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          minutes,
          callId,
          metadata,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to track usage:', error);
      throw new Error(error.error || 'Failed to track usage');
    }

    const data = await response.json();
    console.log('Usage tracked successfully:', data);
  } catch (error) {
    console.error('Error tracking call usage:', error);
    throw error;
  }
}

/**
 * Check if company can make a call based on their usage limits.
 *
 * Logic:
 * 1. Subscription must exist and be active/trialing
 * 2. Minutes used must be less than minutes included
 * 3. If trial (free plan) and minutes exhausted → blocked, must upgrade
 * 4. No overage — calls are simply blocked at the limit
 */
export async function checkUsageLimit(companyId: string): Promise<UsageCheckResult> {
  try {
    // Get company subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (subError || !subscription) {
      return {
        allowed: false,
        reason: 'No active subscription',
        usage: {
          minutesUsed: 0,
          minutesIncluded: 0,
          minutesRemaining: 0,
        },
        subscription: {
          status: 'inactive',
          planSlug: 'none',
          isTrial: false,
        },
      };
    }

    const planSlug = subscription.subscription_plans?.slug || 'free';
    const isTrial = planSlug === 'free';

    // Check subscription status
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return {
        allowed: false,
        reason: `Subscription is ${subscription.status}`,
        usage: {
          minutesUsed: 0,
          minutesIncluded: 0,
          minutesRemaining: 0,
        },
        subscription: {
          status: subscription.status,
          planSlug,
          isTrial,
        },
      };
    }

    // Get current usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    const minutesUsed = usage?.minutes_used || 0;
    const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
    const minutesRemaining = Math.max(0, minutesIncluded - minutesUsed);

    // Check if within included minutes
    if (minutesUsed < minutesIncluded) {
      return {
        allowed: true,
        usage: {
          minutesUsed,
          minutesIncluded,
          minutesRemaining,
        },
        subscription: {
          status: subscription.status,
          planSlug,
          isTrial,
        },
      };
    }

    // Minutes exhausted — calls are blocked
    const reason = isTrial
      ? 'Your free trial minutes have been used. Please upgrade to a paid plan to continue.'
      : 'Monthly minutes exceeded. Please upgrade your plan for more minutes.';

    return {
      allowed: false,
      reason,
      usage: {
        minutesUsed,
        minutesIncluded,
        minutesRemaining: 0,
      },
      subscription: {
        status: subscription.status,
        planSlug,
        isTrial,
      },
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    throw error;
  }
}

/**
 * Get current usage statistics for a company
 */
export async function getUsageStats(companyId: string) {
  try {
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (!subscription) {
      return null;
    }

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    const minutesUsed = usage?.minutes_used || 0;
    const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
    const minutesRemaining = Math.max(0, minutesIncluded - minutesUsed);
    const planSlug = subscription.subscription_plans?.slug || 'free';

    return {
      minutesUsed,
      minutesIncluded,
      minutesRemaining,
      percentageUsed: minutesIncluded > 0 ? (minutesUsed / minutesIncluded) * 100 : 0,
      isTrial: planSlug === 'free',
      planSlug,
      periodStart: usage?.period_start,
      periodEnd: usage?.period_end,
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return null;
  }
}

/**
 * Reset usage for a new billing period
 */
export async function resetUsageForNewPeriod(companyId: string): Promise<void> {
  try {
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);

    // Create new usage tracking record
    await supabase.from('usage_tracking').insert({
      company_id: companyId,
      subscription_id: subscription.id,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: subscription.subscription_plans?.minutes_included || 0,
      total_cost: 0,
    });

    console.log(`Usage reset for company ${companyId}`);
  } catch (error) {
    console.error('Error resetting usage:', error);
    throw error;
  }
}
