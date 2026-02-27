// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
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
type CategoryFilter = 'all' | 'calendar' | 'video' | 'communication' | 'crm';

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
  category: CategoryFilter;
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

// ============================================================================
// HELPERS
// ============================================================================

const PLAN_ORDER: Record<PlanTier, number> = { free: 0, starter: 1, business: 2, teams: 3, enterprise: 4 };

function planMeetsRequirement(currentPlan: string, requiredPlan: PlanTier): boolean {
  return (PLAN_ORDER[currentPlan as PlanTier] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
}

function getPlanLabel(plan: PlanTier): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatLastSynced(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ============================================================================
// CONFIGURE MODAL
// ============================================================================

function ConfigureModal({
  item,
  onClose,
  onSync,
  onDisconnect,
  loadingAction,
}: {
  item: IntegrationItem;
  onClose: () => void;
  onSync: (provider: string, name: string) => void;
  onDisconnect: (provider: string, name: string) => void;
  loadingAction: string | null;
}) {
  const isConnected = item.status === 'connected';
  const isAutoEnabled = item.status === 'auto_enabled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center`}>
              {item.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
              <p className="text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-600">Status</span>
            {isConnected || isAutoEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isAutoEnabled ? 'Auto-enabled' : 'Connected'}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Not connected</span>
            )}
          </div>

          {/* Connected Info */}
          {(isConnected || isAutoEnabled) && item.connectedInfo && item.connectedInfo.length > 0 && (
            <div className="space-y-2">
              {item.connectedInfo.map((info, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-sm text-slate-600">{info.label}</span>
                  <span className="text-sm font-medium text-slate-900 truncate ml-4 max-w-[200px]">{info.value}</span>
                </div>
              ))}
            </div>
          )}

          {isAutoEnabled && item.autoEnabledWith && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Automatically enabled via {item.autoEnabledWith}
            </p>
          )}

          {/* Manage URL */}
          {isConnected && item.manageUrl && (
            <Link
              href={item.manageUrl}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Manage Integration
            </Link>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-6 pt-0 flex gap-2">
          {isConnected && item.showSync && item.syncUrl && (
            <button
              onClick={() => onSync(item.provider, item.name)}
              disabled={loadingAction === `sync-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
            >
              {loadingAction === `sync-${item.provider}` ? <Spinner className="w-4 h-4" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync Now
            </button>
          )}
          {isConnected && !item.settingsUrl && item.id !== 'zoom' && (
            <button
              onClick={() => onDisconnect(item.provider, item.name)}
              disabled={loadingAction === `disconnect-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {loadingAction === `disconnect-${item.provider}` ? <Spinner className="w-4 h-4" /> : 'Disconnect'}
            </button>
          )}
          {isConnected && item.settingsUrl && (
            <Link
              href={item.settingsUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [configItem, setConfigItem] = useState<IntegrationItem | null>(null);

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
  // Actions - OAuth opens in NEW TAB
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
      // Open OAuth in a new tab so the app doesn't close
      window.open(connectUrl, '_blank', 'noopener,noreferrer');
    }
  }, [router, showToast]);

  const handleDisconnect = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`disconnect-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} disconnected`, 'success');
        setConfigItem(null);
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
    setLoadingAction(`sync-${provider}`);
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
  // All integrations as flat list with category tags
  // --------------------------------------------------------------------------

  const allItems: IntegrationItem[] = useMemo(() => [
    {
      id: 'google-calendar', provider: 'google-calendar', name: 'Google Calendar',
      description: 'Sync call schedules, appointments, and events',
      icon: <GoogleCalendarIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
      syncUrl: '/api/integrations/google-calendar/sync', showSync: true,
      connectedInfo: integrations.google_calendar.connected ? [
        ...(integrations.google_calendar.email ? [{ label: 'Account', value: integrations.google_calendar.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.google_calendar.lastSynced) },
      ] : undefined,
    },
    {
      id: 'microsoft-outlook', provider: 'microsoft-outlook', name: 'Microsoft 365',
      description: 'Sync Outlook calendar events and schedules',
      icon: <OutlookIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
      syncUrl: '/api/integrations/microsoft-outlook/sync', showSync: true,
      connectedInfo: integrations.microsoft_outlook.connected ? [
        ...(integrations.microsoft_outlook.email ? [{ label: 'Account', value: integrations.microsoft_outlook.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.microsoft_outlook.lastSynced) },
      ] : undefined,
    },
    {
      id: 'google-meet', provider: 'google-meet', name: 'Google Meet',
      description: 'Auto-generate Meet links for calendar events',
      icon: <GoogleMeetIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-teal-50',
      category: 'video', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Google Calendar',
    },
    {
      id: 'microsoft-teams', provider: 'microsoft-teams', name: 'Microsoft Teams',
      description: 'Auto-generate Teams links for calendar events',
      icon: <TeamsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'video', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Microsoft 365 Outlook',
    },
    {
      id: 'zoom', provider: 'zoom', name: 'Zoom',
      description: 'Server-to-server integration, always available',
      icon: <BiLogoZoom className="w-7 h-7" />, iconColor: 'text-[#2D8CFF]', iconBg: 'bg-blue-50',
      category: 'video', requiredPlan: 'free',
      status: 'connected',
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
    {
      id: 'salesforce', provider: 'salesforce', name: 'Salesforce',
      description: 'Sync contacts, leads, and call data with your CRM',
      icon: <FaSalesforce className="w-7 h-7" />, iconColor: 'text-[#00A1E0]', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.salesforce.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/salesforce/connect?return_to=/integrations',
      syncUrl: '/api/integrations/salesforce/sync', showSync: true,
      manageUrl: '/contacts/salesforce',
      connectedInfo: integrations.salesforce.connected ? [
        ...(integrations.salesforce.username ? [{ label: 'User', value: integrations.salesforce.displayName || integrations.salesforce.username }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.salesforce.lastSynced) },
      ] : undefined,
    },
    {
      id: 'slack', provider: 'slack', name: 'Slack',
      description: 'Real-time notifications and slash commands',
      icon: <SlackIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-purple-50',
      category: 'communication', requiredPlan: 'business',
      status: integrations.slack.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
      connectedInfo: integrations.slack.connected ? [
        ...(integrations.slack.teamName ? [{ label: 'Workspace', value: integrations.slack.teamName }] : []),
        ...(integrations.slack.channelName ? [{ label: 'Channel', value: `#${integrations.slack.channelName}` }] : []),
      ] : undefined,
    },
    {
      id: 'twilio', provider: 'twilio', name: 'Twilio',
      description: 'Voice calling and SMS phone numbers',
      icon: <SiTwilio className="w-6 h-6" />, iconColor: 'text-[#F22F46]', iconBg: 'bg-red-50',
      category: 'communication', requiredPlan: 'business',
      status: integrations.twilio.connected ? 'connected' : 'available',
      settingsUrl: '/settings?section=call-settings&scroll=phone-numbers',
      connectedInfo: integrations.twilio.connected ? [{ label: 'Config', value: 'Managed via Settings' }] : undefined,
    },
    {
      id: 'google-sheets', provider: 'google-sheets', name: 'Google Sheets',
      description: 'Export call logs, results, and contact data',
      icon: <GoogleSheetsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-green-50',
      category: 'crm', requiredPlan: 'free', status: 'coming_soon',
    },
    {
      id: 'hubspot', provider: 'hubspot', name: 'HubSpot',
      description: 'Import contacts and sync call outcomes',
      icon: <FaHubspot className="w-7 h-7" />, iconColor: 'text-[#FF7A59]', iconBg: 'bg-orange-50',
      category: 'crm', requiredPlan: 'business', status: 'coming_soon',
    },
  ], [integrations]);

  const filteredItems = activeFilter === 'all' ? allItems : allItems.filter(i => i.category === activeFilter);

  const activeCount = allItems.filter(i => i.status === 'connected' || i.status === 'auto_enabled').length;

  const filterBadges: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'video', label: 'Video' },
    { id: 'communication', label: 'Communication' },
  ];

  // --------------------------------------------------------------------------
  // Render card
  // --------------------------------------------------------------------------

  function renderCard(item: IntegrationItem) {
    const isComingSoon = item.status === 'coming_soon';
    const isConnected = item.status === 'connected';
    const isAutoEnabled = item.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, item.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;

    return (
      <div
        key={item.id}
        className={`relative flex flex-col p-5 rounded-xl border transition-all ${
          isComingSoon
            ? 'border-slate-100 bg-slate-50/60 opacity-70'
            : isConnected || isAutoEnabled
            ? 'border-emerald-100 bg-white hover:shadow-md hover:border-emerald-200'
            : isLocked
            ? 'border-slate-100 bg-slate-50/40'
            : 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
        }`}
      >
        {/* Connected indicator dot */}
        {(isConnected || isAutoEnabled) && (
          <div className="absolute top-3 right-3">
            <span className="flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
        )}

        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center mb-3`}>
          {item.icon}
        </div>

        {/* Name + plan badge */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
          {item.requiredPlan !== 'free' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase tracking-wider">
              {getPlanLabel(item.requiredPlan)}+
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">{item.description}</p>

        {/* Action button */}
        <div>
          {isComingSoon && (
            <span className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 w-full justify-center">
              Coming Soon
            </span>
          )}

          {!isComingSoon && (isConnected || isAutoEnabled) && (
            <button
              onClick={() => setConfigItem(item)}
              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure
            </button>
          )}

          {!isComingSoon && !isConnected && !isAutoEnabled && item.connectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(item.provider, item.connectUrl!, item.connectMethod);
              }}
              disabled={isLocked || loadingAction === `connect-${item.provider}`}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade to {getPlanLabel(item.requiredPlan)}
                </>
              ) : loadingAction === `connect-${item.provider}` ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : (
                'Connect'
              )}
            </button>
          )}

          {!isComingSoon && !isConnected && item.settingsUrl && !item.connectUrl && (
            <Link
              href={isLocked ? '#' : item.settingsUrl}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed pointer-events-none' : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade
                </>
              ) : (
                'Configure'
              )}
            </Link>
          )}

          {!isComingSoon && !isConnected && !isAutoEnabled && !item.connectUrl && !item.settingsUrl && item.autoEnabledWith && (
            <span className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100">
              Connect {item.autoEnabledWith} first
            </span>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Toast */}
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
          <p className="text-slate-500 text-sm mt-1">Connect your tools to streamline your workflow</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">{activeCount} active</span>
        </div>
      </div>

      {/* Filter badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterBadges.map((badge) => (
          <button
            key={badge.id}
            onClick={() => setActiveFilter(badge.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === badge.id
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {badge.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => renderCard(item))}
      </div>

      {/* Configure Modal */}
      {configItem && (
        <ConfigureModal
          item={configItem}
          onClose={() => setConfigItem(null)}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          loadingAction={loadingAction}
        />
      )}
    </div>
  );
}
