// components/calls/CallsHistory.tsx
'use client';

import { useState, useMemo } from 'react';
import { formatDuration } from '@/lib/call-agent-utils';
import CallDetailModal from './CallDetailModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

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
  analysis: any;
  error_message: string | null;
  metadata: any;
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
}

export default function CallsHistory({ callLogs, agentTemplates }: CallsHistoryProps) {
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
        return 'bg-slate-50 text-slate-600 border-slate-200';
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
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Call History' }]} />

      {/* Section Header */}
      <div className="gradient-bg-subtle rounded-2xl p-10 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Call History
            </h2>
            <p className="text-base text-slate-500 font-medium">
              Complete record of all AI calling activity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Calls</span>
            </div>
            <span className="text-3xl text-slate-900 font-bold">{stats.total.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Successful</span>
            </div>
            <span className="text-3xl text-slate-900 font-bold">{stats.successful.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Failed</span>
            </div>
            <span className="text-3xl text-slate-900 font-bold">{stats.failed.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Avg Duration</span>
            </div>
            <span className="text-3xl text-slate-900 font-bold">{formatDuration(stats.avgDuration)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by call ID, company, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-slate-900 placeholder-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="no_answer">No Answer</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Agents</option>
              {agentTemplates.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>

            <select
              value={answeredByFilter}
              onChange={(e) => setAnsweredByFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Types</option>
              <option value="human">Human</option>
              <option value="voicemail">Voicemail</option>
            </select>

            <button
              onClick={resetFilters}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-600 font-medium">
            Showing <span className="font-bold text-slate-900">{filteredCalls.length}</span> of <span className="font-bold text-slate-900">{callLogs.length}</span> calls
          </p>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg mb-2">No calls found</p>
            <p className="text-sm text-slate-500">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Call ID
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Answered By
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedCall(call)}>
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-slate-900 font-mono">
                          {call.call_id.substring(0, 16)}...
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {call.contacts?.company_name || 'Unknown'}
                          </p>
                          {call.contacts?.contact_name && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {call.contacts.contact_name}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">
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
                              className="p-2 rounded-lg text-[var(--color-primary)] hover:bg-slate-50 transition-all"
                              title="Play Recording"
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
                              title="View Transcript"
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
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600 font-medium">
                  Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-white hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-primary px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}
