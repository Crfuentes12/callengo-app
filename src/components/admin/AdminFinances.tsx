'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { AdminFinance } from '@/types/supabase';

export default function AdminFinances() {
  const { t } = useTranslation();
  const [finances, setFinances] = useState<AdminFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');

  useEffect(() => {
    fetchFinances();
  }, [selectedPeriod]);

  const fetchFinances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/finances?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setFinances(data.finances || []);
      }
    } catch (error) {
      console.error('Error fetching finances:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const currentFinance = finances[0];

  if (!currentFinance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">{t.common.noData}</p>
      </div>
    );
  }

  const marginColor = (percent: number | null) => {
    if (!percent) return 'text-slate-600';
    if (percent >= 50) return 'text-emerald-600';
    if (percent >= 35) return 'text-amber-600';
    return 'text-red-600';
  };

  // Calculate addon revenue breakdown (with fallbacks for new columns)
  const addonRevenue = (currentFinance as any).addon_revenue || 0;
  const dedicatedNumberRevenue = (currentFinance as any).dedicated_number_revenue || 0;
  const recordingVaultRevenue = (currentFinance as any).recording_vault_revenue || 0;
  const callsBoosterRevenue = (currentFinance as any).calls_booster_revenue || 0;
  const activeSubaccounts = (currentFinance as any).active_subaccounts || 0;
  const blandInfrastructureCost = (currentFinance as any).bland_infrastructure_cost || 0;

  const totalRevenue = (currentFinance.revenue_total || 0) + addonRevenue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.admin.finances.title}</h2>
          <p className="text-sm text-slate-600 mt-1">V4 Pricing Model — Sub-accounts + Add-ons</p>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="current">Current Period</option>
          <option value="last_30">Last 30 Days</option>
          <option value="last_90">Last 90 Days</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Total Revenue</span>
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-emerald-900">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-emerald-700">
              <span>Subscriptions</span>
              <span>${currentFinance.revenue_subscriptions?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Overages</span>
              <span>${currentFinance.revenue_overages?.toLocaleString() || 0}</span>
            </div>
            {addonRevenue > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Add-ons</span>
                <span>${addonRevenue.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cost Total */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Total Costs</span>
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-red-900">
            ${currentFinance.cost_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-red-700">
              <span>Bland per-min</span>
              <span>${currentFinance.cost_bland?.toLocaleString() || 0}</span>
            </div>
            {blandInfrastructureCost > 0 && (
              <div className="flex justify-between text-red-700">
                <span>Bland infra (Scale)</span>
                <span>${blandInfrastructureCost.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-red-700">
              <span>Other</span>
              <span>${((currentFinance.cost_openai || 0) + (currentFinance.cost_supabase || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Gross Margin */}
        <div className="gradient-bg-subtle border border-[var(--color-primary)]/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">Gross Margin</span>
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            ${currentFinance.gross_margin?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className={`mt-3 text-2xl font-bold ${marginColor(currentFinance.gross_margin_percent)}`}>
            {currentFinance.gross_margin_percent?.toFixed(1) || '0.0'}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Target: 55–67% on included min</p>
        </div>

        {/* Active Companies + Sub-accounts */}
        <div className="gradient-bg-subtle border border-[var(--color-primary)]/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">Companies</span>
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {currentFinance.total_companies_active || 0}
          </p>
          <p className="mt-2 text-sm text-[var(--color-primary)]">
            ${currentFinance.avg_revenue_per_company?.toFixed(2) || '0.00'} ARPC
          </p>
          {activeSubaccounts > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {activeSubaccounts} Bland sub-accounts
            </p>
          )}
        </div>
      </div>

      {/* Add-on Revenue Breakdown */}
      {addonRevenue > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Add-on Revenue
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Dedicated Number</p>
              <p className="text-2xl font-bold text-slate-900">${dedicatedNumberRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">$15/mo per number</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Recording Vault</p>
              <p className="text-2xl font-bold text-slate-900">${recordingVaultRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">$12/mo per company</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs font-semibold text-orange-600 uppercase mb-1">Calls Booster</p>
              <p className="text-2xl font-bold text-slate-900">${callsBoosterRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">$35/mo per booster</p>
            </div>
          </div>
        </div>
      )}

      {/* Bland AI Sub-account Infrastructure */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Bland AI — Sub-account Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Parent Plan</p>
            <p className="text-xl font-bold text-slate-900">{currentFinance.bland_plan || 'Scale'}</p>
            <p className="text-sm text-slate-600 mt-1">${currentFinance.bland_plan_cost || 0}/mo</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Per-Min Rate</p>
            <p className="text-xl font-bold text-slate-900">${currentFinance.bland_talk_rate?.toFixed(4) || '0.1100'}/min</p>
            <p className="text-sm text-slate-600 mt-1">Transfer: ${currentFinance.bland_transfer_rate?.toFixed(4) || '0.0000'}/min</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Sub-accounts</p>
            <p className="text-xl font-bold text-slate-900">{activeSubaccounts}</p>
            <p className="text-sm text-slate-600 mt-1">Isolated per company</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Parent Limits</p>
            <p className="text-sm text-slate-700"><strong>{currentFinance.bland_concurrent_limit || '∞'}</strong> concurrent</p>
            <p className="text-sm text-slate-700"><strong>{currentFinance.bland_daily_limit || '∞'}</strong> per day</p>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Total Calls</h4>
          <p className="text-4xl font-bold text-slate-900 mb-2">
            {currentFinance.total_calls_made?.toLocaleString() || 0}
          </p>
          <p className="text-sm text-slate-600">
            {currentFinance.total_minutes_used?.toLocaleString() || 0} minutes used
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Avg: {currentFinance.avg_minutes_per_call?.toFixed(2) || '0.00'} min/call
            {' '}(target: ~1.5)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Overage Revenue</h4>
          <p className="text-4xl font-bold text-slate-900 mb-2">
            ${currentFinance.revenue_overages?.toLocaleString() || '0'}
          </p>
          <p className="text-sm text-slate-600">
            {currentFinance.overage_revenue_percent?.toFixed(1) || '0.0'}% of subscription revenue
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Margin on overage: ~55–164% above Bland cost
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Active Users</h4>
          <p className="text-4xl font-bold text-slate-900 mb-2">
            {currentFinance.total_users_active || 0}
          </p>
          <p className="text-sm text-slate-600">
            across {currentFinance.total_companies_active || 0} companies
          </p>
          <p className="text-xs text-slate-500 mt-2">
            ${currentFinance.avg_revenue_per_company?.toFixed(2) || '0.00'} avg revenue/company
          </p>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Plan Distribution (V4 Pricing)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { slug: 'free', label: 'Free', price: '$0', color: 'bg-slate-100 text-slate-700 border-slate-200' },
            { slug: 'starter', label: 'Starter', price: '$99/mo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { slug: 'growth', label: 'Growth', price: '$179/mo', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            { slug: 'business', label: 'Business', price: '$299/mo', color: 'bg-violet-50 text-violet-700 border-violet-200' },
            { slug: 'teams', label: 'Teams', price: '$649/mo', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { slug: 'enterprise', label: 'Enterprise', price: '$1,499/mo', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
          ].map(plan => {
            const count = (currentFinance as any)[`companies_on_${plan.slug}`] || 0;
            return (
              <div key={plan.slug} className={`p-3 rounded-lg border ${plan.color}`}>
                <p className="text-xs font-bold uppercase mb-1">{plan.label}</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-[10px] mt-0.5 opacity-70">{plan.price}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <span className="font-semibold text-slate-700">Bland AI (per-minute)</span>
              <p className="text-xs text-slate-500">$0.11/min × total minutes</p>
            </div>
            <span className="text-lg font-bold text-slate-900">
              ${currentFinance.cost_bland?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
          {blandInfrastructureCost > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="font-semibold text-slate-700">Bland AI (Scale plan)</span>
                <p className="text-xs text-slate-500">Monthly infrastructure flat fee</p>
              </div>
              <span className="text-lg font-bold text-slate-900">
                ${blandInfrastructureCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="font-semibold text-slate-700">OpenAI</span>
            <span className="text-lg font-bold text-slate-900">
              ${currentFinance.cost_openai?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="font-semibold text-slate-700">Supabase</span>
            <span className="text-lg font-bold text-slate-900">
              ${currentFinance.cost_supabase?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
            <span className="font-bold text-white uppercase">Total Costs</span>
            <span className="text-2xl font-bold text-white">
              ${currentFinance.cost_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Unit Economics Reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Unit Economics Reference (V4)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Plan</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Price</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Calls</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Min</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Bland Cost</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Gross Margin</th>
                <th className="text-center py-2 px-3 text-slate-500 font-semibold">Overage</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: 'Starter', price: 99, calls: 200, min: 300, blandCost: 33, margin: 66.7, overage: 0.29 },
                { plan: 'Growth', price: 179, calls: 400, min: 600, blandCost: 66, margin: 63.1, overage: 0.26 },
                { plan: 'Business', price: 299, calls: 800, min: 1200, blandCost: 132, margin: 55.9, overage: 0.23 },
                { plan: 'Teams', price: 649, calls: 1500, min: 2250, blandCost: 247.5, margin: 61.9, overage: 0.20 },
                { plan: 'Enterprise', price: 1499, calls: 4000, min: 6000, blandCost: 660, margin: 56.0, overage: 0.17 },
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : ''}>
                  <td className="py-2 pr-4 font-semibold text-slate-800">{row.plan}</td>
                  <td className="text-center py-2 px-3">${row.price}/mo</td>
                  <td className="text-center py-2 px-3">~{row.calls}</td>
                  <td className="text-center py-2 px-3">{row.min}</td>
                  <td className="text-center py-2 px-3 text-red-600">${row.blandCost}</td>
                  <td className={`text-center py-2 px-3 font-bold ${row.margin >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>{row.margin}%</td>
                  <td className="text-center py-2 px-3">${row.overage}/min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">* Bland cost @ $0.11/min (Scale plan). Effective avg: 1.5 min/call attempt.</p>
      </div>

      {/* Notes */}
      {currentFinance.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-amber-900 mb-2">Notes</h4>
          <p className="text-sm text-amber-800">{currentFinance.notes}</p>
        </div>
      )}
    </div>
  );
}
