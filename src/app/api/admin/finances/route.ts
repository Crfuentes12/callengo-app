// app/api/admin/finances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { BLAND_COST_PER_MINUTE } from '@/lib/bland/master-client';

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get period from query
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current';

    let periodStart: Date;
    const periodEnd: Date = new Date();

    switch (period) {
      case 'last_30':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case 'last_90':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case 'current':
      default:
        periodStart = new Date();
        periodStart.setDate(1);
        break;
    }

    // Fetch finances from DB + Bland master account info + admin config in parallel
    const [financeResult, blandMasterInfo, adminConfigResult] = await Promise.all([
      supabase
        .from('admin_finances')
        .select('*')
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString())
        .order('period_start', { ascending: false }),

      fetchBlandMasterAccountInfo(),

      // Admin platform config (persisted Bland plan selection)
      supabaseAdmin
        .from('admin_platform_config')
        .select('*')
        .limit(1)
        .single(),
    ]);

    if (financeResult.error) throw financeResult.error;

    const finances = financeResult.data || [];
    const adminConfig = adminConfigResult.data;

    // Override blandMasterInfo with persisted config if available
    if (adminConfig?.bland_plan) {
      blandMasterInfo.plan = adminConfig.bland_plan;
      blandMasterInfo.concurrentLimit = String(adminConfig.bland_concurrent_cap);
      blandMasterInfo.dailyLimit = String(adminConfig.bland_daily_cap);
      blandMasterInfo.transferRate = Number(adminConfig.bland_transfer_rate);
      if (blandMasterInfo.balance === 0 && adminConfig.bland_account_balance) {
        blandMasterInfo.balance = Number(adminConfig.bland_account_balance);
      }
      if (blandMasterInfo.subscription) {
        blandMasterInfo.subscription.plan = adminConfig.bland_plan;
        blandMasterInfo.subscription.perMinRate = Number(adminConfig.bland_cost_per_minute);
        blandMasterInfo.subscription.transferRate = Number(adminConfig.bland_transfer_rate);
        blandMasterInfo.subscription.concurrentLimit = String(adminConfig.bland_concurrent_cap);
        blandMasterInfo.subscription.dailyLimit = String(adminConfig.bland_daily_cap);
      } else {
        blandMasterInfo.subscription = {
          plan: adminConfig.bland_plan,
          status: 'active',
          perMinRate: Number(adminConfig.bland_cost_per_minute),
          transferRate: Number(adminConfig.bland_transfer_rate),
          concurrentLimit: String(adminConfig.bland_concurrent_cap),
          dailyLimit: String(adminConfig.bland_daily_cap),
          monthlyCost: 0,
        };
      }
    }

    // Enrich each finance record with live Bland master account data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedFinances: any[] = finances.map(f => ({
      ...f,
      // Override with actual values from Bland master account / config
      bland_talk_rate: BLAND_COST_PER_MINUTE,
      bland_transfer_rate: blandMasterInfo.transferRate,
      bland_plan: blandMasterInfo.plan || f.bland_plan || null,
      bland_plan_cost: blandMasterInfo.planCost ?? f.bland_plan_cost ?? 0,
      bland_concurrent_limit: blandMasterInfo.concurrentLimit || f.bland_concurrent_limit || '∞',
      bland_daily_limit: blandMasterInfo.dailyLimit || f.bland_daily_limit || '∞',
      active_subaccounts: 0,
      // Master account info for admin display
      bland_master_balance: blandMasterInfo.balance,
      bland_master_subscription: blandMasterInfo.subscription,
    }));

    // If no finance records exist, return a synthesized one with master info
    if (enrichedFinances.length === 0) {
      enrichedFinances.push({
        bland_talk_rate: BLAND_COST_PER_MINUTE,
        bland_transfer_rate: blandMasterInfo.transferRate,
        bland_plan: blandMasterInfo.plan || null,
        bland_plan_cost: blandMasterInfo.planCost ?? 0,
        bland_concurrent_limit: blandMasterInfo.concurrentLimit || '∞',
        bland_daily_limit: blandMasterInfo.dailyLimit || '∞',
        active_subaccounts: 0,
        bland_master_balance: blandMasterInfo.balance,
        bland_master_subscription: blandMasterInfo.subscription,
        revenue_total: 0,
        revenue_subscriptions: 0,
        revenue_overages: 0,
        cost_total: 0,
        cost_bland: 0,
        cost_openai: 0,
        cost_supabase: 0,
        gross_margin: 0,
        gross_margin_percent: 0,
        total_companies_active: 0,
        total_users_active: 0,
        total_calls_made: 0,
        total_minutes_used: 0,
        avg_minutes_per_call: 0,
        avg_revenue_per_company: 0,
        overage_revenue_percent: 0,
      });
    }

    return NextResponse.json({
      finances: enrichedFinances,
    });

  } catch (error) {
    console.error('Error fetching admin finances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finances' },
      { status: 500 }
    );
  }
}

interface BlandMasterInfo {
  balance: number;
  plan: string | null;
  planCost: number | null;
  concurrentLimit: string | null;
  dailyLimit: string | null;
  transferRate: number;
  subscription: {
    plan: string;
    status: string;
    perMinRate: number;
    transferRate: number;
    concurrentLimit: string;
    dailyLimit: string;
    monthlyCost: number;
  } | null;
}

async function fetchBlandMasterAccountInfo(): Promise<BlandMasterInfo> {
  const defaults: BlandMasterInfo = {
    balance: 0,
    plan: null,
    planCost: null,
    concurrentLimit: null,
    dailyLimit: null,
    transferRate: 0,
    subscription: null,
  };

  if (!BLAND_MASTER_KEY) return defaults;

  try {
    // Try to get org/account info which contains plan details
    const endpoints = [
      `${BLAND_API_URL}/org`,
      `${BLAND_API_URL}/me`,
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': BLAND_MASTER_KEY },
        });

        if (!response.ok) continue;

        const data = await response.json();

        // Extract plan info from the response
        const plan = data.plan || data.subscription_plan || data.billing?.plan || null;
        const planCost = data.plan_cost || data.billing?.plan_cost || data.monthly_cost || null;
        const balance = data.credits || data.balance || data.current_balance || data.billing?.credits || 0;
        const concurrentLimit = data.concurrent_limit || data.concurrency_limit || data.billing?.concurrent_limit || null;
        const dailyLimit = data.daily_limit || data.billing?.daily_limit || null;
        const talkRate = data.talk_rate || data.per_minute_rate || data.billing?.talk_rate || BLAND_COST_PER_MINUTE;
        const transferRate = data.transfer_rate || data.billing?.transfer_rate || 0;

        return {
          balance: typeof balance === 'number' ? balance : 0,
          plan: plan ? String(plan) : null,
          planCost: typeof planCost === 'number' ? planCost : null,
          concurrentLimit: concurrentLimit ? String(concurrentLimit) : null,
          dailyLimit: dailyLimit ? String(dailyLimit) : null,
          transferRate: typeof transferRate === 'number' ? transferRate : 0,
          subscription: {
            plan: plan ? String(plan) : 'Unknown',
            status: 'active',
            perMinRate: typeof talkRate === 'number' ? talkRate : BLAND_COST_PER_MINUTE,
            transferRate: typeof transferRate === 'number' ? transferRate : 0,
            concurrentLimit: concurrentLimit ? String(concurrentLimit) : '∞',
            dailyLimit: dailyLimit ? String(dailyLimit) : '∞',
            monthlyCost: typeof planCost === 'number' ? planCost : 0,
          },
        };
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('[finances] Error fetching Bland master info:', error);
  }

  return defaults;
}
