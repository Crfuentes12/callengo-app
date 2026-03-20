// app/api/admin/clients/route.ts
// Admin Clients List — all companies with usage, sub-accounts, unit economics
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { BLAND_COST_PER_MINUTE } from '@/lib/bland/subaccount-manager';

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

export async function GET() {
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

    // Get all companies with subscriptions and settings
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (!companies || companies.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    const companyIds = companies.map(c => c.id);

    // Parallel queries for all data
    const [
      subscriptionsResult,
      settingsResult,
      usageResult,
      addonsResult,
    ] = await Promise.all([
      // Subscriptions with plan info
      supabaseAdmin
        .from('company_subscriptions')
        .select('*, subscription_plans(*)')
        .in('company_id', companyIds),

      // Company settings (bland sub-account info)
      supabaseAdmin
        .from('company_settings')
        .select('company_id, bland_subaccount_id, bland_api_key')
        .in('company_id', companyIds),

      // Current usage tracking
      supabaseAdmin
        .from('usage_tracking')
        .select('*')
        .in('company_id', companyIds)
        .order('period_start', { ascending: false }),

      // Active add-ons
      supabaseAdminRaw
        .from('company_addons')
        .select('company_id, addon_type, quantity, price')
        .in('company_id', companyIds)
        .eq('status', 'active'),
    ]);

    // Index data by company_id
    const subsByCompany = new Map<string, typeof subscriptionsResult.data extends (infer T)[] ? T : never>();
    (subscriptionsResult.data || []).forEach(s => subsByCompany.set(s.company_id, s));

    const settingsByCompany = new Map<string, { bland_subaccount_id: string | null; bland_api_key: string | null }>();
    (settingsResult.data || []).forEach(s => settingsByCompany.set(s.company_id, s));

    // Get latest usage per company (first one since ordered desc)
    const usageByCompany = new Map<string, { minutes_used: number; minutes_included: number; total_cost: number; period_start: string; period_end: string }>();
    (usageResult.data || []).forEach(u => {
      if (!usageByCompany.has(u.company_id)) {
        usageByCompany.set(u.company_id, u);
      }
    });

    // Add-ons indexed by company
    const addonsByCompany = new Map<string, { addon_type: string; quantity: number; price: number }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((addonsResult.data || []) as any[]).forEach((a: { company_id: string; addon_type: string; quantity: number; price: number }) => {
      const existing = addonsByCompany.get(a.company_id) || [];
      existing.push(a);
      addonsByCompany.set(a.company_id, existing);
    });

    // Fetch Bland sub-account balances in batches (max 10 concurrent)
    const companiesWithSubAccounts = companies.filter(c => {
      const settings = settingsByCompany.get(c.id);
      return settings?.bland_subaccount_id;
    });

    const blandBalances = new Map<string, number>();
    const batchSize = 10;
    for (let i = 0; i < companiesWithSubAccounts.length; i += batchSize) {
      const batch = companiesWithSubAccounts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (c) => {
          const settings = settingsByCompany.get(c.id);
          if (!settings?.bland_subaccount_id) return { companyId: c.id, balance: 0 };
          try {
            const res = await fetch(`${BLAND_API_URL}/accounts/${settings.bland_subaccount_id}`, {
              method: 'GET',
              headers: { 'Authorization': BLAND_MASTER_KEY },
            });
            if (!res.ok) return { companyId: c.id, balance: 0 };
            const data = await res.json();
            return { companyId: c.id, balance: data.credits || data.balance || 0 };
          } catch {
            return { companyId: c.id, balance: 0 };
          }
        })
      );
      results.forEach(r => blandBalances.set(r.companyId, r.balance));
    }

    // Build client list
    const clients = companies.map(company => {
      const sub = subsByCompany.get(company.id);
      const settings = settingsByCompany.get(company.id);
      const usage = usageByCompany.get(company.id);
      const addons = addonsByCompany.get(company.id) || [];
      const blandBalance = blandBalances.get(company.id) || 0;

      const plan = sub?.subscription_plans as { slug?: string; name?: string; price_monthly?: number; minutes_included?: number; price_per_extra_minute?: number } | null;
      const minutesUsed = usage?.minutes_used || 0;
      const minutesIncluded = plan?.minutes_included || 0;
      const usagePercent = minutesIncluded > 0 ? Math.round((minutesUsed / minutesIncluded) * 100) : 0;

      // Unit economics
      const subscriptionRevenue = plan?.price_monthly || 0;
      const overageMinutes = Math.max(0, minutesUsed - minutesIncluded);
      const overageRevenue = overageMinutes * (plan?.price_per_extra_minute || 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addonRevenue = addons.reduce((sum: number, a: any) => sum + ((a.price || 0) * (a.quantity || 1)), 0);
      const totalRevenue = subscriptionRevenue + overageRevenue + addonRevenue;

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
          subAccountId: settings?.bland_subaccount_id || null,
          apiKeyMasked: settings?.bland_api_key ? `${settings.bland_api_key.substring(0, 8)}...` : null,
          creditBalance: blandBalance,
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
          totalRevenue,
          subscriptionRevenue,
          overageRevenue,
          addonRevenue,
          blandCost: Math.round(blandCost * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          marginPercent,
        },
        addons: addons.map(a => ({ type: a.addon_type, quantity: a.quantity })),
      };
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching admin clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
