/**
 * Call Throttle Service
 * Enforces concurrent call limits, daily caps, and usage limits BEFORE dispatching to Bland.
 *
 * AUDIT FIX: None of these checks existed before. The send-call endpoint dispatched
 * to Bland without checking concurrent limits, daily caps, or usage limits.
 * Callengo is 100% responsible for enforcing plan limits — Bland does NOT do this
 * for sub-accounts.
 */

import { supabaseAdmin } from '@/lib/supabase/service';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import { CAMPAIGN_FEATURE_ACCESS } from '@/config/plan-features';

export interface ThrottleCheckResult {
  allowed: boolean;
  reason?: string;
  reasonCode?: 'concurrent_limit' | 'daily_cap' | 'usage_exhausted' | 'overage_budget' | 'subscription_inactive' | 'hourly_cap';
  currentConcurrent?: number;
  maxConcurrent?: number;
  dailyCallsToday?: number;
  dailyCap?: number;
  planSlug?: string;
  suggestedUpgrade?: string;
}

// Plan order for upgrade suggestions
const PLAN_ORDER = ['free', 'starter', 'growth', 'business', 'teams', 'enterprise'];

function getNextPlan(currentSlug: string): string | null {
  const idx = PLAN_ORDER.indexOf(currentSlug);
  if (idx === -1 || idx >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[idx + 1];
}

// Daily soft caps per plan (based on minutes_included / 1.5 min per call / 30 days)
const DAILY_SOFT_CAPS: Record<string, number> = {
  free: 10, // 10 calls total (one-time), so daily cap = total
  starter: 10, // ~200 calls/month ÷ 30 ≈ 6.7 → round up to 10 for flexibility
  growth: 20, // ~400/30 ≈ 13.3 → 20
  business: 40, // ~800/30 ≈ 26.7 → 40
  teams: 75, // ~1500/30 = 50 → 75
  enterprise: 500, // High but reasonable hourly protection
};

// Hourly caps to protect the Bland master account (Bland has 1000 calls/hour on Scale)
const HOURLY_CAPS: Record<string, number> = {
  free: 5,
  starter: 15,
  growth: 25,
  business: 50,
  teams: 100,
  enterprise: 200,
};

/**
 * Comprehensive pre-dispatch check. Must be called BEFORE sending a call to Bland.
 * Returns whether the call is allowed and why not if blocked.
 */
export async function checkCallAllowed(companyId: string): Promise<ThrottleCheckResult> {
  // 1. Get subscription + plan
  const { data: subscription } = await supabaseAdmin
    .from('company_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('company_id', companyId)
    .single();

  if (!subscription || !subscription.subscription_plans) {
    return {
      allowed: false,
      reason: 'No active subscription found',
      reasonCode: 'subscription_inactive',
    };
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return {
      allowed: false,
      reason: `Subscription is ${subscription.status}. Please update your payment method.`,
      reasonCode: 'subscription_inactive',
    };
  }

  // Check if subscription period has expired (critical for free plan 90-day trial)
  if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
    return {
      allowed: false,
      reason: 'Your subscription period has expired. Please upgrade to continue making calls.',
      reasonCode: 'subscription_inactive',
    };
  }

  const planSlug = subscription.subscription_plans.slug as string;
  const planFeatures = CAMPAIGN_FEATURE_ACCESS[planSlug] || CAMPAIGN_FEATURE_ACCESS.free;
  const maxConcurrent = planFeatures.maxConcurrentCalls;
  const nextPlan = getNextPlan(planSlug);

  // 2. Check concurrent calls
  if (maxConcurrent !== -1) {
    const activeCalls = await getActiveCalls(companyId);
    if (activeCalls >= maxConcurrent) {
      return {
        allowed: false,
        reason: `You've reached your limit of ${maxConcurrent} simultaneous calls on the ${subscription.subscription_plans.name} plan.${nextPlan ? ` Upgrade to ${nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)} for more concurrent calls.` : ''}`,
        reasonCode: 'concurrent_limit',
        currentConcurrent: activeCalls,
        maxConcurrent,
        planSlug,
        suggestedUpgrade: nextPlan || undefined,
      };
    }
  }

  // 3. Check daily cap
  const dailyCap = DAILY_SOFT_CAPS[planSlug] || DAILY_SOFT_CAPS.free;
  const dailyCalls = await getDailyCallCount(companyId);
  if (dailyCalls >= dailyCap) {
    return {
      allowed: false,
      reason: `Daily call limit reached (${dailyCap} calls/day on ${subscription.subscription_plans.name}). Please try again tomorrow.${nextPlan ? ` Upgrade to ${nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)} for higher daily limits.` : ''}`,
      reasonCode: 'daily_cap',
      dailyCallsToday: dailyCalls,
      dailyCap,
      planSlug,
      suggestedUpgrade: nextPlan || undefined,
    };
  }

  // 4. Check hourly cap (protect Bland master account)
  const hourlyCap = HOURLY_CAPS[planSlug] || HOURLY_CAPS.free;
  const hourlyCalls = await getHourlyCallCount(companyId);
  if (hourlyCalls >= hourlyCap) {
    return {
      allowed: false,
      reason: `Hourly call limit reached (${hourlyCap} calls/hour). Please wait a few minutes before sending more calls.`,
      reasonCode: 'hourly_cap',
      planSlug,
    };
  }

  // 5. Check usage limits (minutes remaining + overage)
  const usageCheck = await checkMinutesAvailable(companyId, subscription);
  if (!usageCheck.allowed) {
    return {
      ...usageCheck,
      planSlug,
      suggestedUpgrade: nextPlan || undefined,
    };
  }

  return {
    allowed: true,
    planSlug,
    currentConcurrent: await getActiveCalls(companyId),
    maxConcurrent: maxConcurrent === -1 ? undefined : maxConcurrent,
    dailyCallsToday: dailyCalls,
    dailyCap,
  };
}

/**
 * Get count of currently active (in-progress) calls for a company.
 * Uses call_logs where status is 'in_progress' or 'ringing'.
 */
async function getActiveCalls(companyId: string): Promise<number> {
  // Active calls = calls started in last 15 min that haven't completed
  // TTL of 15 min prevents ghost counts if webhook doesn't arrive
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('status', ['in_progress', 'ringing', 'queued'])
    .gte('created_at', fifteenMinAgo);

  return count || 0;
}

/**
 * Get count of calls made today for a company.
 */
async function getDailyCallCount(companyId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', startOfDay.toISOString());

  return count || 0;
}

/**
 * Get count of calls made in the last hour for a company.
 */
async function getHourlyCallCount(companyId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', oneHourAgo);

  return count || 0;
}

/**
 * Check if there are minutes available (included + overage budget).
 */
async function checkMinutesAvailable(
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any
): Promise<ThrottleCheckResult> {
  const plan = subscription.subscription_plans;
  const isFreePlan = plan.slug === 'free';

  // Get current usage (most recent period first to handle overlapping records)
  const now = new Date().toISOString();
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('company_id', companyId)
    .eq('subscription_id', subscription.id)
    .lte('period_start', now)
    .gte('period_end', now)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const minutesUsed = usage?.minutes_used || 0;

  // Include Calls Booster add-on minutes
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
      (sum: number, addon: { quantity?: number }) => sum + ((addon.quantity || 1) * 225), 0
    );
  }

  const minutesIncluded = (plan.minutes_included || 0) + boosterMinutes;

  // Within included minutes — always allowed
  if (minutesUsed < minutesIncluded) {
    return { allowed: true };
  }

  // Free plan: hard block
  if (isFreePlan) {
    return {
      allowed: false,
      reason: 'Trial minutes exhausted. Upgrade to a paid plan to continue making calls.',
      reasonCode: 'usage_exhausted',
    };
  }

  // Paid plan: check overage settings
  if (!subscription.overage_enabled) {
    return {
      allowed: false,
      reason: 'Monthly minutes exceeded and overage is disabled. Enable overage or upgrade your plan.',
      reasonCode: 'usage_exhausted',
    };
  }

  // Check overage budget
  if (subscription.overage_budget) {
    const overageMinutes = minutesUsed - minutesIncluded;
    const pricePerMinute = plan.price_per_extra_minute || 0;
    const overageCost = overageMinutes * pricePerMinute;

    if (overageCost >= subscription.overage_budget) {
      return {
        allowed: false,
        reason: `Overage budget of $${subscription.overage_budget} has been reached. Increase your budget or upgrade your plan.`,
        reasonCode: 'overage_budget',
      };
    }
  }

  return { allowed: true };
}

/**
 * Get the plan-specific max call duration in minutes.
 * Used to set max_duration when dispatching to Bland.
 */
export function getMaxCallDuration(planSlug: string): number {
  const features = CAMPAIGN_FEATURE_ACCESS[planSlug] || CAMPAIGN_FEATURE_ACCESS.free;
  const maxDuration = features.maxCallDurationMinutes;
  // -1 means unlimited — use 600 minutes (10 hours) as practical limit
  return maxDuration === -1 ? 600 : maxDuration;
}
