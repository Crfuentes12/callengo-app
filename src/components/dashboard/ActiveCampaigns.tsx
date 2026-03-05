// components/dashboard/ActiveCampaigns.tsx
'use client';

import { useTranslation } from '@/i18n';
import { AgentRun } from '@/types/supabase';

interface ActiveCampaignsProps {
  agentRuns: AgentRun[];
  activeCampaigns: number;
  completedCampaigns: number;
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

export default function ActiveCampaigns({
  agentRuns,
  activeCampaigns,
  completedCampaigns,
}: ActiveCampaignsProps) {
  const { t } = useTranslation();

  if (agentRuns.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t.dashboard.recentActivity}</h3>
            <p className="text-sm text-slate-500">{activeCampaigns} {t.agents.active.toLowerCase()}, {completedCampaigns} {t.calls.completed.toLowerCase()}</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {agentRuns.map((run) => {
            const progress = run.total_contacts > 0 ? (run.completed_calls / run.total_contacts) * 100 : 0;
            const successRate = run.completed_calls > 0 ? (run.successful_calls / run.completed_calls) * 100 : 0;

            return (
              <a
                key={run.id}
                href={`/campaigns/${run.id}`}
                className="block p-5 bg-slate-50 rounded-xl border border-slate-200 hover:shadow-sm hover:border-[var(--color-primary-200)] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-slate-900 text-lg">{run.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(run.status)}`}>
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">{t.campaigns.totalContacts}</p>
                        <p className="text-xl font-bold text-slate-900">{run.total_contacts}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">{t.campaigns.completedCalls}</p>
                        <p className="text-xl font-bold text-blue-600">{run.completed_calls}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">{t.campaigns.successfulCalls}</p>
                        <p className="text-xl font-bold text-emerald-600">{run.successful_calls}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">{t.campaigns.overview}</span>
                    <span className="text-xs font-semibold text-slate-900">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-bg rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  {run.completed_calls > 0 && (
                    <p className="text-xs text-emerald-600 font-medium mt-2">
                      {successRate.toFixed(1)}% {t.dashboard.successRate.toLowerCase()}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
