// components/settings/TeamSettings.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { teamEvents } from '@/lib/analytics';
import { phTeamEvents } from '@/lib/posthog';

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

interface IntegrationSource {
  id: string;
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  endpoint: string;
  memberKey: string;
}

interface IntegrationMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  already_in_callengo: boolean;
}

interface TeamSettingsProps {
  companyId: string;
  currentUser: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
  };
  integrationConnections?: {
    salesforce?: boolean;
    hubspot?: boolean;
    pipedrive?: boolean;
    clio?: boolean;
    zoho?: boolean;
    dynamics?: boolean;
    simplybook?: boolean;
  };
}

const PLAN_SEAT_LIMITS: Record<string, { seats: number; extraCost: number | null; label: string; nextPlan?: string }> = {
  free: { seats: 1, extraCost: null, label: 'Free', nextPlan: 'Starter' },
  starter: { seats: 1, extraCost: null, label: 'Starter', nextPlan: 'Business' },
  growth: { seats: 1, extraCost: null, label: 'Growth', nextPlan: 'Business' },
  business: { seats: 3, extraCost: 49, label: 'Business' },
  teams: { seats: 5, extraCost: 49, label: 'Teams' },
  enterprise: { seats: -1, extraCost: null, label: 'Enterprise' }, // -1 = unlimited
};

export default function TeamSettings({ companyId, currentUser, integrationConnections = {} }: TeamSettingsProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [planSlug, setPlanSlug] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Invite mode state
  const [inviteMode, setInviteMode] = useState<'email' | 'integrations' | 'bulk'>('email');
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [integrationMembers, setIntegrationMembers] = useState<IntegrationMember[]>([]);
  const [loadingIntMembers, setLoadingIntMembers] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [invitingBatch, setInvitingBatch] = useState(false);

  // Bulk import state
  const [dragOver, setDragOver] = useState(false);
  const [bulkEmails, setBulkEmails] = useState<string[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkRole, setBulkRole] = useState<'member' | 'admin'>('member');
  const [invitingBulk, setInvitingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });

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
        setPlanSlug((sub.subscription_plans as Record<string, unknown>).slug as string || 'free');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- currentUser is a stable prop
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

      teamEvents.memberInvited(inviteRole, 'email');
      phTeamEvents.memberInvited(inviteRole, 'email');
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      await loadTeamData();
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send invitation');
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
      teamEvents.memberRemoved();
      phTeamEvents.memberRemoved();
      setSuccess('Team member removed');
      await loadTeamData();
      router.refresh();
    } catch {
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
      teamEvents.inviteCancelled();
      phTeamEvents.inviteCancelled();
      setSuccess('Invitation cancelled');
      await loadTeamData();
      router.refresh();
    } catch {
      setError('Failed to cancel invitation');
    }
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    setResendingId(invite.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invite.email, role: invite.role }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend invitation');

      teamEvents.inviteResent();
      phTeamEvents.inviteResent();
      setSuccess(`Invitation resent to ${invite.email}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const getDaysAgo = (dateString: string): string => {
    const now = new Date();
    const sent = new Date(dateString);
    const diffMs = now.getTime() - sent.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-200)]';
      case 'admin': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)] border-[var(--border-default)]';
    }
  };

  // Integration sources
  const integrationSources: IntegrationSource[] = useMemo(() => [
    { id: 'salesforce', name: 'Salesforce', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#00A1E0"><path d="M10.1 4.8c.9-.9 2.1-1.5 3.5-1.5 1.7 0 3.2.9 4 2.2.7-.3 1.5-.5 2.3-.5 3.1 0 5.6 2.5 5.6 5.6s-2.5 5.6-5.6 5.6c-.5 0-.9-.1-1.4-.2-.7 1.3-2.1 2.2-3.7 2.2-1.2 0-2.2-.5-3-1.3-.6.2-1.2.3-1.8.3-2.8 0-5-2.2-5-5s2.2-5 5-5c.4 0 .8 0 1.1.1.6-1 1.6-1.7 2.7-2.1-.1-.5-.2-1-.2-1.5 0-2 1.1-3.7 2.7-4.7-.3-.1-.6-.2-.9-.2-1.4 0-2.6.6-3.5 1.5-.1-.2-.3-.3-.5-.5z"/></svg>, connected: !!integrationConnections.salesforce, endpoint: '/api/integrations/salesforce/users', memberKey: 'members' },
    { id: 'hubspot', name: 'HubSpot', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF7A59"><path d="M17.5 8.5V6.4c.8-.4 1.3-1.2 1.3-2.1 0-1.3-1.1-2.4-2.4-2.4s-2.4 1.1-2.4 2.4c0 .9.5 1.7 1.3 2.1v2c-.8.2-1.6.5-2.2 1l-6-4.5c.1-.2.1-.5.1-.7 0-1.3-1-2.3-2.3-2.3S2.6 2.9 2.6 4.2s1 2.3 2.3 2.3c.4 0 .8-.1 1.1-.3l5.8 4.4c-.5.8-.8 1.7-.8 2.7 0 2.8 2.3 5 5 5s5-2.3 5-5-2.1-4.8-3.5-4.8z"/></svg>, connected: !!integrationConnections.hubspot, endpoint: '/api/integrations/hubspot/users', memberKey: 'members' },
    { id: 'pipedrive', name: 'Pipedrive', icon: <svg className="w-4 h-4 text-black" viewBox="0 0 32 32" fill="currentColor"><path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" /></svg>, connected: !!integrationConnections.pipedrive, endpoint: '/api/integrations/pipedrive/users', memberKey: 'members' },
    // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
    { id: 'clio', name: 'Clio', icon: <img src="/clio-logo.png" alt="Clio" className="w-4 h-4" />, connected: !!integrationConnections.clio, endpoint: '/api/integrations/clio/users', memberKey: 'members' },
    { id: 'zoho', name: 'Zoho CRM', icon: <svg className="w-4 h-4" viewBox="0 0 1024 450" fill="none"><path d="M458.1,353c-7.7,0-15.5-1.6-23-4.9l-160-71.3c-28.6-12.7-41.5-46.4-28.8-75l71.3-160c12.7-28.6,46.4-41.5,75-28.8l160,71.3c28.6,12.7,41.5,46.4,28.8,75l-71.3,160C500.6,340.5,479.8,353,458.1,353z" fill="#089949"/><path d="M960,353.1H784.8c-31.3,0-56.8-25.5-56.8-56.8V121.1c0-31.3,25.5-56.8,56.8-56.8H960c31.3,0,56.8,25.5,56.8,56.8v175.2C1016.8,327.6,991.3,353.1,960,353.1z" fill="#F9B21D"/><path d="M303.9,153.2L280.3,206l-28-173c-2.1-13.1,6.8-25.4,19.8-27.5l173-28c13.1-2.1,25.4,6.8,27.5,19.8l28,173c-5-30.9-34.2-52-65.1-47l-173,28c-30.9,5-52,34.2-47,65.1L303.9,153.2z" fill="#E42527"/></svg>, connected: !!integrationConnections.zoho, endpoint: '/api/integrations/zoho/users', memberKey: 'members' },
    { id: 'dynamics', name: 'Microsoft Dynamics', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#002050"/><path d="M6 6h5v5H6V6z" fill="#0078D4"/><path d="M13 6h5v5h-5V6z" fill="#28A8EA"/><path d="M6 13h5v5H6v-5z" fill="#50E6FF"/><path d="M13 13h5v5h-5v-5z" fill="#0078D4" opacity="0.7"/></svg>, connected: !!integrationConnections.dynamics, endpoint: '/api/integrations/dynamics/users', memberKey: 'members' },
    // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
    { id: 'simplybook', name: 'SimplyBook.me', icon: <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-4 h-4 rounded-sm" />, connected: !!integrationConnections.simplybook, endpoint: '/api/integrations/simplybook/providers', memberKey: 'providers' },
  ], [integrationConnections]);

  const connectedSources = useMemo(() => integrationSources.filter(s => s.connected), [integrationSources]);

  // Load integration members
  const loadIntegrationMembers = useCallback(async (source: IntegrationSource) => {
    setLoadingIntMembers(true);
    setIntegrationMembers([]);
    setSelectedMemberIds(new Set());
    try {
      const res = await fetch(source.endpoint);
      if (res.ok) {
        const data = await res.json();
        const raw = data[source.memberKey] || [];
        const mapped: IntegrationMember[] = raw.map((m: Record<string, unknown>) => ({
          id: m[source.id === 'simplybook' ? 'sb_provider_id' : `${source.id}_user_id`] || m.id || m.email,
          name: m.name || m.full_name || (m.email as string | undefined)?.split('@')[0] || 'Unknown',
          email: m.email || '',
          role: m.role || m.profile || undefined,
          already_in_callengo: !!m.already_in_callengo,
        }));
        setIntegrationMembers(mapped.filter((m: IntegrationMember) => m.email));
      }
    } catch {
      setError('Failed to load members from integration');
    } finally {
      setLoadingIntMembers(false);
    }
  }, []);

  // Batch invite from integrations
  const handleBatchInvite = async () => {
    const toInvite = integrationMembers.filter(m => selectedMemberIds.has(m.id) && !m.already_in_callengo);
    if (toInvite.length === 0) return;

    setInvitingBatch(true);
    setError('');
    setSuccess('');
    let successCount = 0;

    for (const member of toInvite) {
      try {
        const res = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: member.email, role: 'member' }),
        });
        if (res.ok) successCount++;
      } catch { /* continue */ }
    }

    setSuccess(`${successCount} invitation${successCount !== 1 ? 's' : ''} sent successfully`);
    setSelectedMemberIds(new Set());
    await loadTeamData();
    setInvitingBatch(false);
    router.refresh();
  };

  // Bulk file import
  const handleBulkFile = (file: File) => {
    setBulkFileName(file.name);
    setBulkEmails([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      // Parse CSV/TXT/Excel-like format
      const emails: string[] = [];
      const lines = text.split(/[\r\n]+/);
      for (const line of lines) {
        const cells = line.split(/[,;\t]+/);
        for (const cell of cells) {
          const trimmed = cell.trim().replace(/^["']|["']$/g, '');
          if (trimmed.includes('@') && trimmed.includes('.')) {
            emails.push(trimmed.toLowerCase());
          }
        }
      }
      setBulkEmails([...new Set(emails)]);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleBulkFile(file);
  };

  const handleBulkInvite = async () => {
    if (bulkEmails.length === 0) return;
    setInvitingBulk(true);
    setError('');
    setSuccess('');
    setBulkProgress({ sent: 0, total: bulkEmails.length });

    let sent = 0;
    for (const email of bulkEmails) {
      try {
        const res = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: bulkRole }),
        });
        if (res.ok) sent++;
      } catch { /* continue */ }
      setBulkProgress({ sent: sent, total: bulkEmails.length });
    }

    teamEvents.bulkInviteSent(sent, bulkFileName ? 'csv' : 'manual');
    phTeamEvents.bulkInviteSent(sent, bulkFileName ? 'csv' : 'manual');
    setSuccess(`${sent} of ${bulkEmails.length} invitation${bulkEmails.length !== 1 ? 's' : ''} sent`);
    setBulkEmails([]);
    setBulkFileName('');
    await loadTeamData();
    setInvitingBulk(false);
    router.refresh();
  };

  // Seat checkout state — must be before any early returns (Rules of Hooks)
  const [buyingSeat, setBuyingSeat] = useState(false);

  const handleBuyExtraSeat = async () => {
    setBuyingSeat(true);
    try {
      const res = await fetch('/api/billing/seat-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1, currency: 'USD' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout');
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      alert((err as Error).message || 'Could not start checkout');
    } finally {
      setBuyingSeat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Seat upgrade plans per slug
  const UPGRADE_PLANS: Record<string, { name: string; seats: number; extraCost: number | null }> = {
    business: { name: 'Business', seats: 3, extraCost: 49 },
    teams: { name: 'Teams', seats: 5, extraCost: 49 },
    enterprise: { name: 'Enterprise', seats: -1, extraCost: null },
  };

  const nextUpgrade = Object.entries(UPGRADE_PLANS).find(([slug]) => {
    const tierOrder: Record<string, number> = { free: 0, starter: 1, growth: 2, business: 3, teams: 4, enterprise: 5 };
    return (tierOrder[slug] ?? 0) > (tierOrder[planSlug] ?? 0);
  });

  // Plans that support buying extra seats directly
  const canBuyExtraSeats = planConfig.extraCost !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-ink)]">Team Management</h2>
        <p className="text-sm text-[var(--color-neutral-500)] mt-1">Manage your team members, roles, and invitations</p>
      </div>

      {/* Seat capacity banner */}
      <div className={`rounded-xl p-4 border flex items-center justify-between gap-4 ${!canInvite ? 'bg-amber-50 border-amber-200' : 'bg-[var(--color-neutral-50)] border-[var(--border-default)]'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!canInvite ? 'bg-amber-100' : 'bg-[var(--color-neutral-200)]'}`}>
            <svg className={`w-4 h-4 ${!canInvite ? 'text-amber-700' : 'text-[var(--color-neutral-500)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              {maxSeats === -1 ? 'Unlimited seats' : `${currentSeats} / ${maxSeats} seats used`}
              {planConfig.extraCost && maxSeats !== -1 && <span className="text-[var(--color-neutral-500)] font-normal ml-1">· ${planConfig.extraCost}/mo per extra seat</span>}
            </p>
            <p className="text-xs text-[var(--color-neutral-500)]">{planConfig.label} plan</p>
          </div>
        </div>
        {!canInvite && canBuyExtraSeats ? (
          <button
            onClick={handleBuyExtraSeat}
            disabled={buyingSeat}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg gradient-bg text-white text-xs font-semibold hover:opacity-90 transition-all whitespace-nowrap shadow-sm disabled:opacity-50"
          >
            {buyingSeat ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            )}
            Add seat (+${planConfig.extraCost}/mo)
          </button>
        ) : !canInvite && nextUpgrade ? (
          <a
            href="/settings?tab=billing"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg gradient-bg text-white text-xs font-semibold hover:opacity-90 transition-all whitespace-nowrap shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            Upgrade to {nextUpgrade[1].name}
          </a>
        ) : canInvite && maxSeats !== -1 && maxSeats - currentSeats <= 1 && canBuyExtraSeats ? (
          <button
            onClick={handleBuyExtraSeat}
            disabled={buyingSeat}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-neutral-800)] text-white text-xs font-semibold hover:bg-[var(--color-neutral-900)] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {buyingSeat ? 'Loading...' : 'Add seat'}
          </button>
        ) : null}
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
      <div className="bg-gradient-to-r from-[var(--color-neutral-50)] to-[var(--color-primary-50)] rounded-xl border border-[var(--border-default)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Team Seats</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-200)]">
                {planConfig.label} Plan
              </span>
            </div>
            <p className="text-xs text-[var(--color-neutral-500)]">
              {maxSeats === -1
                ? 'Unlimited team seats available'
                : `${currentSeats} of ${maxSeats} seats used`}
              {planConfig.extraCost && ` · $${planConfig.extraCost}/mo per additional seat`}
            </p>
          </div>
          {maxSeats !== -1 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--color-ink)]">{currentSeats}/{maxSeats}</p>
              <div className="w-24 h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden mt-1">
                <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${Math.min((currentSeats / maxSeats) * 100, 100)}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {!canInvite && planSlug !== 'enterprise' && (
          <>
            {(planSlug === 'free' || planSlug === 'starter') && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 font-medium">
                  Upgrade to Business plan or higher to add team members.
                </p>
                <a href="/settings?tab=billing" className="text-xs font-semibold text-amber-800 hover:text-amber-900 mt-1 inline-block">
                  Upgrade Plan &rarr;
                </a>
              </div>
            )}

            {planSlug === 'business' && (
              <div className="mt-3 p-4 bg-gradient-to-r from-[var(--color-primary-50)] via-indigo-50 to-purple-50 border border-[var(--color-primary-200)] rounded-xl">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <p className="text-sm font-bold text-[var(--color-ink)]">Need more seats?</p>
                    </div>
                    <p className="text-xs text-[var(--color-neutral-600)]">
                      Add extra seats at <span className="font-semibold">$49/mo each</span> — or upgrade to Teams for <span className="font-semibold">5 seats included</span>.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBuyExtraSeat}
                    disabled={buyingSeat}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white gradient-bg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
                  >
                    {buyingSeat ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    )}
                    Add seat (+$49/mo)
                  </button>
                  <a
                    href="/settings?tab=billing&upgrade=teams"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[var(--color-neutral-700)] bg-white border border-[var(--border-default)] hover:bg-[var(--color-neutral-50)] transition-colors shadow-sm"
                  >
                    Upgrade to Teams
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                </div>
              </div>
            )}

            {planSlug === 'teams' && (
              <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border border-purple-200 rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                      <p className="text-sm font-bold text-[var(--color-ink)]">Upgrade to Enterprise</p>
                    </div>
                    <p className="text-xs text-[var(--color-neutral-600)]">
                      Get <span className="font-semibold">unlimited seats</span>, dedicated support, custom integrations, and advanced security features for your organization.
                    </p>
                  </div>
                  <a
                    href="/settings?tab=billing&upgrade=enterprise"
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 transition-all shadow-sm"
                  >
                    Contact Sales
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Section */}
      {isOwnerOrAdmin && (
        <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
          {/* Invite Header with Tabs */}
          <div className="border-b border-[var(--border-subtle)]">
            <div className="px-5 pt-4 pb-0">
              <h3 className="text-sm font-bold text-[var(--color-ink)] mb-3">Invite Team Members</h3>
              <div className="flex gap-1">
                {([
                  { id: 'email' as const, label: 'Email', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg> },
                  { id: 'integrations' as const, label: 'Integrations', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 006.364 6.364l1.757-1.757" /></svg>, badge: connectedSources.length > 0 ? connectedSources.length : undefined },
                  { id: 'bulk' as const, label: 'Bulk Import', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setInviteMode(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                      inviteMode === tab.id
                        ? 'text-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-primary-50)]/50'
                        : 'text-[var(--color-neutral-500)] border-transparent hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {'badge' in tab && tab.badge && (
                      <span className="w-4 h-4 rounded-full bg-[var(--color-primary)] text-white text-[9px] font-bold flex items-center justify-center">{tab.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Email Invite */}
          {inviteMode === 'email' && (
            <div className="p-5">
              <form onSubmit={handleInvite} className="flex gap-3">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-default)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    required
                    disabled={!canInvite}
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
                  className="px-3 py-2.5 border border-[var(--border-default)] rounded-xl text-sm text-[var(--color-neutral-700)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                  disabled={!canInvite}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !canInvite || !inviteEmail}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {inviting ? (
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                  Send Invite
                </button>
              </form>
            </div>
          )}

          {/* Import from Integrations */}
          {inviteMode === 'integrations' && (
            <div className="p-5">
              {connectedSources.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-neutral-100)] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[var(--color-neutral-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 006.364 6.364l1.757-1.757" /></svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-neutral-500)] mb-1">No integrations connected</p>
                  <p className="text-xs text-[var(--color-neutral-400)] mb-3">Connect a CRM or booking platform to import team members</p>
                  <a href="/integrations" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Go to Integrations</a>
                </div>
              ) : (
                <>
                  {/* Source selector */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {connectedSources.map(source => (
                      <button
                        key={source.id}
                        onClick={() => { setSelectedIntegration(source.id); loadIntegrationMembers(source); }}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          selectedIntegration === source.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                            : 'border-[var(--border-default)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        {source.icon}
                        {source.name}
                      </button>
                    ))}
                  </div>

                  {/* Members list */}
                  {selectedIntegration && (
                    <>
                      {loadingIntMembers ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                        </div>
                      ) : integrationMembers.length === 0 ? (
                        <div className="text-center py-6 text-sm text-[var(--color-neutral-400)]">No members found in this integration</div>
                      ) : (
                        <>
                          {/* Select all header */}
                          <div className="flex items-center justify-between mb-2 px-1">
                            <label className="flex items-center gap-2 text-xs text-[var(--color-neutral-500)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={integrationMembers.filter(m => !m.already_in_callengo).every(m => selectedMemberIds.has(m.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMemberIds(new Set(integrationMembers.filter(m => !m.already_in_callengo).map(m => m.id)));
                                  } else {
                                    setSelectedMemberIds(new Set());
                                  }
                                }}
                                className="rounded border-[var(--border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                              />
                              Select all available ({integrationMembers.filter(m => !m.already_in_callengo).length})
                            </label>
                            {selectedMemberIds.size > 0 && (
                              <button
                                onClick={handleBatchInvite}
                                disabled={invitingBatch}
                                className="btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {invitingBatch ? (
                                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                                )}
                                Invite {selectedMemberIds.size} selected
                              </button>
                            )}
                          </div>

                          {/* Members grid */}
                          <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border-default)] divide-y divide-[var(--border-subtle)]">
                            {integrationMembers.map(member => (
                              <label
                                key={member.id}
                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                  member.already_in_callengo ? 'opacity-50 cursor-default' : 'hover:bg-[var(--color-neutral-50)]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMemberIds.has(member.id)}
                                  disabled={member.already_in_callengo}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedMemberIds);
                                    if (e.target.checked) { newSet.add(member.id); } else { newSet.delete(member.id); }
                                    setSelectedMemberIds(newSet);
                                  }}
                                  className="rounded border-[var(--border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">{member.name}</p>
                                  <p className="text-[11px] text-[var(--color-neutral-500)] truncate">{member.email}</p>
                                </div>
                                {member.already_in_callengo && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                    In Callengo
                                  </span>
                                )}
                                {member.role && !member.already_in_callengo && (
                                  <span className="text-[10px] text-[var(--color-neutral-400)] shrink-0">{member.role}</span>
                                )}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bulk Import */}
          {inviteMode === 'bulk' && (
            <div className="p-5">
              {bulkEmails.length === 0 ? (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                      dragOver
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]/50'
                        : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--color-neutral-50)]/50'
                    }`}
                    onClick={() => document.getElementById('bulk-file-input')?.click()}
                  >
                    <input
                      id="bulk-file-input"
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleBulkFile(e.target.files[0])}
                    />
                    <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${
                      dragOver ? 'bg-[var(--color-primary-50)]' : 'bg-[var(--color-neutral-100)]'
                    }`}>
                      <svg className={`w-7 h-7 ${dragOver ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-400)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-neutral-700)] mb-1">
                      {dragOver ? 'Drop your file here' : 'Drag & drop a file here'}
                    </p>
                    <p className="text-xs text-[var(--color-neutral-400)] mb-3">or click to browse</p>
                    <div className="flex items-center justify-center gap-2">
                      {['CSV', 'XLSX', 'XLS', 'TXT'].map(ext => (
                        <span key={ext} className="text-[10px] font-semibold text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] px-2 py-0.5 rounded-md">.{ext.toLowerCase()}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--color-neutral-400)] mt-3 text-center">
                    Upload a file containing email addresses. We&apos;ll automatically detect and extract them.
                  </p>
                </>
              ) : (
                <div>
                  {/* File info */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-neutral-700)]">{bulkFileName}</p>
                        <p className="text-[11px] text-[var(--color-neutral-500)]">{bulkEmails.length} email{bulkEmails.length !== 1 ? 's' : ''} detected</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setBulkEmails([]); setBulkFileName(''); }}
                      className="text-xs text-[var(--color-neutral-400)] hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Email preview */}
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border-default)] divide-y divide-[var(--border-subtle)] mb-4">
                    {bulkEmails.slice(0, 20).map((email, i) => (
                      <div key={i} className="px-4 py-2 flex items-center gap-2 text-sm text-[var(--color-neutral-700)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--color-neutral-100)] text-[10px] font-bold text-[var(--color-neutral-400)] flex items-center justify-center shrink-0">{i + 1}</span>
                        {email}
                      </div>
                    ))}
                    {bulkEmails.length > 20 && (
                      <div className="px-4 py-2 text-xs text-[var(--color-neutral-400)]">... and {bulkEmails.length - 20} more</div>
                    )}
                  </div>

                  {/* Role + Invite */}
                  <div className="flex items-center gap-3">
                    <select
                      value={bulkRole}
                      onChange={e => setBulkRole(e.target.value as 'member' | 'admin')}
                      className="px-3 py-2.5 border border-[var(--border-default)] rounded-xl text-sm text-[var(--color-neutral-700)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    >
                      <option value="member">Invite as Member</option>
                      <option value="admin">Invite as Admin</option>
                    </select>
                    <button
                      onClick={handleBulkInvite}
                      disabled={invitingBulk}
                      className="flex-1 btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {invitingBulk ? (
                        <>
                          <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                          Sending {bulkProgress.sent}/{bulkProgress.total}...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                          Invite All {bulkEmails.length}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Team Members ({members.length})</h3>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {members.map(member => (
            <div key={member.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm">
                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      {member.full_name || member.email.split('@')[0]}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge(member.role)}`}>
                      {member.role}
                    </span>
                    {member.id === currentUser.id && (
                      <span className="text-[10px] text-[var(--color-neutral-400)] font-medium">(You)</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-neutral-500)]">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-[var(--color-neutral-400)]">
                  {member.last_sign_in_at
                    ? `Active ${new Date(member.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Never signed in'}
                </p>
                {isOwnerOrAdmin && member.id !== currentUser.id && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 rounded-lg text-[var(--color-neutral-400)] hover:text-red-600 hover:bg-red-50 transition-colors"
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
        <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Pending Invitations ({invites.length})</h3>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {invites.map(invite => (
              <div key={invite.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full bg-[var(--color-neutral-100)] border-2 border-dashed border-[var(--border-strong)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="absolute -top-0.5 -right-0.5">
                      <span className="inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{invite.email}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge(invite.role)}`}>
                        {invite.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Invitation Sent
                      </span>
                      <span className="text-xs text-[var(--color-neutral-400)]">
                        Sent {getDaysAgo(invite.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvite(invite)}
                      disabled={resendingId === invite.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendingId === invite.id ? (
                        <div className="w-3 h-3 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      )}
                      Resend
                    </button>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Info */}
      <div className="bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border border-[var(--border-default)]">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('owner')}`}>Owner</span>
            </div>
            <ul className="space-y-1 text-xs text-[var(--color-neutral-600)]">
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
          <div className="p-3 bg-white rounded-lg border border-[var(--border-default)]">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('admin')}`}>Admin</span>
            </div>
            <ul className="space-y-1 text-xs text-[var(--color-neutral-600)]">
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
          <div className="p-3 bg-white rounded-lg border border-[var(--border-default)]">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${getRoleBadge('member')}`}>Member</span>
            </div>
            <ul className="space-y-1 text-xs text-[var(--color-neutral-600)]">
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                View dashboard & analytics
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                View calls & campaigns
              </li>
              <li className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-[var(--color-neutral-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="text-[var(--color-neutral-400)]">Cannot change settings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
