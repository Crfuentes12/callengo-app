// components/campaigns/CampaignsOverview.tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { AgentTemplate, Company } from '@/types/supabase';
import AgentSelectionModal from '@/components/agents/AgentSelectionModal';
import AgentConfigModal from '@/components/agents/AgentConfigModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import PageTipCard from '@/components/ui/PageTipCard';
import { campaignEvents } from '@/lib/analytics';
import { phCampaignEvents } from '@/lib/posthog';

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
  companySettings?: Record<string, unknown>;
  totalContactCount: number;
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
  totalContactCount,
}: CampaignsOverviewProps) {
  const { t } = useTranslation();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentSelection, setShowAgentSelection] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showNoContactsModal, setShowNoContactsModal] = useState(false);

  const handleAgentSelect = (agent: AgentTemplate) => {
    campaignEvents.newCampaignClicked();
    phCampaignEvents.newCampaignClicked();
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
      running: { color: 'text-emerald-700', text: t.campaigns.running, bgColor: 'bg-emerald-50 border-emerald-200' },
      active: { color: 'text-emerald-700', text: t.campaigns.running, bgColor: 'bg-emerald-50 border-emerald-200' },
      completed: { color: 'text-blue-700', text: t.campaigns.completed, bgColor: 'bg-blue-50 border-blue-200' },
      paused: { color: 'text-amber-700', text: t.campaigns.paused, bgColor: 'bg-amber-50 border-amber-200' },
      failed: { color: 'text-red-700', text: t.calls.failed, bgColor: 'bg-red-50 border-red-200' },
      draft: { color: 'text-[var(--color-neutral-700)]', text: t.campaigns.draft, bgColor: 'bg-[var(--color-neutral-50)] border-[var(--border-default)]' },
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
      <Breadcrumbs items={[{ label: t.campaigns.title }]} />

      {/* Campaigns Tip Card */}
      <PageTipCard
        title="Getting started with Campaigns"
        settingKey="tour_campaigns_seen"
        companyId={companyId}
        tips={[
          { icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', label: 'Create a campaign', desc: 'Select an AI agent, add contacts, and launch outbound calls in minutes' },
          { icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Schedule calls', desc: 'Set specific days and times, or let campaigns run continuously' },
          { icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', label: 'Monitor results', desc: 'Track answer rates, sentiment, and outcomes in real time' },
          { icon: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z', label: 'Clone campaigns', desc: 'Duplicate successful campaigns to reuse configurations instantly' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">{t.campaigns.title}</h1>
          <p className="text-[var(--color-neutral-600)] mt-1">Track and manage your AI calling campaigns</p>
        </div>
        <button
          onClick={() => {
            phCampaignEvents.creationFlowStarted();
            setShowAgentSelection(true);
          }}
          className="btn-primary"
        >
          + {t.campaigns.newCampaign}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.dashboard.activeCampaigns}</span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.active}</div>
          <div className="text-xs text-[var(--color-neutral-500)] mt-1">{t.campaigns.running}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.campaigns.completed}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.completed}</div>
          <div className="text-xs text-[var(--color-neutral-500)] mt-1">{t.campaigns.completed}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.campaigns.successRate}</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.successRate}%</div>
          <div className="text-xs text-[var(--color-neutral-500)] mt-1">{stats.totalCalls} {t.campaigns.calls}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.followUps.title}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.pendingFollowUps}</div>
          <div className="text-xs text-[var(--color-neutral-500)] mt-1">{t.followUps.pending} · {stats.completedFollowUps} {t.followUps.completed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border-default)] p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'completed', 'paused', 'failed'] as FilterStatus[]).map((status) => {
              const filterLabels: Record<FilterStatus, string> = {
                all: t.common.all,
                active: t.campaigns.running,
                completed: t.campaigns.completed,
                paused: t.campaigns.paused,
                failed: t.calls.failed,
              };
              return (
                <button
                  key={status}
                  onClick={() => { setFilterStatus(status); campaignEvents.filtered('status', status); phCampaignEvents.filtered('status', status); }}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    filterStatus === status
                      ? 'gradient-bg text-white shadow-sm'
                      : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                  }`}
                >
                  {filterLabels[status]}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder={t.campaigns.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[var(--border-strong)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-neutral-400)]"
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
      <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-neutral-100)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-2">{t.campaigns.noCampaigns}</h3>
            <p className="text-[var(--color-neutral-600)] mb-6">
              {searchQuery || filterStatus !== 'all' ? t.common.noResults : t.campaigns.noCampaignsDesc}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Link
                href="/agents"
                className="btn-primary"
              >
                + {t.campaigns.newCampaign}
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.campaignName}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.selectAgent}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.status}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.overview}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.successRate}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.billing.features}</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.campaigns.created}</th>
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
                    <tr key={campaign.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" onClick={() => window.location.href = `/campaigns/${campaign.id}`}>
                      <td className="py-4 px-6">
                        <Link href={`/campaigns/${campaign.id}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors">{campaign.name}</Link>
                        <div className="text-xs text-[var(--color-neutral-500)] mt-1">
                          {campaign.total_contacts} {t.campaigns.contacts}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-[var(--color-ink)]">
                          {campaign.agent_templates?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(campaign.status)}</td>
                      <td className="py-4 px-6">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--color-neutral-600)] font-medium">{Math.round(progress)}%</span>
                            <span className="text-[var(--color-neutral-500)]">{campaign.completed_calls}/{campaign.total_contacts}</span>
                          </div>
                          <div className="h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden">
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
                        <span className="text-xs text-[var(--color-neutral-500)]">{formatDate(campaign.created_at)}</span>
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
          onClose={() => {
            phCampaignEvents.creationFlowAbandoned('agent_selection');
            setShowAgentSelection(false);
          }}
        />
      )}

      {/* Agent Config Modal */}
      {showConfigModal && selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          companyId={companyId}
          company={company}
          companySettings={companySettings}
          totalContactCount={totalContactCount}
          onClose={() => {
            phCampaignEvents.creationFlowAbandoned('agent_config');
            setShowConfigModal(false);
            setSelectedAgent(null);
          }}
        />
      )}

      {/* No Contacts Modal */}
      {showNoContactsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border-default)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-default)] gradient-bg-subtle">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-ink)]">Add contacts first</h2>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">You need contacts before launching a campaign</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                Campaigns need a contact list to call. Add contacts manually, import a CSV, or sync from your CRM — then come back to launch your campaign.
              </p>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink)]">Add manually</p>
                    <p className="text-[11px] text-[var(--color-neutral-500)]">Enter contacts one by one</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink)]">Import CSV or Excel</p>
                    <p className="text-[11px] text-[var(--color-neutral-500)]">Upload a spreadsheet with your contacts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink)]">Sync from CRM</p>
                    <p className="text-[11px] text-[var(--color-neutral-500)]">HubSpot, Salesforce, Pipedrive, and more</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowNoContactsModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-lg hover:bg-[var(--surface-hover)] font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <a
                href="/contacts"
                className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-lg font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Go to Contacts
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
