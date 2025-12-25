// components/analytics/AnalyticsDashboard.tsx
'use client';

import { useMemo } from 'react';
import { Database } from '@/types/supabase';
import { formatDuration } from '@/lib/call-agent-utils';

type CallLog = Database['public']['Tables']['call_logs']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type AgentTemplate = Database['public']['Tables']['agent_templates']['Row'];
type AgentRun = Database['public']['Tables']['agent_runs']['Row'];

interface AnalyticsDashboardProps {
  callLogs: CallLog[];
  contacts: Contact[];
  agentTemplates: AgentTemplate[];
  agentRuns: AgentRun[];
}

interface DailyCallData {
  date: string;
  count: number;
  successful: number;
  failed: number;
}

interface AgentPerformance {
  id: string;
  name: string;
  totalCalls: number;
  successfulCalls: number;
  avgDuration: number;
}

export default function AnalyticsDashboard({
  callLogs,
  contacts,
  agentTemplates,
  agentRuns
}: AnalyticsDashboardProps) {
  // Calculate comprehensive KPIs
  const kpis = useMemo(() => {
    const totalCalls = callLogs.length;
    const completedCalls = callLogs.filter(log => log.completed).length;
    const successfulCalls = callLogs.filter(log => log.status === 'completed').length;
    const failedCalls = callLogs.filter(log => log.status === 'failed' || !log.completed).length;

    const totalDuration = callLogs.reduce((sum, log) => sum + (log.call_length || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const successRate = completedCalls > 0 ? (successfulCalls / completedCalls) * 100 : 0;

    // Contact stats
    const totalContacts = contacts.length;
    const verifiedContacts = contacts.filter(c => c.status === 'Fully Verified').length;
    const pendingContacts = contacts.filter(c => c.status === 'Pending').length;

    // Agent runs stats
    const activeCampaigns = agentRuns.filter(r => r.status === 'running' || r.status === 'active').length;
    const completedCampaigns = agentRuns.filter(r => r.status === 'completed').length;
    const totalCampaignCalls = agentRuns.reduce((sum, r) => sum + r.completed_calls, 0);

    return {
      totalCalls,
      completedCalls,
      successfulCalls,
      failedCalls,
      totalDuration,
      avgDuration,
      successRate,
      totalContacts,
      verifiedContacts,
      pendingContacts,
      activeCampaigns,
      completedCampaigns,
      totalCampaignCalls,
    };
  }, [callLogs, contacts, agentRuns]);

  // Calculate daily call trends (last 30 days)
  const dailyCallTrends = useMemo(() => {
    const last30Days: DailyCallData[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = callLogs.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      last30Days.push({
        date: dateStr,
        count: dayLogs.length,
        successful: dayLogs.filter(log => log.status === 'completed').length,
        failed: dayLogs.filter(log => log.status === 'failed' || !log.completed).length,
      });
    }

    return last30Days;
  }, [callLogs]);

  // Calculate agent performance
  const agentPerformance = useMemo(() => {
    const agentMap = new Map<string, AgentPerformance>();

    callLogs.forEach(log => {
      if (!log.agent_template_id) return;

      const agent = agentTemplates.find(a => a.id === log.agent_template_id);
      if (!agent) return;

      if (!agentMap.has(agent.id)) {
        agentMap.set(agent.id, {
          id: agent.id,
          name: agent.name,
          totalCalls: 0,
          successfulCalls: 0,
          avgDuration: 0,
        });
      }

      const perf = agentMap.get(agent.id)!;
      perf.totalCalls++;
      if (log.status === 'completed') perf.successfulCalls++;
      perf.avgDuration += log.call_length || 0;
    });

    // Calculate averages
    agentMap.forEach(perf => {
      perf.avgDuration = perf.totalCalls > 0 ? perf.avgDuration / perf.totalCalls : 0;
    });

    return Array.from(agentMap.values()).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [callLogs, agentTemplates]);

  // Calculate contact status breakdown
  const contactStatusBreakdown = useMemo(() => {
    const statusMap = new Map<string, number>();

    contacts.forEach(contact => {
      const status = contact.status || 'Unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [contacts]);

  // Hour of day analysis
  const hourlyDistribution = useMemo(() => {
    const hours = Array(24).fill(0);

    callLogs.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hours[hour]++;
    });

    return hours.map((count, hour) => ({
      hour,
      count,
      label: `${hour.toString().padStart(2, '0')}:00`
    }));
  }, [callLogs]);

  const maxDailyCalls = Math.max(...dailyCallTrends.map(d => d.count), 1);
  const maxHourlyCalls = Math.max(...hourlyDistribution.map(h => h.count), 1);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Fully Verified': 'from-emerald-400 to-teal-600',
      'Pending': 'from-slate-400 to-slate-600',
      'Calling': 'from-blue-400 to-cyan-600',
      'No Answer': 'from-amber-400 to-orange-600',
      'Voicemail Left': 'from-purple-400 to-violet-600',
      'For Callback': 'from-violet-400 to-purple-600',
    };
    return colors[status] || 'from-slate-400 to-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border-2 border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>

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
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-400"></div>
            </div>
            <div>
              <h2 className="text-5xl font-black text-white uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
                Analytics Hub
              </h2>
              <p className="text-lg text-slate-400 font-medium">
                Deep insights and performance metrics across all operations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Total Calls</span>
              </div>
              <span className="text-3xl text-white font-black">{kpis.totalCalls.toLocaleString()}</span>
              <p className="text-xs text-slate-400 mt-1">{kpis.successfulCalls} successful</p>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Success Rate</span>
              </div>
              <span className="text-3xl text-white font-black">{kpis.successRate.toFixed(0)}%</span>
              <p className="text-xs text-slate-400 mt-1">{kpis.completedCalls} completed</p>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Campaigns</span>
              </div>
              <span className="text-3xl text-white font-black">{kpis.activeCampaigns}</span>
              <p className="text-xs text-slate-400 mt-1">{kpis.completedCampaigns} completed</p>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Avg Duration</span>
              </div>
              <span className="text-3xl text-white font-black">{formatDuration(kpis.avgDuration)}</span>
              <p className="text-xs text-slate-400 mt-1">per call</p>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl"></div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Contacts</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{kpis.totalContacts.toLocaleString()}</p>
              <p className="text-sm text-emerald-600 mt-2 font-bold">{kpis.verifiedContacts} verified</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>

        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Successful Calls</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{kpis.successfulCalls.toLocaleString()}</p>
              <p className="text-sm text-emerald-600 mt-2 font-bold">{kpis.successRate.toFixed(1)}% rate</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:shadow-emerald-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>

        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-red-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Failed Calls</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{kpis.failedCalls.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">{kpis.totalCalls > 0 ? ((kpis.failedCalls / kpis.totalCalls) * 100).toFixed(1) : 0}% of total</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg group-hover:shadow-red-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>

        <div className="group bg-white rounded-xl border-2 border-slate-200/80 p-6 hover:shadow-xl hover:border-cyan-300 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Duration</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{formatDuration(kpis.totalDuration)}</p>
              <p className="text-sm text-slate-500 mt-2 font-medium">cumulative time</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:shadow-cyan-500/50 transition-all">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500 mt-4"></div>
        </div>
      </div>

      {/* Call Trends - Last 30 Days */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Call Volume Trends
            </h3>
            <p className="text-sm text-slate-500 mt-1">Last 30 days performance</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-slate-600">Successful</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-600">Failed</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {dailyCallTrends.map((day, idx) => {
            const barHeight = day.count > 0 ? (day.count / maxDailyCalls) * 100 : 1;
            return (
              <div key={idx} className="flex items-center gap-3 group">
                <div className="w-20 text-xs text-slate-500 font-bold">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 flex gap-1 h-10 items-end">
                  <div className="relative flex-1 bg-slate-100 rounded-lg overflow-hidden h-full">
                    {day.count > 0 && (
                      <>
                        <div
                          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500 group-hover:from-emerald-600 group-hover:to-emerald-500"
                          style={{ height: `${(day.successful / maxDailyCalls) * 100}%` }}
                        ></div>
                        <div
                          className="absolute w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-500 group-hover:from-red-600 group-hover:to-red-500"
                          style={{
                            bottom: `${(day.successful / maxDailyCalls) * 100}%`,
                            height: `${(day.failed / maxDailyCalls) * 100}%`
                          }}
                        ></div>
                      </>
                    )}
                  </div>
                  <div className="w-14 text-sm font-black text-slate-900 text-right">
                    {day.count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Performance & Contact Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b-2 border-slate-100 bg-gradient-to-r from-cyan-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Agent Performance</h3>
                <p className="text-sm text-slate-500">Top performing AI agents</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {agentPerformance.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold">No agent data yet</p>
                <p className="text-sm text-slate-500 mt-1">Start a campaign to see performance</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentPerformance.map(agent => {
                  const successRate = agent.totalCalls > 0 ? (agent.successfulCalls / agent.totalCalls) * 100 : 0;
                  return (
                    <div key={agent.id} className="group p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-cyan-300 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{agent.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{agent.totalCalls} calls made</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-emerald-600">{successRate.toFixed(0)}%</p>
                          <p className="text-xs text-slate-500 font-semibold">success</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-500 font-semibold">Avg Duration</p>
                          <p className="text-sm font-black text-slate-900 mt-1">{formatDuration(agent.avgDuration)}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-500 font-semibold">Successful</p>
                          <p className="text-sm font-black text-emerald-600 mt-1">{agent.successfulCalls}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Contact Status Distribution */}
        <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b-2 border-slate-100 bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Contact Status</h3>
                <p className="text-sm text-slate-500">Distribution by outcome</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {contactStatusBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold">No contact data yet</p>
                <p className="text-sm text-slate-500 mt-1">Import contacts to begin</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contactStatusBreakdown.map((item, idx) => {
                  const maxCount = contactStatusBreakdown[0]?.count || 1;
                  const percentage = (item.count / kpis.totalContacts) * 100;

                  return (
                    <div key={idx} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">{item.status}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{item.count}</span>
                          <span className="text-xs text-slate-500 font-semibold">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getStatusColor(item.status)} transition-all duration-700 group-hover:opacity-90`}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Call Activity by Hour</h3>
            <p className="text-sm text-slate-500">24-hour distribution pattern</p>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {hourlyDistribution.map((hour) => {
            const height = hour.count > 0 ? (hour.count / maxHourlyCalls) * 100 : 2;
            return (
              <div key={hour.hour} className="flex flex-col items-center group">
                <div className="w-full h-32 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:from-indigo-600 group-hover:to-indigo-500"
                    style={{ height: `${height}%` }}
                    title={`${hour.label}: ${hour.count} calls`}
                  ></div>
                </div>
                <div className="text-xs text-slate-500 font-semibold mt-2">{hour.hour}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Campaigns */}
      {agentRuns.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b-2 border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Campaign Performance</h3>
                <p className="text-sm text-slate-500">{kpis.activeCampaigns} active, {kpis.completedCampaigns} completed</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-4">
              {agentRuns.slice(0, 5).map((run) => {
                const progress = run.total_contacts > 0 ? (run.completed_calls / run.total_contacts) * 100 : 0;
                const successRate = run.completed_calls > 0 ? (run.successful_calls / run.completed_calls) * 100 : 0;

                return (
                  <div key={run.id} className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-black text-slate-900 text-lg">{run.name}</h4>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        run.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        run.status === 'running' || run.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {run.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Total</p>
                        <p className="text-xl font-black text-slate-900">{run.total_contacts}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Completed</p>
                        <p className="text-xl font-black text-blue-600">{run.completed_calls}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Successful</p>
                        <p className="text-xl font-black text-emerald-600">{run.successful_calls}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Success Rate</p>
                        <p className="text-xl font-black text-purple-600">{successRate.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600">Progress</span>
                        <span className="text-xs font-black text-slate-900">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
