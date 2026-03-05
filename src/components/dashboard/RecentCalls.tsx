// components/dashboard/RecentCalls.tsx
'use client';

import { useTranslation } from '@/i18n';
import { formatDuration } from '@/lib/call-agent-utils';

interface CallLog {
  id: string;
  company_id: string;
  contact_id: string | null;
  agent_template_id: string | null;
  call_id: string;
  status: string | null;
  completed: boolean;
  call_length: number | null;
  price: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  analysis: any;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

interface RecentCallsProps {
  recentCalls: CallLog[];
  onCallSelect: (call: CallLog) => void;
  onStartCampaign: () => void;
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'in_progress':
    case 'running':
    case 'active':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'no_answer':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export default function RecentCalls({
  recentCalls,
  onCallSelect,
  onStartCampaign,
}: RecentCallsProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t.dashboard.recentActivity}</h3>
            <p className="text-sm text-slate-500">{recentCalls.length} {t.dashboard.totalCalls.toLowerCase()}</p>
          </div>
        </div>
        <a
          href="/calls"
          className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex items-center gap-1"
        >
          {t.common.viewAll}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {recentCalls.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <p className="text-slate-900 font-semibold text-lg mb-2">{t.calls.noCalls}</p>
          <p className="text-sm text-slate-500 mb-6">{t.calls.noCallsDesc}</p>
          <button
            onClick={onStartCampaign}
            className="btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            {t.dashboard.newCampaign}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.campaigns.callLog}
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.common.status}
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.calls.duration}
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.calls.contact}
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t.common.date}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCalls.slice(0, 8).map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onCallSelect(call)}>
                  <td className="py-4 px-6">
                    <p className="text-sm font-medium text-slate-900 font-mono">
                      {call.call_id.substring(0, 12)}...
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(call.status || 'unknown')}`}>
                      {call.status || t.common.noData}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-slate-700">
                      {formatDuration(call.call_length)}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      call.answered_by === 'human'
                        ? 'bg-emerald-50 text-emerald-700'
                        : call.answered_by === 'voicemail'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 text-slate-600'
                    }`}>
                      {call.answered_by || t.common.noData}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-slate-500">
                      {new Date(call.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
