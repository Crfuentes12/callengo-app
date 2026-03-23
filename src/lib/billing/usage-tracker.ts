/**
 * Usage Tracker Service
 * Tracks usage directly via DB + Stripe (no self-calling HTTP)
 */

import { supabaseAdmin as supabase, supabaseAdminRaw } from '@/lib/supabase/service';
// supabaseAdminRaw used for atomic_increment_usage RPC fallback (Fix #2)
import { reportUsage } from '@/lib/stripe';

export interface UsageReport {
  companyId: string;
  minutes: number;
  callId?: string;
  metadata?: Record<string, unknown>;
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
 * Track call usage and report to billing system.
 * Calls billing logic directly instead of via HTTP self-call.
 */
export async function trackCallUsage(params: UsageReport): Promise<void> {
  const { companyId, minutes, callId } = params;

  try {
    // Idempotency: if callId is provided, check if usage was already reported
    if (callId) {
      const { data: existingEvent } = await supabase
        .from('billing_events')
        .select('id')
        .eq('company_id', companyId)
        .eq('event_type', 'usage_recorded')
        .filter('event_data->>call_id', 'eq', callId)
        .maybeSingle();

      if (existingEvent) {
        console.log(`[usage-tracker] Usage already reported for call ${callId}, skipping`);
        return;
      }
    }

    // Get company subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (subError || !subscription) {
      console.error('[usage-tracker] No active subscription for company:', companyId);
      return;
    }

    // Get current usage tracking
    const now = new Date().toISOString();
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .lte('period_start', now)
      .gte('period_end', now)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!usage) {
      console.error('[usage-tracker] Usage tracking record not found for company:', companyId);
      return;
    }

    // Atomic increment with optimistic locking (retry up to 3 times)
    for (let attempt = 0; attempt <= 3; attempt++) {
      const freshUsage = attempt === 0 ? usage : (await supabase
        .from('usage_tracking')
        .select('*')
        .eq('id', usage.id)
        .single()).data;

      if (!freshUsage) break;

      const newMinutesUsed = freshUsage.minutes_used + minutes;
      const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
      const overageMinutes = Math.max(0, newMinutesUsed - minutesIncluded);
      const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
      const overageCost = overageMinutes * pricePerMinute;

      const { data: updated } = await supabase
        .from('usage_tracking')
        .update({
          minutes_used: newMinutesUsed,
          total_cost: overageCost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', freshUsage.id)
        .eq('updated_at', freshUsage.updated_at) // Optimistic lock
        .select('id');

      if (!updated || updated.length === 0) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
          continue;
        }
        // FIX #2: Atomic fallback instead of silently dropping usage data.
        // If optimistic lock fails after all retries, fall back to atomic SQL increment
        // so usage is never lost (even if overage/cost recalculation is slightly stale).
        console.warn('[usage-tracker] Optimistic lock exhausted, falling back to atomic increment');
        const { error: atomicError } = await supabaseAdminRaw
          .rpc('atomic_increment_usage', {
            p_usage_id: usage.id,
            p_minutes: minutes,
          });
        if (atomicError) {
          // Last resort: log a billing event so reconciliation can catch it
          console.error('[usage-tracker] CRITICAL: Atomic fallback also failed:', atomicError);
          await supabase.from('billing_events').insert({
            company_id: companyId,
            subscription_id: subscription.id,
            event_type: 'usage_tracking_failed',
            event_data: {
              call_id: callId,
              minutes,
              error: atomicError.message,
              needs_reconciliation: true,
            },
            minutes_consumed: minutes,
            cost_usd: 0,
          });
        }
        return;
      }

      // Update overage tracking
      await supabase
        .from('company_subscriptions')
        .update({ overage_spent: overageCost })
        .eq('id', subscription.id);

      // Log billing event
      await supabase.from('billing_events').insert({
        company_id: companyId,
        subscription_id: subscription.id,
        event_type: 'usage_recorded',
        event_data: { call_id: callId, minutes, total_minutes: newMinutesUsed, overage_minutes: overageMinutes },
        minutes_consumed: minutes,
        cost_usd: newMinutesUsed > minutesIncluded ? minutes * pricePerMinute : 0,
      });

      // Report to Stripe if overage
      // FIX #4: Use 'set' with the total overage (not increment) because we track the
      // cumulative total in usage_tracking.minutes_used. The periodic syncAllMeteredUsage()
      // is the authoritative reconciliation point. Per-call reporting uses 'set' with the
      // latest total to avoid double-counting if a call's webhook is retried.
      if (subscription.overage_enabled && overageMinutes > 0 && subscription.stripe_subscription_item_id) {
        try {
          await reportUsage({
            subscriptionItemId: subscription.stripe_subscription_item_id,
            quantity: Math.ceil(overageMinutes),
            action: 'set',
          });
        } catch (stripeError) {
          console.error('[usage-tracker] CRITICAL: Stripe usage report failed:', stripeError);
          await supabase.from('billing_events').insert({
            company_id: companyId,
            subscription_id: subscription.id,
            event_type: 'stripe_usage_report_failed',
            event_data: {
              overage_minutes: overageMinutes,
              error: stripeError instanceof Error ? stripeError.message : String(stripeError),
              needs_reconciliation: true,
            },
            minutes_consumed: overageMinutes,
            cost_usd: 0,
          });
        }
      }

      console.log(`[usage-tracker] Usage tracked: ${newMinutesUsed}min for company ${companyId}`);
      break; // Success
    }
  } catch (error) {
    console.error('[usage-tracker] Error tracking call usage:', error);
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

    // Check if subscription period has expired (enforces 90-day free trial)
    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
      // Persist expired status to DB so other code paths see consistent state
      await supabase
        .from('company_subscriptions')
        .update({ status: 'expired' })
        .eq('id', subscription.id)
        .eq('status', 'active'); // Only transition from active (idempotent)

      return {
        allowed: false,
        reason: 'Subscription period has expired. Please upgrade to continue.',
        usage: {
          minutesUsed: 0,
          minutesIncluded: 0,
          overageMinutes: 0,
          overageCost: 0,
        },
        subscription: {
          status: 'expired',
          overageEnabled: false,
          overageBudget: null,
          overageSpent: 0,
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

    // Check for active Calls Booster add-on to include extra minutes
    // Uses untyped client since company_addons is not yet in the Database type
    let boosterMinutes = 0;
    const { data: activeAddons } = await supabaseAdminRaw
      .from('company_addons')
      .select('addon_type, quantity')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .eq('addon_type', 'calls_booster');

    if (activeAddons && activeAddons.length > 0) {
      // Each Calls Booster adds 225 minutes (150 calls * ~1.5 min avg)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      boosterMinutes = (activeAddons as any[]).reduce((sum: number, addon: any) => sum + (Math.max(0, addon.quantity || 1) * 225), 0);
    }

    const minutesUsed = usage?.minutes_used || 0;
    const minutesIncluded = (subscription.subscription_plans?.minutes_included || 0) + boosterMinutes;
    const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    // Determine if this is a free/trial plan
    const isFreePlan = subscription.subscription_plans?.slug === 'free';

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

    // FREE PLAN: Hard block at included minutes — no overage allowed
    // Free users get 15 trial minutes only. After that, they must upgrade.
    if (isFreePlan) {
      return {
        allowed: false,
        reason: 'Trial minutes exhausted. Please upgrade to a paid plan to continue making calls.',
        usage: {
          minutesUsed,
          minutesIncluded,
          overageMinutes: 0,
          overageCost: 0,
        },
        subscription: {
          status: subscription.status,
          overageEnabled: false,
          overageBudget: null,
          overageSpent: 0,
        },
      };
    }

    // PAID PLANS: Over included minutes - check overage settings
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
    if (subscription.overage_budget && overageCost > subscription.overage_budget) {
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

    // All checks passed (paid plan with overage within budget)
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

    // Include Calls Booster add-on minutes (same logic as checkUsageLimit)
    let boosterMinutes = 0;
    const { data: activeAddons } = await supabaseAdminRaw
      .from('company_addons')
      .select('addon_type, quantity')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .eq('addon_type', 'calls_booster');

    if (activeAddons && activeAddons.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      boosterMinutes = (activeAddons as any[]).reduce(
        (sum: number, addon: { quantity?: number }) => sum + (Math.max(0, addon.quantity || 1) * 225), 0
      );
    }

    const minutesUsed = usage?.minutes_used || 0;
    const minutesIncluded = (subscription.subscription_plans?.minutes_included || 0) + boosterMinutes;
    const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
    const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    return {
      minutesUsed,
      minutesIncluded,
      overageMinutes,
      overageCost,
      percentageUsed: minutesIncluded > 0 ? (minutesUsed / minutesIncluded) * 100 : 0,
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

    // Check if a record for this period already exists (prevent duplicates)
    const { data: existingUsage } = await supabase
      .from('usage_tracking')
      .select('id')
      .eq('company_id', companyId)
      .eq('subscription_id', subscription.id)
      .eq('period_start', periodStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (existingUsage) {
      console.log(`[usage-tracker] Usage record already exists for period ${periodStart.toISOString()}, skipping insert`);
    } else {
      await supabase.from('usage_tracking').insert({
        company_id: companyId,
        subscription_id: subscription.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        minutes_used: 0,
        minutes_included: subscription.subscription_plans?.minutes_included || 0,
        total_cost: 0,
      });
    }

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
