// components/campaigns/CampaignDetail.tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CallDetailModal from '@/components/calls/CallDetailModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

interface CallLog {
  id: string;
  status: string | null;
  call_length: number | null;
  answered_by: string | null;
  recording_url: string | null;
  created_at: string;
  completed: boolean;
  voicemail_detected: boolean;
  voicemail_left: boolean;
  contacts: {
    id: string;
    contact_name: string | null;
    company_name: string;
    phone_number: string;
  } | null;
}

interface FollowUp {
  id: string;
  status: string;
  contact_id: string;
  attempt_number: number;
  max_attempts: number;
  next_attempt_at: string;
  created_at: string;
}

interface VoicemailLog {
  id: string;
  message_left: boolean;
  message_duration: number | null;
  detected_at: string;
  contact_id: string | null;
}

interface Campaign {
  id: string;
  company_id: string;
  agent_template_id: string;
  name: string;
  status: string;
  total_contacts: number;
  completed_calls: number;
  successful_calls: number;
  failed_calls: number;
  settings: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  follow_up_enabled: boolean;
  follow_up_max_attempts: number;
  follow_up_interval_hours: number;
  voicemail_enabled: boolean;
  voicemail_detection_enabled: boolean;
  voicemail_message: string | null;
  voicemail_action: string;
  agent_templates: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    category: string | null;
  } | null;
}

interface CampaignDetailProps {
  campaign: Campaign;
  callLogs: CallLog[];
  followUps: FollowUp[];
  voicemailLogs: VoicemailLog[];
}

export default function CampaignDetail({
  campaign,
  callLogs,
  followUps,
  voicemailLogs,
}: CampaignDetailProps) {
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);

  // Computed stats
  const stats = useMemo(() => {
    const progress = campaign.total_contacts > 0
      ? (campaign.completed_calls / campaign.total_contacts) * 100
      : 0;
    const successRate = campaign.completed_calls > 0
      ? (campaign.successful_calls / campaign.completed_calls) * 100
      : 0;

    const totalDuration = callLogs.reduce((sum, log) => sum + (log.call_length || 0), 0);
    const completedCallLogs = callLogs.filter(log => log.completed && log.call_length && log.call_length > 0);
    const avgDuration = completedCallLogs.length > 0
      ? totalDuration / completedCallLogs.length
      : 0;

    const pendingFollowUps = followUps.filter(f => f.status === 'pending').length;
    const voicemailsLeft = voicemailLogs.filter(v => v.message_left).length;

    return {
      progress,
      successRate,
      avgDuration,
      pendingFollowUps,
      voicemailsLeft,
    };
  }, [campaign, callLogs, followUps, voicemailLogs]);

  // Build activity timeline from real data
  const activityTimeline = useMemo(() => {
    const events: { id: string; type: string; title: string; description: string; time: string; icon: string; color: string }[] = [];

    // Campaign created
    events.push({
      id: 'created',
      type: 'created',
      title: 'Campaign Created',
      description: `"${campaign.name}" was created with ${campaign.total_contacts} contacts`,
      time: campaign.created_at,
      icon: 'plus',
      color: 'bg-slate-100 text-slate-600',
    });

    // Campaign started
    if (campaign.started_at) {
      events.push({
        id: 'started',
        type: 'started',
        title: 'Campaign Started',
        description: 'Calling began for all queued contacts',
        time: campaign.started_at,
        icon: 'play',
        color: 'bg-emerald-100 text-emerald-600',
      });
    }

    // Add call events (last 5)
    const recentCalls = callLogs.slice(0, 5);
    recentCalls.forEach((log) => {
      const contactName = log.contacts?.contact_name || log.contacts?.company_name || 'Unknown';
      const isSuccess = log.status === 'completed' || log.completed;

      events.push({
        id: `call-${log.id}`,
        type: 'call',
        title: isSuccess ? 'Call Completed' : `Call ${log.status || 'ended'}`,
        description: `${contactName} - ${log.call_length ? formatDuration(log.call_length) : 'No duration'}`,
        time: log.created_at,
        icon: 'phone',
        color: isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600',
      });
    });

    // Campaign completed
    if (campaign.completed_at) {
      events.push({
        id: 'completed',
        type: 'completed',
        title: 'Campaign Completed',
        description: `Finished with ${campaign.successful_calls} successful calls out of ${campaign.completed_calls}`,
        time: campaign.completed_at,
        icon: 'check',
        color: 'bg-blue-100 text-blue-600',
      });
    }

    // Sort by time descending
    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return events;
  }, [campaign, callLogs]);

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
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.bgColor} ${config.color}`}>
        {(status === 'running' || status === 'active') && (
          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
        )}
        {config.text}
      </span>
    );
  };

  const getCallStatusBadge = (status: string | null, completed: boolean) => {
    if (completed || status === 'completed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
          Completed
        </span>
      );
    }
    if (status === 'failed' || status === 'error') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 border border-red-200 text-red-700">
          Failed
        </span>
      );
    }
    if (status === 'no-answer') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
          No Answer
        </span>
      );
    }
    if (status === 'busy') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
          Busy
        </span>
      );
    }
    if (status === 'voicemail') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 border border-violet-200 text-violet-700">
          Voicemail
        </span>
      );
    }
    if (status === 'in-progress' || status === 'ringing') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700">
        {status || 'Unknown'}
      </span>
    );
  };

  function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatRelativeTime(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  }

  const renderTimelineIcon = (icon: string) => {
    switch (icon) {
      case 'plus':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        );
      case 'play':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        );
      case 'phone':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Campaigns', href: '/campaigns' },
        { label: campaign.name },
      ]} />

      {/* Header Section */}
      <div className="gradient-bg-subtle rounded-2xl p-6 border border-[var(--color-primary-200)]">

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              {campaign.agent_templates && (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center text-xs">
                    {campaign.agent_templates.icon || '🤖'}
                  </div>
                  <span className="font-medium text-slate-700">{campaign.agent_templates.name}</span>
                  {campaign.agent_templates.category && (
                    <span className="text-slate-400">/ {campaign.agent_templates.category}</span>
                  )}
                </div>
              )}
              <span className="text-slate-300">|</span>
              <span>Created {formatDate(campaign.created_at)}</span>
              {campaign.started_at && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>Started {formatDate(campaign.started_at)}</span>
                </>
              )}
            </div>

            {/* Feature Tags */}
            <div className="flex gap-2 mt-3">
              {campaign.follow_up_enabled && (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Follow-ups Enabled
                </div>
              )}
              {campaign.voicemail_enabled && (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 border border-violet-200 rounded-lg text-xs font-medium text-violet-700">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51" />
                  </svg>
                  Voicemail Enabled
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Contacts</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{campaign.total_contacts}</div>
          <div className="text-xs text-slate-500 mt-1">In campaign</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Calls Made</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{campaign.completed_calls}</div>
          <div className="text-xs text-slate-500 mt-1">
            {campaign.successful_calls} successful
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-bold ${
            stats.successRate >= 70 ? 'text-emerald-600' :
            stats.successRate >= 40 ? 'text-amber-600' :
            'text-slate-900'
          }`}>
            {stats.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">Conversion rate</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Failed</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{campaign.failed_calls}</div>
          <div className="text-xs text-slate-500 mt-1">Failed calls</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Avg Duration</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatDuration(stats.avgDuration)}</div>
          <div className="text-xs text-slate-500 mt-1">Per call</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Campaign Progress</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {campaign.completed_calls} of {campaign.total_contacts} contacts called
            </p>
          </div>
          <span className="text-lg font-bold text-slate-900">{Math.round(stats.progress)}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full gradient-bg rounded-full transition-all duration-500"
            style={{ width: `${Math.min(stats.progress, 100)}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Successful: {campaign.successful_calls}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
              Failed: {campaign.failed_calls}
            </span>
            {stats.pendingFollowUps > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                Follow-ups Pending: {stats.pendingFollowUps}
              </span>
            )}
            {stats.voicemailsLeft > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                Voicemails Left: {stats.voicemailsLeft}
              </span>
            )}
          </div>
          <span>
            Remaining: {Math.max(0, campaign.total_contacts - campaign.completed_calls)}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls Table - 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recent Calls</h3>
                <p className="text-xs text-slate-500 mt-0.5">{callLogs.length} call{callLogs.length !== 1 ? 's' : ''} recorded</p>
              </div>
            </div>
          </div>

          {callLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600">No calls have been made yet</p>
              <p className="text-xs text-slate-400 mt-1">Calls will appear here once the campaign starts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Contact</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Phone</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Duration</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {callLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedCallLog(log)}>
                      <td className="py-3 px-6">
                        <div className="font-medium text-sm text-slate-900">
                          {log.contacts?.contact_name || log.contacts?.company_name || 'Unknown'}
                        </div>
                        {log.contacts?.contact_name && log.contacts?.company_name && (
                          <div className="text-xs text-slate-500">{log.contacts.company_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-600 font-mono">
                          {log.contacts?.phone_number || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        {getCallStatusBadge(log.status, log.completed)}
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-sm text-slate-700">
                          {log.call_length ? formatDuration(log.call_length) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-xs text-slate-500">{formatDate(log.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Timeline - 1 column */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Activity Timeline</h3>
            <p className="text-xs text-slate-500 mt-0.5">Recent campaign events</p>
          </div>

          {activityTimeline.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-600">No activity yet</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-0">
                {activityTimeline.map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.color}`}>
                        {renderTimelineIcon(event.icon)}
                      </div>
                      {index < activityTimeline.length - 1 && (
                        <div className="w-px h-full min-h-[32px] bg-slate-200"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-6 ${index === activityTimeline.length - 1 ? 'pb-0' : ''}`}>
                      <p className="text-sm font-medium text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(event.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Detail Modal */}
      {selectedCallLog && (
        <CallDetailModal
          call={{
            id: selectedCallLog.id,
            call_id: selectedCallLog.id,
            status: selectedCallLog.status,
            completed: selectedCallLog.completed,
            call_length: selectedCallLog.call_length,
            answered_by: selectedCallLog.answered_by,
            recording_url: selectedCallLog.recording_url,
            transcript: null,
            summary: null,
            analysis: null,
            error_message: null,
            metadata: null,
            created_at: selectedCallLog.created_at,
            voicemail_detected: selectedCallLog.voicemail_detected,
            voicemail_left: selectedCallLog.voicemail_left,
            contacts: selectedCallLog.contacts ? {
              company_name: selectedCallLog.contacts.company_name,
              contact_name: selectedCallLog.contacts.contact_name,
              phone_number: selectedCallLog.contacts.phone_number,
            } : null,
          }}
          onClose={() => setSelectedCallLog(null)}
        />
      )}
    </div>
  );
}
