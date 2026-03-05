// components/dashboard/QuickActions.tsx
'use client';

import { useTranslation } from '@/i18n';

interface QuickActionsProps {
  onStartCampaign: () => void;
}

export default function QuickActions({ onStartCampaign }: QuickActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <a
        href="/contacts"
        className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-[var(--color-primary-200)] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">
              {t.contacts.importContacts}
            </h4>
            <p className="text-sm text-slate-500 mt-0.5">{t.dashboard.addContacts}</p>
          </div>
        </div>
      </a>

      <button
        onClick={onStartCampaign}
        className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-emerald-200 transition-all text-left w-full"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
              {t.dashboard.newCampaign}
            </h4>
            <p className="text-sm text-slate-500 mt-0.5">{t.agents.subtitle}</p>
          </div>
        </div>
      </button>

      <a
        href="/settings"
        className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-violet-200 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">
              {t.nav.settings}
            </h4>
            <p className="text-sm text-slate-500 mt-0.5">{t.settings.title}</p>
          </div>
        </div>
      </a>

      <a
        href="https://calengo.com/resources/help-center"
        target="_blank"
        rel="noopener noreferrer"
        className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
              {t.agents.support}
            </h4>
            <p className="text-sm text-slate-500 mt-0.5">{t.common.info}</p>
          </div>
        </div>
      </a>
    </div>
  );
}
