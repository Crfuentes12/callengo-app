// components/settings/DynamicsOrgMembers.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DynamicsOrgMember {
  dynamics_user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  title?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

interface DynamicsOrgMembersProps {
  companyId: string;
  planSlug: string;
  dynamicsConnected: boolean;
}

function DynamicsLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#002050" />
      <path d="M6 6h5v5H6V6z" fill="#0078D4" />
      <path d="M13 6h5v5h-5V6z" fill="#28A8EA" />
      <path d="M6 13h5v5H6v-5z" fill="#50E6FF" />
      <path d="M13 13h5v5h-5v-5z" fill="#0078D4" opacity="0.7" />
    </svg>
  );
}

export default function DynamicsOrgMembers({
  companyId,
  planSlug,
  dynamicsConnected,
}: DynamicsOrgMembersProps) {
  const [members, setMembers] = useState<DynamicsOrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState('');

  const hasDynamicsAccess = ['teams', 'enterprise'].includes(planSlug);

  const loadMembers = useCallback(async () => {
    if (!dynamicsConnected) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/dynamics/users');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load Dynamics org members');
      }
    } catch {
      setError('Failed to load Dynamics org members');
    } finally {
      setLoading(false);
    }
  }, [dynamicsConnected]);

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

  // Upgrade CTA for plans below teams
  if (!hasDynamicsAccess) {
    return (
      <div className="bg-gradient-to-r from-blue-50/50 to-blue-100/30 rounded-xl border border-blue-200/50 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <DynamicsLogo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Microsoft Dynamics Members</h3>
            <p className="text-xs text-[var(--color-neutral-500)]">Preview and invite Dynamics members to Callengo</p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-neutral-600)] mb-4">
          Connect Microsoft Dynamics on Teams plan or higher to preview your organization&apos;s members and invite them directly to Callengo.
        </p>
        <Link
          href="/settings?tab=billing"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 transition-all"
        >
          Upgrade to Teams
        </Link>
      </div>
    );
  }

  // Not connected
  if (!dynamicsConnected) {
    return (
      <div className="bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <DynamicsLogo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Microsoft Dynamics Members</h3>
            <p className="text-xs text-[var(--color-neutral-500)]">Connect Dynamics to see your org members</p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-neutral-600)] mb-4">
          Connect your Microsoft Dynamics account to preview organization members and invite them to your Callengo team.
        </p>
        <Link
          href="/api/integrations/dynamics/connect?return_to=/team"
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
        >
          <DynamicsLogo className="w-3.5 h-3.5" />
          Connect Microsoft Dynamics
        </Link>
      </div>
    );
  }

  // Connected - show members
  return (
    <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <DynamicsLogo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">
              Microsoft Dynamics Members ({members.length})
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
            <div key={member.dynamics_user_id} className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-xs">
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
                  {member.title && (
                    <p className="text-xs text-[var(--color-neutral-400)]">{member.title}</p>
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
          No active members found in your Microsoft Dynamics organization
        </div>
      )}
    </div>
  );
}
