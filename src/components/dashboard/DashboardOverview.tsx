// components/dashboard/DashboardOverview.tsx
'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Company, AgentTemplate, AgentRun, ContactList } from '@/types/supabase';
import { Contact } from '@/types/call-agent';
import AgentSelectionModal from '@/components/agents/AgentSelectionModal';
import AgentConfigModal from '@/components/agents/AgentConfigModal';
import CallDetailModal from '@/components/calls/CallDetailModal';
import DashboardStats from './DashboardStats';
import ActiveAgents from './ActiveAgents';
import ActiveCampaigns from './ActiveCampaigns';
import RecentCalls from './RecentCalls';
import QuickActions from './QuickActions';

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
  analysis: any;
  error_message: string | null;
  metadata: any;
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
  contacts: any[];
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
  contactLists,
  usageTracking,
  subscription,
  contactStats: serverStats,
}: DashboardOverviewProps) {
  const { t } = useTranslation();
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowAgentSelection(false);
    setShowConfigModal(true);
  };

  const handleStartCampaign = () => {
    setShowAgentSelection(true);
  };

  const stats = useMemo(() => {
    const typedContacts = contacts as Contact[];

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
  }, [contacts, recentCalls, agentRuns, serverStats]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="gradient-bg-subtle rounded-2xl p-8 border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t.dashboard.title}
            </h2>
            <p className="text-slate-600 mt-0.5">
              {t.dashboard.overview}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">{t.agents.active} {t.nav.agents}</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{companyAgents.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">{t.nav.campaigns}</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{stats.activeCampaigns}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">{t.dashboard.totalCalls}</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{recentCalls.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">{t.dashboard.successRate}</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{stats.successRate.toFixed(0)}%</span>
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
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                {t.billing.free} — {usageTracking ? Math.max(0, (subscription.subscription_plans?.minutes_included || 0) - usageTracking.minutes_used) : (subscription.subscription_plans?.minutes_included || 0)} {t.dashboard.minutesRemaining.toLowerCase()}
              </h3>
              <p className="text-sm text-slate-700 mb-3">
                {t.billing.minutesIncluded}: {subscription.subscription_plans?.minutes_included || 15} {t.common.minutes}
              </p>
              <a
                href="/settings?tab=billing"
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

      {/* Key Metrics + Contact Status Distribution */}
      <DashboardStats
        stats={stats}
        usageTracking={usageTracking}
        subscription={subscription}
        companyAgentsCount={companyAgents.length}
        recentCallsCount={recentCalls.length}
      />

      {/* Active Agents Section */}
      <ActiveAgents companyAgents={companyAgents} />

      {/* Active Campaigns */}
      <ActiveCampaigns
        agentRuns={agentRuns}
        activeCampaigns={stats.activeCampaigns}
        completedCampaigns={stats.completedCampaigns}
      />

      {/* Recent Calls Table */}
      <RecentCalls
        recentCalls={recentCalls}
        onCallSelect={setSelectedCall}
        onStartCampaign={handleStartCampaign}
      />

      {/* Quick Actions */}
      <QuickActions onStartCampaign={handleStartCampaign} />

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
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}
