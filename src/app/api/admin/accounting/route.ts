// app/api/admin/accounting/route.ts
// Admin Accounting — Full P&L, Balance, Ledger for platform financial overview
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { BLAND_COST_PER_MINUTE } from '@/lib/bland/master-client';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
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

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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
      case 'ytd':
        periodStart = new Date();
        periodStart.setMonth(0, 1);
        break;
      case 'current':
      default:
        periodStart = new Date();
        periodStart.setDate(1);
        break;
    }

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = periodEnd.toISOString();

    // Fetch all data in parallel
    const [
      activeSubsResult,
      allUsersResult,
      callLogsResult,
      usageResult,
      billingHistoryResult,
      billingEventsResult,
      addonsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('company_subscriptions')
        .select('*, subscription_plans(slug, name, price_monthly, price_yearly, minutes_included, price_per_extra_minute)')
        .in('status', ['active', 'trialing']),

      supabaseAdmin
        .from('users')
        .select('id, company_id'),

      supabaseAdmin
        .from('call_logs')
        .select('id, call_length, status, company_id, created_at')
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO),

      supabaseAdmin
        .from('usage_tracking')
        .select('company_id, minutes_used, minutes_included')
        .gte('period_end', periodStartISO),

      supabaseAdmin
        .from('billing_history')
        .select('*')
        .gte('created_at', periodStartISO)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('billing_events')
        .select('*')
        .gte('created_at', periodStartISO)
        .order('created_at', { ascending: false }),

      supabaseAdminRaw
        .from('company_addons')
        .select('company_id, addon_type, quantity, status')
        .eq('status', 'active'),
    ]);

    const activeSubs = activeSubsResult.data || [];
    const allUsers = allUsersResult.data || [];
    const callLogs = callLogsResult.data || [];
    const usageData = usageResult.data || [];
    const billingHistory = billingHistoryResult.data || [];
    const billingEvents = billingEventsResult.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeAddons = (addonsResult.data || []) as any as { company_id: string; addon_type: string; quantity: number; status: string }[];

    // ─── Company/User counts ───────────────────────────
    const activeCompanyIds = new Set(activeSubs.map(s => s.company_id));
    const totalCompanies = activeCompanyIds.size;
    const totalUsers = allUsers.filter(u => u.company_id && activeCompanyIds.has(u.company_id)).length;

    // ─── Stripe discount data ──────────────────────────
    let totalDiscountImpact = 0;
    const discountedSubscriptions: {
      companyId: string;
      plan: string;
      grossAmount: number;
      discountAmount: number;
      netAmount: number;
      promoCode: string | null;
      couponName: string | null;
      percentOff: number | null;
      duration: string;
    }[] = [];

    try {
      const [stripeSubs, allCoupons, allPromoCodes] = await Promise.all([
        stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.discounts', 'data.customer'] }),
        stripe.coupons.list({ limit: 100 }),
        stripe.promotionCodes.list({ limit: 100 }),
      ]);
      const couponMap = new Map(allCoupons.data.map(c => [c.id, c]));
      const promoCodeIdToName = new Map(allPromoCodes.data.map(pc => [pc.id, pc.code]));

      for (const sub of stripeSubs.data) {
        const firstDiscount = (sub.discounts && sub.discounts.length > 0) ? sub.discounts[0] : null;
        if (!firstDiscount || typeof firstDiscount === 'string') continue;
        const couponRef = firstDiscount.source?.coupon;
        const coupon = typeof couponRef === 'string' ? couponMap.get(couponRef) || null : couponRef;
        if (!coupon) continue;

        const cust = sub.customer as { metadata?: Record<string, string> } | string;
        const companyId = typeof cust === 'string' ? null : cust.metadata?.company_id;

        const planAmount = sub.items.data.reduce((sum, item) => {
          const ua = item.price?.unit_amount || 0;
          return sum + (item.price?.recurring?.interval === 'year' ? ua / 12 : ua);
        }, 0) / 100;

        let discAmount = 0;
        if (coupon.percent_off) discAmount = planAmount * (coupon.percent_off / 100);
        else if (coupon.amount_off) discAmount = Math.min(coupon.amount_off / 100, planAmount);

        totalDiscountImpact += discAmount;

        const pcRef = firstDiscount.promotion_code;
        const promoCodeName = pcRef
          ? (typeof pcRef === 'string' ? (promoCodeIdToName.get(pcRef) || null) : pcRef.code)
          : null;

        // Find plan slug from our subs
        const companySub = companyId ? activeSubs.find(s => s.company_id === companyId) : null;
        const planInfo = companySub?.subscription_plans as { slug?: string } | null;

        discountedSubscriptions.push({
          companyId: companyId || 'unknown',
          plan: planInfo?.slug || 'unknown',
          grossAmount: Math.round(planAmount * 100) / 100,
          discountAmount: Math.round(discAmount * 100) / 100,
          netAmount: Math.round((planAmount - discAmount) * 100) / 100,
          promoCode: promoCodeName,
          couponName: coupon.name,
          percentOff: coupon.percent_off,
          duration: coupon.duration,
        });
      }
    } catch (err) {
      console.error('[accounting] Failed to fetch Stripe discounts:', err);
    }

    // ─── P&L COMPUTATION ───────────────────────────────

    // REVENUE
    // Gross subscription revenue (MRR from plan prices, before discounts)
    let grossSubscriptionRevenue = 0;
    const revenueByPlan: Record<string, { count: number; gross: number; net: number }> = {};
    for (const sub of activeSubs) {
      const plan = sub.subscription_plans as { price_monthly?: number; price_yearly?: number; slug?: string; name?: string } | null;
      if (!plan || plan.slug === 'free') continue;
      const monthly = sub.billing_cycle === 'annual'
        ? (plan.price_yearly || 0) / 12
        : (plan.price_monthly || 0);
      grossSubscriptionRevenue += monthly;
      const slug = plan.slug || 'unknown';
      if (!revenueByPlan[slug]) revenueByPlan[slug] = { count: 0, gross: 0, net: 0 };
      revenueByPlan[slug].count++;
      revenueByPlan[slug].gross += monthly;
    }

    // Apply per-plan discount
    for (const ds of discountedSubscriptions) {
      if (revenueByPlan[ds.plan]) {
        revenueByPlan[ds.plan].net = revenueByPlan[ds.plan].gross - ds.discountAmount;
      }
    }
    // Set net = gross for plans without discounts
    for (const slug of Object.keys(revenueByPlan)) {
      if (revenueByPlan[slug].net === 0 && revenueByPlan[slug].gross > 0) {
        revenueByPlan[slug].net = revenueByPlan[slug].gross;
      }
    }

    // Overage revenue
    const overageRevenue = usageData.reduce((sum, u) => {
      const overageMin = Math.max(0, (u.minutes_used || 0) - (u.minutes_included || 0));
      const companySub = activeSubs.find(s => s.company_id === u.company_id);
      const plan = companySub?.subscription_plans as { price_per_extra_minute?: number } | null;
      return sum + overageMin * (plan?.price_per_extra_minute || 0);
    }, 0);

    // Add-on revenue
    const ADDON_PRICES: Record<string, number> = { dedicated_number: 25, recording_vault: 12, calls_booster: 35 };
    const addonRevenue = activeAddons.reduce((sum, a) =>
      sum + (ADDON_PRICES[a.addon_type] || 0) * (a.quantity || 1), 0);

    const totalGrossRevenue = grossSubscriptionRevenue + overageRevenue + addonRevenue;
    const totalNetRevenue = totalGrossRevenue - totalDiscountImpact;

    // Actual payments received (from Stripe billing_history)
    const actualPaymentsReceived = billingHistory
      .filter(bh => bh.status === 'paid')
      .reduce((sum, bh) => sum + (bh.amount || 0), 0);
    const failedPayments = billingHistory
      .filter(bh => bh.status === 'failed')
      .reduce((sum, bh) => sum + (bh.amount || 0), 0);

    // COSTS
    const totalMinutes = callLogs.reduce((sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0);
    const totalCalls = callLogs.length;
    const completedCalls = callLogs.filter(c => c.status === 'completed').length;
    const failedCalls = callLogs.filter(c => c.status && ['failed', 'error', 'no_answer'].includes(c.status)).length;

    const costBland = totalMinutes * BLAND_COST_PER_MINUTE;
    const costOpenAI = 0; // Not tracked per-period yet
    const costSupabase = 0; // Fixed monthly, not tracked
    const costStripeProcessing = actualPaymentsReceived * 0.029 + (billingHistory.filter(bh => bh.status === 'paid').length * 0.30); // ~2.9% + $0.30/txn
    const totalCOGS = costBland + costOpenAI + costSupabase;
    const totalOperatingCosts = totalCOGS + costStripeProcessing;

    // MARGINS
    const grossProfit = totalNetRevenue - totalCOGS;
    const grossMarginPercent = totalNetRevenue > 0 ? (grossProfit / totalNetRevenue) * 100 : 0;
    const operatingProfit = totalNetRevenue - totalOperatingCosts;
    const operatingMarginPercent = totalNetRevenue > 0 ? (operatingProfit / totalNetRevenue) * 100 : 0;

    // UNIT ECONOMICS
    const paidCompanies = activeSubs.filter(s => {
      const plan = s.subscription_plans as { slug?: string } | null;
      return plan && plan.slug !== 'free';
    }).length;
    const arpc = paidCompanies > 0 ? totalNetRevenue / paidCompanies : 0;
    const costPerCall = totalCalls > 0 ? costBland / totalCalls : 0;
    const avgMinPerCall = totalCalls > 0 ? totalMinutes / totalCalls : 0;
    const ltv = arpc > 0 ? arpc * 12 : 0; // Simplified: 12-month LTV

    // ─── LEDGER ENTRIES ────────────────────────────────
    // Build a chronological ledger from billing_history + billing_events
    type LedgerEntry = {
      date: string;
      type: 'revenue' | 'cost' | 'discount' | 'refund';
      category: string;
      description: string;
      debit: number;
      credit: number;
      companyId: string | null;
      reference: string | null;
    };

    const ledger: LedgerEntry[] = [];

    // Revenue entries from billing_history
    for (const bh of billingHistory) {
      if (bh.status === 'paid' && bh.amount > 0) {
        ledger.push({
          date: bh.billing_date || bh.created_at,
          type: 'revenue',
          category: 'Subscription Payment',
          description: `Invoice ${bh.stripe_invoice_id || 'N/A'}`,
          debit: 0,
          credit: bh.amount,
          companyId: bh.company_id,
          reference: bh.stripe_invoice_id,
        });
      } else if (bh.status === 'failed') {
        ledger.push({
          date: bh.billing_date || bh.created_at,
          type: 'cost',
          category: 'Failed Payment',
          description: `Failed invoice ${bh.stripe_invoice_id || 'N/A'}`,
          debit: bh.amount,
          credit: 0,
          companyId: bh.company_id,
          reference: bh.stripe_invoice_id,
        });
      }
    }

    // Billing event entries
    for (const ev of billingEvents) {
      const data = ev.event_data as Record<string, unknown> || {};
      switch (ev.event_type) {
        case 'promo_code_applied':
          ledger.push({
            date: ev.created_at,
            type: 'discount',
            category: 'Promo Code Discount',
            description: `${data.promo_code || data.coupon_name || 'Discount'} (${data.percent_off ? `${data.percent_off}% off` : `$${data.amount_off} off`}) on ${data.plan || 'plan'}`,
            debit: Math.abs(Number(data.discount_amount) || 0),
            credit: 0,
            companyId: ev.company_id,
            reference: null,
          });
          break;
        case 'usage_recorded':
          if (ev.cost_usd && ev.cost_usd > 0) {
            ledger.push({
              date: ev.created_at,
              type: 'cost',
              category: 'Bland AI Usage',
              description: `${ev.minutes_consumed || 0} minutes @ $${BLAND_COST_PER_MINUTE}/min`,
              debit: ev.cost_usd,
              credit: 0,
              companyId: ev.company_id,
              reference: null,
            });
          }
          break;
        case 'overage_alert':
        case 'overage_budget_exceeded':
          ledger.push({
            date: ev.created_at,
            type: 'revenue',
            category: 'Overage Revenue',
            description: `Overage: ${ev.minutes_consumed || 0} min, $${ev.cost_usd || 0}`,
            debit: 0,
            credit: ev.cost_usd || 0,
            companyId: ev.company_id,
            reference: null,
          });
          break;
        case 'addon_purchased':
          ledger.push({
            date: ev.created_at,
            type: 'revenue',
            category: 'Add-on Purchase',
            description: `${data.addon_type || 'Add-on'}`,
            debit: 0,
            credit: ev.cost_usd || 0,
            companyId: ev.company_id,
            reference: null,
          });
          break;
      }
    }

    // Sort ledger by date descending
    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Enrich ledger with company names
    const companyIds = [...new Set(ledger.map(e => e.companyId).filter(Boolean) as string[])];
    const { data: companiesData } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', companyIds.length > 0 ? companyIds : ['_none_']);
    const companyNameMap = new Map((companiesData || []).map(c => [c.id, c.name]));

    const enrichedLedger = ledger.map(e => ({
      ...e,
      companyName: e.companyId ? (companyNameMap.get(e.companyId) || e.companyId.substring(0, 8)) : null,
    }));

    return NextResponse.json({
      period: { start: periodStartISO, end: periodEndISO, label: period },

      // P&L Statement
      pnl: {
        revenue: {
          grossSubscriptions: Math.round(grossSubscriptionRevenue * 100) / 100,
          discounts: Math.round(totalDiscountImpact * 100) / 100,
          netSubscriptions: Math.round((grossSubscriptionRevenue - totalDiscountImpact) * 100) / 100,
          overages: Math.round(overageRevenue * 100) / 100,
          addons: Math.round(addonRevenue * 100) / 100,
          totalGross: Math.round(totalGrossRevenue * 100) / 100,
          totalNet: Math.round(totalNetRevenue * 100) / 100,
          byPlan: revenueByPlan,
        },
        costs: {
          bland: Math.round(costBland * 100) / 100,
          openai: costOpenAI,
          supabase: costSupabase,
          stripeProcessing: Math.round(costStripeProcessing * 100) / 100,
          totalCOGS: Math.round(totalCOGS * 100) / 100,
          totalOperating: Math.round(totalOperatingCosts * 100) / 100,
        },
        margins: {
          grossProfit: Math.round(grossProfit * 100) / 100,
          grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
          operatingProfit: Math.round(operatingProfit * 100) / 100,
          operatingMarginPercent: Math.round(operatingMarginPercent * 10) / 10,
        },
      },

      // Cash Flow (actual payments)
      cashFlow: {
        paymentsReceived: Math.round(actualPaymentsReceived * 100) / 100,
        paymentsFailed: Math.round(failedPayments * 100) / 100,
        transactionCount: billingHistory.filter(bh => bh.status === 'paid').length,
      },

      // Discounted Subscriptions Detail
      discountedSubscriptions,

      // Unit Economics
      unitEconomics: {
        totalCompanies,
        paidCompanies,
        freeCompanies: totalCompanies - paidCompanies,
        totalUsers,
        arpc: Math.round(arpc * 100) / 100,
        costPerCall: Math.round(costPerCall * 100) / 100,
        avgMinPerCall: Math.round(avgMinPerCall * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        totalCalls,
        completedCalls,
        failedCalls,
        totalMinutes,
      },

      // Ledger (chronological entries)
      ledger: enrichedLedger,
    });
  } catch (error) {
    console.error('Error fetching accounting data:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting data' }, { status: 500 });
  }
}
