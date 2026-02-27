// components/contacts/SalesforceContactsBanner.tsx
'use client';

import Link from 'next/link';
import { FaSalesforce } from 'react-icons/fa';

interface SalesforceContactsBannerProps {
  planSlug: string;
  hasSalesforceAccess: boolean;
  sfConnected: boolean;
}

export default function SalesforceContactsBanner({
  planSlug,
  hasSalesforceAccess,
  sfConnected,
}: SalesforceContactsBannerProps) {
  // Connected: show link to Salesforce contacts sub-page
  if (hasSalesforceAccess && sfConnected) {
    return (
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-[var(--color-primary-50)] rounded-xl border border-blue-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#00A1E0] flex items-center justify-center">
            <FaSalesforce className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Salesforce Connected</p>
            <p className="text-xs text-slate-500">View and sync your Salesforce contacts and leads</p>
          </div>
        </div>
        <Link
          href="/contacts/salesforce"
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-2"
        >
          <FaSalesforce className="w-3.5 h-3.5" />
          Salesforce Contacts
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    );
  }

  // Has access but not connected: prompt to connect
  if (hasSalesforceAccess && !sfConnected) {
    return (
      <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#00A1E0] flex items-center justify-center">
            <FaSalesforce className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Import from Salesforce</p>
            <p className="text-xs text-slate-500">Connect your Salesforce account to import contacts and leads</p>
          </div>
        </div>
        <Link
          href="/api/integrations/salesforce/connect?return_to=/contacts/salesforce"
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <FaSalesforce className="w-3.5 h-3.5" />
          Connect Salesforce
        </Link>
      </div>
    );
  }

  // No access: show upgrade CTA
  return (
    <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
          <FaSalesforce className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Salesforce CRM Integration</p>
          <p className="text-xs text-slate-500">
            Import contacts and leads from Salesforce. Available on Business plan and above.
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
