// app/api/admin/command-center/route.ts
// Admin Command Center — real-time health metrics with single master key architecture
// Shows: Bland plan info, concurrency, daily/hourly usage, limits, Redis state
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { getBlandAccountInfo, BLAND_COST_PER_MINUTE } from '@/lib/bland/master-client';
import {
  getConcurrencySnapshot,
  cacheBlandLimits,
  resetStaleConcurrency,
} from '@/lib/redis/concurrency-manager';
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
    ]);

    // Cache Bland plan limits in Redis for concurrency manager
    if (blandAccountResult.plan) {
      await cacheBlandLimits({
        dailyCap: blandAccountResult.dailyCap,
        hourlyCap: blandAccountResult.hourlyCap,
        concurrentCap: blandAccountResult.concurrentCap,
        plan: blandAccountResult.plan,
      }).catch(() => {}); // Non-fatal
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

    // Mask the Bland API key for display
    const maskedBlandKey = process.env.BLAND_API_KEY
      ? `${process.env.BLAND_API_KEY.substring(0, 8)}...${process.env.BLAND_API_KEY.slice(-4)}`
      : null;

    return NextResponse.json({
      // === Architecture info ===
      architecture: 'single_master_key',

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
        redisConnected: concurrencySnapshot.blandLimits.plan !== 'start' || concurrencySnapshot.globalConcurrent > 0,
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
