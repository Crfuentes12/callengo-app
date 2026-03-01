/**
 * Usage Tracker Service
 * Automatically tracks and reports usage to Stripe
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
    overageMinutes: number;
    overageCost: number;
  };
  subscription: {
    status: string;
    overageEnabled: boolean;
    overageBudget: number | null;
    overageSpent: number;
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
    console.log('✅ Usage tracked successfully:', data);
  } catch (error) {
    console.error('Error tracking call usage:', error);
    throw error;
  }
}

/**
 * Check if company can make a call based on their usage limits
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
          overageMinutes: 0,
          overageCost: 0,
        },
        subscription: {
          status: 'inactive',
          overageEnabled: false,
          overageBudget: null,
          overageSpent: 0,
        },
      };
    }

    // Check subscription status
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return {
        allowed: false,
        reason: `Subscription is ${subscription.status}`,
        usage: {
          minutesUsed: 0,
          minutesIncluded: 0,
          overageMinutes: 0,
          overageCost: 0,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: subscription.overage_enabled,
          overageBudget: subscription.overage_budget,
          overageSpent: subscription.overage_spent || 0,
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
    const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    // Check if within included minutes
    if (minutesUsed < minutesIncluded) {
      return {
        allowed: true,
        usage: {
          minutesUsed,
          minutesIncluded,
          overageMinutes,
          overageCost,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: subscription.overage_enabled,
          overageBudget: subscription.overage_budget,
          overageSpent: subscription.overage_spent || 0,
        },
      };
    }

    // Free/trial plan: always block when minutes exhausted — no overage
    const planSlug = subscription.subscription_plans?.slug || 'free';
    if (planSlug === 'free') {
      return {
        allowed: false,
        reason: 'Your free trial minutes have been used. Please upgrade to a paid plan to continue.',
        usage: {
          minutesUsed,
          minutesIncluded,
          overageMinutes,
          overageCost,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: false,
          overageBudget: null,
          overageSpent: 0,
        },
      };
    }

    // Paid plans: check overage settings
    if (!subscription.overage_enabled) {
      return {
        allowed: false,
        reason: 'Monthly minutes exceeded and overage is disabled',
        usage: {
          minutesUsed,
          minutesIncluded,
          overageMinutes,
          overageCost,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: subscription.overage_enabled,
          overageBudget: subscription.overage_budget,
          overageSpent: subscription.overage_spent || 0,
        },
      };
    }

    // Check overage budget
    if (subscription.overage_budget && overageCost >= subscription.overage_budget) {
      return {
        allowed: false,
        reason: 'Overage budget exceeded',
        usage: {
          minutesUsed,
          minutesIncluded,
          overageMinutes,
          overageCost,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: subscription.overage_enabled,
          overageBudget: subscription.overage_budget,
          overageSpent: subscription.overage_spent || 0,
        },
      };
    }

    // All checks passed
    return {
      allowed: true,
      usage: {
        minutesUsed,
        minutesIncluded,
        overageMinutes,
        overageCost,
      },
      subscription: {
        status: subscription.status,
        overageEnabled: subscription.overage_enabled,
        overageBudget: subscription.overage_budget,
        overageSpent: subscription.overage_spent || 0,
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
    const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    return {
      minutesUsed,
      minutesIncluded,
      overageMinutes,
      overageCost,
      percentageUsed: (minutesUsed / minutesIncluded) * 100,
      overageEnabled: subscription.overage_enabled,
      overageBudget: subscription.overage_budget,
      overageSpent: subscription.overage_spent || 0,
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

    // Reset overage tracking in subscription
    await supabase
      .from('company_subscriptions')
      .update({
        overage_spent: 0,
        last_overage_alert_at: null,
        overage_alert_level: 0,
      })
      .eq('id', subscription.id);

    console.log(`✅ Usage reset for company ${companyId}`);
  } catch (error) {
    console.error('Error resetting usage:', error);
    throw error;
  }
}
