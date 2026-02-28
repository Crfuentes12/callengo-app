// components/contacts/PipedriveContactsBanner.tsx
'use client';

import Link from 'next/link';

function PipedriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5v-3.07c-1.62-.27-3-1.4-3.47-3.03-.07-.24-.03-.5.11-.71.14-.21.37-.34.63-.34h1.47c.3 0 .56.18.67.46.27.67.92 1.14 1.67 1.14h1.84c1.01 0 1.84-.83 1.84-1.84 0-.88-.62-1.63-1.48-1.81l-3.38-.68c-1.72-.34-2.98-1.86-2.98-3.61 0-2.04 1.66-3.7 3.7-3.7h.38V3.5c0-.28.22-.5.5-.5s.5.22.5.5v2.81c1.62.27 3 1.4 3.47 3.03.07.24.03.5-.11.71-.14.21-.37.34-.63.34h-1.47c-.3 0-.56-.18-.67-.46-.27-.67-.92-1.14-1.67-1.14H10.3c-1.01 0-1.84.83-1.84 1.84 0 .88.62 1.63 1.48 1.81l3.38.68c1.72.34 2.98 1.86 2.98 3.61 0 2.04-1.66 3.7-3.7 3.7H12.22v2.81c0 .28-.22.5-.5.5s-.5-.22-.5-.5z" />
    </svg>
  );
}

interface PipedriveContactsBannerProps {
  planSlug: string;
  hasPipedriveAccess: boolean;
  pdConnected: boolean;
}

export default function PipedriveContactsBanner({
  planSlug,
  hasPipedriveAccess,
  pdConnected,
}: PipedriveContactsBannerProps) {
  // Connected: show link to Pipedrive contacts sub-page
  if (hasPipedriveAccess && pdConnected) {
    return (
      <div className="mb-4 bg-gradient-to-r from-emerald-50 to-[var(--color-primary-50)] rounded-xl border border-emerald-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <PipedriveIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Pipedrive Connected</p>
            <p className="text-xs text-slate-500">View and sync your Pipedrive contacts</p>
          </div>
        </div>
        <Link
          href="/contacts/pipedrive"
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-2"
        >
          <PipedriveIcon className="w-3.5 h-3.5" />
          Pipedrive Contacts
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    );
  }

  // Has access but not connected: prompt to connect
  if (hasPipedriveAccess && !pdConnected) {
    return (
      <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PipedriveIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Import from Pipedrive</p>
            <p className="text-xs text-slate-500">Connect your Pipedrive account to import contacts</p>
          </div>
        </div>
        <Link
          href="/api/integrations/pipedrive/connect?return_to=/contacts/pipedrive"
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <PipedriveIcon className="w-3.5 h-3.5" />
          Connect Pipedrive
        </Link>
      </div>
    );
  }

  // No access: show upgrade CTA
  return (
    <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
          <PipedriveIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Pipedrive CRM Integration</p>
          <p className="text-xs text-slate-500">
            Import contacts from Pipedrive. Available on Business plan and above.
          </p>
        </div>
      </div>
      <Link
        href="/settings?tab=billing"
        className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 transition-all"
      >
        Upgrade to Business
      </Link>
    </div>
  );
}
