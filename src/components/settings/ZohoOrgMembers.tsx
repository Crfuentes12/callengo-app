// components/settings/ZohoOrgMembers.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ZohoOrgMember {
  zoho_user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  role?: string;
  profile?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

interface ZohoOrgMembersProps {
  companyId: string;
  planSlug: string;
  zohoConnected: boolean;
}

function ZohoLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 450" fill="none">
      <path d="M458.1,353c-7.7,0-15.5-1.6-23-4.9l0,0l-160-71.3c-28.6-12.7-41.5-46.4-28.8-75l71.3-160c12.7-28.6,46.4-41.5,75-28.8l160,71.3c28.6,12.7,41.5,46.4,28.8,75l-71.3,160C500.6,340.5,479.8,353,458.1,353z M448.4,318.1c12.1,5.4,26.3-0.1,31.7-12.1l71.3-160c5.4-12.1-0.1-26.3-12.1-31.7L379.2,43c-12.1-5.4-26.3,0.1-31.7,12.1l-71.3,160c-5.4,12.1,0.1,26.3,12.1,31.7L448.4,318.1z" fill="#089949"/>
      <path d="M960,353.1H784.8c-31.3,0-56.8-25.5-56.8-56.8V121.1c0-31.3,25.5-56.8,56.8-56.8H960c31.3,0,56.8,25.5,56.8,56.8v175.2C1016.8,327.6,991.3,353.1,960,353.1z M784.8,97.1c-13.2,0-24,10.8-24,24v175.2c0,13.2,10.8,24,24,24H960c13.2,0,24-10.8,24-24V121.1c0-13.2-10.8-24-24-24H784.8z" fill="#F9B21D"/>
      <path d="M303.9,153.2L280.3,206c-0.3,0.6-0.6,1.1-0.9,1.6l9.2,56.8c2.1,13.1-6.8,25.4-19.8,27.5l-173,28c-6.3,1-12.7-0.5-17.9-4.2c-5.2-3.7-8.6-9.3-9.6-15.6l-28-173c-1-6.3,0.5-12.7,4.2-17.9c3.7-5.2,9.3-8.6,15.6-9.6l173-28c1.3-0.2,2.6-0.3,3.8-0.3c11.5,0,21.8,8.4,23.7,20.2l9.3,57.2L294.3,94l-1.3-7.7c-5-30.9-34.2-52-65.1-47l-173,28C40,69.6,26.8,77.7,18,90c-8.9,12.3-12.4,27.3-10,42.3l28,173c2.4,15,10.5,28.1,22.8,37C68.5,349.4,80,353,91.9,353c3,0,6.1-0.2,9.2-0.7l173-28c30.9-5,52-34.2,47-65.1L303.9,153.2z" fill="#E42527"/>
      <path d="M511.4,235.8l25.4-56.9l-7.2-52.9c-0.9-6.3,0.8-12.6,4.7-17.7c3.9-5.1,9.5-8.4,15.9-9.2l173.6-23.6c1.1-0.1,2.2-0.2,3.3-0.2c5.2,0,10.2,1.7,14.5,4.9c0.8,0.6,1.5,1.3,2.2,1.9c7.7-8.1,17.8-13.9,29.1-16.4c-3.2-4.4-7-8.3-11.5-11.7c-12.1-9.2-27-13.1-42-11.1L545.6,66.5c-15,2-28.4,9.8-37.5,21.9c-9.2,12.1-13.1,27-11.1,42L511.4,235.8z" fill="#226DB4"/>
      <path d="M806.8,265.1l-22.8-168c-12.8,0.4-23.1,11-23.1,23.9v49.3l13.5,99.2c0.9,6.3-0.8,12.6-4.7,17.7s-9.5,8.4-15.9,9.2l-173.6,23.6c-6.3,0.9-12.6-0.8-17.7-4.7c-5.1-3.9-8.4-9.5-9.2-15.9l-8-58.9l-25.4,56.9l0.9,6.4c2,15,9.8,28.4,21.9,37.5c10,7.6,21.9,11.6,34.3,11.6c2.6,0,5.2-0.2,7.8-0.5L758.2,329c15-2,28.4-9.8,37.5-21.9C804.9,295,808.8,280.1,806.8,265.1z" fill="#226DB4"/>
    </svg>
  );
}

export default function ZohoOrgMembers({
  companyId,
  planSlug,
  zohoConnected,
}: ZohoOrgMembersProps) {
  const [members, setMembers] = useState<ZohoOrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState('');

  const hasZohoAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  const loadMembers = useCallback(async () => {
    if (!zohoConnected) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/zoho/users');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load Zoho org members');
      }
    } catch {
      setError('Failed to load Zoho org members');
    } finally {
      setLoading(false);
    }
  }, [zohoConnected]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async (email: string) => {
    setInvitingEmail(email);
    setInviteSuccess('');
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'member' }),
      });

      if (res.ok) {
        setInviteSuccess(`Invitation sent to ${email}`);
        loadMembers();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to send invitation');
      }
    } catch {
      setError('Failed to send invitation');
    } finally {
      setInvitingEmail(null);
    }
  };

  // Upgrade CTA for plans below business
  if (!hasZohoAccess) {
    return (
      <div className="bg-gradient-to-r from-red-50/50 to-red-100/30 rounded-xl border border-red-200/50 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ZohoLogo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Zoho CRM Members</h3>
            <p className="text-xs text-[var(--color-neutral-500)]">Preview and invite Zoho members to Callengo</p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-neutral-600)] mb-4">
          Connect Zoho CRM on Business plan or higher to preview your organization&apos;s members and invite them directly to Callengo.
        </p>
        <Link
          href="/settings?tab=billing"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-all"
        >
          Upgrade to Business
        </Link>
      </div>
    );
  }

  // Not connected
  if (!zohoConnected) {
    return (
      <div className="bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ZohoLogo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Zoho CRM Members</h3>
            <p className="text-xs text-[var(--color-neutral-500)]">Connect Zoho CRM to see your org members</p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-neutral-600)] mb-4">
          Connect your Zoho CRM account to preview organization members and invite them to your Callengo team.
        </p>
        <Link
          href="/api/integrations/zoho/connect?return_to=/team"
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
        >
          <ZohoLogo className="w-3.5 h-3.5" />
          Connect Zoho CRM
        </Link>
      </div>
    );
  }

  // Connected - show members
  return (
    <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <ZohoLogo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">
              Zoho CRM Members ({members.length})
            </h3>
            <p className="text-xs text-[var(--color-neutral-400)]">
              {members.filter((m) => m.already_in_callengo).length} already in Callengo
            </p>
          </div>
        </div>
        <button
          onClick={loadMembers}
          disabled={loading}
          className="text-xs font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Messages */}
      {inviteSuccess && (
        <div className="mx-5 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-700">{inviteSuccess}</p>
        </div>
      )}
      {error && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
      )}

      {/* Member List */}
      {!loading && members.length > 0 && (
        <div className="divide-y divide-[var(--border-subtle)]">
          {members.map((member) => (
            <div key={member.zoho_user_id} className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-700 font-bold text-xs">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{member.name}</p>
                    {member.already_in_callengo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        In Callengo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-neutral-500)]">{member.email}</p>
                  {member.role && (
                    <p className="text-xs text-[var(--color-neutral-400)]">{member.role}{member.profile ? ` · ${member.profile}` : ''}</p>
                  )}
                </div>
              </div>
              <div>
                {member.already_in_callengo ? (
                  <span className="text-xs text-[var(--color-neutral-400)] font-medium">Already a member</span>
                ) : (
                  <button
                    onClick={() => handleInvite(member.email)}
                    disabled={invitingEmail === member.email}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
                  >
                    {invitingEmail === member.email ? 'Inviting...' : 'Invite to Callengo'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && members.length === 0 && !error && (
        <div className="px-5 py-8 text-center text-sm text-[var(--color-neutral-400)]">
          No active members found in your Zoho CRM organization
        </div>
      )}
    </div>
  );
}
