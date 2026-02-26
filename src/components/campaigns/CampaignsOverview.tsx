// components/campaigns/CampaignsOverview.tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AgentTemplate, Company } from '@/types/supabase';
import AgentSelectionModal from '@/components/agents/AgentSelectionModal';
import AgentConfigModal from '@/components/agents/AgentConfigModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

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
  follow_up_enabled: boolean;
  voicemail_enabled: boolean;
  agent_templates: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
  } | null;
}

interface FollowUpStat {
  status: string;
  agent_run_id: string | null;
}

interface VoicemailStat {
  message_left: boolean;
  agent_run_id: string | null;
}

interface CampaignsOverviewProps {
  campaigns: Campaign[];
  companyId: string;
  followUpStats: FollowUpStat[];
  voicemailStats: VoicemailStat[];
  agentTemplates: AgentTemplate[];
  company: Company;
  companySettings?: any;
}

type FilterStatus = 'all' | 'active' | 'completed' | 'paused' | 'failed';

export default function CampaignsOverview({
  campaigns,
  companyId,
  followUpStats,
  voicemailStats,
  agentTemplates,
  company,
  companySettings,
}: CampaignsOverviewProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowAgentSelection(false);
    setShowConfigModal(true);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'running' || c.status === 'active').length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const totalCalls = campaigns.reduce((sum, c) => sum + c.completed_calls, 0);
    const successfulCalls = campaigns.reduce((sum, c) => sum + c.successful_calls, 0);
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    const pendingFollowUps = followUpStats.filter(f => f.status === 'pending').length;
    const completedFollowUps = followUpStats.filter(f => f.status === 'completed').length;
    const voicemailsLeft = voicemailStats.filter(v => v.message_left).length;

    return {
      active,
      completed,
      totalCalls,
      successRate: successRate.toFixed(1),
      pendingFollowUps,
      completedFollowUps,
      voicemailsLeft,
    };
  }, [campaigns, followUpStats, voicemailStats]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        filtered = filtered.filter(c => c.status === 'running' || c.status === 'active');
      } else {
        filtered = filtered.filter(c => c.status === filterStatus);
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.agent_templates?.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [campaigns, filterStatus, searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; bgColor: string }> = {
      running: { color: 'text-emerald-700', text: 'Running', bgColor: 'bg-emerald-50 border-emerald-200' },
      active: { color: 'text-emerald-700', text: 'Active', bgColor: 'bg-emerald-50 border-emerald-200' },
      completed: { color: 'text-blue-700', text: 'Completed', bgColor: 'bg-blue-50 border-blue-200' },
      paused: { color: 'text-amber-700', text: 'Paused', bgColor: 'bg-amber-50 border-amber-200' },
      failed: { color: 'text-red-700', text: 'Failed', bgColor: 'bg-red-50 border-red-200' },
      draft: { color: 'text-slate-700', text: 'Draft', bgColor: 'bg-slate-50 border-slate-200' },
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Campaigns' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-600 mt-1">Track and manage your AI calling campaigns</p>
        </div>
        <button
          onClick={() => setShowAgentSelection(true)}
          className="btn-primary"
        >
          + New Campaign
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Active</span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
          <div className="text-xs text-slate-500 mt-1">Running campaigns</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Completed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.completed}</div>
          <div className="text-xs text-slate-500 mt-1">Total finished</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.successRate}%</div>
          <div className="text-xs text-slate-500 mt-1">Across {stats.totalCalls} calls</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Follow-ups</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.pendingFollowUps}</div>
          <div className="text-xs text-slate-500 mt-1">Pending · {stats.completedFollowUps} done</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'completed', 'paused', 'failed'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterStatus === status
                    ? 'gradient-bg text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No campaigns found</h3>
            <p className="text-slate-600 mb-6">
              {searchQuery || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Create your first campaign to get started'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Link
                href="/agents"
                className="btn-primary"
              >
                + Create Campaign
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Campaign</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Agent</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Progress</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Success Rate</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Features</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => {
                  const progress = campaign.total_contacts > 0
                    ? (campaign.completed_calls / campaign.total_contacts) * 100
                    : 0;
                  const successRate = campaign.completed_calls > 0
                    ? (campaign.successful_calls / campaign.completed_calls) * 100
                    : 0;

                  const campaignFollowUps = followUpStats.filter(f => f.agent_run_id === campaign.id);
                  const campaignVoicemails = voicemailStats.filter(v => v.agent_run_id === campaign.id);

                  return (
                    <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/campaigns/${campaign.id}`}>
                      <td className="py-4 px-6">
                        <Link href={`/campaigns/${campaign.id}`} className="font-semibold text-slate-900 hover:text-[var(--color-primary)] transition-colors">{campaign.name}</Link>
                        <div className="text-xs text-slate-500 mt-1">
                          {campaign.total_contacts} contacts
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-slate-900">
                          {campaign.agent_templates?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(campaign.status)}</td>
                      <td className="py-4 px-6">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">{Math.round(progress)}%</span>
                            <span className="text-slate-500">{campaign.completed_calls}/{campaign.total_contacts}</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full gradient-bg rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-sm font-medium ${
                          successRate >= 70 ? 'text-emerald-600' :
                          successRate >= 40 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          {campaign.follow_up_enabled && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              {campaignFollowUps.length}
                            </div>
                          )}
                          {campaign.voicemail_enabled && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 rounded text-xs font-medium text-violet-700">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                              </svg>
                              {campaignVoicemails.filter(v => v.message_left).length}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-slate-500">{formatDate(campaign.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
          companyId={companyId}
          company={company}
          companySettings={companySettings}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedAgent(null);
          }}
        />
      )}
    </div>
  );
}
