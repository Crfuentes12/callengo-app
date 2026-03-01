// components/dashboard/DashboardOverview.tsx
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Company, AgentTemplate, AgentRun, ContactList } from '@/types/supabase';
import { Contact } from '@/types/call-agent';
import { formatDuration } from '@/lib/call-agent-utils';
import AgentSelectionModal from '@/components/agents/AgentSelectionModal';
import AgentConfigModal from '@/components/agents/AgentConfigModal';
import CallDetailModal from '@/components/calls/CallDetailModal';

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
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowAgentSelection(false);
    setShowConfigModal(true);
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
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

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
              Dashboard
            </h2>
            <p className="text-slate-600 mt-0.5">
              Real-time overview of your AI calling operations
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">Active Agents</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{companyAgents.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">Campaigns</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{stats.activeCampaigns}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">Total Calls</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{recentCalls.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">Success Rate</span>
            </div>
            <span className="text-2xl text-slate-900 font-bold">{stats.successRate.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Free Plan Banner — only for Free plan users */}
      {subscription && subscription.subscription_plans?.name === 'Free' && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900 mb-1">You have 15 free minutes courtesy of Callengo</h3>
              <p className="text-sm text-slate-700 mb-3">
                We believe so much in our product that you don&apos;t need more than 15 minutes to see its real value. Create a small campaign, watch the magic happen, and see how Callengo transforms your outreach.
              </p>
              <a
                href="/settings"
                className="btn-primary text-sm"
              >
                Upgrade Your Plan
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Contacts</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">{stats.pending} pending</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-emerald-600 font-medium">{stats.verified} verified</span>
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
              <p className="text-sm font-medium text-slate-500">Verified</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.verified.toLocaleString()}</p>
              <p className="text-sm text-emerald-600 mt-2 font-medium">{stats.successRate.toFixed(1)}% success rate</p>
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
              <p className="text-sm font-medium text-slate-500">Avg Call Time</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{formatDuration(stats.avgCallDuration)}</p>
              <p className="text-sm text-slate-400 mt-2">per successful call</p>
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
              <p className="text-sm font-medium text-slate-500">Minutes Remaining</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                {usageTracking && subscription?.subscription_plans
                  ? (subscription.subscription_plans.minutes_included - (usageTracking.minutes_used || 0)).toLocaleString()
                  : subscription?.subscription_plans?.minutes_included?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                of {subscription?.subscription_plans?.minutes_included?.toLocaleString() || '0'} included
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Active AI Agents</h3>
                <p className="text-sm text-slate-500">Currently deployed and ready to call</p>
              </div>
            </div>
            <a
              href="/agents"
              className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex items-center gap-1"
            >
              View all
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
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-[var(--color-primary-200)] hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 truncate">
                        {agent.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {agent.agent_templates?.description || 'AI calling agent'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-emerald-600 font-medium">Active</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent Campaigns</h3>
                <p className="text-sm text-slate-500">{stats.activeCampaigns} active, {stats.completedCampaigns} completed</p>
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
                    className="block p-5 bg-slate-50 rounded-xl border border-slate-200 hover:shadow-sm hover:border-[var(--color-primary-200)] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-slate-900 text-lg">{run.name}</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(run.status)}`}>
                            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-1">Total Contacts</p>
                            <p className="text-xl font-bold text-slate-900">{run.total_contacts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-1">Completed</p>
                            <p className="text-xl font-bold text-blue-600">{run.completed_calls}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-1">Successful</p>
                            <p className="text-xl font-bold text-emerald-600">{run.successful_calls}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600">Progress</span>
                        <span className="text-xs font-semibold text-slate-900">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-bg rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      {run.completed_calls > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-2">
                          {successRate.toFixed(1)}% success rate
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Contact Status Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            <p className="text-xs text-slate-500 font-medium mt-1.5">Pending</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-2xl font-bold text-blue-900">{stats.calling}</p>
            <p className="text-xs text-blue-600 font-medium mt-1.5">In Progress</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-900">{stats.verified}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1.5">Verified</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-2xl font-bold text-amber-900">{stats.noAnswer}</p>
            <p className="text-xs text-amber-600 font-medium mt-1.5">No Answer</p>
          </div>
          <div className="text-center p-4 bg-violet-50 rounded-xl border border-violet-200">
            <p className="text-2xl font-bold text-violet-900">{stats.callback}</p>
            <p className="text-xs text-violet-600 font-medium mt-1.5">Callback</p>
          </div>
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent Call Activity</h3>
              <p className="text-sm text-slate-500">Latest {recentCalls.length} calls</p>
            </div>
          </div>
          <a
            href="/calls"
            className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex items-center gap-1"
          >
            View all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg mb-2">No calls yet</p>
            <p className="text-sm text-slate-500 mb-6">Select an AI agent and build your first campaign</p>
            <button
              onClick={() => setShowAgentSelection(true)}
              className="btn-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Call ID
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Answered By
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCalls.slice(0, 8).map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedCall(call)}>
                    <td className="py-4 px-6">
                      <p className="text-sm font-medium text-slate-900 font-mono">
                        {call.call_id.substring(0, 12)}...
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(call.status || 'unknown')}`}>
                        {call.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-700">
                        {formatDuration(call.call_length)}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        call.answered_by === 'human'
                          ? 'bg-emerald-50 text-emerald-700'
                          : call.answered_by === 'voicemail'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-50 text-slate-600'
                      }`}>
                        {call.answered_by || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-500">
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
          className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-[var(--color-primary-200)] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">
                Import Contacts
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Add contacts to call</p>
            </div>
          </div>
        </a>

        <button
          onClick={() => setShowAgentSelection(true)}
          className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-emerald-200 transition-all text-left w-full"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Start Campaign
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Launch AI calling agent</p>
            </div>
          </div>
        </button>

        <a
          href="/settings"
          className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-violet-200 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">
                Settings
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Configure your account</p>
            </div>
          </div>
        </a>

        <a
          href="https://calengo.com/resources/help-center"
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
                Help Center
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Learn how to use Callengo</p>
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
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}
