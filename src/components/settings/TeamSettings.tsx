// components/settings/TeamSettings.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  status: string;
}

interface TeamSettingsProps {
  companyId: string;
  currentUser: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
  };
}

const PLAN_SEAT_LIMITS: Record<string, { seats: number; extraCost: number | null; label: string }> = {
  free: { seats: 1, extraCost: null, label: 'Free' },
  starter: { seats: 1, extraCost: null, label: 'Starter' },
  business: { seats: 3, extraCost: null, label: 'Business' },
  teams: { seats: 5, extraCost: 79, label: 'Teams' },
  enterprise: { seats: -1, extraCost: null, label: 'Enterprise' }, // -1 = unlimited
};

export default function TeamSettings({ companyId, currentUser }: TeamSettingsProps) {
  const supabase = createClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [planSlug, setPlanSlug] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    try {
      // Get subscription plan
      const { data: sub } = await supabase
        .from('company_subscriptions')
        .select('subscription_plans(slug)')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      if (sub?.subscription_plans) {
        setPlanSlug((sub.subscription_plans as any).slug || 'free');
      }

      // Fetch team data via API to avoid direct table dependency
      try {
        const res = await fetch('/api/team/members');
        if (res.ok) {
          const data = await res.json();
          if (data.members) setMembers(data.members);
          if (data.invites) setInvites(data.invites);
        } else {
          // If API doesn't exist yet, show current user only
          setMembers([{
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.full_name,
            role: currentUser.role || 'owner',
            created_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          }]);
        }
      } catch {
        // Fallback: show current user as the only member
        setMembers([{
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.full_name,
          role: currentUser.role || 'owner',
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const planConfig = PLAN_SEAT_LIMITS[planSlug] || PLAN_SEAT_LIMITS.free;
  const currentSeats = members.length + invites.length;
  const maxSeats = planConfig.seats;
  const canInvite = maxSeats === -1 || currentSeats < maxSeats;
  const isOwnerOrAdmin = currentUser.role === 'owner' || currentUser.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !canInvite) return;

    setInviting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send invitation');

      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      loadTeamData();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUser.id) return;
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const response = await fetch('/api/team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      });

      if (!response.ok) throw new Error('Failed to remove member');
      setSuccess('Team member removed');
      loadTeamData();
    } catch (err) {
      setError('Failed to remove team member');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const response = await fetch('/api/team/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) throw new Error('Failed to cancel invitation');
      setSuccess('Invitation cancelled');
      loadTeamData();
    } catch (err) {
      setError('Failed to cancel invitation');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-200)]';
      case 'admin': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Team Management</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your team members, roles, and invitations</p>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Plan Seat Info */}
      <div className="bg-gradient-to-r from-slate-50 to-[var(--color-primary-50)] rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-slate-900">Team Seats</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-200)]">
                {planConfig.label} Plan
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {maxSeats === -1
                ? 'Unlimited team seats available'
                : `${currentSeats} of ${maxSeats} seats used`}
              {planConfig.extraCost && ` · $${planConfig.extraCost}/mo per additional seat`}
            </p>
          </div>
          {maxSeats !== -1 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{currentSeats}/{maxSeats}</p>
              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${Math.min((currentSeats / maxSeats) * 100, 100)}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {!canInvite && planSlug !== 'enterprise' && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">
              {planSlug === 'free' || planSlug === 'starter'
                ? 'Upgrade to Business plan or higher to add team members.'
                : planConfig.extraCost
                ? `All seats are used. Additional seats cost $${planConfig.extraCost}/month each.`
                : 'Upgrade your plan to add more team members.'}
            </p>
            <a href="/billing" className="text-xs font-semibold text-amber-800 hover:text-amber-900 mt-1 inline-block">
              Upgrade Plan &rarr;
            </a>
          </div>
        )}
      </div>

      {/* Invite Form */}
      {isOwnerOrAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Invite Team Member</h3>
          <form onSubmit={handleInvite} className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                required
                disabled={!canInvite}
              />
            </div>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
              disabled={!canInvite}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting || !canInvite || !inviteEmail}
              className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {inviting ? (
                <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
              Invite
            </button>
          </form>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Team Members ({members.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {members.map(member => (
            <div key={member.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm">
                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {member.full_name || member.email.split('@')[0]}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge(member.role)}`}>
                      {member.role}
                    </span>
                    {member.id === currentUser.id && (
                      <span className="text-[10px] text-slate-400 font-medium">(You)</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-400">
                  {member.last_sign_in_at
                    ? `Active ${new Date(member.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Never signed in'}
                </p>
                {isOwnerOrAdmin && member.id !== currentUser.id && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove member"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Pending Invitations ({invites.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {invites.map(invite => (
              <div key={invite.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
                        Pending
                      </span>
                      <span className="text-xs text-slate-400">
                        Sent {new Date(invite.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Info */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('owner')}`}>Owner</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Full account access
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Manage billing & plans
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Add/remove team members
              </li>
            </ul>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('admin')}`}>Admin</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Create & manage campaigns
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Configure agents & settings
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Invite team members
              </li>
            </ul>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('member')}`}>Member</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                View dashboard & analytics
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                View calls & campaigns
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="text-slate-400">Cannot change settings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
