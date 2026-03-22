// app/api/admin/command-center/route.ts
// Admin Command Center — real-time health metrics with single master key architecture
// Shows: Bland plan info, concurrency, daily/hourly usage, limits, Redis state
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { getBlandAccountInfo, BLAND_COST_PER_MINUTE, BLAND_PLAN_LIMITS } from '@/lib/bland/master-client';
import {
  getConcurrencySnapshot,
  cacheBlandLimits,
  resetStaleConcurrency,
  REDIS_AVAILABLE,
} from '@/lib/redis/concurrency-manager';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future use
import { getCompanyNumbers } from '@/lib/bland/phone-numbers';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Ensure admin's company has a subscription + master key
    if (userData.company_id) {
      await ensureAdminCompanySetup(userData.company_id);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Read persisted admin config (source of truth for Bland plan selection)
    const { data: adminConfig } = await supabaseAdmin
      .from('admin_platform_config')
      .select('*')
      .limit(1)
      .single();

    // Get active company IDs
    const { data: usersWithCompanies } = await supabaseAdmin
      .from('users')
      .select('company_id');
    const { data: allCompanies } = await supabaseAdmin
      .from('companies')
      .select('id, name');

    const companiesWithUsers = new Set(
      (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
    );
    const archivedCompanies = (allCompanies || []).filter(c => c.name.startsWith('[ARCHIVED] '));
    const orphanedCompanies = (allCompanies || []).filter(
      c => !companiesWithUsers.has(c.id) && !c.name.startsWith('[ARCHIVED] ')
    );
    const activeCompanyIds = new Set(
      (allCompanies || [])
        .filter(c => companiesWithUsers.has(c.id) && !c.name.startsWith('[ARCHIVED] '))
        .map(c => c.id)
    );

    // Time boundaries
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [
      blandAccountResult,
      concurrencySnapshot,
      callsTodayResult,
      callsThisHourResult,
      activeCallsResult,
      callsThisMonthResult,
      minutesThisMonthResult,
      companiesResult,
      recentEventsResult,
      dedicatedNumbersResult,
      // New: MRR & subscription analytics
      allSubscriptionsResult,
      // New: Failed calls this month
      failedCallsResult,
      // New: Stripe revenue from billing_history
      billingHistoryResult,
      // New: Call duration stats this month
      callDurationStatsResult,
    ] = await Promise.all([
      // 1. Bland AI master account info (plan, balance, limits)
      getBlandAccountInfo().catch(err => ({
        status: 'error',
        balance: 0,
        totalCalls: 0,
        plan: null as string | null,
        dailyCap: 100,
        hourlyCap: 100,
        concurrentCap: 10,
        voiceClones: 0,
        costPerMinute: BLAND_COST_PER_MINUTE,
        transferRate: 0.05,
        error: String(err),
      })),

      // 2. Redis concurrency snapshot
      getConcurrencySnapshot(),

      // 3. Calls today (across all companies)
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // 4. Calls in the last hour
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hourAgo),

      // 5. Active/in-progress calls right now
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['in_progress', 'ringing', 'queued']),

      // 6. Total calls this month
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart),

      // 7. Total minutes this month (from usage_tracking)
      supabaseAdmin
        .from('usage_tracking')
        .select('company_id, minutes_used, minutes_included')
        .gte('period_start', monthStart),

      // 8. Active companies with subscriptions
      supabaseAdmin
        .from('company_subscriptions')
        .select('id, company_id, status, subscription_plans(slug)')
        .in('status', ['active', 'trialing']),

      // 9. Recent billing events (last 24h)
      supabaseAdmin
        .from('billing_events')
        .select('*')
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),

      // 10. Dedicated numbers across all companies
      supabaseAdminRaw
        .from('company_addons')
        .select('id, company_id, dedicated_phone_number, status')
        .eq('addon_type', 'dedicated_number')
        .eq('status', 'active'),

      // 11. All subscriptions (for MRR, churn, trial conversion)
      supabaseAdmin
        .from('company_subscriptions')
        .select('id, company_id, status, billing_cycle, created_at, current_period_end, subscription_plans(slug, name, price_monthly, price_yearly)'),

      // 12. Failed/error calls this month
      supabaseAdmin
        .from('call_logs')
        .select('id, status, error_message, company_id, created_at')
        .in('status', ['failed', 'error', 'no_answer'])
        .gte('created_at', monthStart)
        .order('created_at', { ascending: false })
        .limit(200),

      // 13. Billing history (Stripe payments) for revenue tracking
      supabaseAdmin
        .from('billing_history')
        .select('id, company_id, amount, currency, status, created_at')
        .gte('created_at', thirtyDaysAgo)
        .eq('status', 'paid'),

      // 14. Call duration stats (for avg duration + burn rate)
      supabaseAdmin
        .from('call_logs')
        .select('call_length, created_at, status')
        .gte('created_at', monthStart)
        .not('call_length', 'is', null),
    ]);

    // Override Bland account info with DB-persisted config (source of truth)
    if (adminConfig?.bland_plan && BLAND_PLAN_LIMITS[adminConfig.bland_plan]) {
      const dbLimits = BLAND_PLAN_LIMITS[adminConfig.bland_plan];
      blandAccountResult.plan = adminConfig.bland_plan;
      blandAccountResult.dailyCap = dbLimits.dailyCap;
      blandAccountResult.hourlyCap = dbLimits.hourlyCap;
      blandAccountResult.concurrentCap = dbLimits.concurrentCap;
      blandAccountResult.costPerMinute = dbLimits.costPerMinute;
      blandAccountResult.transferRate = dbLimits.transferRate;
      blandAccountResult.voiceClones = dbLimits.voiceClones;
    }

    // Also update cached balance from DB if available
    if (adminConfig?.bland_account_balance != null && blandAccountResult.balance === 0) {
      blandAccountResult.balance = Number(adminConfig.bland_account_balance);
    }

    // Cache Bland plan limits in Redis for concurrency manager
    if (blandAccountResult.plan) {
      await cacheBlandLimits({
        dailyCap: blandAccountResult.dailyCap,
        hourlyCap: blandAccountResult.hourlyCap,
        concurrentCap: blandAccountResult.concurrentCap,
        plan: blandAccountResult.plan,
      }).catch(() => {}); // Non-fatal
    }

    // Sync Bland API balance back to DB (non-blocking, fire-and-forget)
    if (blandAccountResult.balance > 0 && !(blandAccountResult as Record<string, unknown>).error) {
      void supabaseAdmin
        .from('admin_platform_config')
        .update({
          bland_account_balance: blandAccountResult.balance,
          bland_account_plan: blandAccountResult.plan,
          bland_account_total_calls: blandAccountResult.totalCalls,
          bland_last_synced_at: now.toISOString(),
        })
        .not('id', 'is', null);
    }

    // Filter to active companies
    const activeSubscriptions = (companiesResult.data || []).filter(
      sub => activeCompanyIds.has(sub.company_id)
    );
    const activeUsage = (minutesThisMonthResult.data || []).filter(
      row => activeCompanyIds.has(row.company_id)
    );

    // Aggregate minutes
    const totalMinutesUsed = activeUsage.reduce(
      (sum, row) => sum + (row.minutes_used || 0), 0
    );
    const totalMinutesIncluded = activeUsage.reduce(
      (sum, row) => sum + (row.minutes_included || 0), 0
    );

    // Plan distribution
    const planDistribution: Record<string, number> = {};
    activeSubscriptions.forEach((sub) => {
      const slug = (sub.subscription_plans as { slug?: string } | null)?.slug || 'unknown';
      planDistribution[slug] = (planDistribution[slug] || 0) + 1;
    });

    // Build hourly calls history (last 24 hours)
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: hourlyCallsRaw } = await supabaseAdmin
      .from('call_logs')
      .select('created_at')
      .gte('created_at', last24hStart)
      .order('created_at', { ascending: true });

    const hourlyBuckets: { hour: string; calls: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const bucketEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);
      const label = bucketStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const count = (hourlyCallsRaw || []).filter((c) => {
        const t = new Date(c.created_at);
        return t >= bucketStart && t < bucketEnd;
      }).length;
      hourlyBuckets.push({ hour: label, calls: count });
    }

    // Build daily calls history (last 30 days)
    const last30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dailyCallsRaw } = await supabaseAdmin
      .from('call_logs')
      .select('created_at')
      .gte('created_at', last30dStart)
      .order('created_at', { ascending: true });

    const dailyBuckets: { date: string; calls: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const count = (dailyCallsRaw || []).filter((c) =>
        c.created_at.startsWith(dateStr)
      ).length;
      dailyBuckets.push({ date: dateStr, calls: count });
    }

    // Alerts
    const alerts: { level: string; message: string; time: string }[] = [];

    // Bland balance alerts
    const blandError = (blandAccountResult as Record<string, unknown>).error as string | undefined;
    if (blandError) {
      alerts.push({
        level: 'warning',
        message: `Bland AI account check failed: ${blandError}`,
        time: now.toISOString(),
      });
    } else if (blandAccountResult.balance < 1) {
      alerts.push({
        level: 'critical',
        message: `Bland AI balance depleted: $${blandAccountResult.balance.toFixed(2)}`,
        time: now.toISOString(),
      });
    } else if (blandAccountResult.balance < 5) {
      alerts.push({
        level: 'warning',
        message: `Bland AI balance low: $${blandAccountResult.balance.toFixed(2)}`,
        time: now.toISOString(),
      });
    }

    // Concurrency alerts
    if (concurrencySnapshot.globalConcurrent > concurrencySnapshot.blandLimits.concurrentCap * 0.8) {
      alerts.push({
        level: 'warning',
        message: `Concurrent calls at ${Math.round((concurrencySnapshot.globalConcurrent / concurrencySnapshot.blandLimits.concurrentCap) * 100)}% capacity (${concurrencySnapshot.globalConcurrent}/${concurrencySnapshot.blandLimits.concurrentCap})`,
        time: now.toISOString(),
      });
    }

    // Daily cap alert
    if (concurrencySnapshot.globalDaily > concurrencySnapshot.blandLimits.dailyCap * 0.8) {
      alerts.push({
        level: 'warning',
        message: `Daily calls at ${Math.round((concurrencySnapshot.globalDaily / concurrencySnapshot.blandLimits.dailyCap) * 100)}% of Bland limit (${concurrencySnapshot.globalDaily}/${concurrencySnapshot.blandLimits.dailyCap})`,
        time: now.toISOString(),
      });
    }

    const usagePercent = totalMinutesIncluded > 0
      ? (totalMinutesUsed / totalMinutesIncluded) * 100
      : 0;

    // ════════════════════════════════════════════════════════════════
    // NEW: MRR, Churn, Trial Conversion, Burn Rate, Failed Calls
    // ════════════════════════════════════════════════════════════════

    const allSubs = allSubscriptionsResult.data || [];

    // MRR calculation: sum of monthly revenue from active subscriptions
    let mrr = 0;
    let trialCount = 0;
    let activeCount = 0;
    let canceledCount = 0;
    let pastDueCount = 0;
    let expiredCount = 0;

    // Revenue by plan for breakdown
    const revenueByPlan: Record<string, { count: number; mrr: number }> = {};

    for (const sub of allSubs) {
      const plan = sub.subscription_plans as { slug?: string; name?: string; price_monthly?: number; price_yearly?: number } | null;
      const slug = plan?.slug || 'unknown';
      const monthlyPrice = plan?.price_monthly || 0;
      const yearlyPrice = plan?.price_yearly || 0;

      if (!revenueByPlan[slug]) revenueByPlan[slug] = { count: 0, mrr: 0 };

      if (sub.status === 'active') {
        activeCount++;
        const monthlyRevenue = sub.billing_cycle === 'annual'
          ? yearlyPrice / 12
          : monthlyPrice;
        mrr += monthlyRevenue;
        revenueByPlan[slug].count++;
        revenueByPlan[slug].mrr += monthlyRevenue;
      } else if (sub.status === 'trialing') {
        trialCount++;
        revenueByPlan[slug].count++;
      } else if (sub.status === 'canceled') {
        canceledCount++;
      } else if (sub.status === 'past_due') {
        pastDueCount++;
      } else if (sub.status === 'expired') {
        expiredCount++;
      }
    }

    // Trial conversion rate (trials that became active / total ever trialing)
    const totalTrialAndActive = trialCount + activeCount;
    const trialConversionRate = totalTrialAndActive > 0
      ? Math.round((activeCount / totalTrialAndActive) * 100)
      : 0;

    // Churn rate: canceled in last 30 days / (active + canceled)
    const recentCanceled = allSubs.filter(s =>
      s.status === 'canceled' &&
      s.current_period_end &&
      new Date(s.current_period_end) >= new Date(thirtyDaysAgo)
    ).length;
    const churnRate = (activeCount + recentCanceled) > 0
      ? Math.round((recentCanceled / (activeCount + recentCanceled)) * 1000) / 10
      : 0;

    // Bland credit burn rate (cost per day based on last 7 days usage)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentCallDurations = (callDurationStatsResult.data || []).filter(
      c => new Date(c.created_at) >= sevenDaysAgo
    );
    const recentMinutes = recentCallDurations.reduce(
      (sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0
    );
    const burnRatePerDay = recentMinutes > 0
      ? (recentMinutes / 7) * blandAccountResult.costPerMinute
      : 0;
    const projectedRunwayDays = burnRatePerDay > 0
      ? Math.round(blandAccountResult.balance / burnRatePerDay)
      : null;

    // Failed calls analysis
    const failedCalls = failedCallsResult.data || [];
    const failedByReason: Record<string, number> = {};
    for (const call of failedCalls) {
      const reason = call.status === 'no_answer' ? 'no_answer'
        : call.error_message ? String(call.error_message).substring(0, 50)
        : call.status || 'unknown';
      failedByReason[reason] = (failedByReason[reason] || 0) + 1;
    }

    // Avg call duration this month
    const allCallDurations = callDurationStatsResult.data || [];
    const completedDurations = allCallDurations.filter(c => c.status === 'completed' && c.call_length);
    const avgCallDurationSec = completedDurations.length > 0
      ? Math.round(completedDurations.reduce((s, c) => s + (c.call_length || 0), 0) / completedDurations.length)
      : 0;

    // Stripe revenue (last 30 days from billing_history)
    const billingHistory = billingHistoryResult.data || [];
    const stripeRevenue30d = billingHistory.reduce(
      (sum, b) => sum + ((b.amount || 0) / 100), 0 // Stripe amounts in cents
    );

    // Bland cost this month (from actual call durations)
    const totalMinutesThisMonth = allCallDurations.reduce(
      (sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0
    );
    const blandCostThisMonth = totalMinutesThisMonth * blandAccountResult.costPerMinute;

    // Mask the Bland API key for display
    const maskedBlandKey = process.env.BLAND_API_KEY
      ? `${process.env.BLAND_API_KEY.substring(0, 8)}...${process.env.BLAND_API_KEY.slice(-4)}`
      : null;

    return NextResponse.json({
      // === Architecture info ===
      architecture: 'single_master_key',

      // === Bland AI Plan Catalog (for dropdown selector) ===
      blandPlanCatalog: Object.entries(BLAND_PLAN_LIMITS).map(([slug, limits]) => ({
        slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        ...limits,
      })),

      // === Bland AI Account ===
      blandAccount: {
        plan: blandAccountResult.plan,
        balance: blandAccountResult.balance,
        totalCalls: blandAccountResult.totalCalls,
        costPerMinute: blandAccountResult.costPerMinute,
        transferRate: blandAccountResult.transferRate,
        voiceClones: blandAccountResult.voiceClones,
        apiKeyMasked: maskedBlandKey,
      },

      // === Real-Time Limits (from Bland plan) ===
      blandLimits: {
        dailyCap: blandAccountResult.dailyCap,
        hourlyCap: blandAccountResult.hourlyCap,
        concurrentCap: blandAccountResult.concurrentCap,
      },

      // === Real-Time Concurrency (from Redis) ===
      concurrency: {
        globalConcurrent: concurrencySnapshot.globalConcurrent,
        globalDaily: concurrencySnapshot.globalDaily,
        globalHourly: concurrencySnapshot.globalHourly,
        activeCallCount: concurrencySnapshot.activeCallCount,
        topCompanies: concurrencySnapshot.topCompanies,
        redisAvailable: REDIS_AVAILABLE,
        redisConnected: REDIS_AVAILABLE && (concurrencySnapshot.blandLimits.plan !== 'start' || concurrencySnapshot.globalConcurrent >= 0),
      },

      // === Usage Gauges (percentage of Bland limits used) ===
      gauges: {
        concurrentPercent: blandAccountResult.concurrentCap > 0
          ? Math.round((concurrencySnapshot.globalConcurrent / blandAccountResult.concurrentCap) * 100)
          : 0,
        dailyPercent: blandAccountResult.dailyCap > 0
          ? Math.round(((callsTodayResult.count || 0) / blandAccountResult.dailyCap) * 100)
          : 0,
        hourlyPercent: blandAccountResult.hourlyCap > 0
          ? Math.round(((callsThisHourResult.count || 0) / blandAccountResult.hourlyCap) * 100)
          : 0,
      },

      // === Call Metrics ===
      callsToday: callsTodayResult.count || 0,
      callsThisHour: callsThisHourResult.count || 0,
      activeCalls: activeCallsResult.count || 0,
      callsThisMonth: callsThisMonthResult.count || 0,
      totalMinutesUsed,
      totalMinutesIncluded,
      usagePercent: Math.round(usagePercent * 10) / 10,

      // === Company Metrics ===
      activeCompanies: activeSubscriptions.length,
      orphanedCompanies: orphanedCompanies.length,
      archivedCompanies: archivedCompanies.length,
      planDistribution,

      // === Dedicated Numbers ===
      dedicatedNumbers: {
        total: dedicatedNumbersResult.data?.length || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        numbers: (dedicatedNumbersResult.data || []).map((n: any) => ({
          companyId: n.company_id,
          phoneNumber: n.dedicated_phone_number,
        })),
      },

      // === Charts ===
      hourlyCallsChart: hourlyBuckets,
      dailyCallsChart: dailyBuckets,

      // === Events & Alerts ===
      recentBillingEvents: recentEventsResult.data || [],
      alerts,
      timestamp: now.toISOString(),

      // === NEW: Revenue & Business Metrics ===
      revenue: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        stripeRevenue30d: Math.round(stripeRevenue30d * 100) / 100,
        revenueByPlan,
      },

      // === NEW: Subscription Health ===
      subscriptionHealth: {
        active: activeCount,
        trialing: trialCount,
        canceled: canceledCount,
        pastDue: pastDueCount,
        expired: expiredCount,
        churnRate,
        trialConversionRate,
      },

      // === NEW: Bland Credit Economics ===
      blandEconomics: {
        burnRatePerDay: Math.round(burnRatePerDay * 100) / 100,
        projectedRunwayDays,
        blandCostThisMonth: Math.round(blandCostThisMonth * 100) / 100,
        totalMinutesThisMonth,
        avgCallDurationSec,
        costPerMinute: blandAccountResult.costPerMinute,
      },

      // === NEW: Failed Calls Analysis ===
      failedCalls: {
        totalThisMonth: failedCalls.length,
        byReason: Object.entries(failedByReason)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([reason, count]) => ({ reason, count })),
      },

      // === NEW: Unit Economics Summary ===
      unitEconomics: {
        grossRevenue: Math.round(mrr * 100) / 100,
        grossCost: Math.round(blandCostThisMonth * 100) / 100,
        grossProfit: Math.round((mrr - blandCostThisMonth) * 100) / 100,
        grossMarginPercent: mrr > 0 ? Math.round(((mrr - blandCostThisMonth) / mrr) * 1000) / 10 : 0,
        arpc: activeCount > 0 ? Math.round((mrr / activeCount) * 100) / 100 : 0,
        costPerCall: (callsThisMonthResult.count || 0) > 0
          ? Math.round((blandCostThisMonth / (callsThisMonthResult.count || 1)) * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error('Error in command-center:', error);
    return NextResponse.json({ error: 'Failed to fetch command center data' }, { status: 500 });
  }
}

/**
 * Ensure admin's company has a Free plan subscription + master API key.
 * Idempotent — safe to call on every Command Center load.
 */
async function ensureAdminCompanySetup(companyId: string) {
  try {
    // Check if subscription exists
    const { data: existingSub } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, plan_id')
      .eq('company_id', companyId)
      .limit(1)
      .single();

    if (!existingSub) {
      // Create free plan subscription for admin
      const { data: freePlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('id, minutes_included')
        .eq('slug', 'free')
        .single();

      if (freePlan) {
        const now = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 90);

        const { data: newSub } = await supabaseAdmin
          .from('company_subscriptions')
          .insert({
            company_id: companyId,
            plan_id: freePlan.id,
            billing_cycle: 'monthly',
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            overage_enabled: false,
            overage_budget: 0,
            overage_spent: 0,
          })
          .select()
          .single();

        if (newSub) {
          await supabaseAdmin.from('usage_tracking').insert({
            company_id: companyId,
            subscription_id: newSub.id,
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            minutes_used: 0,
            minutes_included: freePlan.minutes_included,
          });
        }
      }
    }

    // Ensure master API key is stored
    const masterKey = process.env.BLAND_API_KEY;
    if (masterKey) {
      const { data: settings } = await supabaseAdmin
        .from('company_settings')
        .select('bland_api_key')
        .eq('company_id', companyId)
        .single();

      if (!settings?.bland_api_key) {
        await supabaseAdmin
          .from('company_settings')
          .update({
            bland_api_key: masterKey,
            bland_subaccount_id: 'master',
          })
          .eq('company_id', companyId);
      }
    }
  } catch (error) {
    console.error('[admin-setup] Admin company setup error (non-fatal):', error);
  }
}

// ================================================================
// POST: Admin selects Bland AI plan → cache limits in Redis
// ================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !BLAND_PLAN_LIMITS[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan. Valid options: ' + Object.keys(BLAND_PLAN_LIMITS).join(', ') },
        { status: 400 }
      );
    }

    const limits = BLAND_PLAN_LIMITS[plan];

    // Read current config for audit log
    const { data: currentConfig } = await supabaseAdmin
      .from('admin_platform_config')
      .select('bland_plan, bland_cost_per_minute, bland_daily_cap, bland_hourly_cap, bland_concurrent_cap')
      .limit(1)
      .single();

    // Persist to DB (source of truth)
    const { error: updateError } = await supabaseAdmin
      .from('admin_platform_config')
      .update({
        bland_plan: plan,
        bland_cost_per_minute: limits.costPerMinute,
        bland_transfer_rate: limits.transferRate,
        bland_daily_cap: limits.dailyCap,
        bland_hourly_cap: limits.hourlyCap,
        bland_concurrent_cap: limits.concurrentCap,
        bland_voice_clones: limits.voiceClones,
        updated_by: user.id,
      })
      .not('id', 'is', null); // Update the singleton row

    if (updateError) {
      console.error('Failed to update admin_platform_config:', updateError);
      // If table doesn't exist yet, insert
      await supabaseAdmin
        .from('admin_platform_config')
        .insert({
          bland_plan: plan,
          bland_cost_per_minute: limits.costPerMinute,
          bland_transfer_rate: limits.transferRate,
          bland_daily_cap: limits.dailyCap,
          bland_hourly_cap: limits.hourlyCap,
          bland_concurrent_cap: limits.concurrentCap,
          bland_voice_clones: limits.voiceClones,
          updated_by: user.id,
        });
    }

    // Cache in Redis too (for concurrency manager fast access)
    await cacheBlandLimits({
      dailyCap: limits.dailyCap,
      hourlyCap: limits.hourlyCap,
      concurrentCap: limits.concurrentCap,
      plan,
    });

    // Reset stale concurrency counters to sync with new limits
    await resetStaleConcurrency();

    // Audit log
    await supabaseAdmin
      .from('admin_audit_log')
      .insert({
        user_id: user.id,
        action: 'bland_plan_changed',
        entity_type: 'bland_plan',
        entity_id: plan,
        old_value: currentConfig ? {
          plan: currentConfig.bland_plan,
          costPerMinute: currentConfig.bland_cost_per_minute,
          dailyCap: currentConfig.bland_daily_cap,
        } : null,
        new_value: {
          plan,
          costPerMinute: limits.costPerMinute,
          dailyCap: limits.dailyCap,
          hourlyCap: limits.hourlyCap,
          concurrentCap: limits.concurrentCap,
        },
      });
    // Audit log is fire-and-forget, don't block response

    return NextResponse.json({
      success: true,
      plan,
      limits: {
        dailyCap: limits.dailyCap,
        hourlyCap: limits.hourlyCap,
        concurrentCap: limits.concurrentCap,
        costPerMinute: limits.costPerMinute,
        transferRate: limits.transferRate,
        voiceClones: limits.voiceClones,
      },
    });
  } catch (error) {
    console.error('Error updating Bland plan:', error);
    return NextResponse.json({ error: 'Failed to update Bland plan' }, { status: 500 });
  }
}
