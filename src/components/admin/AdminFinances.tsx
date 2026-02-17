'use client';

import { useState, useEffect } from 'react';
import { AdminFinance } from '@/types/supabase';

export default function AdminFinances() {
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
          <p className="text-sm text-slate-500">Loading financial data...</p>
        </div>
      </div>
    );
  }

  const currentFinance = finances[0];

  if (!currentFinance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No financial data available</p>
      </div>
    );
  }

  const marginColor = (percent: number | null) => {
    if (!percent) return 'text-slate-600';
    if (percent >= 40) return 'text-emerald-600';
    if (percent >= 30) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Dashboard</h2>
          <p className="text-sm text-slate-600 mt-1">Real-time cost tracking and margin analysis</p>
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
        {/* Revenue Total */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Total Revenue</span>
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-emerald-900">
            ${currentFinance.revenue_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-emerald-700">Subs: ${currentFinance.revenue_subscriptions?.toLocaleString() || 0}</span>
            <span className="text-emerald-600">•</span>
            <span className="text-emerald-700">Overage: ${currentFinance.revenue_overages?.toLocaleString() || 0}</span>
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
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-red-700">Bland: ${currentFinance.cost_bland?.toLocaleString() || 0}</span>
            <span className="text-red-600">•</span>
            <span className="text-red-700">AI: ${currentFinance.cost_openai?.toLocaleString() || 0}</span>
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
        </div>

        {/* Active Companies */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Active Companies</span>
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-purple-900">
            {currentFinance.total_companies_active || 0}
          </p>
          <p className="mt-3 text-sm text-purple-700">
            ${currentFinance.avg_revenue_per_company?.toFixed(2) || '0.00'} ARPC
          </p>
        </div>
      </div>

      {/* Bland AI Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Bland AI Infrastructure
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Current Plan</p>
            <p className="text-xl font-bold text-slate-900">{currentFinance.bland_plan || 'N/A'}</p>
            <p className="text-sm text-slate-600 mt-1">${currentFinance.bland_plan_cost || 0}/mo</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Talk Rate</p>
            <p className="text-xl font-bold text-slate-900">${currentFinance.bland_talk_rate?.toFixed(4) || '0.0000'}/min</p>
            <p className="text-sm text-slate-600 mt-1">Transfer: ${currentFinance.bland_transfer_rate?.toFixed(4) || '0.0000'}/min</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Limits</p>
            <p className="text-sm text-slate-700"><strong>{currentFinance.bland_concurrent_limit || 0}</strong> concurrent</p>
            <p className="text-sm text-slate-700"><strong>{currentFinance.bland_hourly_limit || 0}</strong> per hour</p>
            <p className="text-sm text-slate-700"><strong>{currentFinance.bland_daily_limit || 0}</strong> per day</p>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Call Volume</h4>
          <p className="text-4xl font-bold text-slate-900 mb-2">
            {currentFinance.total_calls_made?.toLocaleString() || 0}
          </p>
          <p className="text-sm text-slate-600">
            {currentFinance.total_minutes_used?.toLocaleString() || 0} minutes
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Avg: {currentFinance.avg_minutes_per_call?.toFixed(2) || '0.00'} min/call
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Overage Revenue</h4>
          <p className="text-4xl font-bold text-slate-900 mb-2">
            ${currentFinance.revenue_overages?.toLocaleString() || '0'}
          </p>
          <p className="text-sm text-slate-600">
            {currentFinance.overage_revenue_percent?.toFixed(1) || '0.0'}% of total revenue
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
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="font-semibold text-slate-700">Bland AI</span>
            <span className="text-lg font-bold text-slate-900">
              ${currentFinance.cost_bland?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
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
            <span className="font-bold text-white uppercase">Total</span>
            <span className="text-2xl font-bold text-white">
              ${currentFinance.cost_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
        </div>
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
