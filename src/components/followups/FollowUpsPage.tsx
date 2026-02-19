// components/followups/FollowUpsPage.tsx
'use client';

import { useState, useMemo } from 'react';
import CallDetailModal from '@/components/calls/CallDetailModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

interface FollowUp {
  id: string;
  company_id: string;
  agent_run_id: string;
  contact_id: string;
  original_call_id: string | null;
  attempt_number: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  contacts: {
    company_name: string | null;
    contact_name: string | null;
    phone_number: string;
  } | null;
  agent_runs: {
    name: string;
  } | null;
}

interface FollowUpsPageProps {
  followUps: FollowUp[];
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  scheduled: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
  cancelled: 'bg-slate-50 border-slate-200 text-slate-600',
};

export default function FollowUpsPage({ followUps }: FollowUpsPageProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'scheduled' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);

  const filtered = useMemo(() => {
    let result = followUps;
    if (filter !== 'all') result = result.filter(f => f.status === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.contacts?.contact_name?.toLowerCase().includes(q) ||
        f.contacts?.company_name?.toLowerCase().includes(q) ||
        f.contacts?.phone_number?.includes(q) ||
        f.reason?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [followUps, filter, search]);

  const stats = useMemo(() => ({
    total: followUps.length,
    pending: followUps.filter(f => f.status === 'pending' || f.status === 'scheduled').length,
    completed: followUps.filter(f => f.status === 'completed').length,
    failed: followUps.filter(f => f.status === 'failed').length,
  }), [followUps]);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      if (diffHours > -24) return `${Math.abs(diffHours)}h ago`;
      return `${Math.abs(diffDays)}d ago`;
    }
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Follow-ups' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-slate-600 mt-1">Manage scheduled follow-up calls and retry attempts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Follow-ups</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Completed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.completed}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Failed</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.failed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by contact, company, or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {(['all', 'pending', 'scheduled', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Contact</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Campaign</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Attempt</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Reason</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Next Attempt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(fu => (
                  <tr key={fu.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedFollowUp(fu)}>
                    <td className="py-3 px-6">
                      <div>
                        <span className="text-sm font-medium text-slate-900">
                          {fu.contacts?.contact_name || fu.contacts?.company_name || 'Unknown'}
                        </span>
                        {fu.contacts?.phone_number && (
                          <p className="text-xs text-slate-500">{fu.contacts.phone_number}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600">{fu.agent_runs?.name || '—'}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[fu.status] || statusStyles.pending}`}>
                        {fu.status}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600">{fu.attempt_number}/{fu.max_attempts}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600 truncate max-w-[200px] block">
                        {fu.reason || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <div>
                        <span className="text-sm text-slate-900">{formatRelativeTime(fu.next_attempt_at)}</span>
                        <p className="text-xs text-slate-500">
                          {new Date(fu.next_attempt_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-900">No follow-ups found</p>
                      <p className="text-xs text-slate-500 mt-1">Follow-up calls will appear here when scheduled</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Detail Modal (mapped from follow-up data) */}
      {selectedFollowUp && (
        <CallDetailModal
          call={{
            id: selectedFollowUp.id,
            call_id: selectedFollowUp.original_call_id || selectedFollowUp.id,
            status: selectedFollowUp.status === 'completed' ? 'completed' : selectedFollowUp.status === 'failed' ? 'failed' : 'pending',
            completed: selectedFollowUp.status === 'completed',
            call_length: null,
            answered_by: null,
            recording_url: null,
            transcript: null,
            summary: selectedFollowUp.status === 'pending' || selectedFollowUp.status === 'scheduled'
              ? `Follow-up call scheduled. Attempt ${selectedFollowUp.attempt_number} of ${selectedFollowUp.max_attempts}. Next attempt: ${new Date(selectedFollowUp.next_attempt_at).toLocaleString()}.`
              : selectedFollowUp.status === 'completed'
              ? `Follow-up completed after ${selectedFollowUp.attempt_number} attempt(s).`
              : `Follow-up ${selectedFollowUp.status}. Reason: ${selectedFollowUp.reason || 'No reason provided'}.`,
            analysis: null,
            error_message: null,
            metadata: null,
            created_at: selectedFollowUp.created_at,
            contacts: selectedFollowUp.contacts ? {
              company_name: selectedFollowUp.contacts.company_name || 'Unknown',
              contact_name: selectedFollowUp.contacts.contact_name,
              phone_number: selectedFollowUp.contacts.phone_number,
            } : null,
            agent_runs: selectedFollowUp.agent_runs,
          }}
          onClose={() => setSelectedFollowUp(null)}
        />
      )}
    </div>
  );
}
