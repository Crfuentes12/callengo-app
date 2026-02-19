// components/analytics/AnalyticsDashboard.tsx
'use client';

import { useMemo, useState } from 'react';
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

  const maxDailySuccessful = Math.max(...dailyCallTrends.map(d => d.successful), 1);
  const maxDailyFailed = Math.max(...dailyCallTrends.map(d => d.failed), 1);
  const maxDailyCalls = Math.max(maxDailySuccessful, maxDailyFailed, 1);
  const maxHourlyCalls = Math.max(...hourlyDistribution.map(h => h.count), 1);

  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; chart: 'daily' | 'hourly' } | null>(null);

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
      {/* Section Header */}
      <div className="gradient-bg-subtle rounded-2xl p-10 shadow-md border border-slate-200">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Analytics Dashboard
              </h2>
              <p className="text-lg text-slate-500 font-medium">
                Deep insights and performance metrics across all operations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Total Calls</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{kpis.totalCalls.toLocaleString()}</span>
              <p className="text-xs text-slate-500 mt-1">{kpis.successfulCalls} successful</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Success Rate</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{kpis.successRate.toFixed(0)}%</span>
              <p className="text-xs text-slate-500 mt-1">{kpis.failedCalls} failed</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Total Contacts</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{kpis.totalContacts.toLocaleString()}</span>
              <p className="text-xs text-slate-500 mt-1">{kpis.verifiedContacts} verified</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Avg Duration</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{formatDuration(kpis.avgDuration)}</span>
              <p className="text-xs text-slate-500 mt-1">{formatDuration(kpis.totalDuration)} total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call Trends - Last 30 Days (Area Chart) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Call Volume Trends
            </h3>
            <p className="text-sm text-slate-500 mt-1">Last 30 days performance</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full gradient-bg"></div>
              <span className="text-slate-600">Successful</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span className="text-slate-600">Failed</span>
            </div>
          </div>
        </div>
        {(() => {
          const cW = 800, cH = 280, pL = 42, pR = 10, pT = 20, pB = 30;
          const w = cW - pL - pR, h = cH - pT - pB;
          const data = dailyCallTrends;
          const mx = Math.max(maxDailyCalls, 1);
          const xS = data.length > 1 ? w / (data.length - 1) : w;
          const tX = (i: number) => pL + i * xS;
          const tY = (v: number) => pT + h - (v / mx) * h;
          const yMin = pT, yMax = pT + h;

          // Clamped smooth monotone cubic bezier path (prevents overshooting below x-axis)
          const smoothPath = (points: { x: number; y: number }[]) => {
            if (points.length < 2) return '';
            let d = `M${points[0].x},${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[Math.max(0, i - 1)];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = points[Math.min(points.length - 1, i + 2)];
              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = Math.min(Math.max(p1.y + (p2.y - p0.y) / 6, yMin), yMax);
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = Math.min(Math.max(p2.y - (p3.y - p1.y) / 6, yMin), yMax);
              d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
            }
            return d;
          };

          const sPts = data.map((d, i) => ({ x: tX(i), y: tY(d.successful) }));
          const fPts = data.map((d, i) => ({ x: tX(i), y: tY(d.failed) }));
          const sL = smoothPath(sPts);
          const fL = smoothPath(fPts);
          const bse = `L${tX(data.length - 1)},${tY(0)} L${tX(0)},${tY(0)}`;
          const sA = `${sL} ${bse} Z`;
          const fA = `${fL} ${bse} Z`;
          const hp = hoveredPoint?.chart === 'daily' ? hoveredPoint.index : null;
          return (
            <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHoveredPoint(null)}>
              <defs>
                <linearGradient id="aSuccStr" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#173657" /><stop offset="50%" stopColor="#2e3a76" /><stop offset="100%" stopColor="#8938b0" />
                </linearGradient>
                <linearGradient id="aSuccFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e3a76" stopOpacity="0.25" /><stop offset="50%" stopColor="#8938b0" stopOpacity="0.08" /><stop offset="100%" stopColor="#8938b0" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="aFailFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <g key={i}>
                  <line x1={pL} y1={tY(mx * p)} x2={pL + w} y2={tY(mx * p)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={p > 0 ? "4,4" : "0"} />
                  <text x={pL - 6} y={tY(mx * p) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(mx * p)}</text>
                </g>
              ))}
              {/* Failed calls area and line */}
              <path d={fA} fill="url(#aFailFill)" />
              <path d={fL} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
              {/* Successful calls area and line */}
              <path d={sA} fill="url(#aSuccFill)" />
              <path d={sL} fill="none" stroke="url(#aSuccStr)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* Hover hit areas */}
              {data.map((d, i) => (
                <rect key={`hit${i}`} x={tX(i) - xS / 2} y={pT} width={xS} height={h} fill="transparent" onMouseEnter={() => setHoveredPoint({ index: i, chart: 'daily' })} />
              ))}
              {/* Hover guide line */}
              {hp !== null && (
                <line x1={tX(hp)} y1={pT} x2={tX(hp)} y2={pT + h} stroke="#2e3a76" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
              )}
              {/* Successful data points */}
              {data.map((d, i) => d.successful > 0 || hp === i ? (
                <circle key={`s${i}`} cx={tX(i)} cy={tY(d.successful)} r={hp === i ? 5 : 3} fill="#2e3a76" stroke="white" strokeWidth={hp === i ? 2.5 : 1.5} opacity={hp === i ? 1 : 0.9} className="transition-all duration-150" />
              ) : null)}
              {/* Failed data points */}
              {data.map((d, i) => d.failed > 0 || hp === i ? (
                <circle key={`f${i}`} cx={tX(i)} cy={tY(d.failed)} r={hp === i ? 5 : 3} fill="#ef4444" stroke="white" strokeWidth={hp === i ? 2.5 : 1.5} opacity={hp === i ? 1 : 0.7} className="transition-all duration-150" />
              ) : null)}
              {/* Tooltip */}
              {hp !== null && (() => {
                const d = data[hp];
                const tx = tX(hp);
                const ty = Math.min(tY(d.successful), tY(d.failed)) - 14;
                const dateLabel = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const boxW = 130, boxH = 58;
                const bx = Math.min(Math.max(tx - boxW / 2, pL), pL + w - boxW);
                const by = Math.max(ty - boxH, pT - 5);
                return (
                  <g>
                    <rect x={bx} y={by} width={boxW} height={boxH} rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1" filter="url(#shadow)" />
                    <text x={bx + boxW / 2} y={by + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b">{dateLabel}</text>
                    <text x={bx + 10} y={by + 32} fontSize="9" fill="#64748b">Successful: <tspan fontWeight="700" fill="#2e3a76">{d.successful}</tspan></text>
                    <text x={bx + 10} y={by + 47} fontSize="9" fill="#64748b">Failed: <tspan fontWeight="700" fill="#ef4444">{d.failed}</tspan></text>
                  </g>
                );
              })()}
              {/* X-axis labels */}
              {data.map((d, i) => (i % 5 === 0 || i === data.length - 1) ? <text key={`l${i}`} x={tX(i)} y={cH - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text> : null)}
            </svg>
          );
        })()}
      </div>

      {/* Agent Performance & Contact Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Agent Performance</h3>
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
                <p className="text-slate-900 font-semibold">No agent data yet</p>
                <p className="text-sm text-slate-500 mt-1">Start a campaign to see performance</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentPerformance.map(agent => {
                  const successRate = agent.totalCalls > 0 ? (agent.successfulCalls / agent.totalCalls) * 100 : 0;
                  return (
                    <div key={agent.id} className="group p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">{agent.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{agent.totalCalls} calls made</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600">{successRate.toFixed(0)}%</p>
                          <p className="text-xs text-slate-500 font-semibold">success</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-500 font-semibold">Avg Duration</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">{formatDuration(agent.avgDuration)}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-500 font-semibold">Successful</p>
                          <p className="text-sm font-bold text-emerald-600 mt-1">{agent.successfulCalls}</p>
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
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Contact Status</h3>
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
                <p className="text-slate-900 font-semibold">No contact data yet</p>
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
                        <span className="text-sm font-semibold text-slate-700">{item.status}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.count}</span>
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

      {/* Hourly Distribution (Area Chart) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Call Activity by Hour</h3>
            <p className="text-sm text-slate-500">24-hour distribution pattern</p>
          </div>
        </div>
        {(() => {
          const cW = 800, cH = 220, pL = 42, pR = 10, pT = 15, pB = 28;
          const w = cW - pL - pR, h = cH - pT - pB;
          const data = hourlyDistribution;
          const mx = Math.max(maxHourlyCalls, 1);
          const xS = w / (data.length - 1);
          const tX = (i: number) => pL + i * xS;
          const tY = (v: number) => pT + h - (v / mx) * h;

          const yMin = pT, yMax = pT + h;

          // Clamped smooth monotone cubic bezier path
          const smoothPath = (points: { x: number; y: number }[]) => {
            if (points.length < 2) return '';
            let d = `M${points[0].x},${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[Math.max(0, i - 1)];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = points[Math.min(points.length - 1, i + 2)];
              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = Math.min(Math.max(p1.y + (p2.y - p0.y) / 6, yMin), yMax);
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = Math.min(Math.max(p2.y - (p3.y - p1.y) / 6, yMin), yMax);
              d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
            }
            return d;
          };

          const pts = data.map((d, i) => ({ x: tX(i), y: tY(d.count) }));
          const linePath = smoothPath(pts);
          const areaPath = `${linePath} L${tX(data.length - 1)},${tY(0)} L${tX(0)},${tY(0)} Z`;
          const hhp = hoveredPoint?.chart === 'hourly' ? hoveredPoint.index : null;

          return (
            <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHoveredPoint(null)}>
              <defs>
                <linearGradient id="hourStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <g key={i}>
                  <line x1={pL} y1={tY(mx * p)} x2={pL + w} y2={tY(mx * p)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={p > 0 ? "4,4" : "0"} />
                  <text x={pL - 6} y={tY(mx * p) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(mx * p)}</text>
                </g>
              ))}
              <path d={areaPath} fill="url(#hourFill)" />
              <path d={linePath} fill="none" stroke="url(#hourStroke)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* Hover hit areas */}
              {data.map((d, i) => (
                <rect key={`hit${i}`} x={tX(i) - xS / 2} y={pT} width={xS} height={h} fill="transparent" onMouseEnter={() => setHoveredPoint({ index: i, chart: 'hourly' })} />
              ))}
              {hhp !== null && <line x1={tX(hhp)} y1={pT} x2={tX(hhp)} y2={pT + h} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />}
              {data.map((d, i) => d.count > 0 || hhp === i ? <circle key={i} cx={tX(i)} cy={tY(d.count)} r={hhp === i ? 5 : 3} fill="#f59e0b" stroke="white" strokeWidth={hhp === i ? 2.5 : 1.5} className="transition-all duration-150" /> : null)}
              {hhp !== null && (() => {
                const d = data[hhp];
                const tx = tX(hhp);
                const boxW = 100, boxH = 40;
                const bx = Math.min(Math.max(tx - boxW / 2, pL), pL + w - boxW);
                const by = Math.max(tY(d.count) - boxH - 14, pT - 5);
                return (
                  <g>
                    <rect x={bx} y={by} width={boxW} height={boxH} rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1" />
                    <text x={bx + boxW / 2} y={by + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b">{d.label}</text>
                    <text x={bx + boxW / 2} y={by + 32} textAnchor="middle" fontSize="10" fill="#64748b">Calls: <tspan fontWeight="700" fill="#f59e0b">{d.count}</tspan></text>
                  </g>
                );
              })()}
              {data.map((d, i) => (
                <text key={`h${i}`} x={tX(i)} y={cH - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.hour}</text>
              ))}
            </svg>
          );
        })()}
      </div>

      {/* Active Campaigns */}
      {agentRuns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Campaign Performance</h3>
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
                  <div key={run.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-900 text-lg">{run.name}</h4>
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
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
                        <p className="text-xl font-bold text-slate-900">{run.total_contacts}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Completed</p>
                        <p className="text-xl font-bold text-blue-600">{run.completed_calls}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Successful</p>
                        <p className="text-xl font-bold text-emerald-600">{run.successful_calls}</p>
                      </div>
                      <div className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Success Rate</p>
                        <p className="text-xl font-bold text-purple-600">{successRate.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-600">Progress</span>
                        <span className="text-xs font-bold text-slate-900">{progress.toFixed(1)}%</span>
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
