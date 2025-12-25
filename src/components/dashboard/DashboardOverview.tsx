// components/dashboard/DashboardOverview.tsx
'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Company, AgentTemplate, AgentRun, ContactList } from '@/types/supabase';
import { Contact } from '@/types/call-agent';
import { formatDuration } from '@/lib/call-agent-utils';

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
  calls_made: number;
  calls_included: number;
  overage_calls: number;
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
    calls_included: number;
    price_monthly: number;
    price_annual: number;
  } | null;
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
}: DashboardOverviewProps) {
  const stats = useMemo(() => {
    const typedContacts = contacts as Contact[];

    const total = typedContacts.length;
    const pending = typedContacts.filter(c => c.status === 'Pending').length;
    const calling = typedContacts.filter(c => c.status === 'Calling').length;
    const verified = typedContacts.filter(c => c.status === 'Fully Verified').length;
    const noAnswer = typedContacts.filter(c => c.status === 'No Answer').length;
    const voicemail = typedContacts.filter(c => c.status === 'Voicemail Left').length;
    const callback = typedContacts.filter(c => c.status === 'For Callback').length;

    const totalCallDuration = typedContacts.reduce((sum, c) => sum + (c.call_duration || 0), 0);

    const calledContacts = typedContacts.filter(c => c.call_attempts > 0).length;
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
  }, [contacts, recentCalls, agentRuns]);

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

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
        return 'from-blue-400 to-cyan-600';
      case 'completed':
        return 'from-emerald-400 to-teal-600';
      case 'paused':
        return 'from-amber-400 to-orange-600';
      case 'failed':
        return 'from-red-400 to-rose-600';
      default:
        return 'from-slate-400 to-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner - Agent Style */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border-2 border-slate-800">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>

        {/* Scan lines effect */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-2xl">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-400"></div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-5xl font-black text-white uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
                  Command Center
                </h2>
              </div>
              <p className="text-lg text-slate-400 font-medium">
                Real-time overview of your AI calling operations
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Active Agents</span>
              </div>
              <span className="text-3xl text-white font-black">{companyAgents.length}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Campaigns</span>
              </div>
              <span className="text-3xl text-white font-black">{stats.activeCampaigns}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Total Calls</span>
              </div>
              <span className="text-3xl text-white font-black">{recentCalls.length}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Success Rate</span>
              </div>
              <span className="text-3xl text-white font-black">{stats.successRate.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Decorative glowing orbs */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl"></div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Contacts */}
        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Contacts</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">{stats.pending} pending</span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-emerald-600 font-semibold">{stats.verified} verified</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>

        {/* Verified */}
        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Verified</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{stats.verified.toLocaleString()}</p>
              <p className="text-sm text-emerald-600 mt-2 font-bold">{stats.successRate.toFixed(1)}% success rate</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:shadow-emerald-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>

        {/* Avg Duration */}
        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-amber-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Avg Call Time</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{formatDuration(stats.avgCallDuration)}</p>
              <p className="text-sm text-slate-400 mt-2">per successful call</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg group-hover:shadow-amber-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>
      </div>

      {/* Active Agents Section */}
      {companyAgents.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Active AI Agents</h3>
                <p className="text-sm text-slate-500">Currently deployed and ready to call</p>
              </div>
            </div>
            <a
              href="/dashboard/agents"
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
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
                  className="group relative p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-cyan-300 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate group-hover:text-cyan-700 transition-colors">
                        {agent.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {agent.agent_templates?.description || 'AI calling agent'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-emerald-600 font-bold">Active</span>
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
        <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Recent Campaigns</h3>
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
                  <div
                    key={run.id}
                    className="group p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-black text-slate-900 text-lg">{run.name}</h4>
                          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border-2 ${getStatusStyles(run.status)}`}>
                            {run.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-slate-500 font-semibold mb-1">Total Contacts</p>
                            <p className="text-2xl font-black text-slate-900">{run.total_contacts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold mb-1">Completed</p>
                            <p className="text-2xl font-black text-blue-600">{run.completed_calls}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold mb-1">Successful</p>
                            <p className="text-2xl font-black text-emerald-600">{run.successful_calls}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600">Progress</span>
                        <span className="text-xs font-black text-slate-900">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 rounded-full transition-all duration-500 shadow-lg"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      {run.completed_calls > 0 && (
                        <p className="text-xs text-emerald-600 font-bold mt-2">
                          {successRate.toFixed(1)}% success rate
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Contact Status Distribution */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Contact Status Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200 hover:shadow-md transition-all">
            <p className="text-3xl font-black text-slate-900">{stats.pending}</p>
            <p className="text-xs text-slate-500 font-bold mt-1.5 uppercase tracking-wide">Pending</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 hover:shadow-md transition-all">
            <p className="text-3xl font-black text-blue-900">{stats.calling}</p>
            <p className="text-xs text-blue-600 font-bold mt-1.5 uppercase tracking-wide">In Progress</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border-2 border-emerald-200 hover:shadow-md transition-all">
            <p className="text-3xl font-black text-emerald-900">{stats.verified}</p>
            <p className="text-xs text-emerald-600 font-bold mt-1.5 uppercase tracking-wide">Verified</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-2 border-amber-200 hover:shadow-md transition-all">
            <p className="text-3xl font-black text-amber-900">{stats.noAnswer}</p>
            <p className="text-xs text-amber-600 font-bold mt-1.5 uppercase tracking-wide">No Answer</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl border-2 border-violet-200 hover:shadow-md transition-all">
            <p className="text-3xl font-black text-violet-900">{stats.callback}</p>
            <p className="text-xs text-violet-600 font-bold mt-1.5 uppercase tracking-wide">Callback</p>
          </div>
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Recent Call Activity</h3>
              <p className="text-sm text-slate-500">Latest {recentCalls.length} calls</p>
            </div>
          </div>
          <a
            href="/dashboard/calls"
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
          >
            View all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-slate-900 font-bold text-lg mb-2">No calls yet</p>
            <p className="text-sm text-slate-500 mb-6">Start a campaign to begin making calls</p>
            <a
              href="/dashboard/agents"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all font-bold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Launch Campaign
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Call ID
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Answered By
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCalls.slice(0, 8).map((call) => (
                  <tr key={call.id} className="hover:bg-indigo-50/50 transition-colors group">
                    <td className="py-4 px-6">
                      <p className="text-sm font-bold text-slate-900 font-mono">
                        {call.call_id.substring(0, 12)}...
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${getStatusStyles(call.status || 'unknown')}`}>
                        {call.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-semibold text-slate-700">
                        {formatDuration(call.call_length)}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        call.answered_by === 'human'
                          ? 'bg-emerald-100 text-emerald-700'
                          : call.answered_by === 'voicemail'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {call.answered_by || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-500 font-medium">
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/dashboard/contacts"
          className="group bg-gradient-to-br from-white to-indigo-50 rounded-2xl border-2 border-indigo-200 p-6 hover:shadow-xl hover:border-indigo-400 transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/40 transition-all group-hover:scale-110 duration-300">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                Import Contacts
              </h4>
              <p className="text-sm text-slate-500 mt-1 font-medium">Add contacts to call</p>
            </div>
          </div>
        </a>

        <a
          href="/dashboard/agents"
          className="group bg-gradient-to-br from-white to-emerald-50 rounded-2xl border-2 border-emerald-200 p-6 hover:shadow-xl hover:border-emerald-400 transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:shadow-emerald-500/40 transition-all group-hover:scale-110 duration-300">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg group-hover:text-emerald-600 transition-colors">
                Start Campaign
              </h4>
              <p className="text-sm text-slate-500 mt-1 font-medium">Launch AI calling agent</p>
            </div>
          </div>
        </a>

        <a
          href="/dashboard/settings"
          className="group bg-gradient-to-br from-white to-violet-50 rounded-2xl border-2 border-violet-200 p-6 hover:shadow-xl hover:border-violet-400 transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg group-hover:shadow-violet-500/40 transition-all group-hover:scale-110 duration-300">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg group-hover:text-violet-600 transition-colors">
                Settings
              </h4>
              <p className="text-sm text-slate-500 mt-1 font-medium">Configure your account</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
