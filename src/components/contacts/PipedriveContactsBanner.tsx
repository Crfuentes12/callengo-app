// components/contacts/PipedriveContactsBanner.tsx
'use client';

import Link from 'next/link';

function PipedriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" />
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
      <div className="mb-4 bg-gradient-to-r from-slate-50 to-[var(--color-primary-50)] rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-black flex items-center justify-center">
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
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-black flex items-center justify-center">
            <PipedriveIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Sync with Pipedrive</p>
            <p className="text-xs text-slate-500">Connect your Pipedrive account to sync contacts</p>
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
            Sync contacts with Pipedrive. Available on Business plan and above.
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
