// components/dashboard/DashboardStats.tsx
'use client';

import { useTranslation } from '@/i18n';
import { formatDuration } from '@/lib/call-agent-utils';

interface DashboardStatsData {
  total: number;
  pending: number;
  calling: number;
  verified: number;
  noAnswer: number;
  voicemail: number;
  callback: number;
  totalCallDuration: number;
  successRate: number;
  avgCallDuration: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalCampaignCalls: number;
}

interface SubscriptionWithPlan {
  id: string;
  company_id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  subscription_plans: {
    name: string;
    minutes_included: number;
    max_call_duration: number;
    price_monthly: number;
    price_annual: number;
  } | null;
}

interface UsageTracking {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
  total_cost: number;
}

interface DashboardStatsProps {
  stats: DashboardStatsData;
  usageTracking: UsageTracking | null;
  subscription: SubscriptionWithPlan | null;
  companyAgentsCount: number;
  recentCallsCount: number;
}

export default function DashboardStats({
  stats,
  usageTracking,
  subscription,
  companyAgentsCount,
  recentCallsCount,
}: DashboardStatsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{t.campaigns.totalContacts}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">{stats.pending} {t.contacts.pending.toLowerCase()}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-emerald-600 font-medium">{stats.verified} {t.common.success.toLowerCase()}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{t.campaigns.successfulCalls}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.verified.toLocaleString()}</p>
              <p className="text-sm text-emerald-600 mt-2 font-medium">{stats.successRate.toFixed(1)}% {t.dashboard.successRate.toLowerCase()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{t.calls.duration}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{formatDuration(stats.avgCallDuration)}</p>
              <p className="text-sm text-slate-400 mt-2">{t.campaigns.successfulCalls.toLowerCase()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Minutes Remaining */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{t.dashboard.minutesRemaining}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                {usageTracking && subscription?.subscription_plans
                  ? (subscription.subscription_plans.minutes_included - (usageTracking.minutes_used || 0)).toLocaleString()
                  : subscription?.subscription_plans?.minutes_included?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                {t.dashboard.of} {subscription?.subscription_plans?.minutes_included?.toLocaleString() || '0'} {t.billing.minutesIncluded.toLowerCase()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Status Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {t.contacts.allStatuses}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            <p className="text-xs text-slate-500 font-medium mt-1.5">{t.contacts.pending}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-2xl font-bold text-blue-900">{stats.calling}</p>
            <p className="text-xs text-blue-600 font-medium mt-1.5">{t.calls.inProgress}</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-900">{stats.verified}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1.5">{t.calls.completed}</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-2xl font-bold text-amber-900">{stats.noAnswer}</p>
            <p className="text-xs text-amber-600 font-medium mt-1.5">{t.calls.noAnswer}</p>
          </div>
          <div className="text-center p-4 bg-violet-50 rounded-xl border border-violet-200">
            <p className="text-2xl font-bold text-violet-900">{stats.callback}</p>
            <p className="text-xs text-violet-600 font-medium mt-1.5">{t.contacts.callBack}</p>
          </div>
        </div>
      </div>
    </>
  );
}
