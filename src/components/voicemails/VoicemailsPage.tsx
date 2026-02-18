// components/voicemails/VoicemailsPage.tsx
'use client';

import { useState, useMemo } from 'react';

interface VoicemailLog {
  id: string;
  company_id: string;
  call_id: string;
  agent_run_id: string | null;
  contact_id: string | null;
  detected_at: string;
  confidence_score: number | null;
  detection_method: string | null;
  message_left: boolean;
  message_text: string | null;
  message_duration: number | null;
  message_audio_url: string | null;
  follow_up_scheduled: boolean;
  follow_up_id: string | null;
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

interface VoicemailsPageProps {
  voicemails: VoicemailLog[];
}

export default function VoicemailsPage({ voicemails }: VoicemailsPageProps) {
  const [filter, setFilter] = useState<'all' | 'left' | 'detected'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = voicemails;
    if (filter === 'left') result = result.filter(v => v.message_left);
    if (filter === 'detected') result = result.filter(v => !v.message_left);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.contacts?.contact_name?.toLowerCase().includes(q) ||
        v.contacts?.company_name?.toLowerCase().includes(q) ||
        v.contacts?.phone_number?.includes(q) ||
        v.message_text?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [voicemails, filter, search]);

  const stats = useMemo(() => ({
    total: voicemails.length,
    messagesLeft: voicemails.filter(v => v.message_left).length,
    followUpsScheduled: voicemails.filter(v => v.follow_up_scheduled).length,
    avgConfidence: voicemails.length > 0
      ? Math.round(voicemails.reduce((sum, v) => sum + (v.confidence_score || 0), 0) / voicemails.length * 100)
      : 0,
  }), [voicemails]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Voicemails</h1>
        <p className="text-slate-600 mt-1">Track voicemail detections and messages left by your AI agents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Voicemails</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Messages Left</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.messagesLeft}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Follow-ups Scheduled</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.followUpsScheduled}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Avg Detection</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.avgConfidence}%</div>
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
            placeholder="Search by contact, company, or message..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {(['all', 'left', 'detected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'all' ? 'All' : f === 'left' ? 'Message Left' : 'Detected Only'}
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
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Duration</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Follow-up</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase">Detected</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(vm => (
                  <tr key={vm.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6">
                      <div>
                        <span className="text-sm font-medium text-slate-900">
                          {vm.contacts?.contact_name || vm.contacts?.company_name || 'Unknown'}
                        </span>
                        {vm.contacts?.phone_number && (
                          <p className="text-xs text-slate-500">{vm.contacts.phone_number}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600">{vm.agent_runs?.name || '—'}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        vm.message_left
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {vm.message_left ? 'Message Left' : 'Detected'}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-slate-600">
                        {vm.message_duration ? `${Math.floor(vm.message_duration / 60)}:${(vm.message_duration % 60).toString().padStart(2, '0')}` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      {vm.follow_up_scheduled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700">
                          Scheduled
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-xs text-slate-500">
                        {new Date(vm.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-900">No voicemails found</p>
                      <p className="text-xs text-slate-500 mt-1">Voicemails will appear here when detected during calls</p>
                    </div>
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
