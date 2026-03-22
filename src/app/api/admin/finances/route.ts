// app/api/admin/finances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { BLAND_COST_PER_MINUTE } from '@/lib/bland/master-client';
import { stripe } from '@/lib/stripe';

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

    if (!userData || userData.role !== 'admin') {
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

    // Fetch all data sources in parallel
    const [
      blandMasterInfo,
      adminConfigResult,
      activeSubsResult,
      allUsersResult,
      callLogsResult,
      usageResult,
      billingHistoryResult,
    ] = await Promise.all([
      fetchBlandMasterAccountInfo(),

      // Admin platform config (persisted Bland plan selection)
      supabaseAdmin
        .from('admin_platform_config')
        .select('*')
        .limit(1)
        .single(),

      // Active subscriptions with plan info
      supabaseAdmin
        .from('company_subscriptions')
        .select('*, subscription_plans(*)')
        .in('status', ['active', 'trialing']),

      // All active users
      supabaseAdmin
        .from('users')
        .select('id, company_id'),

      // Call logs in period
      supabaseAdmin
        .from('call_logs')
        .select('id, call_length, status, company_id')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString()),

      // Usage tracking (current period)
      supabaseAdmin
        .from('usage_tracking')
        .select('company_id, minutes_used, minutes_included')
        .gte('period_end', periodStart.toISOString()),

      // Billing history (payments in period)
      supabaseAdmin
        .from('billing_history')
        .select('amount, currency, status, company_id')
        .gte('created_at', periodStart.toISOString())
        .eq('status', 'paid'),
    ]);

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

    // ── Compute live financial data ──────────────────────────────────

    const activeSubs = activeSubsResult.data || [];
    const allUsers = allUsersResult.data || [];
    const callLogs = callLogsResult.data || [];
    const usageData = usageResult.data || [];
    const billingHistory = billingHistoryResult.data || [];

    // Active companies: companies with active subscriptions
    // Also count from users table as fallback (in case subscription query returns empty)
    const activeCompanyIds = new Set(activeSubs.map(s => s.company_id));
    // If no subs found, count unique company_ids from users
    const userCompanyIds = new Set(allUsers.map(u => u.company_id).filter(Boolean));
    const totalCompaniesActive = activeCompanyIds.size > 0 ? activeCompanyIds.size : userCompanyIds.size;

    // Active users: all users with a company
    const totalUsersActive = allUsers.filter(u => u.company_id).length;

    // Subscription revenue (MRR from plans)
    let revenueSubscriptions = 0;
    for (const sub of activeSubs) {
      const plan = sub.subscription_plans as { price_monthly?: number; price_yearly?: number; slug?: string } | null;
      if (!plan || plan.slug === 'free') continue;
      if (sub.billing_cycle === 'annual') {
        revenueSubscriptions += (plan.price_yearly || 0) / 12;
      } else {
        revenueSubscriptions += plan.price_monthly || 0;
      }
    }

    // Overage revenue from billing history (beyond subscription amounts)
    const totalPayments = billingHistory.reduce((sum, bh) => sum + (bh.amount || 0), 0);
    // Estimate overage: total payments minus subscription revenue (approximation)
    const usageOverages = usageData.reduce((sum, u) => {
      const overageMin = Math.max(0, (u.minutes_used || 0) - (u.minutes_included || 0));
      // Find the company's plan overage rate
      const companySub = activeSubs.find(s => s.company_id === u.company_id);
      const plan = companySub?.subscription_plans as { price_per_extra_minute?: number } | null;
      return sum + overageMin * (plan?.price_per_extra_minute || 0);
    }, 0);

    // Calls and minutes
    const totalCallsMade = callLogs.length;
    const totalMinutesUsed = callLogs.reduce(
      (sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0
    );
    const avgMinutesPerCall = totalCallsMade > 0 ? totalMinutesUsed / totalCallsMade : 0;

    // Costs
    const costBland = totalMinutesUsed * BLAND_COST_PER_MINUTE;
    const costOpenai = 0; // Would need OpenAI usage tracking
    const costSupabase = 0; // Fixed cost, not tracked per-period
    const costTotal = costBland + costOpenai + costSupabase;

    // Revenue and margin — gross = plan prices, net = gross - discounts
    const revenueOverages = usageOverages;
    const grossRevenue = revenueSubscriptions + revenueOverages;
    // Net revenue will be computed after discount calculation below

    // Stripe discount impact
    let totalDiscountImpact = 0;
    try {
      const [stripeSubs, allCoupons] = await Promise.all([
        stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.discounts'] }),
        stripe.coupons.list({ limit: 100 }),
      ]);
      const couponMap = new Map(allCoupons.data.map(c => [c.id, c]));
      for (const sub of stripeSubs.data) {
        const firstDiscount = (sub.discounts && sub.discounts.length > 0) ? sub.discounts[0] : null;
        if (!firstDiscount || typeof firstDiscount === 'string') continue;
        const couponRef = firstDiscount.source?.coupon;
        const coupon = typeof couponRef === 'string'
          ? couponMap.get(couponRef) || null
          : couponRef;
        if (!coupon) continue;
        const planAmount = sub.items.data.reduce((sum, item) => {
          const ua = item.price?.unit_amount || 0;
          return sum + (item.price?.recurring?.interval === 'year' ? ua / 12 : ua);
        }, 0) / 100;
        if (coupon.percent_off) {
          totalDiscountImpact += planAmount * (coupon.percent_off / 100);
        } else if (coupon.amount_off) {
          totalDiscountImpact += Math.min(coupon.amount_off / 100, planAmount);
        }
      }
    } catch (err) {
      console.error('[finances] Failed to fetch Stripe discounts:', err);
    }

    // Actual revenue = what's collected (can't be negative — promo users pay $0, not negative)
    const actualRevenue = Math.max(0, grossRevenue - totalDiscountImpact);
    const grossMargin = actualRevenue - costTotal;
    const grossMarginPercent = actualRevenue > 0 ? (grossMargin / actualRevenue) * 100 : 0;
    // ARPC: only count paying companies (exclude fully discounted)
    const paidCompanies = activeSubs.filter(s => {
      const plan = s.subscription_plans as { slug?: string } | null;
      return plan && plan.slug !== 'free';
    }).length;
    const payingCompanies = Math.max(0, paidCompanies); // Stripe promo subs are still "active" in DB
    const avgRevenuePerCompany = payingCompanies > 0 ? actualRevenue / payingCompanies : 0;
    const overageRevenuePercent = revenueSubscriptions > 0 ? (revenueOverages / revenueSubscriptions) * 100 : 0;

    const financeRecord = {
      bland_talk_rate: BLAND_COST_PER_MINUTE,
      bland_transfer_rate: blandMasterInfo.transferRate,
      bland_plan: blandMasterInfo.plan || null,
      bland_plan_cost: blandMasterInfo.planCost ?? 0,
      bland_concurrent_limit: blandMasterInfo.concurrentLimit || '∞',
      bland_daily_limit: blandMasterInfo.dailyLimit || '∞',
      active_subaccounts: 0,
      bland_master_balance: blandMasterInfo.balance,
      bland_master_subscription: blandMasterInfo.subscription,
      // Gross = plan prices (catalog value, before discounts)
      revenue_gross: Math.round(grossRevenue * 100) / 100,
      // Total = actual revenue collected (never negative)
      revenue_total: Math.round(actualRevenue * 100) / 100,
      revenue_subscriptions: Math.round(revenueSubscriptions * 100) / 100,
      revenue_overages: Math.round(revenueOverages * 100) / 100,
      total_discount_impact: Math.round(totalDiscountImpact * 100) / 100,
      cost_total: Math.round(costTotal * 100) / 100,
      cost_bland: Math.round(costBland * 100) / 100,
      cost_openai: costOpenai,
      cost_supabase: costSupabase,
      gross_margin: Math.round(Math.max(grossMargin, -costTotal) * 100) / 100,
      gross_margin_percent: Math.round(grossMarginPercent * 10) / 10,
      paying_companies: payingCompanies,
      total_companies_active: totalCompaniesActive,
      total_users_active: totalUsersActive,
      total_calls_made: totalCallsMade,
      total_minutes_used: totalMinutesUsed,
      avg_minutes_per_call: Math.round(avgMinutesPerCall * 100) / 100,
      avg_revenue_per_company: Math.round(avgRevenuePerCompany * 100) / 100,
      overage_revenue_percent: Math.round(overageRevenuePercent * 10) / 10,
    };

    return NextResponse.json({
      finances: [financeRecord],
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
