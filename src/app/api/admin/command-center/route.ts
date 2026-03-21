// app/api/admin/command-center/route.ts
// Admin Command Center — aggregates real-time health metrics
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { createBlandSubAccount, allocateBlandCredits, calculateCreditAmount } from '@/lib/bland/subaccount-manager';

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

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

    // Ensure admin's company has a subscription + Bland sub-account (runs once, idempotent)
    if (userData.company_id) {
      await ensureAdminCompanySetup(userData.company_id);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get active company IDs (companies with at least one user, not archived)
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

    // Mask the Bland API key for admin display (e.g., "org_abc1...def9")
    const maskedBlandKey = BLAND_MASTER_KEY
      ? `${BLAND_MASTER_KEY.substring(0, 8)}...${BLAND_MASTER_KEY.slice(-4)}`
      : null;

    // Run all queries in parallel
    const [
      blandBalanceResult,
      callsTodayResult,
      callsThisHourResult,
      activeCallsResult,
      callsThisMonthResult,
      minutesThisMonthResult,
      companiesResult,
      recentEventsResult,
    ] = await Promise.all([
      // 1. Bland AI master account balance
      fetchBlandMasterBalance(),

      // 2. Calls today (across all companies)
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // 3. Calls in the last hour
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hourAgo),

      // 4. Active/in-progress calls right now
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['in_progress', 'ringing', 'queued']),

      // 5. Total calls this month
      supabaseAdmin
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart),

      // 6. Total minutes this month (from usage_tracking)
      supabaseAdmin
        .from('usage_tracking')
        .select('company_id, minutes_used, minutes_included')
        .gte('period_start', monthStart),

      // 7. Active companies with subscriptions
      supabaseAdmin
        .from('company_subscriptions')
        .select('id, company_id, status, subscription_plans(slug)')
        .in('status', ['active', 'trialing']),

      // 8. Recent billing events (last 24h)
      supabaseAdmin
        .from('billing_events')
        .select('*')
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // Filter subscriptions & usage to only active (non-orphan) companies
    const activeSubscriptions = (companiesResult.data || []).filter(
      sub => activeCompanyIds.has(sub.company_id)
    );
    const activeUsage = (minutesThisMonthResult.data || []).filter(
      row => activeCompanyIds.has(row.company_id)
    );

    // Aggregate minutes (only active companies)
    const totalMinutesUsed = activeUsage.reduce(
      (sum, row) => sum + (row.minutes_used || 0), 0
    );
    const totalMinutesIncluded = activeUsage.reduce(
      (sum, row) => sum + (row.minutes_included || 0), 0
    );

    // Plan distribution (only active companies)
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

    // Usage alerts (recent)
    const alerts: { level: string; message: string; time: string }[] = [];

    // Thresholds calibrated for auto-recharge setup (threshold $10, refill $10)
    // Critical = auto-recharge likely failed, Warning = approaching recharge threshold
    if (blandBalanceResult.error) {
      alerts.push({
        level: 'warning',
        message: `Bland AI balance check failed: ${blandBalanceResult.error}`,
        time: now.toISOString(),
      });
    } else if (blandBalanceResult.balance < 1) {
      alerts.push({
        level: 'critical',
        message: `Bland AI master balance depleted: $${blandBalanceResult.balance.toFixed(2)} — auto-recharge may have failed`,
        time: now.toISOString(),
      });
    } else if (blandBalanceResult.balance < 5) {
      alerts.push({
        level: 'warning',
        message: `Bland AI master balance low: $${blandBalanceResult.balance.toFixed(2)} — approaching auto-recharge threshold`,
        time: now.toISOString(),
      });
    }

    const usagePercent = totalMinutesIncluded > 0
      ? (totalMinutesUsed / totalMinutesIncluded) * 100
      : 0;

    return NextResponse.json({
      blandBalance: blandBalanceResult.balance,
      blandBalanceError: blandBalanceResult.error,
      callsToday: callsTodayResult.count || 0,
      callsThisHour: callsThisHourResult.count || 0,
      activeCalls: activeCallsResult.count || 0,
      callsThisMonth: callsThisMonthResult.count || 0,
      totalMinutesUsed,
      totalMinutesIncluded,
      usagePercent: Math.round(usagePercent * 10) / 10,
      activeCompanies: activeSubscriptions.length,
      orphanedCompanies: orphanedCompanies.length,
      archivedCompanies: archivedCompanies.length,
      blandApiKeyMasked: maskedBlandKey,
      planDistribution,
      hourlyCallsChart: hourlyBuckets,
      dailyCallsChart: dailyBuckets,
      recentBillingEvents: recentEventsResult.data || [],
      alerts,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error in command-center:', error);
    return NextResponse.json({ error: 'Failed to fetch command center data' }, { status: 500 });
  }
}

function extractBalance(data: Record<string, unknown>): number | null {
  // Check top-level fields
  for (const key of ['credits', 'balance', 'current_balance', 'available_credits']) {
    if (typeof data[key] === 'number' && data[key] !== 0) return data[key] as number;
  }
  // Check nested billing/account objects
  for (const parent of ['billing', 'account', 'org', 'organization']) {
    if (data[parent] && typeof data[parent] === 'object') {
      const nested = data[parent] as Record<string, unknown>;
      for (const key of ['credits', 'balance', 'current_balance', 'available_credits']) {
        if (typeof nested[key] === 'number' && nested[key] !== 0) return nested[key] as number;
      }
    }
  }
  // If all fields are explicitly 0, return 0 (not null)
  for (const key of ['credits', 'balance', 'current_balance']) {
    if (typeof data[key] === 'number') return data[key] as number;
  }
  return null;
}

/**
 * Ensure admin's company has a Free plan subscription + Bland sub-account.
 * Uses the same credit transfer parameters as any other company.
 * Idempotent — safe to call on every Command Center load.
 *
 * NOTE: If Bland sub-account creation fails (e.g., BYOT_INSERT_FAILED),
 * we assign the master account key directly so the admin can still make calls.
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
        periodEnd.setFullYear(periodEnd.getFullYear() + 10);

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

          console.log(`[admin-setup] Free plan subscription created for admin company ${companyId}`);
        }
      }
    }

    // Check if Bland sub-account / API key exists
    const { data: settings } = await supabaseAdmin
      .from('company_settings')
      .select('bland_subaccount_id, bland_api_key')
      .eq('company_id', companyId)
      .single();

    if (!settings?.bland_api_key) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      // Get plan minutes for credit allocation
      const { data: sub } = await supabaseAdmin
        .from('company_subscriptions')
        .select('subscription_plans(minutes_included)')
        .eq('company_id', companyId)
        .limit(1)
        .single();

      const minutes = (sub?.subscription_plans as { minutes_included?: number } | null)?.minutes_included || 15;

      await createBlandSubAccount(companyId, company?.name || 'Callengo Admin');
      // Note: createBlandSubAccount transfers MIN_INITIAL_BALANCE ($10) on creation.
      // Only allocate additional credits if plan includes more minutes.
      const creditAmount = calculateCreditAmount(minutes);
      if (creditAmount > 10) {
        // The sub-account was created with $10 initial balance,
        // allocate the remainder if the plan requires more
        await allocateBlandCredits(companyId, minutes);
      }
      console.log(`[admin-setup] Bland sub-account + credits allocated for admin company ${companyId}`);
    }
  } catch (error) {
    // Non-fatal — don't block Command Center loading
    console.error('[admin-setup] Admin company setup error (non-fatal):', error);
  }
}

async function fetchBlandMasterBalance(): Promise<{ balance: number; error?: string }> {
  if (!BLAND_MASTER_KEY) {
    return { balance: 0, error: 'BLAND_API_KEY not configured' };
  }

  // Try multiple endpoints — org_ keys may use different paths than sk- keys
  const endpoints = [
    `${BLAND_API_URL}/org`,
    `${BLAND_API_URL}/me`,
    `${BLAND_API_URL}/billing`,
  ];

  const errors: string[] = [];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': BLAND_MASTER_KEY },
      });

      if (!response.ok) {
        errors.push(`${url.split('/v1/')[1]}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const balance = extractBalance(data);
      if (balance !== null) {
        return { balance };
      }
      // Got a 200 but couldn't find balance — log what we received
      errors.push(`${url.split('/v1/')[1]}: 200 OK but no balance field (keys: ${Object.keys(data).join(',')})`);
    } catch (err) {
      errors.push(`${url.split('/v1/')[1]}: ${String(err)}`);
    }
  }

  return { balance: 0, error: `Could not read balance. Tried: ${errors.join(' | ')}` };
}
