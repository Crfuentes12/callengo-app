// components/calls/CallsHistory.tsx
'use client';

import { useState, useMemo } from 'react';
import { formatDuration } from '@/lib/call-agent-utils';
import CallDetailModal from './CallDetailModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import PageTipCard from '@/components/ui/PageTipCard';
import { useTranslation } from '@/i18n';

interface CallLogWithContact {
  id: string;
  company_id: string;
  contact_id: string | null;
  agent_template_id: string | null;
  call_id: string;
  status: string | null;
  completed: boolean;
  call_length: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  analysis: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  contacts: {
    company_name: string;
    contact_name: string | null;
    phone_number: string;
  } | null;
}

interface AgentTemplate {
  id: string;
  name: string;
}

interface CallsHistoryProps {
  callLogs: CallLogWithContact[];
  agentTemplates: AgentTemplate[];
  companyId?: string;
}

export default function CallsHistory({ callLogs, agentTemplates, companyId }: CallsHistoryProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [answeredByFilter, setAnsweredByFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<CallLogWithContact | null>(null);
  const itemsPerPage = 25;

  // Filter calls
  const filteredCalls = useMemo(() => {
    return callLogs.filter(call => {
      const matchesSearch =
        call.call_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.contacts?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.contacts?.phone_number.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
      const matchesAgent = agentFilter === 'all' || call.agent_template_id === agentFilter;
      const matchesAnsweredBy = answeredByFilter === 'all' || call.answered_by === answeredByFilter;

      return matchesSearch && matchesStatus && matchesAgent && matchesAnsweredBy;
    });
  }, [callLogs, searchTerm, statusFilter, agentFilter, answeredByFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);
  const paginatedCalls = filteredCalls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = useMemo(() => {
    const total = callLogs.length;
    const completed = callLogs.filter(c => c.completed).length;
    const successful = callLogs.filter(c => c.status === 'completed').length;
    const failed = callLogs.filter(c => c.status === 'failed' || !c.completed).length;
    const totalDuration = callLogs.reduce((sum, c) => sum + (c.call_length || 0), 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    return { total, completed, successful, failed, avgDuration };
  }, [callLogs]);

  const getStatusStyles = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'no_answer':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)] border-[var(--border-default)]';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAgentFilter('all');
    setAnsweredByFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: t.calls.title }]} />

      {/* Calls Tip Card */}
      {companyId && (
        <PageTipCard
          title="Getting started with Call History"
          settingKey="tour_calls_seen"
          companyId={companyId}
          tips={[
            { icon: 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z', label: 'Listen to recordings', desc: "Replay any call to review your agent's performance" },
            { icon: 'M3.75 9h16.5m-16.5 6.75h16.5', label: 'Read transcripts', desc: 'Full AI-generated transcripts with timestamps for every call' },
            { icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', label: 'AI analysis', desc: 'Sentiment, intent, and outcome analysis on every completed call' },
            { icon: 'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z', label: 'Filter by outcome', desc: 'Sort calls by answered, voicemail, no-answer, or failed' },
            { icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3', label: 'Export data', desc: 'Download call logs and transcripts for your CRM or reports' },
          ]}
        />
      )}

      {/* Section Header */}
      <div className="gradient-bg-subtle rounded-2xl p-10 shadow-sm border border-[var(--border-default)]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-[var(--color-ink)]">
              {t.calls.title}
            </h2>
            <p className="text-base text-[var(--color-neutral-500)] font-medium">
              {t.calls.summary}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] uppercase font-semibold">{t.common.total} {t.calls.title}</span>
            </div>
            <span className="text-3xl text-[var(--color-ink)] font-bold">{stats.total.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] uppercase font-semibold">{t.calls.completed}</span>
            </div>
            <span className="text-3xl text-[var(--color-ink)] font-bold">{stats.successful.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] uppercase font-semibold">{t.calls.failed}</span>
            </div>
            <span className="text-3xl text-[var(--color-ink)] font-bold">{stats.failed.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-[var(--color-neutral-500)] uppercase font-semibold">{t.calls.duration}</span>
            </div>
            <span className="text-3xl text-[var(--color-ink)] font-bold">{formatDuration(stats.avgDuration)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[var(--border-default)]/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t.calls.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-[var(--border-default)] rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-ink)] placeholder-[var(--color-neutral-400)] font-medium"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-[var(--border-default)] rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-neutral-700)] cursor-pointer font-medium"
            >
              <option value="all">{t.common.filter} {t.calls.status}</option>
              <option value="completed">{t.calls.completed}</option>
              <option value="in_progress">{t.calls.inProgress}</option>
              <option value="failed">{t.calls.failed}</option>
              <option value="no_answer">{t.calls.noAnswer}</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-4 py-2.5 border border-[var(--border-default)] rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-neutral-700)] cursor-pointer font-medium"
            >
              <option value="all">All Agents</option>
              {agentTemplates.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>

            <select
              value={answeredByFilter}
              onChange={(e) => setAnsweredByFilter(e.target.value)}
              className="px-4 py-2.5 border border-[var(--border-default)] rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-neutral-700)] cursor-pointer font-medium"
            >
              <option value="all">All Types</option>
              <option value="human">Human</option>
              <option value="voicemail">{t.calls.voicemail}</option>
            </select>

            <button
              onClick={resetFilters}
              className="px-4 py-2.5 border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-xl hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-all flex items-center gap-2 font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t.common.refresh}
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-neutral-600)] font-medium">
            Showing <span className="font-bold text-[var(--color-ink)]">{filteredCalls.length}</span> of <span className="font-bold text-[var(--color-ink)]">{callLogs.length}</span> calls
          </p>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-2xl border border-[var(--border-default)]/80 overflow-hidden shadow-sm">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--color-neutral-100)] to-[var(--color-neutral-200)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-[var(--color-ink)] font-semibold text-lg mb-2">{t.calls.noCalls}</p>
            <p className="text-sm text-[var(--color-neutral-500)]">{t.calls.noCallsDesc}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      Call ID
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.calls.contact}
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.calls.status}
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.calls.duration}
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.calls.voicemail}
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.calls.date}
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {paginatedCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-[var(--surface-hover)] transition-colors group cursor-pointer" onClick={() => setSelectedCall(call)}>
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-[var(--color-ink)] font-mono">
                          {call.call_id.substring(0, 16)}...
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-ink)]">
                            {call.contacts?.company_name || 'Unknown'}
                          </p>
                          {call.contacts?.contact_name && (
                            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                              {call.contacts.contact_name}
                            </p>
                          )}
                          <p className="text-xs text-[var(--color-neutral-400)] mt-0.5 font-mono">
                            {call.contacts?.phone_number}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${getStatusStyles(call.status)}`}>
                          {call.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-[var(--color-neutral-700)]">
                          {formatDuration(call.call_length)}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          call.answered_by === 'human'
                            ? 'bg-emerald-100 text-emerald-700'
                            : call.answered_by === 'voicemail'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                        }`}>
                          {call.answered_by || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-[var(--color-neutral-500)] font-medium">
                          {new Date(call.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {call.recording_url && (
                            <a
                              href={call.recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-[var(--color-primary)] hover:bg-[var(--surface-hover)] transition-all"
                              title={t.calls.playRecording}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </a>
                          )}
                          {call.transcript && (
                            <button
                              className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 transition-all"
                              title={t.calls.viewTranscript}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-[var(--color-neutral-50)] border-t border-[var(--border-default)] flex items-center justify-between">
                <p className="text-sm text-[var(--color-neutral-600)] font-medium">
                  {t.common.page} <span className="font-bold text-[var(--color-ink)]">{currentPage}</span> {t.common.of} <span className="font-bold text-[var(--color-ink)]">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-xl hover:bg-white hover:border-[var(--border-strong)] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {t.common.previous}
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-primary px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {t.common.next}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal call={{...selectedCall, analysis: (selectedCall.analysis || {}) as Record<string, unknown>, metadata: (selectedCall.metadata || {}) as Record<string, string>}} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}
