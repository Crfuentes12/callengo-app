// components/analytics/AnalyticsDashboard.tsx
'use client';

import { useMemo } from 'react';
import { Database } from '@/types/supabase';
import { formatCurrency, formatDuration } from '@/lib/call-agent-utils';

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
  totalCost: number;
  avgDuration: number;
}

export default function AnalyticsDashboard({
  callLogs,
  contacts,
  agentTemplates,
  agentRuns
}: AnalyticsDashboardProps) {
  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalCalls = callLogs.length;
    const completedCalls = callLogs.filter(log => log.completed).length;
    const successfulCalls = callLogs.filter(log => log.status === 'completed').length;
    const failedCalls = callLogs.filter(log => log.status === 'failed' || !log.completed).length;

    const totalDuration = callLogs.reduce((sum, log) => sum + (log.call_length || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const totalCost = callLogs.reduce((sum, log) => sum + (log.price || 0), 0);
    const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;

    const successRate = completedCalls > 0 ? (successfulCalls / completedCalls) * 100 : 0;

    return {
      totalCalls,
      completedCalls,
      successfulCalls,
      failedCalls,
      totalDuration,
      avgDuration,
      totalCost,
      avgCost,
      successRate,
    };
  }, [callLogs]);

  // Calculate daily call trends (last 14 days)
  const dailyCallTrends = useMemo(() => {
    const last14Days: DailyCallData[] = [];
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = callLogs.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      last14Days.push({
        date: dateStr,
        count: dayLogs.length,
        successful: dayLogs.filter(log => log.status === 'completed').length,
        failed: dayLogs.filter(log => log.status === 'failed' || !log.completed).length,
      });
    }

    return last14Days;
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
          totalCost: 0,
          avgDuration: 0,
        });
      }

      const perf = agentMap.get(agent.id)!;
      perf.totalCalls++;
      if (log.status === 'completed') perf.successfulCalls++;
      perf.totalCost += log.price || 0;
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

  // Top contacted companies
  const topCompanies = useMemo(() => {
    const companyMap = new Map<string, { name: string; calls: number; successRate: number }>();

    contacts.forEach(contact => {
      const name = contact.company_name;
      if (!name) return;

      if (!companyMap.has(name)) {
        companyMap.set(name, { name, calls: 0, successRate: 0 });
      }

      const company = companyMap.get(name)!;
      company.calls += contact.call_attempts;
      if (contact.status === 'Fully Verified') company.successRate++;
    });

    // Calculate success rate percentage
    companyMap.forEach(company => {
      company.successRate = company.calls > 0 ? (company.successRate / company.calls) * 100 : 0;
    });

    return Array.from(companyMap.values())
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
  }, [contacts]);

  const maxDailyCalls = Math.max(...dailyCallTrends.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/10">
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold mb-1">Analytics Dashboard</h2>
          <p className="text-purple-100">
            Comprehensive insights into your calling performance
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2"></div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Calls</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{kpis.totalCalls}</p>
              <p className="text-sm text-slate-400 mt-1">{kpis.completedCalls} completed</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Success Rate</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{kpis.successRate.toFixed(1)}%</p>
              <p className="text-sm text-emerald-600 mt-1">{kpis.successfulCalls} successful</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Cost</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{formatCurrency(kpis.totalCost)}</p>
              <p className="text-sm text-slate-400 mt-1">{formatCurrency(kpis.avgCost)} avg</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Avg Duration</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{formatDuration(kpis.avgDuration)}</p>
              <p className="text-sm text-slate-400 mt-1">per call</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Call Trends Chart */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Call Trends</h3>
            <p className="text-sm text-slate-500 mt-0.5">Last 14 days</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-slate-600">Successful</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-600">Failed</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {dailyCallTrends.map((day, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-16 text-xs text-slate-500 font-medium">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 flex gap-1 h-8 items-center">
                <div className="relative flex-1 bg-slate-100 rounded-lg overflow-hidden h-full">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${(day.successful / maxDailyCalls) * 100}%` }}
                  ></div>
                  <div
                    className="absolute h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300"
                    style={{
                      left: `${(day.successful / maxDailyCalls) * 100}%`,
                      width: `${(day.failed / maxDailyCalls) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="w-12 text-sm font-semibold text-slate-700 text-right">
                  {day.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout for Agent Performance and Contact Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Agent Performance</h3>
          {agentPerformance.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No agent data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agentPerformance.map(agent => {
                const successRate = agent.totalCalls > 0 ? (agent.successfulCalls / agent.totalCalls) * 100 : 0;
                return (
                  <div key={agent.id} className="border border-slate-100 rounded-lg p-4 hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-slate-900">{agent.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{agent.totalCalls} total calls</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">{successRate.toFixed(0)}%</p>
                        <p className="text-xs text-slate-500">success</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Cost</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(agent.totalCost)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Avg Duration</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDuration(agent.avgDuration)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">Success</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{agent.successfulCalls}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contact Status Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Contact Status Breakdown</h3>
          {contactStatusBreakdown.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No contact data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contactStatusBreakdown.map((item, idx) => {
                const maxCount = contactStatusBreakdown[0]?.count || 1;
                const percentage = (item.count / maxCount) * 100;

                const statusColors: Record<string, { bg: string; text: string; bar: string }> = {
                  'Fully Verified': { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
                  'Pending': { bg: 'bg-slate-50', text: 'text-slate-700', bar: 'bg-slate-400' },
                  'Calling': { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
                  'No Answer': { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
                  'Voicemail Left': { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
                  'For Callback': { bg: 'bg-violet-50', text: 'text-violet-700', bar: 'bg-violet-500' },
                };

                const colors = statusColors[item.status] || { bg: 'bg-slate-50', text: 'text-slate-700', bar: 'bg-slate-400' };

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{item.status}</span>
                        <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} transition-all duration-500 rounded-full`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Companies */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Top Companies by Call Volume</h3>
          <p className="text-sm text-slate-500 mt-0.5">Most contacted organizations</p>
        </div>
        {topCompanies.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No company data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Calls
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCompanies.map((company, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
                        {idx + 1}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm font-medium text-slate-900">{company.name}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm text-slate-700">{company.calls}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[120px] bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(company.successRate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-12">
                          {company.successRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
