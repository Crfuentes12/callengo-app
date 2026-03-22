// components/dashboard/DashboardOverview.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
// Image import available for future use
import { useTranslation } from '@/i18n';
import { Company, AgentTemplate, AgentRun, ContactList } from '@/types/supabase';
import { Contact } from '@/types/call-agent';
import { formatDuration } from '@/lib/call-agent-utils';
import AgentSelectionModal from '@/components/agents/AgentSelectionModal';
import BillingAlertBanner from '@/components/billing/BillingAlertBanner';
import AgentConfigModal from '@/components/agents/AgentConfigModal';
import CallDetailModal from '@/components/calls/CallDetailModal';
import { phPageEvents, phQuickStartEvents } from '@/lib/posthog';

interface CallLog {
  id: string;
  company_id: string;
  contact_id: string | null;
  agent_template_id: string | null;
  call_id: string;
  status: string | null;
  completed: boolean;
  call_length: number | null;
  price: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  analysis: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface CompanyAgentWithTemplate {
  id: string;
  company_id: string;
  agent_template_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  agent_templates: AgentTemplate | null;
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
    slug: string;
    minutes_included: number;
    max_call_duration: number;
    price_monthly: number;
    price_annual: number;
  } | null;
}

interface ContactStatsFromServer {
  total: number;
  pending: number;
  calling: number;
  verified: number;
  noAnswer: number;
  voicemail: number;
  callback: number;
  calledCount: number;
}

interface DashboardOverviewProps {
  contacts: Record<string, unknown>[];
  recentCalls: CallLog[];
  company: Company;
  agentTemplates: AgentTemplate[];
  companyAgents: CompanyAgentWithTemplate[];
  agentRuns: AgentRun[];
  contactLists: ContactList[];
  usageTracking: UsageTracking | null;
  subscription: SubscriptionWithPlan | null;
  contactStats?: ContactStatsFromServer;
}

export default function DashboardOverview({
  contacts,
  recentCalls,
  company,
  agentTemplates,
  companyAgents,
  agentRuns,
  contactLists: _contactLists,
  usageTracking,
  subscription,
  contactStats: serverStats,
}: DashboardOverviewProps) {
  const { t } = useTranslation();
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [quickStartDismissed, setQuickStartDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('callengo_quick_start_dismissed') === 'true';
  });

  // Quick Start tasks derived from actual data
  const quickStartTasks = useMemo(() => [
    { name: 'import_contacts', label: 'taskImportContacts' as const, href: '/contacts', completed: contacts.length > 0 },
    { name: 'create_agent', label: 'taskCreateAgent' as const, href: '/agents', completed: companyAgents.length > 0 },
    { name: 'launch_campaign', label: 'taskLaunchCampaign' as const, href: '/campaigns', completed: agentRuns.length > 0 },
    { name: 'review_calls', label: 'taskReviewCalls' as const, href: '/calls', completed: recentCalls.length > 0 },
  ], [contacts.length, companyAgents.length, agentRuns.length, recentCalls.length]);

  const quickStartCompleted = quickStartTasks.filter(t => t.completed).length;
  const showQuickStart = !quickStartDismissed && quickStartCompleted < quickStartTasks.length;

  // Track quick start guide viewed
  const quickStartViewedRef = useRef(false);
  useEffect(() => {
    if (quickStartViewedRef.current || !showQuickStart) return;
    phQuickStartEvents.guideViewed();
    quickStartViewedRef.current = true;
  }, [showQuickStart]);

  const handleQuickStartDismiss = () => {
    phQuickStartEvents.guideDismissed(quickStartCompleted, quickStartTasks.length);
    setQuickStartDismissed(true);
    localStorage.setItem('callengo_quick_start_dismissed', 'true');
  };

  const handleQuickStartTaskClick = (taskName: string, taskIndex: number) => {
    phQuickStartEvents.taskCompleted(taskName, taskIndex);
  };

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowAgentSelection(false);
    setShowConfigModal(true);
  };

  const stats = useMemo(() => {
    const typedContacts = contacts as unknown as Contact[];

    // Use server stats for accurate totals (avoids 1000 row cap)
    const total = serverStats?.total ?? typedContacts.length;
    const pending = serverStats?.pending ?? typedContacts.filter(c => c.status === 'Pending').length;
    const calling = serverStats?.calling ?? typedContacts.filter(c => c.status === 'Calling').length;
    const verified = serverStats?.verified ?? typedContacts.filter(c => c.status === 'Fully Verified').length;
    const noAnswer = serverStats?.noAnswer ?? typedContacts.filter(c => c.status === 'No Answer').length;
    const voicemail = serverStats?.voicemail ?? typedContacts.filter(c => c.status === 'Voicemail Left').length;
    const callback = serverStats?.callback ?? typedContacts.filter(c => c.status === 'For Callback').length;

    const totalCallDuration = typedContacts.reduce((sum, c) => sum + (c.call_duration || 0), 0);

    const calledContacts = serverStats?.calledCount ?? typedContacts.filter(c => c.call_attempts > 0).length;
    const successRate = calledContacts > 0 ? (verified / calledContacts) * 100 : 0;
    const avgCallDuration = calledContacts > 0 ? totalCallDuration / calledContacts : 0;

    // Campaign stats
    const activeCampaigns = agentRuns.filter(r => r.status === 'running' || r.status === 'active').length;
    const completedCampaigns = agentRuns.filter(r => r.status === 'completed').length;
    const totalCampaignCalls = agentRuns.reduce((sum, r) => sum + r.completed_calls, 0);

    return {
      total,
      pending,
      calling,
      verified,
      noAnswer,
      voicemail,
      callback,
      totalCallDuration,
      successRate,
      avgCallDuration,
      activeCampaigns,
      completedCampaigns,
      totalCampaignCalls,
    };
  }, [contacts, agentRuns, serverStats]);

  // Track when usage exceeds 80% of plan minutes
  const limitTrackedRef = useRef(false);
  useEffect(() => {
    if (limitTrackedRef.current) return;
    if (!usageTracking || !subscription?.subscription_plans) return;
    const { minutes_used } = usageTracking;
    const { minutes_included, slug } = subscription.subscription_plans;
    if (minutes_included > 0 && minutes_used / minutes_included > 0.8) {
      phPageEvents.limitReached('minutes', slug);
      limitTrackedRef.current = true;
    }
  }, [usageTracking, subscription]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
      case 'running':
      case 'active':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'no_answer':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)] border-[var(--border-default)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing Alerts */}
      <BillingAlertBanner />

      {/* Welcome Header */}
      <div className="gradient-bg-subtle rounded-2xl p-8 border border-[var(--border-default)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-ink)]">
              {t.dashboard.title}
            </h2>
            <p className="text-[var(--color-neutral-600)] mt-0.5">
              {t.dashboard.overview}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] font-medium">{t.agents.active} {t.nav.agents}</span>
            </div>
            <span className="text-2xl text-[var(--color-ink)] font-bold">{companyAgents.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] font-medium">{t.nav.campaigns}</span>
            </div>
            <span className="text-2xl text-[var(--color-ink)] font-bold">{stats.activeCampaigns}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] font-medium">{t.dashboard.totalCalls}</span>
            </div>
            <span className="text-2xl text-[var(--color-ink)] font-bold">{recentCalls.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] font-medium">{t.dashboard.successRate}</span>
            </div>
            <span className="text-2xl text-[var(--color-ink)] font-bold">{stats.successRate.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Trial Expired Banner — when free trial minutes are exhausted */}
      {subscription && subscription.subscription_plans?.name === 'Free' && usageTracking && usageTracking.minutes_used >= (subscription.subscription_plans?.minutes_included || 0) && (
        <div className="relative overflow-hidden bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border border-red-200 rounded-2xl p-6">
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-red-900 mb-1">{t.billing.upgradePlan}</h3>
              <p className="text-sm text-red-800 mb-3">
                {t.dashboard.minutesRemaining}: 0
              </p>
              <a
                href="/settings?tab=billing"
                onClick={() => phPageEvents.upgradePromptResponse('dashboard_trial_expired', 'clicked', subscription?.subscription_plans?.slug || 'free')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-md"
              >
                {t.billing.upgradePlan}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Free Trial Banner — for active trial users with remaining minutes */}
      {subscription && subscription.subscription_plans?.name === 'Free' && (!usageTracking || usageTracking.minutes_used < (subscription.subscription_plans?.minutes_included || 0)) && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[var(--color-ink)] mb-1">
                {t.billing.free} — {usageTracking ? Math.max(0, (subscription.subscription_plans?.minutes_included || 0) - usageTracking.minutes_used) : (subscription.subscription_plans?.minutes_included || 0)} {t.dashboard.minutesRemaining.toLowerCase()}
              </h3>
              <p className="text-sm text-[var(--color-neutral-700)] mb-3">
                {t.billing.minutesIncluded}: {subscription.subscription_plans?.minutes_included || 15} {t.common.minutes}
              </p>
              <a
                href="/settings?tab=billing"
                onClick={() => phPageEvents.upgradePromptResponse('dashboard_usage_card', 'clicked', subscription.subscription_plans?.slug || 'free')}
                className="btn-primary text-sm"
              >
                {t.billing.changePlan}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Guide */}
      {showQuickStart && (
        <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t.dashboard.quickStartTitle}</h3>
                <p className="text-sm text-[var(--color-neutral-500)]">
                  {quickStartCompleted}/{quickStartTasks.length} {t.dashboard.quickStartCompleted}
                </p>
              </div>
            </div>
            <button
              onClick={handleQuickStartDismiss}
              className="text-sm text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-colors"
              aria-label={t.dashboard.quickStartDismiss}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <div className="grid sm:grid-cols-2 gap-3">
              {quickStartTasks.map((task, index) => (
                <a
                  key={task.name}
                  href={task.href}
                  onClick={() => handleQuickStartTaskClick(task.name, index)}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    task.completed
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-[var(--color-neutral-50)] border-[var(--border-default)] hover:border-[var(--color-primary-200)] hover:shadow-sm'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    task.completed
                      ? 'bg-emerald-500'
                      : 'bg-[var(--color-neutral-200)]'
                  }`}>
                    {task.completed ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold text-[var(--color-neutral-500)]">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    task.completed
                      ? 'text-emerald-700 line-through'
                      : 'text-[var(--color-ink)]'
                  }`}>
                    {t.dashboard[task.label]}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-500)]">{t.campaigns.totalContacts}</p>
              <p className="text-3xl font-bold text-[var(--color-ink)] mt-2">{stats.total.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[var(--color-neutral-400)]">{stats.pending} {t.contacts.pending.toLowerCase()}</span>
                <span className="text-xs text-[var(--color-neutral-300)]">·</span>
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
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-500)]">{t.campaigns.successfulCalls}</p>
              <p className="text-3xl font-bold text-[var(--color-ink)] mt-2">{stats.verified.toLocaleString()}</p>
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
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-500)]">{t.calls.duration}</p>
              <p className="text-3xl font-bold text-[var(--color-ink)] mt-2">{formatDuration(stats.avgCallDuration)}</p>
              <p className="text-sm text-[var(--color-neutral-400)] mt-2">{t.campaigns.successfulCalls.toLowerCase()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Minutes Remaining */}
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-500)]">{t.dashboard.minutesRemaining}</p>
              <p className="text-3xl font-bold text-[var(--color-ink)] mt-2">
                {usageTracking && subscription?.subscription_plans
                  ? (subscription.subscription_plans.minutes_included - (usageTracking.minutes_used || 0)).toLocaleString()
                  : subscription?.subscription_plans?.minutes_included?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-[var(--color-neutral-400)] mt-2">
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

      {/* Active Agents Section */}
      {companyAgents.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t.agents.active} {t.agents.title}</h3>
                <p className="text-sm text-[var(--color-neutral-500)]">{t.agents.subtitle}</p>
              </div>
            </div>
            <a
              href="/agents"
              className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex items-center gap-1"
            >
              {t.common.viewAll}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <div className="p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companyAgents.slice(0, 6).map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] hover:border-[var(--color-primary-200)] hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[var(--color-ink)] truncate">
                        {agent.name}
                      </h4>
                      <p className="text-xs text-[var(--color-neutral-500)] mt-1 line-clamp-2">
                        {agent.agent_templates?.description || t.agents.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-emerald-600 font-medium">{t.agents.active}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Campaigns */}
      {agentRuns.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t.dashboard.recentActivity}</h3>
                <p className="text-sm text-[var(--color-neutral-500)]">{stats.activeCampaigns} {t.agents.active.toLowerCase()}, {stats.completedCampaigns} {t.calls.completed.toLowerCase()}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {agentRuns.map((run) => {
                const progress = run.total_contacts > 0 ? (run.completed_calls / run.total_contacts) * 100 : 0;
                const successRate = run.completed_calls > 0 ? (run.successful_calls / run.completed_calls) * 100 : 0;

                return (
                  <a
                    key={run.id}
                    href={`/campaigns/${run.id}`}
                    className="block p-5 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] hover:shadow-sm hover:border-[var(--color-primary-200)] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-[var(--color-ink)] text-lg">{run.name}</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(run.status)}`}>
                            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-[var(--color-neutral-500)] font-medium mb-1">{t.campaigns.totalContacts}</p>
                            <p className="text-xl font-bold text-[var(--color-ink)]">{run.total_contacts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-neutral-500)] font-medium mb-1">{t.campaigns.completedCalls}</p>
                            <p className="text-xl font-bold text-blue-600">{run.completed_calls}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-neutral-500)] font-medium mb-1">{t.campaigns.successfulCalls}</p>
                            <p className="text-xl font-bold text-emerald-600">{run.successful_calls}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[var(--color-neutral-600)]">{t.campaigns.overview}</span>
                        <span className="text-xs font-semibold text-[var(--color-ink)]">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-bg rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      {run.completed_calls > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-2">
                          {successRate.toFixed(1)}% {t.dashboard.successRate.toLowerCase()}
                        </p>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Contact Status Distribution */}
      <div className="bg-white rounded-2xl border border-[var(--border-default)] p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {t.contacts.allStatuses}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
            <p className="text-2xl font-bold text-[var(--color-ink)]">{stats.pending}</p>
            <p className="text-xs text-[var(--color-neutral-500)] font-medium mt-1.5">{t.contacts.pending}</p>
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

      {/* Recent Calls Table */}
      <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t.dashboard.recentActivity}</h3>
              <p className="text-sm text-[var(--color-neutral-500)]">{recentCalls.length} {t.dashboard.totalCalls.toLowerCase()}</p>
            </div>
          </div>
          <a
            href="/calls"
            className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex items-center gap-1"
          >
            {t.common.viewAll}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-neutral-100)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-[var(--color-ink)] font-semibold text-lg mb-2">{t.calls.noCalls}</p>
            <p className="text-sm text-[var(--color-neutral-500)] mb-6">{t.calls.noCallsDesc}</p>
            <button
              onClick={() => setShowAgentSelection(true)}
              className="btn-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              {t.dashboard.newCampaign}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-neutral-50)]">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                    {t.campaigns.callLog}
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                    {t.common.status}
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                    {t.calls.duration}
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                    {t.calls.contact}
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                    {t.common.date}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {recentCalls.slice(0, 8).map((call) => (
                  <tr key={call.id} className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" onClick={() => setSelectedCall(call)}>
                    <td className="py-4 px-6">
                      <p className="text-sm font-medium text-[var(--color-ink)] font-mono">
                        {call.call_id.substring(0, 12)}...
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(call.status || 'unknown')}`}>
                        {call.status || t.common.noData}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-[var(--color-neutral-700)]">
                        {formatDuration(call.call_length)}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        call.answered_by === 'human'
                          ? 'bg-emerald-50 text-emerald-700'
                          : call.answered_by === 'voicemail'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)]'
                      }`}>
                        {call.answered_by || t.common.noData}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-[var(--color-neutral-500)]">
                        {new Date(call.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/contacts"
          className="group bg-white rounded-2xl border border-[var(--border-default)] p-5 hover:shadow-md hover:border-[var(--color-primary-200)] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
              <svg className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors">
                {t.contacts.importContacts}
              </h4>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{t.dashboard.addContacts}</p>
            </div>
          </div>
        </a>

        <button
          onClick={() => setShowAgentSelection(true)}
          className="group bg-white rounded-2xl border border-[var(--border-default)] p-5 hover:shadow-md hover:border-emerald-200 transition-all text-left w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <svg className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-emerald-600 transition-colors">
                {t.dashboard.newCampaign}
              </h4>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{t.agents.subtitle}</p>
            </div>
          </div>
        </button>

        <a
          href="/calendar"
          className="group bg-white rounded-2xl border border-[var(--border-default)] p-5 hover:shadow-md hover:border-orange-200 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
              <svg className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-orange-600 transition-colors">
                {t.nav.calendar}
              </h4>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{t.calendar.syncCalendar}</p>
            </div>
          </div>
        </a>

        <a
          href="/integrations"
          className="group bg-white rounded-2xl border border-[var(--border-default)] p-5 hover:shadow-md hover:border-violet-200 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
              <svg className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-violet-600 transition-colors">
                {t.nav.integrations}
              </h4>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{t.integrations.subtitle}</p>
            </div>
          </div>
        </a>
      </div>

      {/* Agent Selection Modal */}
      {showAgentSelection && (
        <AgentSelectionModal
          agentTemplates={agentTemplates}
          onSelect={handleAgentSelect}
          onClose={() => setShowAgentSelection(false)}
        />
      )}

      {/* Agent Config Modal */}
      {showConfigModal && selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          companyId={company.id}
          company={company}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedAgent(null);
          }}
        />
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal call={{ ...selectedCall, analysis: selectedCall.analysis ?? {}, metadata: (selectedCall.metadata ?? {}) as Record<string, string> }} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}
