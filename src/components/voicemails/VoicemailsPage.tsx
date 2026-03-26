// components/voicemails/VoicemailsPage.tsx
'use client';

import { useState, useMemo } from 'react';
import CallDetailModal from '@/components/calls/CallDetailModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import PageTipCard from '@/components/ui/PageTipCard';
import { useTranslation } from '@/i18n';

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
  companyId?: string;
}

export default function VoicemailsPage({ voicemails, companyId }: VoicemailsPageProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'left' | 'detected'>('all');
  const [search, setSearch] = useState('');
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailLog | null>(null);

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
      <Breadcrumbs items={[{ label: t.voicemails.title }]} />

      {/* Voicemails Tip Card */}
      {companyId && (
        <PageTipCard
          title="Getting started with Voicemails"
          settingKey="tour_voicemails_seen"
          companyId={companyId}
          tips={[
            { icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', label: 'Automatic detection', desc: 'The agent detects voicemail and leaves a tailored message automatically' },
            { icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125', label: 'Custom voicemail scripts', desc: 'Per-agent voicemail scripts that match your campaign tone' },
            { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'Follow-up triggers', desc: 'Missed calls and voicemails can auto-trigger a follow-up campaign' },
            { icon: 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z', label: 'Listen & review', desc: 'Replay left voicemails to ensure quality and consistency' },
          ]}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">{t.voicemails.title}</h1>
        <p className="text-[var(--color-neutral-600)] mt-1">{t.voicemails.noVoicemailsDesc}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.common.total} {t.voicemails.title}</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.total}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.voicemails.left}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.messagesLeft}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.voicemails.followUpScheduled}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.followUpsScheduled}</div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">{t.voicemails.detected}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-ink)]">{stats.avgConfidence}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t.common.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--color-ink)] placeholder:text-[var(--color-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex bg-[var(--color-neutral-100)] rounded-lg p-1">
          {(['all', 'left', 'detected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                filter === f
                  ? 'bg-white text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-neutral-600)] hover:text-[var(--color-ink)]'
              }`}
            >
              {f === 'all' ? t.common.filter : f === 'left' ? t.voicemails.left : t.voicemails.detected}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.voicemails.contact}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.followUps.campaign}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.voicemails.status}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.voicemails.duration}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.voicemails.followUpScheduled}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-[var(--color-neutral-600)] uppercase">{t.voicemails.detected}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(vm => (
                  <tr key={vm.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--color-neutral-50)] transition-colors cursor-pointer" onClick={() => setSelectedVoicemail(vm)}>
                    <td className="py-3 px-6">
                      <div>
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          {vm.contacts?.contact_name || vm.contacts?.company_name || 'Unknown'}
                        </span>
                        {vm.contacts?.phone_number && (
                          <p className="text-xs text-[var(--color-neutral-500)]">{vm.contacts.phone_number}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-[var(--color-neutral-600)]">{vm.agent_runs?.name || '—'}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        vm.message_left
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {vm.message_left ? t.voicemails.left : t.voicemails.detected}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-sm text-[var(--color-neutral-600)]">
                        {vm.message_duration ? `${Math.floor(vm.message_duration / 60)}:${(vm.message_duration % 60).toString().padStart(2, '0')}` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      {vm.follow_up_scheduled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700">
                          {t.calendar.scheduled}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-neutral-400)]">{t.voicemails.noFollowUp}</span>
                      )}
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-xs text-[var(--color-neutral-500)]">
                        {new Date(vm.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">{t.voicemails.noVoicemails}</p>
                      <p className="text-xs text-[var(--color-neutral-500)] mt-1">{t.voicemails.noVoicemailsDesc}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Detail Modal (mapped from voicemail data) */}
      {selectedVoicemail && (
        <CallDetailModal
          call={{
            id: selectedVoicemail.id,
            call_id: selectedVoicemail.call_id,
            status: selectedVoicemail.message_left ? 'voicemail' : 'no_answer',
            completed: true,
            call_length: selectedVoicemail.message_duration,
            answered_by: 'voicemail',
            recording_url: null,
            transcript: selectedVoicemail.message_text,
            summary: selectedVoicemail.message_left
              ? `Voicemail was left for ${selectedVoicemail.contacts?.contact_name || selectedVoicemail.contacts?.company_name || 'contact'}. Detection confidence: ${selectedVoicemail.confidence_score ? Math.round(selectedVoicemail.confidence_score * 100) + '%' : 'N/A'}.`
              : `Voicemail was detected but no message was left. Detection method: ${selectedVoicemail.detection_method || 'Unknown'}.`,
            analysis: {},
            error_message: null,
            metadata: {},
            created_at: selectedVoicemail.detected_at,
            voicemail_detected: true,
            voicemail_left: selectedVoicemail.message_left,
            voicemail_message_url: selectedVoicemail.message_audio_url,
            voicemail_duration: selectedVoicemail.message_duration,
            contacts: selectedVoicemail.contacts ? {
              company_name: selectedVoicemail.contacts.company_name || 'Unknown',
              contact_name: selectedVoicemail.contacts.contact_name,
              phone_number: selectedVoicemail.contacts.phone_number,
            } : null,
            agent_runs: selectedVoicemail.agent_runs,
          }}
          onClose={() => setSelectedVoicemail(null)}
        />
      )}
    </div>
  );
}
