'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────
interface BlandPlanOption {
  slug: string;
  label: string;
  dailyCap: number;
  hourlyCap: number;
  concurrentCap: number;
  voiceClones: number;
  costPerMinute: number;
  transferRate: number;
}

interface PromoCodeData {
  summary: {
    totalCoupons: number;
    activeCoupons: number;
    totalPromoCodes: number;
    activePromoCodes: number;
    totalRedemptions: number;
    totalActiveDiscounts: number;
    totalMonthlyDiscountImpact: number;
  };
  promotionCodes: {
    id: string;
    code: string;
    active: boolean;
    timesRedeemed: number;
    maxRedemptions: number | null;
    expiresAt: number | null;
    createdAt: number;
    coupon: {
      id: string;
      name: string | null;
      percentOff: number | null;
      amountOff: number | null;
      currency: string | null;
      duration: string;
      durationInMonths: number | null;
      timesRedeemed: number;
      maxRedemptions: number | null;
      valid: boolean;
      createdAt: number;
    };
    activeRedemptions: number;
    monthlyImpact: number;
    customers: {
      customerId: string;
      customerName: string;
      customerEmail: string;
      companyId: string | null;
      subscriptionId: string;
      subscriptionStatus: string;
      promotionCode: string | null;
      discountStart: number | null;
      discountEnd: number | null;
      monthlyDiscount: number;
      planAmount: number;
    }[];
  }[];
  standaloneCoupons: {
    id: null;
    code: null;
    active: boolean;
    timesRedeemed: number;
    maxRedemptions: number | null;
    expiresAt: null;
    createdAt: number;
    coupon: {
      id: string;
      name: string | null;
      percentOff: number | null;
      amountOff: number | null;
      currency: string | null;
      duration: string;
      durationInMonths: number | null;
      timesRedeemed: number;
      maxRedemptions: number | null;
      valid: boolean;
      createdAt: number;
    };
    activeRedemptions: number;
    monthlyImpact: number;
    customers: {
      customerId: string;
      customerName: string;
      customerEmail: string;
      companyId: string | null;
      subscriptionId: string;
      subscriptionStatus: string;
      promotionCode: string | null;
      discountStart: number | null;
      discountEnd: number | null;
      monthlyDiscount: number;
      planAmount: number;
    }[];
  }[];
}

interface CommandCenterData {
  callsToday: number;
  callsThisHour: number;
  activeCalls: number;
  callsThisMonth: number;
  totalMinutesUsed: number;
  totalMinutesIncluded: number;
  usagePercent: number;
  activeCompanies: number;
  orphanedCompanies: number;
  archivedCompanies: number;
  planDistribution: Record<string, number>;
  hourlyCallsChart: { hour: string; calls: number }[];
  dailyCallsChart: { date: string; calls: number }[];
  recentBillingEvents: BillingEvent[];
  alerts: { level: string; message: string; time: string }[];
  timestamp: string;
  // Bland AI Account
  blandAccount?: {
    plan: string | null;
    balance: number;
    totalCalls: number;
    costPerMinute: number;
    transferRate: number;
    voiceClones: number;
    apiKeyMasked: string | null;
  };
  blandLimits?: {
    dailyCap: number;
    hourlyCap: number;
    concurrentCap: number;
  };
  blandPlanCatalog?: BlandPlanOption[];
  // Redis concurrency
  concurrency?: {
    globalConcurrent: number;
    globalDaily: number;
    globalHourly: number;
    activeCallCount: number;
    topCompanies: { companyId: string; concurrent: number; daily: number }[];
    redisAvailable: boolean;
    redisConnected: boolean;
  };
  gauges?: {
    concurrentPercent: number;
    dailyPercent: number;
    hourlyPercent: number;
  };
  // Revenue & Business Metrics
  revenue?: {
    mrr: number;
    arr: number;
    netMrr: number;
    netArr: number;
    totalDiscountImpact: number;
    subsWithDiscounts: number;
    stripeRevenue30d: number;
    revenueByPlan: Record<string, { count: number; mrr: number }>;
  };
  subscriptionHealth?: {
    active: number;
    trialing: number;
    canceled: number;
    pastDue: number;
    expired: number;
    churnRate: number;
    trialConversionRate: number;
  };
  blandEconomics?: {
    burnRatePerDay: number;
    projectedRunwayDays: number | null;
    blandCostThisMonth: number;
    totalMinutesThisMonth: number;
    avgCallDurationSec: number;
    costPerMinute: number;
  };
  failedCalls?: {
    totalThisMonth: number;
    byReason: { reason: string; count: number }[];
  };
  unitEconomics?: {
    actualRevenue: number;
    catalogMrr: number;
    promoAllowance: number;
    promoSubsCount: number;
    blandCost: number;
    profit: number;
    marginPercent: number;
    payingCompanies: number;
    arpc: number;
    costPerCall: number;
  };
}

interface ClientData {
  id: string;
  name: string;
  createdAt: string;
  plan: { slug: string; name: string; priceMonthly: number };
  subscription: { status: string; overageEnabled: boolean; overageBudget: number | null };
  bland: { subAccountId: string | null; apiKeyMasked: string | null; creditBalance: number };
  usage: { minutesUsed: number; minutesIncluded: number; usagePercent: number; overageMinutes: number; periodStart: string | null; periodEnd: string | null };
  economics: { grossRevenue: number; netRevenue: number; subscriptionRevenue: number; overageRevenue: number; addonRevenue: number; discountAmount: number; blandCost: number; profit: number; marginPercent: number };
  discount: { promoCode: string | null; couponName: string | null; percentOff: number | null; amountOff: number | null; duration: string; durationInMonths: number | null; monthlyDiscount: number } | null;
  addons: { type: string; quantity: number }[];
}

interface BillingEvent {
  id: string;
  company_id: string;
  company_name?: string;
  event_type: string;
  event_data: Record<string, unknown>;
  minutes_consumed: number | null;
  cost_usd: number | null;
  created_at: string;
}

interface ReconcileData {
  discrepancies: {
    companyId: string;
    companyName: string;
    actualMinutes: number;
    trackedMinutes: number;
    difference: number;
    callCount: number;
    severity: 'ok' | 'minor' | 'major' | 'critical';
  }[];
  summary: { total: number; withIssues: number; critical: number; major: number; minor: number; ok: number };
}

interface FinanceData {
  revenue_gross: number | null;
  revenue_total: number | null;
  revenue_subscriptions: number | null;
  revenue_overages: number | null;
  total_discount_impact: number | null;
  cost_total: number | null;
  cost_bland: number | null;
  cost_openai: number | null;
  cost_supabase: number | null;
  gross_margin: number | null;
  gross_margin_percent: number | null;
  total_companies_active: number | null;
  total_users_active: number | null;
  total_calls_made: number | null;
  total_minutes_used: number | null;
  avg_minutes_per_call: number | null;
  avg_revenue_per_company: number | null;
  overage_revenue_percent: number | null;
  bland_plan: string | null;
  bland_plan_cost: number | null;
  bland_talk_rate: number | null;
  bland_transfer_rate: number | null;
  bland_concurrent_limit: string | null;
  bland_daily_limit: string | null;
  bland_master_balance: number | null;
  bland_master_subscription: {
    plan: string;
    status: string;
    perMinRate: number;
    transferRate: number;
    concurrentLimit: string;
    dailyLimit: string;
    monthlyCost: number;
  } | null;
  notes: string | null;
  [key: string]: unknown;
}

type Tab = 'health' | 'operations' | 'clients' | 'events' | 'reconcile' | 'finances' | 'promos' | 'accounting' | 'ai_costs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AccountingData {
  period: { start: string; end: string; label: string };
  pnl: {
    revenue: {
      catalogMrr: number; actualMrr: number;
      overages: number; addons: number; totalActualRevenue: number;
      byPlan: Record<string, { count: number; paying: number; promo: number; catalogMrr: number; actualMrr: number }>;
    };
    promotional: { foregoneRevenue: number; promoCustomers: number; promoBlandCost: number; effectivePromoCost: number };
    costs: { blandTotal: number; blandPaying: number; blandPromo: number; stripeProcessing: number; totalCosts: number };
    margins: { grossProfit: number; grossMarginPercent: number; operatingProfit: number; operatingMarginPercent: number };
  };
  cashFlow: { paymentsReceived: number; paymentsFailed: number; transactionCount: number };
  discountedSubscriptions: { companyId: string; companyName: string; plan: string; grossAmount: number; discountAmount: number; netAmount: number; promoCode: string | null; couponName: string | null; percentOff: number | null; duration: string }[];
  unitEconomics: { totalCompanies: number; payingCustomers: number; promoCustomers: number; freeCustomers: number; totalUsers: number; arpc: number; costPerCall: number; avgMinPerCall: number; ltv: number; totalCalls: number; completedCalls: number; failedCalls: number; totalMinutes: number; payingMinutes: number; promoMinutes: number };
  charts: {
    revenueWaterfall: { name: string; value: number; fill: string }[];
    costBreakdown: { name: string; value: number; fill: string }[];
    subscriberSegments: { name: string; value: number; fill: string }[];
  };
  ledger: { date: string; type: string; category: string; description: string; debit: number; credit: number; companyId: string | null; companyName: string | null; reference: string | null }[];
}

interface OpenAIFeatureBreakdown {
  featureKey: string;
  label: string;
  requests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface OpenAIModelBreakdown {
  model: string;
  requests: number;
  totalTokens: number;
  cost: number;
}

interface OpenAIDailyCost {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

interface OpenAIRecentLog {
  id: string;
  createdAt: string;
  featureKey: string;
  apiKeyLabel: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  companyId: string | null;
}

interface OpenAIUsageData {
  totalCost30d: number;
  totalTokens30d: number;
  totalRequests30d: number;
  totalCostToday: number;
  totalTokensToday: number;
  totalRequestsToday: number;
  byFeature: OpenAIFeatureBreakdown[];
  byModel: OpenAIModelBreakdown[];
  dailyCosts: OpenAIDailyCost[];
  recentLogs: OpenAIRecentLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString();

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-200',
  starter: 'bg-blue-50 text-blue-700 border-blue-200',
  growth: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  business: 'bg-violet-50 text-violet-700 border-violet-200',
  teams: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
};

const severityColors: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  minor: 'bg-amber-50 text-amber-700 border-amber-200',
  major: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const eventTypeLabels: Record<string, string> = {
  subscription_created: 'Subscription Created',
  subscription_updated: 'Subscription Updated',
  subscription_canceled: 'Subscription Canceled',
  payment_succeeded: 'Payment Succeeded',
  payment_failed: 'Payment Failed',
  trial_ending: 'Trial Ending',
  usage_recorded: 'Usage Recorded',
  usage_alert: 'Usage Alert',
  overage_alert: 'Overage Alert',
  overage_budget_exceeded: 'Budget Exceeded',
  overage_enabled: 'Overage Enabled',
  overage_disabled: 'Overage Disabled',
  overage_budget_updated: 'Budget Updated',
  bland_credits_allocated: 'Credits Allocated',
  bland_credits_reclaimed: 'Credits Reclaimed',
  bland_subaccount_deactivated: 'Account Deactivated',
  downgrade_minutes_exceeded: 'Downgrade Warning',
  addon_purchased: 'Add-on Purchased',
  addon_canceled: 'Add-on Canceled',
  plan_upgrade_credits: 'Upgrade Credits',
  promo_code_applied: 'Promo Code Applied',
};

// ─── Component ───────────────────────────────────────────────────────
export default function AdminCommandCenter() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('health');
  const [healthData, setHealthData] = useState<CommandCenterData | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsTotalPages, setEventsTotalPages] = useState(1);
  const [eventsFilter, setEventsFilter] = useState('');
  const [reconcileData, setReconcileData] = useState<ReconcileData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [financePeriod, setFinancePeriod] = useState('current');
  const [loading, setLoading] = useState(true);
  const [clientSort, setClientSort] = useState<'usage' | 'profit' | 'cost' | 'name'>('usage');
  const [clientSearch, setClientSearch] = useState('');
  const [cleaningUp, setCleaningUp] = useState(false);
  const [savingBlandPlan, setSavingBlandPlan] = useState(false);
  const [promoData, setPromoData] = useState<PromoCodeData | null>(null);
  const [promoExpanded, setPromoExpanded] = useState<string | null>(null);
  const [accountingData, setAccountingData] = useState<AccountingData | null>(null);
  const [accountingPeriod, setAccountingPeriod] = useState('current');
  const [openAIUsageData, setOpenAIUsageData] = useState<OpenAIUsageData | null>(null);

  // Auto-refresh health data every 30 seconds
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/command-center');
      if (res.ok) {
        const raw = await res.json();
        setHealthData({
          callsToday: raw.callsToday ?? 0,
          callsThisHour: raw.callsThisHour ?? 0,
          activeCalls: raw.activeCalls ?? 0,
          callsThisMonth: raw.callsThisMonth ?? 0,
          totalMinutesUsed: raw.totalMinutesUsed ?? 0,
          totalMinutesIncluded: raw.totalMinutesIncluded ?? 0,
          usagePercent: raw.usagePercent ?? 0,
          activeCompanies: raw.activeCompanies ?? 0,
          orphanedCompanies: raw.orphanedCompanies ?? 0,
          archivedCompanies: raw.archivedCompanies ?? 0,
          planDistribution: raw.planDistribution ?? {},
          hourlyCallsChart: raw.hourlyCallsChart ?? [],
          dailyCallsChart: raw.dailyCallsChart ?? [],
          recentBillingEvents: raw.recentBillingEvents ?? [],
          alerts: raw.alerts ?? [],
          timestamp: raw.timestamp ?? new Date().toISOString(),
          // Bland AI
          blandAccount: raw.blandAccount,
          blandLimits: raw.blandLimits,
          blandPlanCatalog: raw.blandPlanCatalog,
          // Redis concurrency
          concurrency: raw.concurrency,
          gauges: raw.gauges,
          // Business metrics (with discount-aware fields)
          revenue: raw.revenue ? {
            ...raw.revenue,
            netMrr: raw.revenue.netMrr ?? raw.revenue.mrr,
            netArr: raw.revenue.netArr ?? raw.revenue.arr,
            totalDiscountImpact: raw.revenue.totalDiscountImpact ?? 0,
            subsWithDiscounts: raw.revenue.subsWithDiscounts ?? 0,
          } : undefined,
          subscriptionHealth: raw.subscriptionHealth,
          blandEconomics: raw.blandEconomics,
          failedCalls: raw.failedCalls,
          unitEconomics: raw.unitEconomics,
        });
      }
    } catch (e) {
      console.error('Failed to fetch health data:', e);
    }
  }, []);

  // Save selected Bland AI plan and refresh
  const handleBlandPlanChange = useCallback(async (planSlug: string) => {
    if (!planSlug) return;
    setSavingBlandPlan(true);
    try {
      const res = await fetch('/api/admin/command-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planSlug }),
      });
      if (res.ok) {
        // Refresh health data + clear finance cache so it re-fetches with new plan
        await fetchHealth();
        setFinanceData(null);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error('Failed to update Bland plan:', e);
      alert('Failed to update Bland plan');
    } finally {
      setSavingBlandPlan(false);
    }
  }, [fetchHealth]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (e) {
      console.error('Failed to fetch clients:', e);
    }
  }, []);

  const handleCleanupOrphans = useCallback(async () => {
    if (!confirm('This will archive orphaned companies (no active users) and delete their operational data (contacts, agents, integrations). Financial records (subscriptions, billing, usage, call logs) are preserved. Continue?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/admin/cleanup-orphans', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(`Archived ${data.archived} orphaned companies. Financial records preserved.`);
        fetchClients();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error('Cleanup failed:', e);
      alert('Cleanup failed — check console');
    } finally {
      setCleaningUp(false);
    }
  }, [fetchClients]);

  const fetchEvents = useCallback(async (page = 1, eventType = '') => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (eventType) params.set('event_type', eventType);
      const res = await fetch(`/api/admin/billing-events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setEventsTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  }, []);

  const fetchReconcile = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reconcile');
      if (res.ok) {
        const data = await res.json();
        setReconcileData(data);
      }
    } catch (e) {
      console.error('Failed to fetch reconciliation:', e);
    }
  }, []);

  const fetchFinances = useCallback(async (period = 'current') => {
    try {
      const res = await fetch(`/api/admin/finances?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        const finances = data.finances || [];
        setFinanceData(finances[0] || null);
      }
    } catch (e) {
      console.error('Failed to fetch finances:', e);
    }
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      if (res.ok) {
        const data = await res.json();
        setPromoData(data);
      }
    } catch (e) {
      console.error('Failed to fetch promo codes:', e);
    }
  }, []);

  const fetchAccounting = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/admin/accounting?period=${p}`);
      if (res.ok) {
        const data = await res.json();
        setAccountingData(data);
      }
    } catch (e) {
      console.error('Failed to fetch accounting:', e);
    }
  }, []);

  const fetchOpenAIUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/openai-usage');
      if (res.ok) {
        const data = await res.json();
        setOpenAIUsageData(data);
      }
    } catch (e) {
      console.error('Failed to fetch OpenAI usage:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchHealth();
      setLoading(false);
    };
    load();
  }, [fetchHealth]);

  // Auto-refresh health every 30s (runs on all tabs since plan selector is global)
  useEffect(() => {
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Load tab data on switch
  useEffect(() => {
    if (tab === 'clients' && clients.length === 0) fetchClients();
    if (tab === 'events' && events.length === 0) fetchEvents(1, eventsFilter);
    if (tab === 'reconcile' && !reconcileData) fetchReconcile();
    if (tab === 'finances' && !financeData) fetchFinances(financePeriod);
    if (tab === 'promos' && !promoData) fetchPromos();
    if (tab === 'accounting' && !accountingData) fetchAccounting(accountingPeriod);
    if (tab === 'ai_costs' && !openAIUsageData) fetchOpenAIUsage();
  }, [tab, clients.length, events.length, reconcileData, financeData, promoData, accountingData, openAIUsageData, fetchClients, fetchEvents, fetchReconcile, fetchFinances, fetchPromos, fetchAccounting, fetchOpenAIUsage, eventsFilter, financePeriod, accountingPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--color-neutral-500)]">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // ─── Sorted/filtered clients ──────────────────────────────────────
  const sortedClients = [...clients]
    .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    .sort((a, b) => {
      switch (clientSort) {
        case 'usage': return b.usage.usagePercent - a.usage.usagePercent;
        case 'profit': return b.economics.profit - a.economics.profit;
        case 'cost': return b.economics.blandCost - a.economics.blandCost;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-ink)]">{t.admin.commandCenter?.title || 'Command Center'}</h2>
          <p className="text-sm text-[var(--color-neutral-600)] mt-1">
            {t.admin.commandCenter?.subtitle || 'Real-time platform monitoring & client management'}
          </p>
        </div>
        {healthData && (
          <span className="text-xs text-[var(--color-neutral-400)]">
            Last update: {new Date(healthData.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Alerts Banner */}
      {healthData?.alerts && healthData.alerts.length > 0 && (
        <div className="space-y-2">
          {healthData.alerts.map((alert, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-sm font-medium ${
                alert.level === 'critical'
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}
            >
              {alert.level === 'critical' ? '!! ' : '! '}{alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Global Bland AI Plan Selector + Tab Navigation */}
      <div className="flex flex-col gap-3">
        {/* Bland Plan Selector — visible on all tabs */}
        {healthData && (
          <div className="flex items-center gap-4 p-3 bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-neutral-500)] uppercase whitespace-nowrap">Bland AI Plan</span>
              <select
                value={healthData.blandAccount?.plan || ''}
                onChange={(e) => handleBlandPlanChange(e.target.value)}
                disabled={savingBlandPlan}
                className="px-3 py-1.5 bg-white border border-[var(--border-default)] rounded-lg text-sm font-semibold text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-50"
              >
                {(healthData.blandPlanCatalog || []).map(plan => (
                  <option key={plan.slug} value={plan.slug}>
                    {plan.label} — ${plan.costPerMinute}/min · {plan.concurrentCap >= 999999 ? '∞' : plan.concurrentCap} concurrent
                  </option>
                ))}
              </select>
              {savingBlandPlan && <span className="text-xs text-[var(--color-primary)] animate-pulse">Saving...</span>}
            </div>
            <div className="h-6 w-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-4 text-xs text-[var(--color-neutral-600)]">
              <span><strong className="text-[var(--color-ink)]">${healthData.blandAccount?.costPerMinute ?? '—'}</strong>/min</span>
              <span><strong className="text-[var(--color-ink)]">{(healthData.blandLimits?.concurrentCap ?? 0) >= 999999 ? '∞' : fmtInt(healthData.blandLimits?.concurrentCap ?? 0)}</strong> concurrent</span>
              <span><strong className="text-[var(--color-ink)]">{(healthData.blandLimits?.dailyCap ?? 0) >= 999999 ? '∞' : fmtInt(healthData.blandLimits?.dailyCap ?? 0)}</strong> daily</span>
              <span><strong className="text-[var(--color-ink)]">{(healthData.blandLimits?.hourlyCap ?? 0) >= 999999 ? '∞' : fmtInt(healthData.blandLimits?.hourlyCap ?? 0)}</strong> hourly</span>
            </div>
            <div className="h-6 w-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${(healthData.blandAccount?.balance ?? 0) < 5 ? 'text-red-600' : 'text-emerald-700'}`}>
                ${fmt(healthData.blandAccount?.balance ?? 0)}
              </span>
              <span className="text-xs text-[var(--color-neutral-400)]">balance</span>
            </div>
            {healthData.blandAccount?.apiKeyMasked && (
              <>
                <div className="h-6 w-px bg-[var(--border-default)]" />
                <span className="text-xs text-[var(--color-neutral-400)] font-mono">{healthData.blandAccount.apiKeyMasked}</span>
              </>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-[var(--color-neutral-100)] rounded-lg w-fit">
          {([
            { id: 'health' as Tab, label: t.admin.commandCenter?.tabHealth || 'Health Dashboard' },
            { id: 'operations' as Tab, label: 'Operations' },
            { id: 'clients' as Tab, label: t.admin.commandCenter?.tabClients || 'Clients' },
            { id: 'events' as Tab, label: t.admin.commandCenter?.tabEvents || 'Billing Events' },
            { id: 'reconcile' as Tab, label: t.admin.commandCenter?.tabReconcile || 'Reconciliation' },
            { id: 'finances' as Tab, label: 'Finances' },
            { id: 'promos' as Tab, label: 'Promo Codes' },
            { id: 'accounting' as Tab, label: 'Accounting' },
            { id: 'ai_costs' as Tab, label: 'AI Costs' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-white text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: HEALTH DASHBOARD
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'health' && healthData && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Active Calls" value={String(healthData.activeCalls)} color="blue" sub="Right now" />
            <KPICard label="Calls / Hour" value={fmtInt(healthData.callsThisHour)} color="indigo" sub="Last 60 min" />
            <KPICard label="Calls Today" value={fmtInt(healthData.callsToday)} color="violet" sub="Since midnight" />
            <KPICard label="Calls This Month" value={fmtInt(healthData.callsThisMonth)} color="purple" sub={`${fmtInt(healthData.totalMinutesUsed)} min used`} />
            <KPICard label="Companies" value={String(healthData.activeCompanies)} color="fuchsia" sub="Active subs" />
            <KPICard
              label="Inactive"
              value={String(healthData.orphanedCompanies + healthData.archivedCompanies)}
              color={healthData.orphanedCompanies > 0 ? 'amber' : 'slate'}
              sub={`${healthData.orphanedCompanies} orphaned · ${healthData.archivedCompanies} archived`}
            />
          </div>

          {/* ─── Bland AI Current Balance ─── */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Bland AI — Current Balance</h3>
                <p className={`text-4xl font-bold ${(healthData.blandAccount?.balance ?? 0) < 5 ? 'text-red-600' : 'text-emerald-900'}`}>
                  ${fmt(healthData.blandAccount?.balance ?? 0)}
                </p>
                <p className="text-sm text-emerald-700 mt-1">Available credits on master account</p>
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs text-emerald-600">
                  <span className="font-medium">Plan:</span> <span className="font-bold capitalize">{healthData.blandAccount?.plan || 'Unknown'}</span>
                </div>
                <div className="text-xs text-emerald-600">
                  <span className="font-medium">Rate:</span> <span className="font-bold">${healthData.blandAccount?.costPerMinute ?? '—'}/min</span>
                </div>
                <div className="text-xs text-emerald-600">
                  <span className="font-medium">Total Calls:</span> <span className="font-bold">{fmtInt(healthData.blandAccount?.totalCalls ?? 0)}</span>
                </div>
              </div>
            </div>
            {(healthData.blandAccount?.balance ?? 0) < 5 && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                Low balance warning — recharge your Bland AI account to avoid call disruptions.
              </div>
            )}
          </div>

          {/* ─── Redis / Real-Time Concurrency Panel ─── */}
          <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Real-Time Concurrency (Redis)</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${healthData.concurrency?.redisAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-xs font-medium ${healthData.concurrency?.redisAvailable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {healthData.concurrency?.redisAvailable ? 'Redis Connected' : 'Redis Disconnected'}
                </span>
              </div>
            </div>

            {!healthData.concurrency?.redisAvailable ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Redis is not configured. Set <code className="font-mono bg-red-100 px-1 rounded">UPSTASH_REDIS_REST_URL</code> and <code className="font-mono bg-red-100 px-1 rounded">UPSTASH_REDIS_REST_TOKEN</code> to enable real-time concurrency tracking.
              </div>
            ) : (
              <>
                {/* Concurrency Gauges */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                  {/* Concurrent */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[var(--color-neutral-600)]">Concurrent</span>
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        {healthData.concurrency?.globalConcurrent ?? 0} / {(healthData.blandLimits?.concurrentCap ?? 0) >= 999999 ? '∞' : healthData.blandLimits?.concurrentCap ?? 0}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (healthData.gauges?.concurrentPercent ?? 0) >= 90 ? 'bg-red-500' :
                          (healthData.gauges?.concurrentPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(healthData.gauges?.concurrentPercent ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--color-neutral-400)]">{healthData.gauges?.concurrentPercent ?? 0}%</span>
                  </div>
                  {/* Daily */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[var(--color-neutral-600)]">Daily</span>
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        {healthData.concurrency?.globalDaily ?? 0} / {(healthData.blandLimits?.dailyCap ?? 0) >= 999999 ? '∞' : healthData.blandLimits?.dailyCap ?? 0}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (healthData.gauges?.dailyPercent ?? 0) >= 90 ? 'bg-red-500' :
                          (healthData.gauges?.dailyPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(healthData.gauges?.dailyPercent ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--color-neutral-400)]">{healthData.gauges?.dailyPercent ?? 0}%</span>
                  </div>
                  {/* Hourly */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[var(--color-neutral-600)]">Hourly</span>
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        {healthData.concurrency?.globalHourly ?? 0} / {(healthData.blandLimits?.hourlyCap ?? 0) >= 999999 ? '∞' : healthData.blandLimits?.hourlyCap ?? 0}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (healthData.gauges?.hourlyPercent ?? 0) >= 90 ? 'bg-red-500' :
                          (healthData.gauges?.hourlyPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(healthData.gauges?.hourlyPercent ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--color-neutral-400)]">{healthData.gauges?.hourlyPercent ?? 0}%</span>
                  </div>
                </div>

                {/* Active Calls + Per-Company Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Active Call Slots</h4>
                    <div className="text-3xl font-bold text-blue-600">{healthData.concurrency?.activeCallCount ?? 0}</div>
                    <p className="text-xs text-[var(--color-neutral-400)] mt-1">Tracked in Redis with 30min TTL auto-expiry</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Top Companies (by concurrent)</h4>
                    {(healthData.concurrency?.topCompanies || []).length === 0 ? (
                      <p className="text-xs text-[var(--color-neutral-400)]">No active calls right now</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {(healthData.concurrency?.topCompanies || []).map((c, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-neutral-50)] p-2 rounded">
                            <span className="text-[var(--color-neutral-600)] font-mono truncate max-w-[50%]">{c.companyId.substring(0, 8)}...</span>
                            <div className="flex gap-3">
                              <span className="text-blue-600 font-bold">{c.concurrent} live</span>
                              <span className="text-[var(--color-neutral-400)]">{c.daily} today</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Usage Gauge */}
          <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
            <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-3">
              Platform Usage — {healthData.usagePercent}% of included minutes
            </h3>
            <div className="w-full h-6 bg-[var(--color-neutral-100)] rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthData.usagePercent >= 90 ? 'bg-red-500' :
                  healthData.usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(healthData.usagePercent, 100)}%` }}
              />
              {/* Band markers */}
              <div className="absolute top-0 left-[70%] h-full w-px bg-amber-400 opacity-60" />
              <div className="absolute top-0 left-[90%] h-full w-px bg-red-400 opacity-60" />
            </div>
            <div className="flex justify-between text-xs text-[var(--color-neutral-400)] mt-1">
              <span>0</span>
              <span className="text-amber-500">70%</span>
              <span className="text-red-500">90%</span>
              <span>{fmtInt(healthData.totalMinutesIncluded)} min</span>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calls per Hour (24h) */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Calls per Hour (24h)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={healthData.hourlyCallsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Calls per Day (30d) */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Calls per Day (30d)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={healthData.dailyCallsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {healthData.dailyCallsChart.map((_, i) => (
                      <Cell key={i} fill={i === healthData.dailyCallsChart.length - 1 ? '#8b5cf6' : '#c4b5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution */}
          <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
            <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-3">Plan Distribution</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(healthData.planDistribution).map(([slug, count]) => (
                <div key={slug} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${planColors[slug] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {slug.charAt(0).toUpperCase() + slug.slice(1)}: {count}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Billing Events (quick view) */}
          {healthData.recentBillingEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Recent Events (24h)</h3>
                <button onClick={() => setTab('events')} className="text-xs text-[var(--color-primary)] hover:underline">View all</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {healthData.recentBillingEvents.slice(0, 10).map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-2 bg-[var(--color-neutral-50)] rounded-lg text-xs">
                    <span className="font-medium text-[var(--color-neutral-700)]">
                      {eventTypeLabels[ev.event_type] || ev.event_type}
                    </span>
                    <span className="text-[var(--color-neutral-400)]">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: OPERATIONS — Revenue, Costs, Unit Economics, Health
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'operations' && healthData && (
        <div className="space-y-6">
          {/* Row 1: Revenue KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard
              label="Net MRR"
              value={`$${fmt(healthData.revenue?.netMrr || 0)}`}
              color="emerald"
              sub={`Gross: $${fmt(healthData.revenue?.mrr || 0)} · Disc: -$${fmt(healthData.revenue?.totalDiscountImpact || 0)}`}
            />
            <KPICard
              label="Stripe Rev (30d)"
              value={`$${fmt(healthData.revenue?.stripeRevenue30d || 0)}`}
              color="blue"
              sub="Paid invoices"
            />
            <KPICard
              label="Profit"
              value={`$${fmt(healthData.unitEconomics?.profit || 0)}`}
              color={((healthData.unitEconomics?.marginPercent || 0) >= 50) ? 'emerald' : 'amber'}
              sub={`${healthData.unitEconomics?.marginPercent || 0}% margin`}
            />
            <KPICard
              label="ARPC"
              value={`$${fmt(healthData.unitEconomics?.arpc || 0)}`}
              color="indigo"
              sub="Avg Rev / Company"
            />
            <KPICard
              label="Bland Cost/mo"
              value={`$${fmt(healthData.blandEconomics?.blandCostThisMonth || 0)}`}
              color="red"
              sub={`$${healthData.blandEconomics?.costPerMinute || 0}/min`}
            />
            <KPICard
              label="Cost / Call"
              value={`$${fmt(healthData.unitEconomics?.costPerCall || 0)}`}
              color="violet"
              sub={`${fmtInt(healthData.blandEconomics?.totalMinutesThisMonth || 0)} min total`}
            />
          </div>

          {/* Row 2: Subscription Health + Bland Economics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Health */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Subscription Health</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{healthData.subscriptionHealth?.active || 0}</div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{healthData.subscriptionHealth?.trialing || 0}</div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Trialing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{healthData.subscriptionHealth?.pastDue || 0}</div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Past Due</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{healthData.subscriptionHealth?.canceled || 0}</div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Canceled</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border-default)] grid grid-cols-2 gap-4">
                <div>
                  <div className="text-lg font-bold text-[var(--color-ink)]">{healthData.subscriptionHealth?.trialConversionRate || 0}%</div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Trial Conversion Rate</div>
                </div>
                <div>
                  <div className={`text-lg font-bold ${(healthData.subscriptionHealth?.churnRate || 0) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {healthData.subscriptionHealth?.churnRate || 0}%
                  </div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Monthly Churn Rate</div>
                </div>
              </div>
            </div>

            {/* Bland Credit Economics */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Bland Credit Economics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={`text-2xl font-bold ${(healthData.blandEconomics?.projectedRunwayDays ?? 999) < 7 ? 'text-red-600' : (healthData.blandEconomics?.projectedRunwayDays ?? 999) < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ${fmt(healthData.blandAccount?.balance ?? 0)}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Current Balance</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--color-ink)]">
                    ${fmt(healthData.blandEconomics?.burnRatePerDay || 0)}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Burn Rate / Day</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${(healthData.blandEconomics?.projectedRunwayDays ?? 999) < 7 ? 'text-red-600' : (healthData.blandEconomics?.projectedRunwayDays ?? 999) < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {healthData.blandEconomics?.projectedRunwayDays != null ? `${healthData.blandEconomics.projectedRunwayDays}d` : '--'}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Projected Runway</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--color-ink)]">
                    {healthData.blandEconomics?.avgCallDurationSec ? `${Math.round(healthData.blandEconomics.avgCallDurationSec / 60 * 10) / 10}m` : '--'}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-500)]">Avg Call Duration</div>
                </div>
              </div>
              {/* Runway warning */}
              {healthData.blandEconomics?.projectedRunwayDays != null && healthData.blandEconomics.projectedRunwayDays < 14 && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
                  healthData.blandEconomics.projectedRunwayDays < 7
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {healthData.blandEconomics.projectedRunwayDays < 7
                    ? `!! Critical: Bland credits will run out in ~${healthData.blandEconomics.projectedRunwayDays} days. Top up immediately.`
                    : `! Warning: Bland credits projected to last ~${healthData.blandEconomics.projectedRunwayDays} days. Consider topping up.`
                  }
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Revenue by Plan + Failed Calls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Plan */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">MRR by Plan</h3>
              <div className="space-y-3">
                {Object.entries(healthData.revenue?.revenueByPlan || {})
                  .sort(([, a], [, b]) => b.mrr - a.mrr)
                  .map(([slug, data]) => (
                    <div key={slug} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${planColors[slug] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {slug.charAt(0).toUpperCase() + slug.slice(1)}
                        </span>
                        <span className="text-xs text-[var(--color-neutral-500)]">{data.count} companies</span>
                      </div>
                      <span className="text-sm font-bold text-[var(--color-ink)]">${fmt(data.mrr)}/mo</span>
                    </div>
                  ))}
                {Object.keys(healthData.revenue?.revenueByPlan || {}).length === 0 && (
                  <p className="text-sm text-[var(--color-neutral-400)]">No subscription data</p>
                )}
              </div>
            </div>

            {/* Failed Calls Analysis */}
            <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
              <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">
                Failed Calls This Month ({healthData.failedCalls?.totalThisMonth || 0})
              </h3>
              <div className="space-y-2">
                {(healthData.failedCalls?.byReason || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-neutral-600)] truncate max-w-[70%]">{item.reason}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${Math.min(100, (item.count / Math.max(1, healthData.failedCalls?.totalThisMonth || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[var(--color-neutral-700)] w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
                {(healthData.failedCalls?.byReason || []).length === 0 && (
                  <p className="text-sm text-[var(--color-neutral-400)]">No failed calls this month</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Unit Economics — Correct model: promo users ≠ losses */}
          <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
            <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Actual Economics — This Month</h3>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--color-neutral-500)]">Actual Revenue (Collected)</span>
                  <span className="text-sm font-bold text-emerald-600">${fmt(healthData.unitEconomics?.actualRevenue || 0)}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--color-neutral-500)]">Bland AI Cost (All Users)</span>
                  <span className="text-sm font-bold text-red-600">-${fmt(healthData.unitEconomics?.blandCost || 0)}</span>
                </div>
                <div className="border-t border-[var(--border-default)] pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-neutral-700)]">Profit</span>
                  <span className={`text-sm font-bold ${(healthData.unitEconomics?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${fmt(healthData.unitEconomics?.profit || 0)}
                  </span>
                </div>
                {(healthData.unitEconomics?.promoSubsCount || 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-neutral-200)]">
                    <p className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase mb-1">Promotional Users ({healthData.unitEconomics?.promoSubsCount || 0})</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-neutral-400)]">Foregone revenue (not a loss)</span>
                      <span className="text-xs text-[var(--color-neutral-400)]">${fmt(healthData.unitEconomics?.promoAllowance || 0)}/mo</span>
                    </div>
                    <p className="text-[10px] text-[var(--color-neutral-400)] mt-1">These users only cost you their Bland AI usage</p>
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-[var(--border-default)] flex items-center justify-between">
                  <span className="text-[10px] text-[var(--color-neutral-400)]">Paying customers: {healthData.unitEconomics?.payingCompanies || 0} · ARPC: ${fmt(healthData.unitEconomics?.arpc || 0)}/mo</span>
                </div>
              </div>
              {/* Margin gauge */}
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-neutral-100)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={(healthData.unitEconomics?.marginPercent || 0) >= 50 ? '#10b981' : (healthData.unitEconomics?.marginPercent || 0) >= 20 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${Math.max(0, healthData.unitEconomics?.marginPercent || 0) * 0.974} 97.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-[var(--color-ink)]">{healthData.unitEconomics?.marginPercent || 0}%</span>
                  </div>
                </div>
                <span className="text-xs text-[var(--color-neutral-500)] mt-1">Margin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: CLIENTS LIST
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'clients' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search companies..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <select
              value={clientSort}
              onChange={(e) => setClientSort(e.target.value as typeof clientSort)}
              className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="usage">Sort: Usage %</option>
              <option value="profit">Sort: Profit</option>
              <option value="cost">Sort: Bland Cost</option>
              <option value="name">Sort: Name</option>
            </select>
            <button onClick={fetchClients} className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90">
              Refresh
            </button>
            <button
              onClick={handleCleanupOrphans}
              disabled={cleaningUp}
              className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
            >
              {cleaningUp ? 'Cleaning...' : 'Cleanup Orphans'}
            </button>
            <span className="text-xs text-[var(--color-neutral-400)]">{sortedClients.length} {sortedClients.length === 1 ? 'company' : 'companies'}</span>
          </div>

          {/* Clients Table */}
          <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                    <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Company</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Plan</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Status</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Usage</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Revenue</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Discount</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Bland Cost</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Profit</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((client) => (
                    <tr key={client.id} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--color-ink)] max-w-[280px] truncate" title={client.name}>{client.name}</div>
                        <div className="text-xs text-[var(--color-neutral-400)]">{client.id.substring(0, 8)}...</div>
                      </td>
                      <td className="text-center py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${planColors[client.plan.slug] || ''}`}>
                          {client.plan.slug}
                        </span>
                      </td>
                      <td className="text-center py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          client.subscription.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          client.subscription.status === 'trialing' ? 'bg-blue-50 text-blue-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {client.subscription.status}
                        </span>
                      </td>
                      <td className="text-center py-3 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                client.usage.usagePercent >= 90 ? 'bg-red-500' :
                                client.usage.usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(client.usage.usagePercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-neutral-500)]">
                            {client.usage.minutesUsed}/{client.usage.minutesIncluded} min ({client.usage.usagePercent}%)
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-3">
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-emerald-700">${fmt(client.economics.grossRevenue)}</span>
                          {client.economics.discountAmount > 0 && (
                            <span className="text-[10px] text-[var(--color-neutral-500)]">Net: ${fmt(client.economics.netRevenue)}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-3">
                        {client.discount ? (
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-semibold text-orange-600">-${fmt(client.economics.discountAmount)}/mo</span>
                            <span className="text-[10px] text-[var(--color-neutral-400)]" title={client.discount.couponName || ''}>
                              {client.discount.promoCode || client.discount.couponName || 'Direct'}{' '}
                              ({client.discount.percentOff ? `${client.discount.percentOff}%` : `$${client.discount.amountOff}`}
                              {client.discount.duration === 'repeating' && client.discount.durationInMonths ? ` · ${client.discount.durationInMonths}mo` :
                               client.discount.duration === 'forever' ? ' · forever' : ' · once'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-neutral-300)]">—</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-3 text-red-600">${fmt(client.economics.blandCost)}</td>
                      <td className="text-center py-3 px-3">
                        <span className={`font-semibold ${client.economics.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          ${fmt(client.economics.profit)}
                        </span>
                      </td>
                      <td className="text-center py-3 px-3">
                        <span className={`text-xs font-bold ${
                          client.economics.marginPercent >= 50 ? 'text-emerald-600' :
                          client.economics.marginPercent >= 30 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {client.economics.marginPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unit Economics Summary */}
          {clients.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <SummaryCard
                label="Gross Revenue"
                value={`$${fmt(clients.reduce((s, c) => s + c.economics.grossRevenue, 0))}`}
                color="emerald"
              />
              <SummaryCard
                label="Discounts"
                value={`-$${fmt(clients.reduce((s, c) => s + c.economics.discountAmount, 0))}`}
                color="orange"
              />
              <SummaryCard
                label="Total Bland Cost"
                value={`$${fmt(clients.reduce((s, c) => s + c.economics.blandCost, 0))}`}
                color="red"
              />
              <SummaryCard
                label="Total Profit"
                value={`$${fmt(clients.reduce((s, c) => s + c.economics.profit, 0))}`}
                color="blue"
              />
              <SummaryCard
                label="Avg Margin"
                value={`${Math.round(clients.reduce((s, c) => s + c.economics.marginPercent, 0) / clients.length)}%`}
                color="violet"
              />
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: BILLING EVENTS
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={eventsFilter}
              onChange={(e) => { setEventsFilter(e.target.value); fetchEvents(1, e.target.value); }}
              className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">All event types</option>
              {Object.entries(eventTypeLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => fetchEvents(eventsPage, eventsFilter)}
              className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90"
            >
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                    <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Time</th>
                    <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Company</th>
                    <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Event</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Minutes</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Cost</th>
                    <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                      <td className="py-2 px-4 text-xs text-[var(--color-neutral-500)]">
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-[var(--color-ink)]">{ev.company_name || ev.company_id.substring(0, 8)}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-medium">
                          {eventTypeLabels[ev.event_type] || ev.event_type}
                        </span>
                      </td>
                      <td className="text-center py-2 px-3 text-xs">{ev.minutes_consumed ?? '-'}</td>
                      <td className="text-center py-2 px-3 text-xs">{ev.cost_usd != null ? `$${fmt(ev.cost_usd)}` : '-'}</td>
                      <td className="py-2 px-3 text-xs text-[var(--color-neutral-400)] max-w-xs truncate">
                        {JSON.stringify(ev.event_data).substring(0, 80)}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-[var(--color-neutral-400)]">No billing events found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { const p = Math.max(1, eventsPage - 1); setEventsPage(p); fetchEvents(p, eventsFilter); }}
              disabled={eventsPage <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-sm text-[var(--color-neutral-500)]">
              Page {eventsPage} of {eventsTotalPages}
            </span>
            <button
              onClick={() => { const p = Math.min(eventsTotalPages, eventsPage + 1); setEventsPage(p); fetchEvents(p, eventsFilter); }}
              disabled={eventsPage >= eventsTotalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: RECONCILIATION
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'reconcile' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-neutral-600)]">
              Compares call_logs (Bland webhooks) vs usage_tracking (billing system) to detect missed usage.
            </p>
            <button onClick={fetchReconcile} className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90">
              Run Reconciliation
            </button>
          </div>

          {reconcileData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard label="Total Companies" value={String(reconcileData.summary.total)} color="blue" />
                <SummaryCard label="With Issues" value={String(reconcileData.summary.withIssues)} color={reconcileData.summary.withIssues > 0 ? 'red' : 'emerald'} />
                <SummaryCard label="Critical" value={String(reconcileData.summary.critical)} color="red" />
                <SummaryCard label="Major" value={String(reconcileData.summary.major)} color="orange" />
                <SummaryCard label="Minor" value={String(reconcileData.summary.minor)} color="amber" />
              </div>

              {/* Discrepancy Table */}
              <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Severity</th>
                        <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Company</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Calls</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Actual Min (call_logs)</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Tracked Min (usage)</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileData.discrepancies.filter(d => d.severity !== 'ok' || d.callCount > 0).map(d => (
                        <tr key={d.companyId} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                          <td className="py-2 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${severityColors[d.severity]}`}>
                              {d.severity.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium">{d.companyName}</td>
                          <td className="text-center py-2 px-3">{d.callCount}</td>
                          <td className="text-center py-2 px-3">{d.actualMinutes}</td>
                          <td className="text-center py-2 px-3">{d.trackedMinutes}</td>
                          <td className="text-center py-2 px-3">
                            <span className={`font-bold ${d.difference > 0 ? 'text-red-600' : d.difference < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {d.difference > 0 ? '+' : ''}{d.difference}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {reconcileData.summary.withIssues > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <strong>Note:</strong> Positive difference means Bland processed more minutes than our billing tracked.
                  This could mean the webhook failed to report usage. Check call_logs for calls without corresponding billing_events.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: FINANCES
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'finances' && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-neutral-600)]">V4 Pricing Model — Master Key Architecture</p>
            <select
              value={financePeriod}
              onChange={(e) => { setFinancePeriod(e.target.value); fetchFinances(e.target.value); }}
              className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="current">Current Period</option>
              <option value="last_30">Last 30 Days</option>
              <option value="last_90">Last 90 Days</option>
            </select>
          </div>

          {(() => {
              const fd = financeData || {} as FinanceData;
              const addonRevenue = (fd.addon_revenue as number) || 0;
              // Actual revenue = revenue_total from API (already capped at 0, never negative)
              const actualRevenue = fd.revenue_total || 0;
              const discountImpact = fd.total_discount_impact || 0;
              const blandInfrastructureCost = (fd.bland_infrastructure_cost as number) || 0;
              const marginColor = (p: number | null) => !p ? 'text-[var(--color-neutral-600)]' : p >= 50 ? 'text-emerald-600' : p >= 35 ? 'text-amber-600' : 'text-red-600';
              const blandBalance = fd.bland_master_balance || healthData?.blandAccount?.balance || 0;
              const blandPlan = fd.bland_plan || healthData?.blandAccount?.plan || 'Unknown';
              const blandTalkRate = fd.bland_talk_rate || healthData?.blandAccount?.costPerMinute || 0.11;
              const blandTransferRate = fd.bland_transfer_rate || healthData?.blandAccount?.transferRate || 0;
              const blandConcurrentLimit = fd.bland_concurrent_limit || ((healthData?.blandLimits?.concurrentCap ?? 0) >= 999999 ? '∞' : String(healthData?.blandLimits?.concurrentCap ?? '∞'));
              const blandDailyLimit = fd.bland_daily_limit || ((healthData?.blandLimits?.dailyCap ?? 0) >= 999999 ? '∞' : String(healthData?.blandLimits?.dailyCap ?? '∞'));

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Actual Revenue</p>
                        <p className="text-2xl font-bold text-emerald-900">${fmt(actualRevenue)}</p>
                        <div className="mt-2 space-y-0.5 text-xs text-emerald-700">
                          <div className="flex justify-between"><span>Subscriptions</span><span>${fmt(fd.revenue_subscriptions || 0)}</span></div>
                          <div className="flex justify-between"><span>Overages</span><span>${fmt(fd.revenue_overages || 0)}</span></div>
                          {addonRevenue > 0 && <div className="flex justify-between"><span>Add-ons</span><span>${fmt(addonRevenue)}</span></div>}
                          {discountImpact > 0 && (
                            <div className="flex justify-between text-orange-600 pt-1 mt-1 border-t border-emerald-300">
                              <span>Promo foregone</span><span>${fmt(discountImpact)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Total Costs</p>
                        <p className="text-2xl font-bold text-red-900">${fmt(fd.cost_total || 0)}</p>
                        <div className="mt-2 space-y-0.5 text-xs text-red-700">
                          <div className="flex justify-between"><span>Bland per-min</span><span>${fmt(fd.cost_bland || 0)}</span></div>
                          {blandInfrastructureCost > 0 && <div className="flex justify-between"><span>Bland infra</span><span>${fmt(blandInfrastructureCost)}</span></div>}
                          <div className="flex justify-between"><span>Other</span><span>${fmt((fd.cost_openai || 0) + (fd.cost_supabase || 0))}</span></div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Gross Margin</p>
                        <p className="text-2xl font-bold text-[var(--color-ink)]">${fmt(fd.gross_margin || 0)}</p>
                        <p className={`mt-2 text-xl font-bold ${marginColor(fd.gross_margin_percent)}`}>{fd.gross_margin_percent?.toFixed(1) || '0.0'}%</p>
                        <p className="text-xs text-[var(--color-neutral-500)]">Target: 55-67%</p>
                      </div>

                      <div className="bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-5">
                        <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1">Companies</p>
                        <p className="text-2xl font-bold text-[var(--color-ink)]">{fd.total_companies_active || 0}</p>
                        <p className="mt-2 text-sm text-violet-700">${fmt(fd.avg_revenue_per_company || 0)} ARPC</p>
                        {discountImpact > 0 && <p className="text-xs text-orange-600 mt-1">Includes promo users</p>}
                      </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                        <p className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Total Calls</p>
                        <p className="text-3xl font-bold text-[var(--color-ink)]">{fd.total_calls_made?.toLocaleString() || 0}</p>
                        <p className="text-sm text-[var(--color-neutral-600)] mt-1">{fd.total_minutes_used?.toLocaleString() || 0} minutes used</p>
                        <p className="text-xs text-[var(--color-neutral-500)] mt-1">Avg: {fd.avg_minutes_per_call?.toFixed(2) || '0.00'} min/call (target: ~1.5)</p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                        <p className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Overage Revenue</p>
                        <p className="text-3xl font-bold text-[var(--color-ink)]">${fd.revenue_overages?.toLocaleString() || '0'}</p>
                        <p className="text-sm text-[var(--color-neutral-600)] mt-1">{fd.overage_revenue_percent?.toFixed(1) || '0.0'}% of subscription revenue</p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                        <p className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Active Users</p>
                        <p className="text-3xl font-bold text-[var(--color-ink)]">{fd.total_users_active || 0}</p>
                        <p className="text-sm text-[var(--color-neutral-600)] mt-1">across {fd.total_companies_active || 0} companies</p>
                      </div>
                    </div>

                    {/* Bland AI Infrastructure — Master Account */}
                    <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                      <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-3">Bland AI — Master Account</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className={`p-3 rounded-lg border ${blandBalance < 5 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <p className={`text-xs font-semibold uppercase mb-1 ${blandBalance < 5 ? 'text-red-700' : 'text-emerald-700'}`}>Master Balance</p>
                          <p className={`text-lg font-bold ${blandBalance < 5 ? 'text-red-900' : 'text-emerald-900'}`}>${fmt(blandBalance)}</p>
                          <p className={`text-xs ${blandBalance < 5 ? 'text-red-600' : 'text-emerald-600'}`}>Available credits</p>
                        </div>
                        <div className="p-3 bg-[var(--color-neutral-50)] rounded-lg border border-[var(--border-default)]">
                          <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase mb-1">Master Plan</p>
                          <p className="text-lg font-bold text-[var(--color-ink)] capitalize">{blandPlan}</p>
                          <p className="text-xs text-[var(--color-neutral-600)]">${fd.bland_plan_cost || 0}/mo</p>
                        </div>
                        <div className="p-3 bg-[var(--color-neutral-50)] rounded-lg border border-[var(--border-default)]">
                          <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase mb-1">Per-Min Rate</p>
                          <p className="text-lg font-bold text-[var(--color-ink)]">${blandTalkRate.toFixed(4)}/min</p>
                          <p className="text-xs text-[var(--color-neutral-600)]">Transfer: ${blandTransferRate.toFixed(4)}/min</p>
                        </div>
                        <div className="p-3 bg-[var(--color-neutral-50)] rounded-lg border border-[var(--border-default)]">
                          <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase mb-1">Architecture</p>
                          <p className="text-lg font-bold text-[var(--color-ink)]">Master Key</p>
                          <p className="text-xs text-[var(--color-neutral-600)]">Single API key</p>
                        </div>
                        <div className="p-3 bg-[var(--color-neutral-50)] rounded-lg border border-[var(--border-default)]">
                          <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase mb-1">Master Limits</p>
                          <p className="text-xs text-[var(--color-neutral-700)]"><strong>{blandConcurrentLimit}</strong> concurrent</p>
                          <p className="text-xs text-[var(--color-neutral-700)]"><strong>{blandDailyLimit}</strong> per day</p>
                        </div>
                      </div>

                      {/* Master subscription detail row */}
                      {fd.bland_master_subscription && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                          <p className="text-xs font-semibold text-indigo-700 uppercase mb-2">Master Subscription Details</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-indigo-800">
                            <div><span className="font-medium">Plan:</span> {fd.bland_master_subscription.plan}</div>
                            <div><span className="font-medium">Status:</span> <span className="capitalize">{fd.bland_master_subscription.status}</span></div>
                            <div><span className="font-medium">Talk Rate:</span> ${fd.bland_master_subscription.perMinRate.toFixed(4)}/min</div>
                            <div><span className="font-medium">Transfer Rate:</span> ${fd.bland_master_subscription.transferRate.toFixed(4)}/min</div>
                            <div><span className="font-medium">Concurrent:</span> {fd.bland_master_subscription.concurrentLimit}</div>
                            <div><span className="font-medium">Daily Limit:</span> {fd.bland_master_subscription.dailyLimit}</div>
                            <div><span className="font-medium">Monthly Cost:</span> ${fd.bland_master_subscription.monthlyCost}/mo</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Unit Economics Reference — dynamic based on actual Bland rate */}
                    {(() => {
                      const rate = blandTalkRate;
                      const plans = [
                        { plan: 'Free', price: 0, calls: 10, min: 15, overage: null as number | null },
                        { plan: 'Starter', price: 99, calls: 200, min: 300, overage: 0.29 },
                        { plan: 'Growth', price: 179, calls: 400, min: 600, overage: 0.26 },
                        { plan: 'Business', price: 299, calls: 800, min: 1200, overage: 0.23 },
                        { plan: 'Teams', price: 649, calls: 1500, min: 2250, overage: 0.20 },
                        { plan: 'Enterprise', price: 1499, calls: 4000, min: 6000, overage: 0.17 },
                      ].map(p => {
                        const blandCost = +(p.min * rate).toFixed(2);
                        const credits = +(blandCost * 1.05).toFixed(2);
                        const margin = p.price > 0 ? +((1 - blandCost / p.price) * 100).toFixed(1) : 0;
                        return { ...p, blandCost, credits, margin };
                      });

                      return (
                        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                          <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-3">Unit Economics Reference (V4)</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="border-b-2 border-[var(--border-default)]">
                                  <th className="text-left py-2 pr-4 text-[var(--color-neutral-500)] font-semibold">Plan</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Price</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Calls</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Min</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Bland Cost</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Credits (5%)</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Gross Margin</th>
                                  <th className="text-center py-2 px-3 text-[var(--color-neutral-500)] font-semibold">Overage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {plans.map((row, i) => (
                                  <tr key={i} className={`${i % 2 === 0 ? 'bg-[var(--color-neutral-50)]' : ''} ${row.plan === 'Free' ? 'opacity-70' : ''}`}>
                                    <td className="py-2 pr-4 font-semibold text-[var(--color-neutral-800)]">{row.plan}</td>
                                    <td className="text-center py-2 px-3">{row.price === 0 ? '$0' : `$${row.price}/mo`}</td>
                                    <td className="text-center py-2 px-3">~{row.calls}</td>
                                    <td className="text-center py-2 px-3">{row.min}</td>
                                    <td className="text-center py-2 px-3 text-red-600">${row.blandCost}</td>
                                    <td className="text-center py-2 px-3 text-orange-600">${row.credits}</td>
                                    <td className={`text-center py-2 px-3 font-bold ${row.plan === 'Free' ? 'text-[var(--color-neutral-400)]' : row.margin >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {row.plan === 'Free' ? 'N/A' : `${row.margin}%`}
                                    </td>
                                    <td className="text-center py-2 px-3">{row.overage !== null ? `$${row.overage}/min` : 'Blocked'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-[var(--color-neutral-500)] mt-2">
                            * Bland cost @ ${rate.toFixed(2)}/min ({blandPlan} plan). Credits include 5% buffer. Effective avg: 1.5 min/call attempt.
                          </p>
                        </div>
                      );
                    })()}

                    {fd.notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        <strong>Notes:</strong> {fd.notes}
                      </div>
                    )}
                  </>
                );
              })()}
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════════
          TAB: PROMO CODES — Stripe Promotion Codes, Coupons & Redemptions
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'promos' && (
        <div className="space-y-6">
          {!promoData ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPICard label="Promo Codes" value={String(promoData.summary.totalPromoCodes)} color="violet" sub={`${promoData.summary.activePromoCodes} active`} />
                <KPICard label="Coupons" value={String(promoData.summary.totalCoupons)} color="indigo" sub={`${promoData.summary.activeCoupons} active`} />
                <KPICard label="Total Redemptions" value={fmtInt(promoData.summary.totalRedemptions)} color="blue" sub="All time" />
                <KPICard label="Active Discounts" value={String(promoData.summary.totalActiveDiscounts)} color="emerald" sub="On subscriptions" />
                <KPICard
                  label="Monthly Impact"
                  value={`-$${fmt(promoData.summary.totalMonthlyDiscountImpact)}`}
                  color={promoData.summary.totalMonthlyDiscountImpact > 0 ? 'orange' : 'slate'}
                  sub="Revenue loss/mo"
                />
                <KPICard
                  label="Annual Impact"
                  value={`-$${fmt(promoData.summary.totalMonthlyDiscountImpact * 12)}`}
                  color={promoData.summary.totalMonthlyDiscountImpact > 0 ? 'red' : 'slate'}
                  sub="Projected yearly"
                />
                <KPICard
                  label="Discount Rate"
                  value={`${healthData?.revenue?.mrr ? Math.round((promoData.summary.totalMonthlyDiscountImpact / healthData.revenue.mrr) * 1000) / 10 : 0}%`}
                  color="amber"
                  sub="% of Gross MRR"
                />
              </div>

              {/* Promotion Codes Table */}
              <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
                  <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Promotion Codes</h3>
                  <button onClick={() => { setPromoData(null); fetchPromos(); }} className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs hover:opacity-90">
                    Refresh
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Code</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Discount</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Duration</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Redemptions</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Active On</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Monthly Impact</th>
                        <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoData.promotionCodes.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-[var(--color-neutral-400)]">No promotion codes found in Stripe</td></tr>
                      )}
                      {promoData.promotionCodes.map((pc) => (
                        <>
                          <tr
                            key={pc.id}
                            className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)] transition-colors cursor-pointer"
                            onClick={() => setPromoExpanded(promoExpanded === pc.id ? null : pc.id)}
                          >
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-[var(--color-ink)]">{pc.code}</div>
                              {pc.coupon.name && <div className="text-xs text-[var(--color-neutral-400)]">{pc.coupon.name}</div>}
                            </td>
                            <td className="text-center py-3 px-3">
                              <span className="font-bold text-violet-700">
                                {pc.coupon.percentOff ? `${pc.coupon.percentOff}% off` : `$${fmt(pc.coupon.amountOff || 0)} off`}
                              </span>
                            </td>
                            <td className="text-center py-3 px-3 text-xs text-[var(--color-neutral-600)]">
                              {pc.coupon.duration === 'forever' ? 'Forever' :
                               pc.coupon.duration === 'once' ? 'Once' :
                               `${pc.coupon.durationInMonths}mo`}
                            </td>
                            <td className="text-center py-3 px-3">
                              <span className="font-semibold text-[var(--color-ink)]">{pc.timesRedeemed}</span>
                              {pc.maxRedemptions && <span className="text-xs text-[var(--color-neutral-400)]"> / {pc.maxRedemptions}</span>}
                            </td>
                            <td className="text-center py-3 px-3">
                              <span className={`font-semibold ${pc.activeRedemptions > 0 ? 'text-emerald-600' : 'text-[var(--color-neutral-400)]'}`}>
                                {pc.activeRedemptions} sub{pc.activeRedemptions !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="text-center py-3 px-3">
                              {pc.monthlyImpact > 0 ? (
                                <span className="font-bold text-orange-600">-${fmt(pc.monthlyImpact)}/mo</span>
                              ) : (
                                <span className="text-[var(--color-neutral-400)]">—</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                pc.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {pc.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                          {/* Expanded: customer details */}
                          {promoExpanded === pc.id && pc.customers.length > 0 && (
                            <tr key={`${pc.id}-details`}>
                              <td colSpan={7} className="bg-[var(--color-neutral-50)] px-6 py-3">
                                <div className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Active Redemptions</div>
                                <div className="space-y-2">
                                  {pc.customers.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[var(--border-default)]">
                                      <div>
                                        <span className="font-medium text-[var(--color-ink)]">{c.customerName || c.customerEmail || c.customerId}</span>
                                        {c.customerEmail && c.customerName && <span className="text-xs text-[var(--color-neutral-400)] ml-2">{c.customerEmail}</span>}
                                      </div>
                                      <div className="flex items-center gap-4 text-xs">
                                        <span className="text-[var(--color-neutral-500)]">Plan: <strong>${fmt(c.planAmount)}/mo</strong></span>
                                        <span className="text-orange-600 font-bold">-${fmt(c.monthlyDiscount)}/mo</span>
                                        <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                          c.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                        }`}>{c.subscriptionStatus}</span>
                                        {c.discountEnd && (
                                          <span className="text-[var(--color-neutral-400)]">
                                            Ends: {new Date(c.discountEnd * 1000).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Standalone Coupons (no promo code wrapper — e.g., retention coupons) */}
              {promoData.standaloneCoupons.length > 0 && (
                <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                  <div className="p-4 border-b border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Standalone Coupons (No Promo Code)</h3>
                    <p className="text-xs text-[var(--color-neutral-400)] mt-1">Coupons applied directly (e.g., retention offers, manual discounts)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                          <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Coupon ID / Name</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Discount</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Duration</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Redemptions</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Active On</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Monthly Impact</th>
                          <th className="text-center py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoData.standaloneCoupons.map((sc) => (
                          <>
                            <tr
                              key={sc.coupon.id}
                              className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)] transition-colors cursor-pointer"
                              onClick={() => setPromoExpanded(promoExpanded === sc.coupon.id ? null : sc.coupon.id)}
                            >
                              <td className="py-3 px-4">
                                <div className="font-mono text-xs text-[var(--color-ink)]">{sc.coupon.name || sc.coupon.id}</div>
                                {sc.coupon.name && <div className="text-[10px] text-[var(--color-neutral-400)]">{sc.coupon.id}</div>}
                              </td>
                              <td className="text-center py-3 px-3">
                                <span className="font-bold text-violet-700">
                                  {sc.coupon.percentOff ? `${sc.coupon.percentOff}% off` : `$${fmt(sc.coupon.amountOff || 0)} off`}
                                </span>
                              </td>
                              <td className="text-center py-3 px-3 text-xs text-[var(--color-neutral-600)]">
                                {sc.coupon.duration === 'forever' ? 'Forever' :
                                 sc.coupon.duration === 'once' ? 'Once' :
                                 `${sc.coupon.durationInMonths}mo`}
                              </td>
                              <td className="text-center py-3 px-3 font-semibold">{sc.timesRedeemed}</td>
                              <td className="text-center py-3 px-3">
                                <span className={`font-semibold ${sc.activeRedemptions > 0 ? 'text-emerald-600' : 'text-[var(--color-neutral-400)]'}`}>
                                  {sc.activeRedemptions} sub{sc.activeRedemptions !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="text-center py-3 px-3">
                                {sc.monthlyImpact > 0 ? (
                                  <span className="font-bold text-orange-600">-${fmt(sc.monthlyImpact)}/mo</span>
                                ) : (
                                  <span className="text-[var(--color-neutral-400)]">—</span>
                                )}
                              </td>
                              <td className="text-center py-3 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  sc.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {sc.active ? 'Active' : 'Expired'}
                                </span>
                              </td>
                            </tr>
                            {promoExpanded === sc.coupon.id && sc.customers.length > 0 && (
                              <tr key={`${sc.coupon.id}-details`}>
                                <td colSpan={7} className="bg-[var(--color-neutral-50)] px-6 py-3">
                                  <div className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-2">Active Redemptions</div>
                                  <div className="space-y-2">
                                    {sc.customers.map((c, i) => (
                                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[var(--border-default)]">
                                        <div>
                                          <span className="font-medium text-[var(--color-ink)]">{c.customerName || c.customerEmail || c.customerId}</span>
                                          {c.customerEmail && c.customerName && <span className="text-xs text-[var(--color-neutral-400)] ml-2">{c.customerEmail}</span>}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                          <span className="text-[var(--color-neutral-500)]">Plan: <strong>${fmt(c.planAmount)}/mo</strong></span>
                                          <span className="text-orange-600 font-bold">-${fmt(c.monthlyDiscount)}/mo</span>
                                          <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                            c.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                          }`}>{c.subscriptionStatus}</span>
                                          {c.discountEnd && (
                                            <span className="text-[var(--color-neutral-400)]">
                                              Ends: {new Date(c.discountEnd * 1000).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Revenue Impact Summary */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-6">
                <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-4">Revenue Impact Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-2xl font-bold text-[var(--color-ink)]">${fmt(healthData?.revenue?.mrr || 0)}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">Gross MRR</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">-${fmt(promoData.summary.totalMonthlyDiscountImpact)}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">Total Discounts/mo</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-700">${fmt(healthData?.revenue?.netMrr || 0)}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">Net MRR</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-700">${fmt((healthData?.revenue?.netMrr || 0) * 12)}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">Net ARR</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: ACCOUNTING — P&L, Cash Flow, Ledger
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'accounting' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-neutral-600)]">Full Financial Accounting — Actual Revenue, Real Costs, Promo Impact</p>
            <div className="flex gap-2 items-center">
              <select
                value={accountingPeriod}
                onChange={(e) => { setAccountingPeriod(e.target.value); setAccountingData(null); fetchAccounting(e.target.value); }}
                className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="current">Current Month</option>
                <option value="last_30">Last 30 Days</option>
                <option value="last_90">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
              </select>
              <button
                onClick={() => { setAccountingData(null); fetchAccounting(accountingPeriod); }}
                className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90"
              >
                Refresh
              </button>
            </div>
          </div>

          {!accountingData ? (
            <div className="text-center py-12 text-[var(--color-neutral-400)]">Loading accounting data...</div>
          ) : (() => {
            const { pnl, cashFlow, discountedSubscriptions: discSubs, unitEconomics: ue, charts: chartData, ledger: ledgerData } = accountingData;
            const marginColor = (p: number) => p >= 50 ? 'text-emerald-600' : p >= 20 ? 'text-amber-600' : 'text-red-600';

            return (
              <>
                {/* ─── P&L STATEMENT (Correct: revenue = actual collected) ─── */}
                <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide">Profit & Loss Statement</h3>
                    <p className="text-slate-300 text-xs mt-1">
                      {new Date(accountingData.period.start).toLocaleDateString()} — {new Date(accountingData.period.end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="p-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-[var(--border-default)]">
                          <th className="text-left py-2 font-bold text-[var(--color-neutral-700)]">Line Item</th>
                          <th className="text-right py-2 font-bold text-[var(--color-neutral-700)]">Amount</th>
                          <th className="text-right py-2 font-bold text-[var(--color-neutral-700)]">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* ACTUAL REVENUE */}
                        <tr className="bg-emerald-50"><td colSpan={3} className="py-2 px-2 font-bold text-emerald-800 uppercase text-xs tracking-wide">Actual Revenue (What&apos;s Collected)</td></tr>
                        <tr className="border-b border-[var(--border-default)]">
                          <td className="py-2 pl-6">Subscription Revenue</td>
                          <td className="text-right py-2 font-medium text-emerald-700">${fmt(pnl.revenue.actualMrr)}</td>
                          <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">{ue.payingCustomers} paying customer{ue.payingCustomers !== 1 ? 's' : ''}</td>
                        </tr>
                        {pnl.revenue.overages > 0 && (
                          <tr className="border-b border-[var(--border-default)]">
                            <td className="py-2 pl-6">Overage Revenue</td>
                            <td className="text-right py-2">${fmt(pnl.revenue.overages)}</td>
                            <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">Usage beyond plan limits</td>
                          </tr>
                        )}
                        {pnl.revenue.addons > 0 && (
                          <tr className="border-b border-[var(--border-default)]">
                            <td className="py-2 pl-6">Add-on Revenue</td>
                            <td className="text-right py-2">${fmt(pnl.revenue.addons)}</td>
                            <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">Dedicated numbers, vaults, boosters</td>
                          </tr>
                        )}
                        <tr className="border-b-2 border-emerald-300 bg-emerald-50 font-bold">
                          <td className="py-3 pl-4 text-emerald-800">Total Actual Revenue</td>
                          <td className="text-right py-3 text-emerald-800">${fmt(pnl.revenue.totalActualRevenue)}</td>
                          <td className="text-right py-3 text-xs text-emerald-600">Cash collected</td>
                        </tr>

                        {/* COSTS */}
                        <tr className="bg-red-50"><td colSpan={3} className="py-2 px-2 font-bold text-red-800 uppercase text-xs tracking-wide">Cost of Revenue</td></tr>
                        <tr className="border-b border-[var(--border-default)]">
                          <td className="py-2 pl-6">Bland AI — Paying Customers</td>
                          <td className="text-right py-2 text-red-600">${fmt(pnl.costs.blandPaying)}</td>
                          <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">{ue.payingMinutes} min</td>
                        </tr>
                        {pnl.costs.blandPromo > 0 && (
                          <tr className="border-b border-[var(--border-default)]">
                            <td className="py-2 pl-6">Bland AI — Promo/Tester Users</td>
                            <td className="text-right py-2 text-orange-600">${fmt(pnl.costs.blandPromo)}</td>
                            <td className="text-right py-2 text-xs text-orange-500">{ue.promoMinutes} min · actual cost of promos</td>
                          </tr>
                        )}
                        <tr className="border-b-2 border-red-300 bg-red-50 font-bold">
                          <td className="py-3 pl-4 text-red-800">Total COGS</td>
                          <td className="text-right py-3 text-red-800">${fmt(pnl.costs.blandTotal)}</td>
                          <td className="text-right py-3 text-xs text-red-600">{ue.totalMinutes} total min</td>
                        </tr>

                        {/* GROSS PROFIT */}
                        <tr className="bg-blue-50 font-bold text-lg">
                          <td className="py-3 pl-4 text-blue-800">Gross Profit</td>
                          <td className={`text-right py-3 ${pnl.margins.grossProfit >= 0 ? 'text-blue-800' : 'text-red-600'}`}>${fmt(pnl.margins.grossProfit)}</td>
                          <td className={`text-right py-3 font-bold ${marginColor(pnl.margins.grossMarginPercent)}`}>{pnl.margins.grossMarginPercent}%</td>
                        </tr>

                        {/* OPERATING EXPENSES */}
                        <tr className="bg-amber-50"><td colSpan={3} className="py-2 px-2 font-bold text-amber-800 uppercase text-xs tracking-wide">Operating Expenses</td></tr>
                        <tr className="border-b border-[var(--border-default)]">
                          <td className="py-2 pl-6">Stripe Processing (~2.9% + $0.30/txn)</td>
                          <td className="text-right py-2 text-amber-700">${fmt(pnl.costs.stripeProcessing)}</td>
                          <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">On collected payments only</td>
                        </tr>

                        {/* OPERATING PROFIT */}
                        <tr className="bg-violet-50 font-bold text-lg border-t-2 border-violet-300">
                          <td className="py-3 pl-4 text-violet-800">Operating Profit</td>
                          <td className={`text-right py-3 ${pnl.margins.operatingProfit >= 0 ? 'text-violet-800' : 'text-red-600'}`}>${fmt(pnl.margins.operatingProfit)}</td>
                          <td className={`text-right py-3 font-bold ${marginColor(pnl.margins.operatingMarginPercent)}`}>{pnl.margins.operatingMarginPercent}%</td>
                        </tr>

                        {/* PROMO CONTEXT — informational, NOT a loss */}
                        {pnl.promotional.promoCustomers > 0 && (
                          <>
                            <tr><td colSpan={3} className="py-1" /></tr>
                            <tr className="bg-orange-50"><td colSpan={3} className="py-2 px-2 font-bold text-orange-700 uppercase text-xs tracking-wide">Promotional Users Context (Informational)</td></tr>
                            <tr className="border-b border-[var(--border-default)]">
                              <td className="py-2 pl-6 text-[var(--color-neutral-500)]">Promo/Tester Users</td>
                              <td className="text-right py-2 text-[var(--color-neutral-500)]">{pnl.promotional.promoCustomers}</td>
                              <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">Users on discounted plans</td>
                            </tr>
                            <tr className="border-b border-[var(--border-default)]">
                              <td className="py-2 pl-6 text-[var(--color-neutral-500)]">Catalog Value (if full price)</td>
                              <td className="text-right py-2 text-[var(--color-neutral-400)]">${fmt(pnl.promotional.foregoneRevenue)}/mo</td>
                              <td className="text-right py-2 text-xs text-[var(--color-neutral-400)]">Not a loss — never collected</td>
                            </tr>
                            <tr className="border-b border-[var(--border-default)]">
                              <td className="py-2 pl-6 text-[var(--color-neutral-500)]">Real Cost of Promo Users</td>
                              <td className="text-right py-2 text-orange-600 font-semibold">${fmt(pnl.promotional.effectivePromoCost)}</td>
                              <td className="text-right py-2 text-xs text-orange-500">Only Bland usage — this is your actual cost</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ─── CHARTS: Revenue Waterfall + Cost Breakdown + Subscriber Segments ─── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Revenue Waterfall */}
                  <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                    <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-3">Revenue Waterfall</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData.revenueWaterfall} layout="vertical" margin={{ left: 0, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} fontSize={10} />
                        <YAxis dataKey="name" type="category" fontSize={10} width={90} />
                        <Tooltip formatter={(v) => `$${fmt(Math.abs(Number(v)))}`} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.revenueWaterfall.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                    <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-3">Cost Breakdown</h3>
                    {chartData.costBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={chartData.costBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} fontSize={10}>
                            {chartData.costBreakdown.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => `$${fmt(Number(v))}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[220px] text-[var(--color-neutral-400)] text-sm">No costs yet</div>
                    )}
                  </div>

                  {/* Subscriber Segments */}
                  <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                    <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase mb-3">Subscriber Segments</h3>
                    {chartData.subscriberSegments.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={chartData.subscriberSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} fontSize={10}>
                            {chartData.subscriberSegments.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend fontSize={10} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[220px] text-[var(--color-neutral-400)] text-sm">No subscribers yet</div>
                    )}
                  </div>
                </div>

                {/* ─── REVENUE BY PLAN ─── */}
                <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
                  <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Revenue Breakdown by Plan</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-default)]">
                        <th className="text-left py-2 font-semibold">Plan</th>
                        <th className="text-center py-2 font-semibold">Total</th>
                        <th className="text-center py-2 font-semibold text-emerald-600">Paying</th>
                        <th className="text-center py-2 font-semibold text-orange-600">Promo</th>
                        <th className="text-right py-2 font-semibold">Catalog MRR</th>
                        <th className="text-right py-2 font-semibold">Actual MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(pnl.revenue.byPlan).map(([slug, data]) => (
                        <tr key={slug} className="border-b border-[var(--border-default)]">
                          <td className="py-2 capitalize font-medium">{slug}</td>
                          <td className="text-center py-2">{data.count}</td>
                          <td className="text-center py-2 text-emerald-600">{data.paying}</td>
                          <td className="text-center py-2 text-orange-600">{data.promo}</td>
                          <td className="text-right py-2 text-[var(--color-neutral-400)]">${fmt(data.catalogMrr)}</td>
                          <td className="text-right py-2 font-semibold">${fmt(data.actualMrr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ─── PROMOTIONAL / DISCOUNTED SUBSCRIPTIONS ─── */}
                {discSubs.length > 0 && (
                  <div className="bg-white rounded-xl border border-orange-200 p-6">
                    <h3 className="text-sm font-bold text-orange-700 uppercase mb-1">
                      Promotional Subscriptions ({discSubs.length})
                    </h3>
                    <p className="text-xs text-[var(--color-neutral-400)] mb-4">These users pay reduced or $0. Their only real cost to you is Bland AI usage.</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-orange-200">
                          <th className="text-left py-2 font-semibold">Company</th>
                          <th className="text-center py-2 font-semibold">Plan</th>
                          <th className="text-center py-2 font-semibold">Promo / Coupon</th>
                          <th className="text-right py-2 font-semibold">Full Price</th>
                          <th className="text-right py-2 font-semibold text-emerald-600">Pays</th>
                          <th className="text-center py-2 font-semibold">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discSubs.map((ds, i) => (
                          <tr key={i} className="border-b border-[var(--border-default)]">
                            <td className="py-2 font-medium">{ds.companyName}</td>
                            <td className="text-center py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${planColors[ds.plan] || 'bg-gray-100 text-gray-700'}`}>{ds.plan}</span>
                            </td>
                            <td className="text-center py-2 text-xs">
                              <span className="font-semibold">{ds.promoCode || ds.couponName || 'Direct'}</span>
                              {ds.percentOff && <span className="text-orange-600 ml-1">({ds.percentOff}% off)</span>}
                            </td>
                            <td className="text-right py-2 text-[var(--color-neutral-400)] line-through">${fmt(ds.grossAmount)}</td>
                            <td className="text-right py-2 font-semibold text-emerald-600">${fmt(ds.netAmount)}/mo</td>
                            <td className="text-center py-2 text-xs text-[var(--color-neutral-500)]">{ds.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 pt-3 border-t border-orange-200 flex justify-between text-sm">
                      <span className="text-[var(--color-neutral-500)]">Catalog value if full price</span>
                      <span className="text-[var(--color-neutral-400)]">${fmt(discSubs.reduce((s, d) => s + d.grossAmount, 0))}/mo (not collected — not a loss)</span>
                    </div>
                  </div>
                )}

                {/* ─── CASH FLOW + UNIT ECONOMICS ─── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
                    <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Cash Flow</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Payments Received</span>
                        <span className="text-lg font-bold text-emerald-700">${fmt(cashFlow.paymentsReceived)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Failed Payments</span>
                        <span className={`text-lg font-bold ${cashFlow.paymentsFailed > 0 ? 'text-red-600' : 'text-[var(--color-neutral-400)]'}`}>${fmt(cashFlow.paymentsFailed)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm">Transactions</span>
                        <span className="text-lg font-bold">{cashFlow.transactionCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[var(--border-default)] p-6">
                    <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Unit Economics</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-[var(--color-neutral-500)]">Companies</span><p className="font-bold text-lg">{ue.totalCompanies} <span className="text-xs font-normal text-[var(--color-neutral-400)]">({ue.payingCustomers} paying, {ue.promoCustomers} promo, {ue.freeCustomers} free)</span></p></div>
                      <div><span className="text-[var(--color-neutral-500)]">Active Users</span><p className="font-bold text-lg">{ue.totalUsers}</p></div>
                      <div><span className="text-[var(--color-neutral-500)]">ARPC (paying only)</span><p className="font-bold text-lg">${fmt(ue.arpc)}<span className="text-xs font-normal">/mo</span></p></div>
                      <div><span className="text-[var(--color-neutral-500)]">LTV (12mo)</span><p className="font-bold text-lg">${fmt(ue.ltv)}</p></div>
                      <div><span className="text-[var(--color-neutral-500)]">Total Calls</span><p className="font-bold text-lg">{ue.totalCalls.toLocaleString()} <span className="text-xs font-normal text-[var(--color-neutral-400)]">({ue.completedCalls} ok, {ue.failedCalls} failed)</span></p></div>
                      <div><span className="text-[var(--color-neutral-500)]">Minutes</span><p className="font-bold text-lg">{ue.totalMinutes.toLocaleString()} <span className="text-xs font-normal text-[var(--color-neutral-400)]">({ue.payingMinutes} paying, {ue.promoMinutes} promo)</span></p></div>
                      <div><span className="text-[var(--color-neutral-500)]">Cost/Call</span><p className="font-bold text-lg">${fmt(ue.costPerCall)}</p></div>
                      <div><span className="text-[var(--color-neutral-500)]">Avg Min/Call</span><p className="font-bold text-lg">{ue.avgMinPerCall.toFixed(2)}</p></div>
                    </div>
                  </div>
                </div>

                {/* ─── GENERAL LEDGER ─── */}
                <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide">General Ledger</h3>
                    <p className="text-slate-300 text-xs mt-1">{ledgerData.length} entries</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                          <th className="text-left py-3 px-4 font-semibold text-[var(--color-neutral-500)]">Date</th>
                          <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Type</th>
                          <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Category</th>
                          <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Description</th>
                          <th className="text-left py-3 px-3 font-semibold text-[var(--color-neutral-500)]">Company</th>
                          <th className="text-right py-3 px-3 font-semibold text-red-600">Debit</th>
                          <th className="text-right py-3 px-3 font-semibold text-emerald-600">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.map((entry, i) => (
                          <tr key={i} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                            <td className="py-2 px-4 text-xs text-[var(--color-neutral-500)]">{new Date(entry.date).toLocaleDateString()}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                entry.type === 'revenue' ? 'bg-emerald-50 text-emerald-700' :
                                entry.type === 'cost' ? 'bg-red-50 text-red-700' :
                                entry.type === 'discount' ? 'bg-orange-50 text-orange-700' :
                                'bg-gray-50 text-gray-700'
                              }`}>{entry.type}</span>
                            </td>
                            <td className="py-2 px-3 text-xs font-medium">{entry.category}</td>
                            <td className="py-2 px-3 text-xs text-[var(--color-neutral-600)] max-w-xs truncate">{entry.description}</td>
                            <td className="py-2 px-3 text-xs">{entry.companyName || '—'}</td>
                            <td className="text-right py-2 px-3 text-xs text-red-600">{entry.debit > 0 ? `$${fmt(entry.debit)}` : ''}</td>
                            <td className="text-right py-2 px-3 text-xs text-emerald-600">{entry.credit > 0 ? `$${fmt(entry.credit)}` : ''}</td>
                          </tr>
                        ))}
                        {ledgerData.length === 0 && (
                          <tr><td colSpan={7} className="py-8 text-center text-[var(--color-neutral-400)]">No ledger entries for this period</td></tr>
                        )}
                      </tbody>
                      {ledgerData.length > 0 && (
                        <tfoot>
                          <tr className="bg-[var(--color-neutral-50)] border-t-2 border-[var(--border-default)] font-bold">
                            <td colSpan={5} className="py-3 px-4 text-right">Totals</td>
                            <td className="text-right py-3 px-3 text-red-700">${fmt(ledgerData.reduce((s, e) => s + e.debit, 0))}</td>
                            <td className="text-right py-3 px-3 text-emerald-700">${fmt(ledgerData.reduce((s, e) => s + e.credit, 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: AI COSTS — OpenAI usage tracking
         ════════════════════════════════════════════════════════════════ */}
      {tab === 'ai_costs' && (
        <div className="space-y-6">
          {/* Refresh button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-neutral-600)]">
              OpenAI API usage across all features — tracked per call, per feature key.
            </p>
            <button
              onClick={fetchOpenAIUsage}
              className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90"
            >
              Refresh
            </button>
          </div>

          {!openAIUsageData ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ─── Summary Cards ─── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1">Cost This Month (30d)</p>
                  <p className="text-2xl font-bold text-violet-900">${fmt(openAIUsageData.totalCost30d)}</p>
                  <p className="text-xs text-violet-600 mt-1">Today: ${fmt(openAIUsageData.totalCostToday)}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Requests This Month</p>
                  <p className="text-2xl font-bold text-blue-900">{fmtInt(openAIUsageData.totalRequests30d)}</p>
                  <p className="text-xs text-blue-600 mt-1">Today: {fmtInt(openAIUsageData.totalRequestsToday)}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1">Tokens This Month</p>
                  <p className="text-2xl font-bold text-indigo-900">{fmtInt(openAIUsageData.totalTokens30d)}</p>
                  <p className="text-xs text-indigo-600 mt-1">Today: {fmtInt(openAIUsageData.totalTokensToday)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Avg Cost / Request</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    ${openAIUsageData.totalRequests30d > 0
                      ? (openAIUsageData.totalCost30d / openAIUsageData.totalRequests30d).toFixed(6)
                      : '0.000000'}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">30-day average</p>
                </div>
              </div>

              {/* ─── Feature Breakdown + Daily Chart (side by side) ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Feature breakdown table */}
                <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Cost by Feature (30d)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                          <th className="text-left py-2 px-4 font-semibold text-[var(--color-neutral-500)]">Feature</th>
                          <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Requests</th>
                          <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Tokens</th>
                          <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openAIUsageData.byFeature.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[var(--color-neutral-400)]">No data yet</td></tr>
                        ) : (
                          openAIUsageData.byFeature.map((f) => {
                            const pct = openAIUsageData.totalCost30d > 0
                              ? (f.cost / openAIUsageData.totalCost30d) * 100
                              : 0;
                            return (
                              <tr key={f.featureKey} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                                <td className="py-2 px-4">
                                  <div className="font-medium text-[var(--color-ink)]">{f.label}</div>
                                  <div className="w-full bg-[var(--color-neutral-100)] rounded-full h-1 mt-1">
                                    <div
                                      className="bg-violet-500 h-1 rounded-full"
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="text-right py-2 px-3 text-[var(--color-neutral-600)]">{fmtInt(f.requests)}</td>
                                <td className="text-right py-2 px-3 text-[var(--color-neutral-600)]">{fmtInt(f.totalTokens)}</td>
                                <td className="text-right py-2 px-3 font-semibold text-[var(--color-ink)]">${fmt(f.cost)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Daily cost trend chart */}
                <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
                  <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase mb-4">Daily Cost Trend (30d)</h3>
                  {openAIUsageData.dailyCosts.every(d => d.cost === 0) ? (
                    <div className="flex items-center justify-center h-[220px] text-[var(--color-neutral-400)] text-sm">No cost data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={openAIUsageData.dailyCosts} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="aiCostGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          fontSize={10}
                          tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                          interval={6}
                        />
                        <YAxis fontSize={10} tickFormatter={(v: number) => `$${v.toFixed(4)}`} width={60} />
                        <Tooltip
                          formatter={(v: number) => [`$${v.toFixed(6)}`, 'Cost']}
                          labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                        />
                        <Area
                          type="monotone"
                          dataKey="cost"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          fill="url(#aiCostGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ─── Model Breakdown ─── */}
              <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border-default)]">
                  <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Model Breakdown (30d)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                        <th className="text-left py-2 px-4 font-semibold text-[var(--color-neutral-500)]">Model</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Requests</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Total Tokens</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Cost</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openAIUsageData.byModel.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-[var(--color-neutral-400)]">No data yet</td></tr>
                      ) : (
                        openAIUsageData.byModel.map((m) => {
                          const pct = openAIUsageData.totalCost30d > 0
                            ? (m.cost / openAIUsageData.totalCost30d) * 100
                            : 0;
                          return (
                            <tr key={m.model} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                              <td className="py-2 px-4 font-mono text-xs font-medium text-[var(--color-ink)]">{m.model}</td>
                              <td className="text-right py-2 px-3 text-[var(--color-neutral-600)]">{fmtInt(m.requests)}</td>
                              <td className="text-right py-2 px-3 text-[var(--color-neutral-600)]">{fmtInt(m.totalTokens)}</td>
                              <td className="text-right py-2 px-3 font-semibold text-[var(--color-ink)]">${fmt(m.cost)}</td>
                              <td className="text-right py-2 px-3 text-[var(--color-neutral-500)]">{pct.toFixed(1)}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Recent Logs ─── */}
              <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border-default)]">
                  <h3 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase">Recent Logs (last 50)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                        <th className="text-left py-2 px-4 font-semibold text-[var(--color-neutral-500)]">Time</th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Feature</th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Key</th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Model</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">In tokens</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Out tokens</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--color-neutral-500)]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openAIUsageData.recentLogs.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-[var(--color-neutral-400)]">No logs yet — usage will appear here after the first OpenAI call</td></tr>
                      ) : (
                        openAIUsageData.recentLogs.map((log) => (
                          <tr key={log.id} className="border-b border-[var(--border-default)] hover:bg-[var(--color-neutral-50)]">
                            <td className="py-2 px-4 text-xs text-[var(--color-neutral-500)]">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                                {log.featureKey}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-[var(--color-neutral-600)]">{log.apiKeyLabel}</td>
                            <td className="py-2 px-3 font-mono text-xs text-[var(--color-neutral-700)]">{log.model}</td>
                            <td className="text-right py-2 px-3 text-xs text-[var(--color-neutral-600)]">{fmtInt(log.inputTokens)}</td>
                            <td className="text-right py-2 px-3 text-xs text-[var(--color-neutral-600)]">{fmtInt(log.outputTokens)}</td>
                            <td className="text-right py-2 px-3 text-xs font-semibold text-[var(--color-ink)]">
                              ${log.costUsd.toFixed(6)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function KPICard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    red: 'from-red-50 to-red-100 border-red-200',
    amber: 'from-amber-50 to-amber-100 border-amber-200',
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200',
    violet: 'from-violet-50 to-violet-100 border-violet-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
    fuchsia: 'from-fuchsia-50 to-fuchsia-100 border-fuchsia-200',
    orange: 'from-orange-50 to-orange-100 border-orange-200',
    slate: 'from-slate-50 to-slate-100 border-slate-200',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.blue} border rounded-xl p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-500)] mb-1">{label}</p>
      <p className="text-xl font-bold text-[var(--color-ink)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-neutral-400)] mt-0.5">{sub}</p>}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50',
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    violet: 'border-violet-200 bg-violet-50',
    orange: 'border-orange-200 bg-orange-50',
  };
  return (
    <div className={`border rounded-xl p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
