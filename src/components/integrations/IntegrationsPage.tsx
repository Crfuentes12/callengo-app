// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiTwilio } from 'react-icons/si';
import { FaSalesforce, FaHubspot, FaLock } from 'react-icons/fa';
import Link from 'next/link';
import { BiLogoZoom } from 'react-icons/bi';
import { GoogleCalendarIcon, GoogleMeetIcon, GoogleSheetsIcon, OutlookIcon, TeamsIcon, SlackIcon } from '@/components/icons/BrandIcons';

// ============================================================================
// TYPES
// ============================================================================

type PlanTier = 'free' | 'starter' | 'business' | 'teams' | 'enterprise';

interface IntegrationsPageProps {
  integrations: {
    google_calendar: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    microsoft_outlook: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    zoom: { connected: boolean };
    slack: { connected: boolean; teamName?: string; channelName?: string };
    twilio: { connected: boolean };
    salesforce: { connected: boolean; email?: string; username?: string; displayName?: string; lastSynced?: string; integrationId?: string };
  };
  planSlug: string;
  companyId: string;
}

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  requiredPlan: PlanTier;
  status: 'connected' | 'available' | 'auto_enabled' | 'coming_soon';
  connectedInfo?: { label: string; value: string }[];
  autoEnabledWith?: string;
  connectUrl?: string;
  connectMethod?: 'redirect' | 'post';
  disconnectUrl?: string;
  syncUrl?: string;
  settingsUrl?: string;
  showSync?: boolean;
  manageUrl?: string;
}

interface IntegrationCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: IntegrationItem[];
}

// ============================================================================
// PLAN HELPERS
// ============================================================================

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  business: 2,
  teams: 3,
  enterprise: 4,
};

function planMeetsRequirement(currentPlan: string, requiredPlan: PlanTier): boolean {
  const current = PLAN_ORDER[currentPlan as PlanTier] ?? 0;
  const required = PLAN_ORDER[requiredPlan] ?? 0;
  return current >= required;
}

function getPlanLabel(plan: PlanTier): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

// ============================================================================
// TIME HELPERS
// ============================================================================

function formatLastSynced(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ============================================================================
// SPINNER COMPONENT
// ============================================================================

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage({ integrations, planSlug }: IntegrationsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --------------------------------------------------------------------------
  // Toast
  // --------------------------------------------------------------------------
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Handle OAuth callback params
  const integrationParam = searchParams.get('integration');
  const statusParam = searchParams.get('status');
  if (integrationParam && statusParam === 'connected') {
    if (typeof window !== 'undefined') {
      setTimeout(() => router.replace('/integrations', { scroll: false }), 0);
    }
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleConnect = useCallback(async (provider: string, connectUrl: string, method?: 'redirect' | 'post') => {
    if (method === 'post') {
      setLoadingAction(`connect-${provider}`);
      try {
        const res = await fetch(connectUrl, { method: 'POST' });
        if (res.ok) {
          showToast('Connected successfully', 'success');
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Failed to connect', 'error');
        }
      } catch {
        showToast('Failed to connect', 'error');
      } finally {
        setLoadingAction(null);
      }
    } else {
      window.location.href = connectUrl;
    }
  }, [router, showToast]);

  const handleDisconnect = useCallback(async (provider: string, name: string) => {
    const key = `disconnect-${provider}`;
    setLoadingAction(key);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} disconnected successfully`, 'success');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to disconnect ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to disconnect ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  const handleSync = useCallback(async (provider: string, name: string) => {
    const key = `sync-${provider}`;
    setLoadingAction(key);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} synced successfully`, 'success');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to sync ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to sync ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  // --------------------------------------------------------------------------
  // Integration Definitions (grouped by category)
  // --------------------------------------------------------------------------

  const categories: IntegrationCategory[] = [
    {
      id: 'calendar',
      title: 'Calendar & Scheduling',
      description: 'Sync events and scheduling across your calendar tools',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      items: [
        {
          id: 'google-calendar',
          provider: 'google-calendar',
          name: 'Google Calendar',
          description: 'Sync call schedules, appointments, and events',
          icon: <GoogleCalendarIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-blue-50',
          requiredPlan: 'free',
          status: integrations.google_calendar.connected ? 'connected' : 'available',
          connectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
          syncUrl: '/api/integrations/google-calendar/sync',
          showSync: true,
          connectedInfo: integrations.google_calendar.connected ? [
            ...(integrations.google_calendar.email ? [{ label: 'Account', value: integrations.google_calendar.email }] : []),
            { label: 'Last sync', value: formatLastSynced(integrations.google_calendar.lastSynced) },
          ] : undefined,
        },
        {
          id: 'microsoft-outlook',
          provider: 'microsoft-outlook',
          name: 'Microsoft 365 Outlook',
          description: 'Sync Outlook calendar events and schedules',
          icon: <OutlookIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-blue-50',
          requiredPlan: 'business',
          status: integrations.microsoft_outlook.connected ? 'connected' : 'available',
          connectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
          syncUrl: '/api/integrations/microsoft-outlook/sync',
          showSync: true,
          connectedInfo: integrations.microsoft_outlook.connected ? [
            ...(integrations.microsoft_outlook.email ? [{ label: 'Account', value: integrations.microsoft_outlook.email }] : []),
            { label: 'Last sync', value: formatLastSynced(integrations.microsoft_outlook.lastSynced) },
          ] : undefined,
        },
      ],
    },
    {
      id: 'video',
      title: 'Video Conferencing',
      description: 'Auto-generate meeting links for your scheduled events',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      ),
      items: [
        {
          id: 'google-meet',
          provider: 'google-meet',
          name: 'Google Meet',
          description: 'Auto-adds Meet links with Google Calendar events',
          icon: <GoogleMeetIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-teal-50',
          requiredPlan: 'free',
          status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
          autoEnabledWith: 'Google Calendar',
        },
        {
          id: 'microsoft-teams',
          provider: 'microsoft-teams',
          name: 'Microsoft Teams',
          description: 'Auto-adds Teams links with Microsoft 365 events',
          icon: <TeamsIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-indigo-50',
          requiredPlan: 'business',
          status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
          autoEnabledWith: 'Microsoft 365 Outlook',
        },
        {
          id: 'zoom',
          provider: 'zoom',
          name: 'Zoom',
          description: 'Always available — server-to-server, no setup needed',
          icon: <BiLogoZoom className="w-6 h-6" />,
          iconColor: 'text-[#2D8CFF]',
          iconBg: 'bg-blue-50',
          requiredPlan: 'free',
          status: 'connected',
          connectedInfo: [{ label: 'Status', value: 'Always available' }],
        },
      ],
    },
    {
      id: 'communication',
      title: 'Communication & Notifications',
      description: 'Stay connected with your team through real-time alerts',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      ),
      items: [
        {
          id: 'slack',
          provider: 'slack',
          name: 'Slack',
          description: 'Real-time notifications, interactive buttons, and slash commands',
          icon: <SlackIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-purple-50',
          requiredPlan: 'business',
          status: integrations.slack.connected ? 'connected' : 'available',
          connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
          connectedInfo: integrations.slack.connected ? [
            ...(integrations.slack.teamName ? [{ label: 'Workspace', value: integrations.slack.teamName }] : []),
            ...(integrations.slack.channelName ? [{ label: 'Channel', value: `#${integrations.slack.channelName}` }] : []),
          ] : undefined,
        },
        {
          id: 'twilio',
          provider: 'twilio',
          name: 'Twilio',
          description: 'Voice calling and SMS — configure phone numbers in Settings',
          icon: <SiTwilio className="w-5 h-5" />,
          iconColor: 'text-[#F22F46]',
          iconBg: 'bg-red-50',
          requiredPlan: 'business',
          status: integrations.twilio.connected ? 'connected' : 'available',
          settingsUrl: '/settings?section=call-settings&scroll=phone-numbers',
          connectedInfo: integrations.twilio.connected ? [
            { label: 'Config', value: 'Managed via Settings' },
          ] : undefined,
        },
      ],
    },
    {
      id: 'crm',
      title: 'CRM & Data',
      description: 'Sync contacts, leads, and customer data with your CRM',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
      items: [
        {
          id: 'salesforce',
          provider: 'salesforce',
          name: 'Salesforce',
          description: 'Sync contacts, leads, and call data with your CRM',
          icon: <FaSalesforce className="w-6 h-6" />,
          iconColor: 'text-[#00A1E0]',
          iconBg: 'bg-blue-50',
          requiredPlan: 'business',
          status: integrations.salesforce.connected ? 'connected' : 'available',
          connectUrl: '/api/integrations/salesforce/connect?return_to=/integrations',
          syncUrl: '/api/integrations/salesforce/sync',
          showSync: true,
          manageUrl: '/contacts/salesforce',
          connectedInfo: integrations.salesforce.connected ? [
            ...(integrations.salesforce.username ? [{ label: 'User', value: integrations.salesforce.displayName || integrations.salesforce.username }] : []),
            ...(integrations.salesforce.email ? [{ label: 'Email', value: integrations.salesforce.email }] : []),
            { label: 'Last sync', value: formatLastSynced(integrations.salesforce.lastSynced) },
          ] : undefined,
        },
        {
          id: 'google-sheets',
          provider: 'google-sheets',
          name: 'Google Sheets',
          description: 'Export call logs, campaign results, and contact data',
          icon: <GoogleSheetsIcon className="w-6 h-6" />,
          iconColor: '',
          iconBg: 'bg-green-50',
          requiredPlan: 'free',
          status: 'coming_soon',
        },
        {
          id: 'hubspot',
          provider: 'hubspot',
          name: 'HubSpot',
          description: 'Import contacts and sync call outcomes automatically',
          icon: <FaHubspot className="w-6 h-6" />,
          iconColor: 'text-[#FF7A59]',
          iconBg: 'bg-orange-50',
          requiredPlan: 'business',
          status: 'coming_soon',
        },
      ],
    },
  ];

  // --------------------------------------------------------------------------
  // Count active integrations
  // --------------------------------------------------------------------------
  const activeCount = categories.reduce((count, cat) =>
    count + cat.items.filter(i => i.status === 'connected' || i.status === 'auto_enabled').length, 0
  );
  const totalCount = categories.reduce((count, cat) => count + cat.items.length, 0);

  // --------------------------------------------------------------------------
  // Render integration row
  // --------------------------------------------------------------------------

  function renderRow(item: IntegrationItem) {
    const isComingSoon = item.status === 'coming_soon';
    const isConnected = item.status === 'connected';
    const isAutoEnabled = item.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, item.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;

    return (
      <div
        key={item.id}
        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
          isComingSoon
            ? 'border-slate-100 bg-slate-50/50 opacity-60'
            : isConnected || isAutoEnabled
            ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/30 to-transparent'
            : isLocked
            ? 'border-slate-100 bg-slate-50/30'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center shrink-0`}>
          {item.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
            {item.requiredPlan !== 'free' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase tracking-wider">
                {getPlanLabel(item.requiredPlan)}+
              </span>
            )}
            {isConnected && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Active
              </span>
            )}
            {isAutoEnabled && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Auto
              </span>
            )}
            {isComingSoon && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-wider">
                Soon
              </span>
            )}
            {isLocked && (
              <FaLock className="w-2.5 h-2.5 text-slate-300" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>

          {/* Connected details (inline) */}
          {(isConnected || isAutoEnabled) && item.connectedInfo && item.connectedInfo.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {item.connectedInfo.map((info, idx) => (
                <span key={idx} className="text-[11px] text-slate-400">
                  <span className="text-slate-300">{info.label}:</span>{' '}
                  <span className="text-slate-500 font-medium">{info.value}</span>
                </span>
              ))}
            </div>
          )}

          {/* Auto-enabled note */}
          {isAutoEnabled && item.autoEnabledWith && (
            <p className="text-[11px] text-emerald-500 mt-1">
              Enabled via {item.autoEnabledWith}
            </p>
          )}

          {/* Not auto-enabled hint */}
          {item.autoEnabledWith && !isAutoEnabled && !isComingSoon && !isLocked && (
            <p className="text-[11px] text-slate-400 mt-1">
              Connect {item.autoEnabledWith} to enable
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connected: Manage link */}
          {isConnected && item.manageUrl && (
            <Link
              href={item.manageUrl}
              className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
            >
              Manage
            </Link>
          )}

          {/* Connected: Sync */}
          {isConnected && item.showSync && item.syncUrl && (
            <button
              onClick={() => handleSync(item.provider, item.name)}
              disabled={loadingAction === `sync-${item.provider}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
            >
              {loadingAction === `sync-${item.provider}` ? (
                <Spinner className="w-3 h-3" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync
            </button>
          )}

          {/* Connected: Disconnect */}
          {isConnected && !item.settingsUrl && item.id !== 'zoom' && (
            <button
              onClick={() => handleDisconnect(item.provider, item.name)}
              disabled={loadingAction === `disconnect-${item.provider}`}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-all disabled:opacity-50"
            >
              {loadingAction === `disconnect-${item.provider}` ? <Spinner className="w-3 h-3" /> : 'Disconnect'}
            </button>
          )}

          {/* Connected with settings URL */}
          {isConnected && item.settingsUrl && (
            <Link
              href={item.settingsUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Settings
            </Link>
          )}

          {/* Not connected: Connect button */}
          {!isConnected && !isComingSoon && !isAutoEnabled && item.connectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(item.provider, item.connectUrl!, item.connectMethod);
              }}
              disabled={isLocked}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade
                </>
              ) : (
                'Connect'
              )}
            </button>
          )}

          {/* Not connected settings link */}
          {!isConnected && !isComingSoon && item.settingsUrl && !item.connectUrl && (
            <Link
              href={item.settingsUrl}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isLocked ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed pointer-events-none' : 'btn-primary'
              }`}
            >
              Configure
            </Link>
          )}

          {/* Coming soon */}
          {isComingSoon && (
            <span className="text-[10px] text-slate-300 font-medium">Coming Soon</span>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">
            Connect your tools to streamline your workflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{activeCount} active</span>
          </div>
          <div className="text-xs text-slate-400">{totalCount} integrations</div>
        </div>
      </div>

      {/* Category Sections */}
      {categories.map((category) => (
        <div key={category.id}>
          {/* Category Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="text-slate-400">
              {category.icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{category.title}</h2>
              <p className="text-xs text-slate-400">{category.description}</p>
            </div>
          </div>

          {/* Integration Rows */}
          <div className="space-y-2">
            {category.items.map((item) => renderRow(item))}
          </div>
        </div>
      ))}

      {/* Help Center */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Need help?</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visit our Help Center for step-by-step setup guides
          </p>
        </div>
        <a
          href="https://callengo.com/help/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-white border border-slate-200 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 transition-all"
        >
          Help Center
        </a>
      </div>
    </div>
  );
}
