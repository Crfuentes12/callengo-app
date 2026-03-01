// components/billing/BillingPage.tsx
'use client';

import { useMemo } from 'react';

interface UsageRecord {
  id: string;
  period_start: string;
  period_end: string;
  minutes_used: number;
  minutes_included: number;
  total_cost: number;
  created_at: string;
}

interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  invoice_url: string | null;
  payment_method: string | null;
  billing_date: string;
  created_at: string;
}

interface Subscription {
  id: string;
  billing_cycle: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  subscription_plans: {
    name: string;
    minutes_included: number;
  } | null;
}

interface BillingPageProps {
  usage: UsageRecord[];
  billingHistory: BillingRecord[];
  subscription: Subscription | null;
}

const statusStyles: Record<string, string> = {
  paid: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
  refunded: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function BillingPage({ usage, billingHistory, subscription }: BillingPageProps) {
  const currentUsage = usage[0];

  const usagePercent = currentUsage
    ? Math.min(100, Math.round((currentUsage.minutes_used / (currentUsage.minutes_included || 1)) * 100))
    : 0;

  const stats = useMemo(() => ({
    totalSpent: billingHistory.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0),
    currentMinutes: currentUsage?.minutes_used || 0,
    includedMinutes: currentUsage?.minutes_included || 0,
  }), [billingHistory, currentUsage]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Usage</h1>
        <p className="text-slate-600 mt-1">Monitor your plan usage and billing history</p>
      </div>

      {/* Current Plan Card */}
      {subscription && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-bg-subtle flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{subscription.subscription_plans?.name || 'Current Plan'}</h3>
                <p className="text-xs text-slate-500">{subscription.billing_cycle} billing</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              subscription.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              subscription.status === 'trialing' ? 'bg-blue-50 border-blue-200 text-blue-700' :
              'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              {subscription.status}
              {subscription.cancel_at_period_end && ' (cancels at period end)'}
            </span>
          </div>

          {/* Usage Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Minutes used this period</span>
              <span className="font-medium text-slate-900">
                {stats.currentMinutes.toLocaleString()} / {stats.includedMinutes.toLocaleString()} min
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{usagePercent}% used</span>
              <span>
                Period: {new Date(subscription.current_period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Spent</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalSpent)}</div>
          <div className="text-xs text-slate-500 mt-1">Lifetime total</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Minutes Used</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.currentMinutes.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">This billing period</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{billingHistory.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total invoices</div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Billing History</h3>
          <p className="text-xs text-slate-500 mt-1">Your recent invoices and payments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.length > 0 ? (
                billingHistory.map(record => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-900">
                        {new Date(record.billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600">{record.description || 'Subscription payment'}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(record.amount, record.currency)}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[record.status] || statusStyles.pending}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      {record.invoice_url ? (
                        <a
                          href={record.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--color-primary)] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-900">No billing history yet</p>
                      <p className="text-xs text-slate-500 mt-1">Your invoices will appear here</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage History */}
      {usage.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Usage History</h3>
            <p className="text-xs text-slate-500 mt-1">Minutes consumed per billing period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Period</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Minutes Used</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Included</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Usage</th>
                </tr>
              </thead>
              <tbody>
                {usage.map(record => {
                  const pct = Math.min(100, Math.round((record.minutes_used / (record.minutes_included || 1)) * 100));
                  return (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-900">
                          {new Date(record.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(record.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm font-medium text-slate-900">{record.minutes_used.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-600">{record.minutes_included.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
