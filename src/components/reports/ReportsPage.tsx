// components/reports/ReportsPage.tsx
'use client';

import { useState, useMemo } from 'react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  completed_calls: number;
  successful_calls: number;
  failed_calls: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_templates: { name: string } | null;
}

interface CallStat {
  status: string | null;
  call_length: number | null;
  created_at: string;
}

interface Contact {
  status: string;
  list_id: string | null;
  created_at: string;
}

interface ReportsPageProps {
  campaigns: Campaign[];
  callStats: CallStat[];
  contacts: Contact[];
  companyId: string;
}

export default function ReportsPage({ campaigns, callStats, contacts, companyId }: ReportsPageProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const stats = useMemo(() => {
    const now = new Date();
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : 9999;
    const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const filteredCalls = callStats.filter(c => new Date(c.created_at) >= cutoff);
    const filteredCampaigns = campaigns.filter(c => new Date(c.created_at) >= cutoff);

    const totalCalls = filteredCalls.length;
    const successfulCalls = filteredCalls.filter(c => c.status === 'completed' || c.status === 'answered').length;
    const avgDuration = filteredCalls.reduce((sum, c) => sum + (c.call_length || 0), 0) / (totalCalls || 1);
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      successfulCalls,
      avgDuration: Math.round(avgDuration),
      successRate: successRate.toFixed(1),
      totalCampaigns: filteredCampaigns.length,
      activeCampaigns: filteredCampaigns.filter(c => c.status === 'running' || c.status === 'active').length,
      totalContacts: contacts.length,
    };
  }, [callStats, campaigns, contacts, selectedPeriod]);

  // Group calls by day for the chart
  const dailyData = useMemo(() => {
    const now = new Date();
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : 365;
    const days: { date: string; calls: number; successful: number }[] = [];

    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayCalls = callStats.filter(c => c.created_at.startsWith(dateStr));
      days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        calls: dayCalls.length,
        successful: dayCalls.filter(c => c.status === 'completed' || c.status === 'answered').length,
      });
    }

    return days;
  }, [callStats, selectedPeriod]);

  const maxCalls = Math.max(...dailyData.map(d => d.calls), 1);

  // Campaign performance
  const campaignPerformance = useMemo(() => {
    return campaigns
      .filter(c => c.completed_calls > 0)
      .sort((a, b) => {
        const rateA = a.completed_calls > 0 ? (a.successful_calls / a.completed_calls) * 100 : 0;
        const rateB = b.completed_calls > 0 ? (b.successful_calls / b.completed_calls) * 100 : 0;
        return rateB - rateA;
      })
      .slice(0, 5);
  }, [campaigns]);

  const handleExportCSV = () => {
    const headers = ['Campaign', 'Agent', 'Status', 'Total Contacts', 'Completed', 'Successful', 'Failed', 'Success Rate', 'Created'];
    const rows = campaigns.map(c => [
      c.name,
      c.agent_templates?.name || 'Unknown',
      c.status,
      c.total_contacts,
      c.completed_calls,
      c.successful_calls,
      c.failed_calls,
      c.completed_calls > 0 ? ((c.successful_calls / c.completed_calls) * 100).toFixed(1) + '%' : '0%',
      new Date(c.created_at).toLocaleDateString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callengo-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-600 mt-1">Analyze your campaign performance and call metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  selectedPeriod === period
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period === 'all' ? 'All Time' : period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Calls</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalCalls}</div>
          <div className="text-xs text-slate-500 mt-1">{stats.successfulCalls} successful</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.successRate}%</div>
          <div className="text-xs text-slate-500 mt-1">Call completion rate</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Avg Duration</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{Math.floor(stats.avgDuration / 60)}:{(stats.avgDuration % 60).toString().padStart(2, '0')}</div>
          <div className="text-xs text-slate-500 mt-1">Minutes per call</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Campaigns</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalCampaigns}</div>
          <div className="text-xs text-slate-500 mt-1">{stats.activeCampaigns} active</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Chart (Area) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-bg-subtle flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Call Volume</h3>
              <p className="text-xs text-slate-500">Daily call activity</p>
            </div>
          </div>
          {(() => {
            const sliced = dailyData.slice(-30);
            const cW = 500, cH = 200, pL = 36, pR = 8, pT = 12, pB = 24;
            const w = cW - pL - pR, h = cH - pT - pB;
            const mx = Math.max(maxCalls, 1);
            const xS = sliced.length > 1 ? w / (sliced.length - 1) : w;
            const tX = (i: number) => pL + i * xS;
            const tY = (v: number) => pT + h - (v / mx) * h;
            // Generate smooth monotone cubic bezier path
            const smoothPath = (points: { x: number; y: number }[]) => {
              if (points.length < 2) return '';
              let d = `M${points[0].x},${points[0].y}`;
              for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = Math.min(Math.max(p1.y + (p2.y - p0.y) / 6, pT), pT + h);
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = Math.min(Math.max(p2.y - (p3.y - p1.y) / 6, pT), pT + h);
                d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
              }
              return d;
            };
            const pts = sliced.map((d, i) => ({ x: tX(i), y: tY(d.calls) }));
            const linePath = smoothPath(pts);
            const areaPath = `${linePath} L${tX(sliced.length - 1)},${tY(0)} L${tX(0)},${tY(0)} Z`;
            return (
              <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="rStroke" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#173657" /><stop offset="50%" stopColor="#2e3a76" /><stop offset="100%" stopColor="#8938b0" />
                  </linearGradient>
                  <linearGradient id="rFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e3a76" stopOpacity="0.25" /><stop offset="50%" stopColor="#8938b0" stopOpacity="0.08" /><stop offset="100%" stopColor="#8938b0" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                  <g key={i}>
                    <line x1={pL} y1={tY(mx * p)} x2={pL + w} y2={tY(mx * p)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={p > 0 ? "4,4" : "0"} />
                    <text x={pL - 4} y={tY(mx * p) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(mx * p)}</text>
                  </g>
                ))}
                <path d={areaPath} fill="url(#rFill)" />
                <path d={linePath} fill="none" stroke="url(#rStroke)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {sliced.map((d, i) => d.calls > 0 ? <circle key={i} cx={tX(i)} cy={tY(d.calls)} r="2.5" fill="#2e3a76" stroke="white" strokeWidth="1" /> : null)}
                {sliced.map((d, i) => (i % 5 === 0 || i === sliced.length - 1) ? <text key={`l${i}`} x={tX(i)} y={cH - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.date}</text> : null)}
              </svg>
            );
          })()}
        </div>

        {/* Top Campaigns */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Top Campaigns</h3>
              <p className="text-xs text-slate-500">By success rate</p>
            </div>
          </div>
          <div className="space-y-4">
            {campaignPerformance.length > 0 ? (
              campaignPerformance.map((campaign) => {
                const rate = campaign.completed_calls > 0
                  ? (campaign.successful_calls / campaign.completed_calls) * 100
                  : 0;
                return (
                  <div key={campaign.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-3">{campaign.name}</span>
                      <span className={`text-sm font-bold ${rate >= 70 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {campaign.successful_calls}/{campaign.completed_calls} calls · {campaign.agent_templates?.name}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">No campaign data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Campaign Summary</h3>
          <p className="text-xs text-slate-500 mt-1">Detailed breakdown of all campaigns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Campaign</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Agent</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Calls</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Success</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length > 0 ? (
                campaigns.map(campaign => {
                  const rate = campaign.completed_calls > 0
                    ? (campaign.successful_calls / campaign.completed_calls) * 100
                    : 0;
                  return (
                    <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6">
                        <span className="text-sm font-medium text-slate-900">{campaign.name}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-600">{campaign.agent_templates?.name || 'Unknown'}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          campaign.status === 'running' || campaign.status === 'active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : campaign.status === 'completed'
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : campaign.status === 'paused'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-900">{campaign.completed_calls}/{campaign.total_contacts}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`text-sm font-medium ${rate >= 70 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-xs text-slate-500">
                          {new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    No campaigns yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
