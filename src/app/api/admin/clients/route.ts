// app/api/admin/clients/route.ts
// Admin Clients List — all companies with usage and unit economics (master key architecture)
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { BLAND_COST_PER_MINUTE } from '@/lib/bland/master-client';
import { stripe } from '@/lib/stripe';

// Add-on prices (monthly) — source of truth from pricing model V4
const ADDON_PRICES: Record<string, number> = {
  dedicated_number: 25, // $25/mo to customer ($15/mo Bland cost)
  recording_vault: 12,
  calls_booster: 35,
};

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

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    // Get all companies with subscriptions and settings
    const { data: allCompanies, count: totalCount } = await supabaseAdmin
      .from('companies')
      .select('id, name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!allCompanies || allCompanies.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    // Filter out orphaned companies (no users associated)
    const { data: usersWithCompanies } = await supabaseAdmin
      .from('users')
      .select('company_id');

    const activeCompanyIds = new Set(
      (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
    );

    const allActiveCompanies = allCompanies.filter(c =>
      activeCompanyIds.has(c.id) && !c.name.startsWith('[ARCHIVED] ')
    );
    const filteredTotal = allActiveCompanies.length;

    if (filteredTotal === 0) {
      return NextResponse.json({ clients: [], total: 0, page, limit });
    }

    // Apply pagination
    const companies = allActiveCompanies.slice(offset, offset + limit);
    const companyIds = companies.map(c => c.id);

    // Parallel queries for all data
    const [
      subscriptionsResult,
      usageResult,
      addonsResult,
    ] = await Promise.all([
      // Subscriptions with plan info
      supabaseAdmin
        .from('company_subscriptions')
        .select('*, subscription_plans(*)')
        .in('company_id', companyIds),

      // Current usage tracking
      supabaseAdmin
        .from('usage_tracking')
        .select('*')
        .in('company_id', companyIds)
        .order('period_start', { ascending: false }),

      // Active add-ons (no 'price' column in DB — use ADDON_PRICES map)
      supabaseAdminRaw
        .from('company_addons')
        .select('company_id, addon_type, quantity')
        .in('company_id', companyIds)
        .eq('status', 'active'),
    ]);

    // Index data by company_id
    type SubscriptionRow = NonNullable<typeof subscriptionsResult.data>[number];
    const subsByCompany = new Map<string, SubscriptionRow>();
    (subscriptionsResult.data || []).forEach(s => subsByCompany.set(s.company_id, s));

    // Get latest usage per company (first one since ordered desc)
    const usageByCompany = new Map<string, { minutes_used: number; minutes_included: number; total_cost: number; period_start: string; period_end: string }>();
    (usageResult.data || []).forEach(u => {
      if (!usageByCompany.has(u.company_id)) {
        usageByCompany.set(u.company_id, u);
      }
    });

    // Add-ons indexed by company
    const addonsByCompany = new Map<string, { addon_type: string; quantity: number }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((addonsResult.data || []) as any[]).forEach((a: { company_id: string; addon_type: string; quantity: number }) => {
      const existing = addonsByCompany.get(a.company_id) || [];
      existing.push(a);
      addonsByCompany.set(a.company_id, existing);
    });

    // Fetch Stripe discounts per company (by customer metadata.company_id)
    const discountByCompany = new Map<string, {
      promoCode: string | null;
      couponName: string | null;
      percentOff: number | null;
      amountOff: number | null;
      duration: string;
      durationInMonths: number | null;
      monthlyDiscount: number;
    }>();
    try {
      const stripeSubs = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.discount', 'data.discount.coupon', 'data.discount.promotion_code', 'data.customer'],
      });
      for (const ss of stripeSubs.data) {
        if (!ss.discount?.coupon) continue;
        const cust = ss.customer as { metadata?: Record<string, string> } | string;
        const cId = typeof cust === 'string' ? null : cust.metadata?.company_id;
        if (!cId) continue;
        const planAmt = ss.items.data.reduce((sum, item) => {
          const ua = item.price?.unit_amount || 0;
          return sum + (item.price?.recurring?.interval === 'year' ? ua / 12 : ua);
        }, 0) / 100;
        let disc = 0;
        if (ss.discount.coupon.percent_off) disc = planAmt * (ss.discount.coupon.percent_off / 100);
        else if (ss.discount.coupon.amount_off) disc = Math.min(ss.discount.coupon.amount_off / 100, planAmt);
        const pc = ss.discount.promotion_code;
        discountByCompany.set(cId, {
          promoCode: pc ? (typeof pc === 'string' ? pc : pc.code) : null,
          couponName: ss.discount.coupon.name,
          percentOff: ss.discount.coupon.percent_off,
          amountOff: ss.discount.coupon.amount_off ? ss.discount.coupon.amount_off / 100 : null,
          duration: ss.discount.coupon.duration,
          durationInMonths: ss.discount.coupon.duration_in_months ?? null,
          monthlyDiscount: Math.round(disc * 100) / 100,
        });
      }
    } catch (err) {
      console.error('[admin-clients] Failed to fetch Stripe discounts:', err);
    }

    // Build client list
    const clients = companies.map(company => {
      const sub = subsByCompany.get(company.id);
      const usage = usageByCompany.get(company.id);
      const addons = addonsByCompany.get(company.id) || [];

      const plan = sub?.subscription_plans as { slug?: string; name?: string; price_monthly?: number; minutes_included?: number; price_per_extra_minute?: number } | null;
      const minutesUsed = usage?.minutes_used || 0;
      const minutesIncluded = plan?.minutes_included || 0;
      const usagePercent = minutesIncluded > 0 ? Math.round((minutesUsed / minutesIncluded) * 100) : 0;

      // Unit economics
      const subscriptionRevenue = plan?.price_monthly || 0;
      const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
      const overageRevenue = overageMinutes * (plan?.price_per_extra_minute || 0);
      const addonRevenue = addons.reduce((sum: number, a) => sum + ((ADDON_PRICES[a.addon_type] || 0) * (a.quantity || 1)), 0);
      const discount = discountByCompany.get(company.id);
      const discountAmount = discount?.monthlyDiscount || 0;
      const totalRevenue = subscriptionRevenue + overageRevenue + addonRevenue - discountAmount;

      // Cost = actual minutes used × Bland cost/min
      const blandCost = minutesUsed * BLAND_COST_PER_MINUTE;
      const profit = totalRevenue - blandCost;
      const marginPercent = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;

      return {
        id: company.id,
        name: company.name,
        createdAt: company.created_at,
        plan: {
          slug: plan?.slug || 'free',
          name: plan?.name || 'Free',
          priceMonthly: subscriptionRevenue,
        },
        subscription: {
          status: sub?.status || 'inactive',
          overageEnabled: sub?.overage_enabled || false,
          overageBudget: sub?.overage_budget,
        },
        bland: {
          subAccountId: null,
          apiKeyMasked: null,
          creditBalance: 0,
        },
        usage: {
          minutesUsed,
          minutesIncluded,
          usagePercent,
          overageMinutes,
          periodStart: usage?.period_start || null,
          periodEnd: usage?.period_end || null,
        },
        economics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          subscriptionRevenue,
          overageRevenue,
          addonRevenue,
          discountAmount,
          blandCost: Math.round(blandCost * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          marginPercent,
        },
        discount: discount || null,
        addons: addons.map(a => ({ type: a.addon_type, quantity: a.quantity })),
      };
    });

    return NextResponse.json({ clients, total: filteredTotal, page, limit });
  } catch (error) {
    console.error('Error fetching admin clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
