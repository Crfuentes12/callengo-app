// components/analytics/AnalyticsDashboard.tsx
'use client';

import { useState, useMemo } from 'react';
import { Database } from '@/types/supabase';

type CallLog = Database['public']['Tables']['call_logs']['Row'];
type Contact = Database['public']['Tables']['contacts']['Row'];
type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
type AgentTemplate = Database['public']['Tables']['agent_templates']['Row'];

interface AnalyticsDashboardProps {
  callLogs: CallLog[];
  contacts: Contact[];
  agentRuns: AgentRun[];
  agentTemplates: AgentTemplate[];
  companyId: string;
}

interface TimeSeriesData {
  date: string;
  calls: number;
  completed: number;
  cost: number;
}

export default function AnalyticsDashboard({
  callLogs,
  contacts,
  agentRuns,
  agentTemplates,
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Filter data based on time range
  const filteredCallLogs = useMemo(() => {
    if (timeRange === 'all') return callLogs;

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return callLogs.filter(log => new Date(log.created_at) >= cutoffDate);
  }, [callLogs, timeRange]);

  // Calculate main metrics
  const metrics = useMemo(() => {
    const totalCalls = filteredCallLogs.length;
    const completedCalls = filteredCallLogs.filter(log => log.completed).length;
    const totalDuration = filteredCallLogs.reduce((sum, log) => sum + (log.call_length || 0), 0);
    const totalCost = filteredCallLogs.reduce((sum, log) => sum + (log.price || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
    const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      completedCalls,
      totalDuration: Math.round(totalDuration),
      totalCost: totalCost.toFixed(2),
      avgDuration: Math.round(avgDuration),
      avgCost: avgCost.toFixed(3),
      successRate: successRate.toFixed(1),
    };
  }, [filteredCallLogs]);

  // Contact status distribution
  const contactStats = useMemo(() => {
    const stats: Record<string, number> = {};
    contacts.forEach(contact => {
      const status = contact.status || 'unknown';
      stats[status] = (stats[status] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [contacts]);

  // Answered by distribution (human vs voicemail)
  const answeredByStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredCallLogs.forEach(log => {
      const answeredBy = log.answered_by || 'unknown';
      stats[answeredBy] = (stats[answeredBy] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCallLogs]);

  // Sentiment analysis from contacts
  const sentimentStats = useMemo(() => {
    const stats: Record<string, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
      unknown: 0,
    };

    contacts.forEach(contact => {
      if (contact.analysis && typeof contact.analysis === 'object') {
        const analysis = contact.analysis as Record<string, unknown>;
        const sentiment = (typeof analysis.sentiment === 'string' ? analysis.sentiment.toLowerCase() : null) || 'unknown';
        if (sentiment in stats) {
          stats[sentiment]++;
        } else {
          stats.unknown++;
        }
      } else {
        stats.unknown++;
      }
    });

    return Object.entries(stats)
      .map(([sentiment, count]) => ({ sentiment, count }))
      .filter(item => item.count > 0);
  }, [contacts]);

  // Time series data (calls per day)
  const timeSeriesData = useMemo(() => {
    const dataMap: Record<string, TimeSeriesData> = {};

    filteredCallLogs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!dataMap[date]) {
        dataMap[date] = { date, calls: 0, completed: 0, cost: 0 };
      }
      dataMap[date].calls++;
      if (log.completed) dataMap[date].completed++;
      dataMap[date].cost += log.price || 0;
    });

    return Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredCallLogs]);

  // Top 10 longest calls
  const topCalls = useMemo(() => {
    return [...filteredCallLogs]
      .filter(log => log.call_length && log.call_length > 0)
      .sort((a, b) => (b.call_length || 0) - (a.call_length || 0))
      .slice(0, 10);
  }, [filteredCallLogs]);

  // Agent template usage
  const agentUsage = useMemo(() => {
    const usage: Record<string, { name: string; count: number }> = {};

    filteredCallLogs.forEach(log => {
      if (log.agent_template_id) {
        const template = agentTemplates.find(t => t.id === log.agent_template_id);
        const templateName = template?.name || 'Unknown Agent';

        if (!usage[log.agent_template_id]) {
          usage[log.agent_template_id] = { name: templateName, count: 0 };
        }
        usage[log.agent_template_id].count++;
      }
    });

    return Object.values(usage).sort((a, b) => b.count - a.count);
  }, [filteredCallLogs, agentTemplates]);

  // Campaign statistics
  const campaignStats = useMemo(() => {
    return agentRuns.map(run => ({
      id: run.id,
      createdAt: new Date(run.created_at).toLocaleDateString(),
      totalContacts: run.total_contacts || 0,
      completedCalls: run.completed_calls || 0,
      successfulCalls: run.successful_calls || 0,
      failedCalls: run.failed_calls || 0,
      totalCost: (run.total_cost || 0).toFixed(2),
      successRate: run.total_contacts ? ((run.successful_calls || 0) / run.total_contacts * 100).toFixed(1) : '0',
    }));
  }, [agentRuns]);

  return (
    <div className="space-y-6 p-6">
      {/* Time Range Selector */}
      <div className="flex justify-end gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === 'all' ? 'All Time' : `Last ${range}`}
          </button>
        ))}
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls"
          value={metrics.totalCalls}
          subtitle={`${metrics.completedCalls} completed`}
          color="blue"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          subtitle={`${metrics.completedCalls} / ${metrics.totalCalls}`}
          color="green"
        />
        <MetricCard
          title="Total Duration"
          value={`${Math.floor(metrics.totalDuration / 60)}m ${metrics.totalDuration % 60}s`}
          subtitle={`Avg: ${metrics.avgDuration}s per call`}
          color="purple"
        />
        <MetricCard
          title="Total Cost"
          value={`$${metrics.totalCost}`}
          subtitle={`Avg: $${metrics.avgCost} per call`}
          color="orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Contact Status Distribution</h3>
          <div className="space-y-3">
            {contactStats.map(({ status, count }) => {
              const percentage = (count / contacts.length) * 100;
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{status}</span>
                    <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Answered By Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Answered By</h3>
          <div className="space-y-3">
            {answeredByStats.map(({ type, count }) => {
              const percentage = (count / filteredCallLogs.length) * 100;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{type}</span>
                    <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sentiment Analysis */}
        {sentimentStats.some(s => s.count > 0 && s.sentiment !== 'unknown') && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Sentiment Analysis</h3>
            <div className="space-y-3">
              {sentimentStats.map(({ sentiment, count }) => {
                const percentage = (count / contacts.length) * 100;
                const colorMap: Record<string, string> = {
                  positive: 'bg-green-600',
                  neutral: 'bg-yellow-600',
                  negative: 'bg-red-600',
                  unknown: 'bg-gray-400',
                };
                return (
                  <div key={sentiment}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium capitalize">{sentiment}</span>
                      <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${colorMap[sentiment]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Agent Usage */}
        {agentUsage.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Usage</h3>
            <div className="space-y-3">
              {agentUsage.slice(0, 5).map(({ name, count }) => {
                const percentage = (count / filteredCallLogs.length) * 100;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Time Series Chart */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Calls Over Time</h3>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="flex items-end justify-between h-64 gap-2">
                {timeSeriesData.map((data, idx) => {
                  const maxCalls = Math.max(...timeSeriesData.map(d => d.calls));
                  const height = maxCalls > 0 ? (data.calls / maxCalls) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                      <div
                        className="w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t relative"
                        style={{ height: `${height}%` }}
                        title={`${data.date}: ${data.calls} calls, $${data.cost.toFixed(2)}`}
                      >
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                          {data.calls} calls
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2 rotate-45 origin-left whitespace-nowrap">
                        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Statistics */}
      {campaignStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Campaign Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Contacts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Successful</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaignStats.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.createdAt}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.totalContacts}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.completedCalls}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{campaign.successfulCalls}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{campaign.failedCalls}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.successRate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${campaign.totalCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 10 Longest Calls */}
      {topCalls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top 10 Longest Calls</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Answered By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {call.call_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(call.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.floor((call.call_length || 0) / 60)}m {(call.call_length || 0) % 60}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {call.answered_by || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        call.completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {call.completed ? 'Completed' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(call.price || 0).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ title, value, subtitle, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  const textColorClasses = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    purple: 'text-purple-900',
    orange: 'text-orange-900',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <p className={`text-3xl font-bold mb-1 ${textColorClasses[color]}`}>{value}</p>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}
