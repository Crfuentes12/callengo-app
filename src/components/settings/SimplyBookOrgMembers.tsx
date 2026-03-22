// components/settings/SimplyBookOrgMembers.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SimplyBookOrgMembersProps {
  companyId: string;
  planSlug: string;
  sbConnected: boolean;
}

interface ProviderMember {
  sb_provider_id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_visible: boolean;
  services: number[];
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

export default function SimplyBookOrgMembers({ companyId, planSlug: _planSlug, sbConnected }: SimplyBookOrgMembersProps) {
  const [providers, setProviders] = useState<ProviderMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!sbConnected || !expanded) return;

    const fetchProviders = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/integrations/simplybook/providers');
        const data = await res.json();
        if (res.ok) {
          setProviders(data.providers || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [sbConnected, expanded, companyId]);

  if (!sbConnected) return null;

  return (
    <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--color-neutral-50)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Small brand logo */}
            <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-6 h-6 rounded" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">SimplyBook.me Providers</h3>
            <p className="text-xs text-[var(--color-neutral-500)]">Staff and service providers from your booking system</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--color-neutral-400)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {loading ? (
            <div className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-neutral-100)]" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-[var(--color-neutral-100)] rounded" />
                      <div className="h-3 w-48 bg-[var(--color-neutral-100)] rounded mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : providers.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--color-neutral-400)]">
              No providers found in your SimplyBook.me account
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {providers.map((provider) => (
                <div key={provider.sb_provider_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold text-sm">
                      {provider.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">{provider.name}</p>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-neutral-500)]">
                        {provider.email && <span>{provider.email}</span>}
                        {provider.phone && <span>· {provider.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!provider.is_active && (
                      <span className="px-2 py-0.5 bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] rounded-full text-xs">Inactive</span>
                    )}
                    {provider.already_in_callengo ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                        In Callengo
                      </span>
                    ) : provider.email ? (
                      <Link
                        href={`/team?invite=${encodeURIComponent(provider.email)}`}
                        className="px-3 py-1 bg-sky-50 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-100 transition-colors"
                      >
                        Invite
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
