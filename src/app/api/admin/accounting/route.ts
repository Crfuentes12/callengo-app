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
        .select('*, subscription_plans(*)')
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
    // Fetch company names for enrichment
    const { data: allCompaniesData } = await supabaseAdmin
      .from('companies')
      .select('id, name');
    const companyNameLookup = new Map((allCompaniesData || []).map(c => [c.id, c.name]));

    let totalDiscountImpact = 0;
    const discountedSubscriptions: {
      companyId: string;
      companyName: string;
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

        // Find plan slug from our subs (try DB first, then derive from Stripe price)
        const companySub = companyId ? activeSubs.find(s => s.company_id === companyId) : null;
        const planInfo = companySub?.subscription_plans as { slug?: string; name?: string } | null;

        // Derive plan from Stripe price amount if DB lookup fails
        let planSlug = planInfo?.slug || 'unknown';
        if (planSlug === 'unknown') {
          // Match by price: starter=$99, growth=$179, business=$299, teams=$649, enterprise=$1499
          const priceMap: Record<number, string> = { 99: 'starter', 179: 'growth', 299: 'business', 649: 'teams', 1499: 'enterprise' };
          planSlug = priceMap[Math.round(planAmount)] || 'unknown';
        }

        discountedSubscriptions.push({
          companyId: companyId || 'unknown',
          companyName: companyId ? (companyNameLookup.get(companyId) || companyId.substring(0, 12) + '...') : 'Unknown',
          plan: planSlug,
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

    // ═══════════════════════════════════════════════════════
    // P&L — CORRECT MODEL: Discounts are NOT losses
    // Revenue = what's actually collected
    // Promo users only cost their Bland usage
    // ═══════════════════════════════════════════════════════

    // Segment subscribers: paying vs promo/discounted vs free
    const discountedCompanyIds = new Set(discountedSubscriptions.map(ds => ds.companyId));

    // Categorize subscriptions
    let catalogMrr = 0; // What everyone WOULD pay at full price
    let actualMrr = 0;  // What's actually collected
    let promoForegone = 0; // Informational: foregone revenue from promos

    const revenueByPlan: Record<string, { count: number; paying: number; promo: number; catalogMrr: number; actualMrr: number }> = {};

    for (const sub of activeSubs) {
      const plan = sub.subscription_plans as { price_monthly?: number; price_yearly?: number; slug?: string; name?: string } | null;
      if (!plan || plan.slug === 'free') continue;

      const monthly = sub.billing_cycle === 'annual'
        ? (plan.price_yearly || 0) / 12
        : (plan.price_monthly || 0);

      catalogMrr += monthly;

      const slug = plan.slug || 'unknown';
      if (!revenueByPlan[slug]) revenueByPlan[slug] = { count: 0, paying: 0, promo: 0, catalogMrr: 0, actualMrr: 0 };
      revenueByPlan[slug].count++;
      revenueByPlan[slug].catalogMrr += monthly;

      // Check if this company has a discount
      const ds = discountedSubscriptions.find(d => d.companyId === sub.company_id);
      if (ds) {
        actualMrr += ds.netAmount;
        promoForegone += ds.discountAmount;
        revenueByPlan[slug].promo++;
        revenueByPlan[slug].actualMrr += ds.netAmount;
      } else {
        actualMrr += monthly;
        revenueByPlan[slug].paying++;
        revenueByPlan[slug].actualMrr += monthly;
      }
    }

    // Overage revenue (only from paying users with actual overages)
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

    // ACTUAL REVENUE = what's really collected (never negative)
    const totalActualRevenue = Math.max(0, actualMrr) + overageRevenue + addonRevenue;

    // Cash basis: actual Stripe payments
    const actualPaymentsReceived = billingHistory
      .filter(bh => bh.status === 'paid')
      .reduce((sum, bh) => sum + (bh.amount || 0), 0);
    const failedPayments = billingHistory
      .filter(bh => bh.status === 'failed')
      .reduce((sum, bh) => sum + (bh.amount || 0), 0);

    // COSTS — all users (including promo) generate costs
    const totalMinutes = callLogs.reduce((sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0);
    const totalCalls = callLogs.length;
    const completedCalls = callLogs.filter(c => c.status === 'completed').length;
    const failedCalls = callLogs.filter(c => c.status && ['failed', 'error', 'no_answer'].includes(c.status)).length;

    // Separate costs: paying users vs promo users
    const promoCompanyIds = discountedCompanyIds;
    const promoMinutes = callLogs
      .filter(c => promoCompanyIds.has(c.company_id))
      .reduce((sum, c) => sum + Math.ceil((c.call_length || 0) / 60), 0);
    const payingMinutes = totalMinutes - promoMinutes;

    const costBlandTotal = totalMinutes * BLAND_COST_PER_MINUTE;
    const costBlandPaying = payingMinutes * BLAND_COST_PER_MINUTE;
    const costBlandPromo = promoMinutes * BLAND_COST_PER_MINUTE;
    const costStripeProcessing = actualPaymentsReceived * 0.029 + (billingHistory.filter(bh => bh.status === 'paid').length * 0.30);

    // MARGINS — based on actual revenue vs actual costs
    const grossProfit = totalActualRevenue - costBlandTotal;
    const grossMarginPercent = totalActualRevenue > 0 ? (grossProfit / totalActualRevenue) * 100 : 0;
    const operatingProfit = totalActualRevenue - costBlandTotal - costStripeProcessing;
    const operatingMarginPercent = totalActualRevenue > 0 ? (operatingProfit / totalActualRevenue) * 100 : 0;

    // UNIT ECONOMICS — separate paying vs promo segments
    const totalPaidPlans = activeSubs.filter(s => {
      const plan = s.subscription_plans as { slug?: string } | null;
      return plan && plan.slug !== 'free';
    }).length;
    const payingCustomers = totalPaidPlans - discountedSubscriptions.filter(ds => ds.netAmount === 0).length;
    const promoCustomers = discountedSubscriptions.length;
    const freeCustomers = activeSubs.filter(s => {
      const plan = s.subscription_plans as { slug?: string } | null;
      return !plan || plan.slug === 'free';
    }).length;

    const arpc = payingCustomers > 0 ? actualMrr / payingCustomers : 0;
    const costPerCall = totalCalls > 0 ? costBlandTotal / totalCalls : 0;
    const avgMinPerCall = totalCalls > 0 ? totalMinutes / totalCalls : 0;
    const ltv = arpc > 0 ? arpc * 12 : 0;

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

    // Chart data for visual displays
    const chartData = {
      // Revenue waterfall
      revenueWaterfall: [
        { name: 'Catalog MRR', value: Math.round(catalogMrr * 100) / 100, fill: '#94a3b8' },
        { name: 'Promo Foregone', value: -Math.round(promoForegone * 100) / 100, fill: '#fb923c' },
        { name: 'Actual MRR', value: Math.round(actualMrr * 100) / 100, fill: '#10b981' },
        { name: 'Overages', value: Math.round(overageRevenue * 100) / 100, fill: '#6366f1' },
        { name: 'Add-ons', value: Math.round(addonRevenue * 100) / 100, fill: '#8b5cf6' },
      ],
      // Cost breakdown
      costBreakdown: [
        { name: 'Bland (Paying)', value: Math.round(costBlandPaying * 100) / 100, fill: '#ef4444' },
        { name: 'Bland (Promo)', value: Math.round(costBlandPromo * 100) / 100, fill: '#fb923c' },
        { name: 'Stripe Fees', value: Math.round(costStripeProcessing * 100) / 100, fill: '#f59e0b' },
      ].filter(c => c.value > 0),
      // Subscriber segments
      subscriberSegments: [
        { name: 'Paying', value: payingCustomers, fill: '#10b981' },
        { name: 'Promo/Tester', value: promoCustomers, fill: '#fb923c' },
        { name: 'Free', value: freeCustomers, fill: '#94a3b8' },
      ].filter(s => s.value > 0),
    };

    return NextResponse.json({
      period: { start: periodStartISO, end: periodEndISO, label: period },

      // P&L Statement — CORRECT MODEL
      pnl: {
        revenue: {
          // What everyone would pay at full price (informational)
          catalogMrr: Math.round(catalogMrr * 100) / 100,
          // What's actually collected monthly
          actualMrr: Math.round(actualMrr * 100) / 100,
          overages: Math.round(overageRevenue * 100) / 100,
          addons: Math.round(addonRevenue * 100) / 100,
          totalActualRevenue: Math.round(totalActualRevenue * 100) / 100,
          byPlan: revenueByPlan,
        },
        // Promotional context (NOT losses — informational only)
        promotional: {
          foregoneRevenue: Math.round(promoForegone * 100) / 100,
          promoCustomers,
          promoBlandCost: Math.round(costBlandPromo * 100) / 100,
          effectivePromoCost: Math.round(costBlandPromo * 100) / 100,
        },
        costs: {
          blandTotal: Math.round(costBlandTotal * 100) / 100,
          blandPaying: Math.round(costBlandPaying * 100) / 100,
          blandPromo: Math.round(costBlandPromo * 100) / 100,
          stripeProcessing: Math.round(costStripeProcessing * 100) / 100,
          totalCosts: Math.round((costBlandTotal + costStripeProcessing) * 100) / 100,
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

      // Unit Economics — segmented
      unitEconomics: {
        totalCompanies,
        payingCustomers,
        promoCustomers,
        freeCustomers,
        totalUsers,
        arpc: Math.round(arpc * 100) / 100,
        costPerCall: Math.round(costPerCall * 100) / 100,
        avgMinPerCall: Math.round(avgMinPerCall * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        totalCalls,
        completedCalls,
        failedCalls,
        totalMinutes,
        payingMinutes,
        promoMinutes,
      },

      // Chart data
      charts: chartData,

      // Ledger (chronological entries)
      ledger: enrichedLedger,
    });
  } catch (error) {
    console.error('Error fetching accounting data:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting data' }, { status: 500 });
  }
}
