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

type PlanTier = 'free' | 'starter' | 'business' | 'enterprise';

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

interface IntegrationCardConfig {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  requiredPlan: PlanTier;
  status: 'connected' | 'available' | 'auto_enabled' | 'coming_soon';
  category: string;
  connectedDetail?: React.ReactNode;
  autoEnabledWith?: string;
  connectUrl?: string;
  connectMethod?: 'redirect' | 'post'; // 'redirect' = GET redirect (default), 'post' = API call
  disconnectUrl?: string;
  syncUrl?: string;
  settingsUrl?: string;
  showSync?: boolean;
}

// ============================================================================
// PLAN HELPERS
// ============================================================================

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  business: 2,
  enterprise: 3,
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
// CATEGORY FILTER TYPES
// ============================================================================

type CategoryFilter = 'all' | 'calendar' | 'video' | 'communication' | 'crm';

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'video', label: 'Video' },
  { value: 'communication', label: 'Communication' },
  { value: 'crm', label: 'CRM' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage({ integrations, planSlug, companyId }: IntegrationsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  // --------------------------------------------------------------------------
  // Toast
  // --------------------------------------------------------------------------
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Handle OAuth callback params on mount
  const integrationParam = searchParams.get('integration');
  const statusParam = searchParams.get('status');
  if (integrationParam && statusParam === 'connected') {
    // We read params but rely on server data for actual status
    // Clean URL on next tick
    if (typeof window !== 'undefined') {
      setTimeout(() => router.replace('/integrations', { scroll: false }), 0);
    }
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleConnect = useCallback(async (provider: string, connectUrl: string, method?: 'redirect' | 'post') => {
    if (method === 'post') {
      // Server-to-Server OAuth (e.g., Zoom) — API call instead of redirect
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
  // Integration Definitions
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Free tier integrations
  // --------------------------------------------------------------------------
  const freeIntegrations: IntegrationCardConfig[] = [
    {
      id: 'google-calendar',
      provider: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync your call schedules, appointments, and events directly with Google Calendar.',
      icon: <GoogleCalendarIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-blue-50',
      requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'connected' : 'available',
      category: 'calendar',
      connectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/google-calendar/disconnect',
      syncUrl: '/api/integrations/google-calendar/sync',
      showSync: true,
      connectedDetail: integrations.google_calendar.connected ? (
        <div className="text-xs text-slate-500 space-y-0.5 mt-2">
          {integrations.google_calendar.email && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">Account:</span>
              <span className="font-medium text-slate-600">{integrations.google_calendar.email}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <span className="text-slate-400">Last sync:</span>
            <span className="font-medium text-slate-600">{formatLastSynced(integrations.google_calendar.lastSynced)}</span>
          </p>
        </div>
      ) : undefined,
    },
    {
      id: 'google-meet',
      provider: 'google-meet',
      name: 'Google Meet',
      description: 'Automatically adds Google Meet links when creating events through Google Calendar.',
      icon: <GoogleMeetIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-teal-50',
      requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
      category: 'video',
      autoEnabledWith: 'Google Calendar',
    },
    {
      id: 'zoom',
      provider: 'zoom',
      name: 'Zoom',
      description: 'Auto-generate Zoom meeting links for scheduled events. Always available — no setup required.',
      icon: <BiLogoZoom className="w-7 h-7" />,
      iconColor: 'text-[#2D8CFF]',
      iconBg: 'bg-blue-50',
      requiredPlan: 'free',
      status: 'connected',
      category: 'video',
      connectedDetail: (
        <div className="text-xs text-slate-500 mt-2">
          <p className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <span className="font-medium text-emerald-600">Always available (Server-to-Server)</span>
          </p>
        </div>
      ),
    },
    {
      id: 'google-sheets',
      provider: 'google-sheets',
      name: 'Google Sheets',
      description: 'Export call logs, campaign results, and contact data to Google Sheets for easy reporting and analysis.',
      icon: <GoogleSheetsIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-green-50',
      requiredPlan: 'free',
      status: 'coming_soon',
      category: 'automation',
    },
  ];

  // --------------------------------------------------------------------------
  // Business tier integrations
  // --------------------------------------------------------------------------
  const businessIntegrations: IntegrationCardConfig[] = [
    {
      id: 'microsoft-outlook',
      provider: 'microsoft-outlook',
      name: 'Microsoft 365 Outlook',
      description: 'Sync your Outlook calendar events, appointments, and schedules with Callengo.',
      icon: <OutlookIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-blue-50',
      requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'connected' : 'available',
      category: 'calendar',
      connectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/microsoft-outlook/disconnect',
      syncUrl: '/api/integrations/microsoft-outlook/sync',
      showSync: true,
      connectedDetail: integrations.microsoft_outlook.connected ? (
        <div className="text-xs text-slate-500 space-y-0.5 mt-2">
          {integrations.microsoft_outlook.email && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">Account:</span>
              <span className="font-medium text-slate-600">{integrations.microsoft_outlook.email}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <span className="text-slate-400">Last sync:</span>
            <span className="font-medium text-slate-600">{formatLastSynced(integrations.microsoft_outlook.lastSynced)}</span>
          </p>
        </div>
      ) : undefined,
    },
    {
      id: 'microsoft-teams',
      provider: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Automatically adds Teams meeting links when creating events through Microsoft 365.',
      icon: <TeamsIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-indigo-50',
      requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
      category: 'video',
      autoEnabledWith: 'Microsoft 365 Outlook',
    },
    {
      id: 'slack',
      provider: 'slack',
      name: 'Slack',
      description: 'Get real-time notifications about meetings, no-shows, reminders, and more. Supports interactive buttons and slash commands.',
      icon: <SlackIcon className="w-7 h-7" />,
      iconColor: '',
      iconBg: 'bg-purple-50',
      requiredPlan: 'business',
      status: integrations.slack.connected ? 'connected' : 'available',
      category: 'communication',
      connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/slack/disconnect',
      connectedDetail: integrations.slack.connected ? (
        <div className="text-xs text-slate-500 space-y-0.5 mt-2">
          {integrations.slack.teamName && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">Workspace:</span>
              <span className="font-medium text-slate-600">{integrations.slack.teamName}</span>
            </p>
          )}
          {integrations.slack.channelName && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">Channel:</span>
              <span className="font-medium text-slate-600">#{integrations.slack.channelName}</span>
            </p>
          )}
        </div>
      ) : undefined,
    },
    {
      id: 'twilio',
      provider: 'twilio',
      name: 'Twilio',
      description: 'Voice calling and SMS. Configure phone numbers in Call Settings.',
      icon: <SiTwilio className="w-6 h-6" />,
      iconColor: 'text-[#F22F46]',
      iconBg: 'bg-red-50',
      requiredPlan: 'business',
      status: integrations.twilio.connected ? 'connected' : 'available',
      category: 'communication',
      settingsUrl: '/settings?section=call-settings&scroll=phone-numbers',
      connectedDetail: integrations.twilio.connected ? (
        <div className="text-xs text-slate-500 mt-2">
          <p className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <span className="font-medium text-slate-600">Configured via Settings</span>
          </p>
        </div>
      ) : undefined,
    },
    {
      id: 'salesforce',
      provider: 'salesforce',
      name: 'Salesforce',
      description: 'Sync contacts, leads, and call data with your Salesforce CRM. Import contacts and manage your org from Callengo.',
      icon: <FaSalesforce className="w-7 h-7" />,
      iconColor: 'text-[#00A1E0]',
      iconBg: 'bg-blue-50',
      requiredPlan: 'business',
      status: integrations.salesforce.connected ? 'connected' : 'available',
      category: 'crm',
      connectUrl: '/api/integrations/salesforce/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/salesforce/disconnect',
      syncUrl: '/api/integrations/salesforce/sync',
      showSync: true,
      connectedDetail: integrations.salesforce.connected ? (
        <div className="text-xs text-slate-500 space-y-0.5 mt-2">
          {integrations.salesforce.username && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">User:</span>
              <span className="font-medium text-slate-600">{integrations.salesforce.displayName || integrations.salesforce.username}</span>
            </p>
          )}
          {integrations.salesforce.email && (
            <p className="flex items-center gap-1.5">
              <span className="text-slate-400">Email:</span>
              <span className="font-medium text-slate-600">{integrations.salesforce.email}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <span className="text-slate-400">Last sync:</span>
            <span className="font-medium text-slate-600">{formatLastSynced(integrations.salesforce.lastSynced)}</span>
          </p>
          <div className="pt-1">
            <Link
              href="/contacts/salesforce"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              Manage Salesforce Contacts &rarr;
            </Link>
          </div>
        </div>
      ) : undefined,
    },
    {
      id: 'hubspot',
      provider: 'hubspot',
      name: 'HubSpot',
      description: 'Connect your HubSpot CRM to import contacts and sync call outcomes automatically.',
      icon: <FaHubspot className="w-7 h-7" />,
      iconColor: 'text-[#FF7A59]',
      iconBg: 'bg-orange-50',
      requiredPlan: 'business',
      status: 'coming_soon',
      category: 'crm',
    },
  ];

  // --------------------------------------------------------------------------
  // Combined integrations + filtering
  // --------------------------------------------------------------------------

  const allIntegrations: IntegrationCardConfig[] = [
    ...freeIntegrations,
    ...businessIntegrations,
  ];

  const filteredIntegrations = selectedCategory === 'all'
    ? allIntegrations
    : allIntegrations.filter((card) => card.category === selectedCategory);

  // --------------------------------------------------------------------------
  // Card Renderer
  // --------------------------------------------------------------------------

  function renderCard(card: IntegrationCardConfig) {
    const isComingSoon = card.status === 'coming_soon';
    const isConnected = card.status === 'connected';
    const isAutoEnabled = card.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, card.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;

    return (
      <div
        key={card.id}
        className={`bg-white rounded-xl border p-6 flex flex-col transition-all ${
          isComingSoon
            ? 'border-slate-200 opacity-60'
            : isConnected || isAutoEnabled
            ? 'border-emerald-200 hover:shadow-md'
            : 'border-slate-200 hover:shadow-md'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${card.iconBg} ${card.iconColor || ''} flex items-center justify-center shrink-0`}>
              {card.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{card.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {card.requiredPlan !== 'free' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                    {getPlanLabel(card.requiredPlan)}+
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isConnected && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            )}
            {isAutoEnabled && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Auto-enabled
              </span>
            )}
            {isComingSoon && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">
                Coming Soon
              </span>
            )}
            {isLocked && !isConnected && !isAutoEnabled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                <FaLock className="w-2.5 h-2.5" />
                {getPlanLabel(card.requiredPlan)} Plan Required
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 mb-3 leading-relaxed flex-1">{card.description}</p>

        {/* Auto-enabled note */}
        {isAutoEnabled && card.autoEnabledWith && (
          <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3">
            Automatically enabled with {card.autoEnabledWith} connection
          </div>
        )}

        {/* Not auto-enabled but could be */}
        {card.autoEnabledWith && !isAutoEnabled && !isComingSoon && (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-3">
            Connect {card.autoEnabledWith} to auto-enable this integration
          </div>
        )}

        {/* Connected detail (email, last sync, etc.) */}
        {isConnected && card.connectedDetail && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-3">
            {card.connectedDetail}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto">
          {/* Connected State */}
          {isConnected && !card.settingsUrl && (
            <div className="flex items-center gap-2">
              {card.showSync && card.syncUrl && (
                <button
                  onClick={() => handleSync(card.provider, card.name)}
                  disabled={loadingAction === `sync-${card.provider}`}
                  className="flex-1 py-2.5 rounded-lg font-medium text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingAction === `sync-${card.provider}` ? (
                    <Spinner />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => handleDisconnect(card.provider, card.name)}
                disabled={loadingAction === `disconnect-${card.provider}`}
                className="px-3 py-2.5 rounded-lg font-medium text-sm text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
              >
                {loadingAction === `disconnect-${card.provider}` ? (
                  <Spinner />
                ) : (
                  'Disconnect'
                )}
              </button>
            </div>
          )}

          {/* Twilio connected - link to settings */}
          {isConnected && card.settingsUrl && (
            <div className="flex items-center gap-2">
              <Link
                href={card.settingsUrl}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm text-center text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10 transition-all"
              >
                Manage in Settings
              </Link>
            </div>
          )}

          {/* Not connected, not coming soon, not auto-enabled */}
          {!isConnected && !isComingSoon && !isAutoEnabled && card.connectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(card.provider, card.connectUrl!, card.connectMethod);
              }}
              disabled={isLocked}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'btn-primary w-full justify-center'
              }`}
            >
              {isLocked ? `Requires ${getPlanLabel(card.requiredPlan)} Plan` : `Connect ${card.name}`}
            </button>
          )}

          {/* Not connected Twilio - link to settings */}
          {!isConnected && !isComingSoon && card.settingsUrl && !card.connectUrl && (
            <div className="flex justify-center">
              <Link
                href={card.settingsUrl}
                className="block w-full py-2.5 rounded-lg font-medium text-sm text-center btn-primary"
              >
                Configure in Settings
              </Link>
            </div>
          )}

          {/* Coming Soon */}
          {isComingSoon && (
            <button
              disabled
              className="w-full py-2.5 rounded-lg font-medium text-sm bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              Coming Soon
            </button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-600 mt-1">
          Connect Callengo with your favorite tools and services to streamline your workflow
        </p>
      </div>

      {/* Category Filter Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedCategory(option.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === option.value
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((card) => renderCard(card))}
      </div>

      {/* Help Center Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-semibold text-slate-900">Need help setting up your integrations?</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Visit our Help Center for step-by-step guides and troubleshooting.
          </p>
        </div>
        <a
          href="https://callengo.com/help/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-5 py-2.5 rounded-lg font-medium text-sm text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all"
        >
          Visit Help Center
        </a>
      </div>
    </div>
  );
}
