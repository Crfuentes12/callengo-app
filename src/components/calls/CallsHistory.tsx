// components/calls/CallsHistory.tsx
'use client';

import { useState, useMemo } from 'react';
import { formatDuration } from '@/lib/call-agent-utils';

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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-400"></div>
            </div>
            <div>
              <h2 className="text-5xl font-black text-white uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
                Call History
              </h2>
              <p className="text-lg text-slate-400 font-medium">
                Complete record of all AI calling activity
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Total Calls</span>
              </div>
              <span className="text-3xl text-white font-black">{stats.total.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Successful</span>
              </div>
              <span className="text-3xl text-white font-black">{stats.successful.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Failed</span>
              </div>
              <span className="text-3xl text-white font-black">{stats.failed.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-400 uppercase font-bold">Avg Duration</span>
              </div>
              <span className="text-3xl text-white font-black">{formatDuration(stats.avgDuration)}</span>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl"></div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 p-6 shadow-sm">
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
                className="w-full pl-11 pr-4 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 cursor-pointer font-medium"
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
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Agents</option>
              {agentTemplates.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>

            <select
              value={answeredByFilter}
              onChange={(e) => setAnsweredByFilter(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Types</option>
              <option value="human">Human</option>
              <option value="voicemail">Voicemail</option>
            </select>

            <button
              onClick={resetFilters}
              className="px-4 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-bold"
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
            Showing <span className="font-black text-slate-900">{filteredCalls.length}</span> of <span className="font-black text-slate-900">{callLogs.length}</span> calls
          </p>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-slate-900 font-bold text-lg mb-2">No calls found</p>
            <p className="text-sm text-slate-500">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Call ID
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Answered By
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-indigo-50/50 transition-colors group">
                      <td className="py-4 px-6">
                        <p className="text-sm font-bold text-slate-900 font-mono">
                          {call.call_id.substring(0, 16)}...
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
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
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${getStatusStyles(call.status)}`}>
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
                              className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all"
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
              <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600 font-medium">
                  Page <span className="font-black text-slate-900">{currentPage}</span> of <span className="font-black text-slate-900">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-white hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
