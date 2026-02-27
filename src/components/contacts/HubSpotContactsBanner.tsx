// components/contacts/HubSpotContactsBanner.tsx
'use client';

import Link from 'next/link';
import { FaHubspot } from 'react-icons/fa';

interface HubSpotContactsBannerProps {
  planSlug: string;
  hasHubSpotAccess: boolean;
  hsConnected: boolean;
}

export default function HubSpotContactsBanner({
  planSlug,
  hasHubSpotAccess,
  hsConnected,
}: HubSpotContactsBannerProps) {
  // Connected: show link to HubSpot contacts sub-page
  if (hasHubSpotAccess && hsConnected) {
    return (
      <div className="mb-4 bg-gradient-to-r from-orange-50 to-[var(--color-primary-50)] rounded-xl border border-orange-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-[#FF7A59] flex items-center justify-center">
            <FaHubspot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">HubSpot Connected</p>
            <p className="text-xs text-slate-500">View and sync your HubSpot contacts</p>
          </div>
        </div>
        <Link
          href="/contacts/hubspot"
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-2"
        >
          <FaHubspot className="w-3.5 h-3.5" />
          HubSpot Contacts
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    );
  }

  // Has access but not connected: prompt to connect
  if (hasHubSpotAccess && !hsConnected) {
    return (
      <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#FF7A59] flex items-center justify-center">
            <FaHubspot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Import from HubSpot</p>
            <p className="text-xs text-slate-500">Connect your HubSpot account to import contacts</p>
          </div>
        </div>
        <Link
          href="/api/integrations/hubspot/connect?return_to=/contacts/hubspot"
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <FaHubspot className="w-3.5 h-3.5" />
          Connect HubSpot
        </Link>
      </div>
    );
  }

  // No access: show upgrade CTA
  return (
    <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
          <FaHubspot className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">HubSpot CRM Integration</p>
          <p className="text-xs text-slate-500">
            Import contacts from HubSpot. Available on Business plan and above.
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
