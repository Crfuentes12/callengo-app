// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSalesforce, FaHubspot, FaLock } from 'react-icons/fa';
import Link from 'next/link';
import { BiLogoZoom } from 'react-icons/bi';
import { createClient } from '@/lib/supabase/client';
import { GoogleCalendarIcon, GoogleMeetIcon, GoogleSheetsIcon, OutlookIcon, TeamsIcon, SlackIcon } from '@/components/icons/BrandIcons';
import { useTranslation } from '@/i18n';
import PageTipCard from '@/components/ui/PageTipCard';
import { integrationEvents } from '@/lib/analytics';
import { phIntegrationEvents } from '@/lib/posthog';
import {
  planMeetsRequirement, getPlanLabel,
  formatLastSynced, Spinner,
  WebhookIcon, PipedriveIcon, ZohoIcon, StripeIcon, DynamicsIcon,
} from './integration-helpers';

// ============================================================================
// TYPES
// ============================================================================

type PlanTier = 'free' | 'starter' | 'business' | 'teams' | 'enterprise';
type CategoryFilter = 'all' | 'calendar' | 'video' | 'communication' | 'crm' | 'payment';
type PlanFilter = 'all_plans' | 'free' | 'starter' | 'growth' | 'business' | 'teams' | 'enterprise';

interface IntegrationsPageProps {
  integrations: {
    google_calendar: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    microsoft_outlook: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    zoom: { connected: boolean };
    slack: { connected: boolean; teamName?: string; channelName?: string };
    salesforce: { connected: boolean; email?: string; username?: string; displayName?: string; lastSynced?: string; integrationId?: string };
    hubspot?: { connected: boolean; email?: string; displayName?: string; hubDomain?: string; lastSynced?: string; integrationId?: string };
    pipedrive?: { connected: boolean; email?: string; displayName?: string; companyName?: string; companyDomain?: string; lastSynced?: string; integrationId?: string };
    clio?: { connected: boolean; email?: string; displayName?: string; firmName?: string; firmId?: string; lastSynced?: string; integrationId?: string };
    zoho?: { connected: boolean; email?: string; displayName?: string; orgName?: string; orgId?: string; lastSynced?: string; integrationId?: string };
    dynamics?: { connected: boolean; email?: string; displayName?: string; orgName?: string; instanceUrl?: string; lastSynced?: string; integrationId?: string };
    simplybook?: { connected: boolean; email?: string; displayName?: string; companyName?: string; companyLogin?: string; lastSynced?: string; integrationId?: string };
    google_sheets?: { connected: boolean; email?: string; displayName?: string; lastUsed?: string; integrationId?: string };
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
  connectMethod?: 'redirect' | 'post' | 'webhooks_inline' | 'simplybook_inline';
  disconnectUrl?: string;
  syncUrl?: string;
  settingsUrl?: string;
  showSync?: boolean;
  manageUrl?: string;
  alwaysActive?: boolean;
  parentProvider?: string;
  parentConnectUrl?: string;
  infoUrl?: string;
}

// ============================================================================
// Helper functions and icons imported from ./integration-helpers

// (Twilio BYOP removed — not compatible with Bland AI sub-account architecture)

// ============================================================================
// SIMPLYBOOK SETUP MODAL
// ============================================================================

function SimplyBookSetupModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [companyLogin, setCompanyLogin] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!companyLogin || !userLogin || !userPassword) {
      setError('All fields are required');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/simplybook/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_login: companyLogin,
          user_login: userLogin,
          user_password: userPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      integrationEvents.connected('simplybook', 'calendar');
      phIntegrationEvents.connected('simplybook', 'calendar');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to SimplyBook.me');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- Small brand logo */}
                <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-7 h-7 rounded" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-ink)]">Connect SimplyBook.me</h3>
                <p className="text-sm text-[var(--color-neutral-500)]">Enter your credentials to connect</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-xs text-blue-900">
                <p className="font-semibold mb-0.5">Where to find your credentials</p>
                <p className="text-blue-700">Log in to your SimplyBook.me admin panel. Your company login is the subdomain (e.g., <strong>mycompany</strong>.simplybook.me). Use the same email and password you log in with.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-neutral-700)] mb-2">Company Login</label>
            <div className="relative">
              <input
                type="text" value={companyLogin} onChange={e => setCompanyLogin(e.target.value)}
                placeholder="your-company"
                className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-neutral-400)]">.simplybook.me</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-neutral-700)] mb-2">User Login (Email)</label>
            <input
              type="email" value={userLogin} onChange={e => setUserLogin(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-neutral-700)] mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={userPassword} onChange={e => setUserPassword(e.target.value)}
                placeholder="Your SimplyBook.me password"
                className="w-full px-4 py-3 pr-10 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-lg p-3 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-[var(--color-neutral-400)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            <p className="text-[11px] text-[var(--color-neutral-500)]">Your credentials are encrypted and stored securely. We never share your password with third parties.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] transition-all">
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting || !companyLogin || !userLogin || !userPassword}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {connecting ? <Spinner className="w-4 h-4" /> : null}
            {connecting ? 'Connecting...' : 'Connect SimplyBook.me'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SLACK CONFIGURE MODAL
// ============================================================================

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackDefaultConfig {
  enabled: boolean;
  channelIds: string[];
  channelNames: string[];
  notifyOnCallCompleted: boolean;
  notifyOnAppointment: boolean;
  notifyOnFollowUp: boolean;
  notifyOnNoShow: boolean;
  setAsDefault: boolean;
}

function SlackConfigureModal({
  companyId,
  slackTeamName,
  slackChannelName,
  onClose,
  onSave,
}: {
  companyId: string;
  slackTeamName?: string;
  slackChannelName?: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SlackDefaultConfig>({
    enabled: true,
    channelIds: [],
    channelNames: [],
    notifyOnCallCompleted: true,
    notifyOnAppointment: true,
    notifyOnFollowUp: true,
    notifyOnNoShow: true,
    setAsDefault: true,
  });

  // Load channels and existing config
  useEffect(() => {
    const load = async () => {
      // Fetch channels
      try {
        const res = await fetch('/api/integrations/slack/channels');
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels || []);
        }
      } catch { /* ignore */ }
      setLoadingChannels(false);

      // Load existing default config from company_settings
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('settings')
          .eq('company_id', companyId)
          .single();
        const settings = (data?.settings as Record<string, unknown>) || {};
        const saved = settings.slack_default_config as SlackDefaultConfig | undefined;
        if (saved) {
          setConfig(saved);
        }
      } catch { /* ignore */ }
    };
    load();
  }, [companyId, supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      const existingSettings = (current?.settings as Record<string, unknown>) || {};
      await supabase
        .from('company_settings')
        .update({
          settings: JSON.parse(JSON.stringify({
            ...existingSettings,
            slack_default_config: config,
          })),
        })
        .eq('company_id', companyId);
      integrationEvents.slackNotificationsConfigured(config.channelIds.length);
      phIntegrationEvents.slackNotificationsConfigured(config.channelIds.length);
      onSave();
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const addChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || config.channelIds.includes(channelId)) return;
    setConfig(prev => ({
      ...prev,
      channelIds: [...prev.channelIds, channelId],
      channelNames: [...prev.channelNames, channel.name],
    }));
  };

  const removeChannel = (channelId: string) => {
    setConfig(prev => {
      const idx = prev.channelIds.indexOf(channelId);
      if (idx === -1) return prev;
      const newIds = prev.channelIds.filter((_, i) => i !== idx);
      const newNames = prev.channelNames.filter((_, i) => i !== idx);
      return { ...prev, channelIds: newIds, channelNames: newNames };
    });
  };

  const notificationTypes = [
    { key: 'notifyOnCallCompleted' as const, label: 'Call Completed', description: 'When an AI call finishes' },
    { key: 'notifyOnAppointment' as const, label: 'Appointments', description: 'New, confirmed, or rescheduled appointments' },
    { key: 'notifyOnFollowUp' as const, label: 'Follow-ups', description: 'When follow-up calls are scheduled' },
    { key: 'notifyOnNoShow' as const, label: 'No-shows', description: 'When a contact is marked as no-show' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <SlackIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-ink)]">Slack Notifications</h3>
                {slackTeamName && <p className="text-sm text-[var(--color-neutral-500)]">{slackTeamName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Channels */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-neutral-700)] uppercase mb-2">Notification Channels</label>
            {config.channelIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {config.channelIds.map((chId, idx) => (
                  <span key={chId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700">
                    #{config.channelNames[idx] || chId}
                    <button onClick={() => removeChannel(chId)} className="text-purple-400 hover:text-red-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            {loadingChannels ? (
              <div className="w-full px-3 py-2 bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-lg text-[var(--color-neutral-400)] text-sm animate-pulse">Loading channels...</div>
            ) : (
              <select
                value=""
                onChange={e => { if (e.target.value) addChannel(e.target.value); }}
                className="w-full px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-[var(--color-ink)] text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none"
              >
                <option value="">Add a channel...</option>
                {channels.filter(ch => !config.channelIds.includes(ch.id)).map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            )}
            {config.channelIds.length === 0 && slackChannelName && (
              <p className="text-[11px] text-[var(--color-neutral-400)] mt-1">Default: #{slackChannelName}</p>
            )}
          </div>

          {/* Notification Types */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-neutral-700)] uppercase mb-2">Notification Types</label>
            <div className="space-y-2">
              {notificationTypes.map(notif => (
                <div key={notif.key} className="flex items-center justify-between bg-[var(--color-neutral-50)] rounded-lg px-3 py-2.5 border border-[var(--border-default)]">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-neutral-700)]">{notif.label}</p>
                    <p className="text-[11px] text-[var(--color-neutral-400)]">{notif.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[notif.key]}
                      onChange={e => setConfig(prev => ({ ...prev, [notif.key]: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[var(--color-neutral-200)] rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-strong)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Set as default */}
          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-3 border border-purple-200">
            <div>
              <p className="text-sm font-bold text-purple-800">Set as default</p>
              <p className="text-[11px] text-purple-600">New campaigns will use this Slack configuration automatically</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.setAsDefault}
                onChange={e => setConfig(prev => ({ ...prev, setAsDefault: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-purple-200 rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-purple-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Spinner className="w-4 h-4" /> : null}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WEBHOOKS SETUP MODAL
// ============================================================================

interface WebhookEndpointData {
  id: string;
  url: string;
  description: string | null;
  secret: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  auto_disabled_at: string | null;
}

interface WebhookEventDef {
  type: string;
  label: string;
  description: string;
}

function WebhooksSetupModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<WebhookEndpointData[]>([]);
  const [availableEvents, setAvailableEvents] = useState<WebhookEventDef[]>([]);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/webhooks/endpoints');
        if (res.ok) {
          const data = await res.json();
          setEndpoints(data.endpoints || []);
          setAvailableEvents(data.available_events || []);
          if (!data.endpoints || data.endpoints.length === 0) setShowAddForm(true);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Failed to load webhooks');
        }
      } catch { setError('Failed to load webhooks'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!newUrl.trim()) { setError('URL is required'); return; }
    if (newEvents.length === 0) { setError('Select at least one event'); return; }
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents, description: newDescription.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create endpoint');
      setEndpoints(prev => [data.endpoint, ...prev]);
      setNewUrl(''); setNewDescription(''); setNewEvents([]);
      setShowAddForm(false);
      setRevealedSecrets(prev => new Set(prev).add(data.endpoint.id));
      integrationEvents.webhookCreated();
      phIntegrationEvents.webhookCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create endpoint');
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { const res = await fetch(`/api/webhooks/endpoints/${id}`, { method: 'DELETE' }); if (res.ok) { setEndpoints(prev => prev.filter(e => e.id !== id)); integrationEvents.webhookDeleted(); phIntegrationEvents.webhookDeleted(); } }
    catch { /* ignore */ } finally { setDeletingId(null); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id); setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) });
      const data = await res.json();
      setTestResult({ id, success: data.success, message: data.success ? `OK (${data.durationMs}ms)` : (data.error || 'Failed') });
    } catch { setTestResult({ id, success: false, message: 'Request failed' }); }
    finally { setTestingId(null); }
  };

  const handleToggleActive = async (ep: WebhookEndpointData) => {
    try {
      const res = await fetch(`/api/webhooks/endpoints/${ep.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !ep.is_active }) });
      if (res.ok) { const data = await res.json(); setEndpoints(prev => prev.map(e => e.id === ep.id ? data.endpoint : e)); }
    } catch { /* ignore */ }
  };

  const copySecret = (id: string, secret: string) => { navigator.clipboard.writeText(secret); setCopiedSecret(id); setTimeout(() => setCopiedSecret(null), 2000); phIntegrationEvents.webhookSecretCopied(); };
  const toggleEvent = (eventType: string) => { setNewEvents(prev => prev.includes(eventType) ? prev.filter(e => e !== eventType) : [...prev, eventType]); };
  const selectAllEvents = () => { setNewEvents(newEvents.length === availableEvents.length ? [] : availableEvents.map(e => e.type)); };
  const toggleRevealSecret = (id: string) => { setRevealedSecrets(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const eventsByCategory = useMemo(() => {
    const groups: Record<string, WebhookEventDef[]> = {};
    for (const ev of availableEvents) { const cat = ev.type.split('.')[0]; if (!groups[cat]) groups[cat] = []; groups[cat].push(ev); }
    return groups;
  }, [availableEvents]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn" onClick={e => e.stopPropagation()}>
        {/* Header with gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-gradient-start)] via-[var(--color-gradient-mid)] to-[var(--color-gradient-end)] opacity-[0.07]" />
          <div className="relative p-6 border-b border-[var(--color-primary-100)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-deep-indigo)] to-[var(--color-electric)] text-white flex items-center justify-center shadow-md">
                  <WebhookIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">Webhooks</h3>
                  <p className="text-xs text-[var(--color-neutral-500)]">
                    {endpoints.length === 0 ? 'Set up your first endpoint' : `${endpoints.length} endpoint${endpoints.length !== 1 ? 's' : ''} configured`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
          )}

          {/* Existing endpoints */}
          {!loading && endpoints.map(ep => (
            <div key={ep.id} className={`rounded-xl border p-4 space-y-3 transition-all ${ep.is_active ? 'border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/30' : 'border-[var(--border-default)] bg-[var(--color-neutral-50)]/50 opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ep.is_active ? 'bg-emerald-500' : 'bg-[var(--color-neutral-300)]'}`} />
                    <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{ep.url}</p>
                  </div>
                  {ep.description && <p className="text-xs text-[var(--color-neutral-500)] ml-4">{ep.description}</p>}
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={ep.is_active} onChange={() => handleToggleActive(ep)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[var(--color-neutral-200)] rounded-full peer peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-strong)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>

              <div className="flex flex-wrap gap-1 ml-4">
                {ep.events.map(ev => (
                  <span key={ev} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-100)]">{ev}</span>
                ))}
              </div>

              <div className="ml-4 flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-neutral-400)] shrink-0">Secret:</span>
                <code className="text-[11px] font-mono text-[var(--color-neutral-600)] bg-white px-2 py-0.5 rounded-md border border-[var(--border-default)] truncate max-w-[240px]">
                  {revealedSecrets.has(ep.id) ? ep.secret : `${ep.secret.slice(0, 10)}${'*'.repeat(16)}`}
                </code>
                <button onClick={() => toggleRevealSecret(ep.id)} className="text-[var(--color-neutral-400)] hover:text-[var(--color-primary)] transition-colors" title={revealedSecrets.has(ep.id) ? 'Hide' : 'Reveal'}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {revealedSecrets.has(ep.id) ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    ) : (
                      <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                    )}
                  </svg>
                </button>
                <button onClick={() => copySecret(ep.id, ep.secret)} className="text-[var(--color-neutral-400)] hover:text-[var(--color-primary)] transition-colors" title="Copy">
                  {copiedSecret === ep.id ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                  )}
                </button>
              </div>

              {(ep.last_success_at || ep.consecutive_failures > 0 || ep.auto_disabled_at) && (
                <div className="ml-4 flex items-center gap-3 text-[11px]">
                  {ep.last_success_at && <span className="text-emerald-600">Last success: {formatLastSynced(ep.last_success_at)}</span>}
                  {ep.consecutive_failures > 0 && <span className="text-amber-600">{ep.consecutive_failures} failure{ep.consecutive_failures !== 1 ? 's' : ''}</span>}
                  {ep.auto_disabled_at && <span className="text-red-600 font-medium">Auto-disabled</span>}
                </div>
              )}

              {testResult && testResult.id === ep.id && (
                <div className={`ml-4 text-xs font-medium px-3 py-2 rounded-lg ${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? 'Test successful' : 'Test failed'}: {testResult.message}
                </div>
              )}

              <div className="ml-4 flex items-center gap-2">
                <button onClick={() => handleTest(ep.id)} disabled={testingId === ep.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] border border-[var(--color-primary-100)] transition-all disabled:opacity-50">
                  {testingId === ep.id ? <Spinner className="w-3 h-3" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
                  Send Test
                </button>
                <button onClick={() => handleDelete(ep.id)} disabled={deletingId === ep.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50">
                  {deletingId === ep.id ? <Spinner className="w-3 h-3" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>}
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Add endpoint form */}
          {!loading && showAddForm && (
            <div className="rounded-xl border-2 border-dashed border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/20 p-5 space-y-4">
              <p className="text-sm font-bold text-[var(--color-neutral-800)]">New Endpoint</p>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-neutral-600)] mb-1.5">Endpoint URL</label>
                <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://your-server.com/webhooks/callengo"
                  className="w-full px-3 py-2.5 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-sm font-mono bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-neutral-600)] mb-1.5">Description <span className="text-[var(--color-neutral-400)] font-normal">(optional)</span></label>
                <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="e.g. Zapier automation, internal CRM sync"
                  className="w-full px-3 py-2.5 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-sm bg-white" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[var(--color-neutral-600)]">Events</label>
                  <button onClick={selectAllEvents} className="text-[11px] font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors">
                    {newEvents.length === availableEvents.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-3">
                  {Object.entries(eventsByCategory).map(([category, events]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wider mb-1.5">{category}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {events.map(ev => (
                          <label key={ev.type} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all text-xs ${
                            newEvents.includes(ev.type)
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm'
                              : 'bg-white border-[var(--border-default)] text-[var(--color-neutral-700)] hover:border-[var(--color-primary-200)]'
                          }`}>
                            <input type="checkbox" checked={newEvents.includes(ev.type)} onChange={() => toggleEvent(ev.type)} className="sr-only" />
                            <span className="font-medium">{ev.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !showAddForm && endpoints.length > 0 && endpoints.length < 10 && (
            <button onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-[var(--color-primary-200)] text-sm font-medium text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/30 transition-all">
              + Add Endpoint
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-[var(--border-subtle)] flex gap-2">
          {showAddForm ? (
            <>
              {endpoints.length > 0 && (
                <button onClick={() => { setShowAddForm(false); setError(''); }} className="flex-1 btn-secondary text-sm">Cancel</button>
              )}
              <button onClick={handleCreate} disabled={creating || !newUrl.trim() || newEvents.length === 0}
                className="flex-1 btn-primary text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {creating ? <Spinner className="w-4 h-4" /> : null}
                {creating ? 'Creating...' : 'Create Endpoint'}
              </button>
            </>
          ) : (
            <button onClick={() => { onSuccess(); onClose(); }} className="flex-1 btn-primary text-sm">Done</button>
          )}
        </div>
      </div>
    </div>
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
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center`}>
              {item.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-ink)]">{item.name}</h3>
              <p className="text-sm text-[var(--color-neutral-500)]">{item.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-neutral-50)]">
            <span className="text-sm text-[var(--color-neutral-600)]">Status</span>
            {isConnected || isAutoEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isAutoEnabled ? 'Auto-enabled' : 'Connected'}
              </span>
            ) : (
              <span className="text-xs font-medium text-[var(--color-neutral-400)]">Not connected</span>
            )}
          </div>

          {/* Connected Info */}
          {(isConnected || isAutoEnabled) && item.connectedInfo && item.connectedInfo.length > 0 && (
            <div className="space-y-2">
              {item.connectedInfo.map((info, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-neutral-50)]">
                  <span className="text-sm text-[var(--color-neutral-600)]">{info.label}</span>
                  <span className="text-sm font-medium text-[var(--color-ink)] truncate ml-4 max-w-[200px]">{info.value}</span>
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
          {isConnected && !item.settingsUrl && !item.alwaysActive && (
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
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FEEDBACK SECTION
// ============================================================================

const FEEDBACK_TYPES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'new_integration', label: 'New Integration' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'other', label: 'Other' },
] as const;

function FeedbackSection() {
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<string>('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/integrations/feedback')
      .then(res => res.json())
      .then(data => { if (data.has_submitted_today) setAlreadySubmitted(true); })
      .catch((err) => console.warn('Non-critical fetch failed:', err?.message));
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/integrations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_type: feedbackType, message: message.trim() }),
      });
      if (res.status === 429) { setAlreadySubmitted(true); setError('You already submitted feedback today. Come back tomorrow!'); return; }
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to submit'); }
      integrationEvents.feedbackSubmitted(feedbackType);
      phIntegrationEvents.feedbackSubmitted(feedbackType);
      setSubmitted(true); setMessage('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-sm font-bold text-emerald-800 mb-1">Thank you for your feedback!</p>
        <p className="text-xs text-emerald-600">Our development team reviews every suggestion. Your input helps shape the future of Callengo.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-white overflow-hidden">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary-50)] to-[var(--color-accent)]/5" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-deep-indigo)] to-[var(--color-electric)] flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-ink)]">Help us build better integrations</p>
            <p className="text-xs text-[var(--color-neutral-500)]">Your feedback goes directly to our development team. We read every single suggestion.</p>
          </div>
        </div>
      </div>

      {alreadySubmitted && !error ? (
        <div className="px-6 py-5 border-t border-[var(--border-subtle)] text-center">
          <p className="text-xs text-[var(--color-neutral-500)]">You already submitted feedback today. Thanks! Come back tomorrow if you have more ideas.</p>
        </div>
      ) : (
        <div className="px-6 py-5 border-t border-[var(--border-subtle)] space-y-3">
          {error && (
            <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FEEDBACK_TYPES.map(ft => (
              <button key={ft.value} onClick={() => setFeedbackType(ft.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  feedbackType === ft.value
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-200)]'
                }`}>
                {ft.label}
              </button>
            ))}
          </div>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder={feedbackType === 'new_integration' ? 'Which integration would you like to see? Tell us about your use case...' : 'Share your thoughts, ideas, or suggestions...'}
            rows={3}
            className="w-full px-3 py-2.5 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-sm resize-none bg-[var(--color-neutral-50)]/50"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--color-neutral-400)]">1 submission per day. No obligation, totally voluntary.</p>
            <button onClick={handleSubmit} disabled={submitting || !message.trim()}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50 inline-flex items-center gap-1.5">
              {submitting ? <Spinner className="w-3 h-3" /> : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              )}
              {submitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage({ integrations, planSlug, companyId }: IntegrationsPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all_plans');
  const [configItem, setConfigItem] = useState<IntegrationItem | null>(null);
  const [showSlackConfig, setShowSlackConfig] = useState(false);
  const [showWebhooksSetup, setShowWebhooksSetup] = useState(false);
  const [showSimplyBookSetup, setShowSimplyBookSetup] = useState(false);

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

  const handleConnect = useCallback(async (provider: string, connectUrl: string, method?: 'redirect' | 'post' | 'webhooks_inline' | 'simplybook_inline') => {
    integrationEvents.connectStarted(provider, method || 'redirect');
    phIntegrationEvents.connectStarted(provider, method || 'redirect');
    phIntegrationEvents.connectionFlowStarted(provider);
    if (method === 'webhooks_inline') {
      setShowWebhooksSetup(true);
      return;
    }
    if (method === 'simplybook_inline') {
      setShowSimplyBookSetup(true);
      return;
    }
    if (method === 'post') {
      setLoadingAction(`connect-${provider}`);
      try {
        const res = await fetch(connectUrl, { method: 'POST' });
        if (res.ok) {
          integrationEvents.connected(provider, 'post');
          phIntegrationEvents.connected(provider, 'post');
          showToast(t.integrations.syncSuccess, 'success');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable per render cycle
  }, [router, showToast]);

  const handleDisconnect = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`disconnect-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      if (res.ok) {
        integrationEvents.disconnected(provider, provider);
        phIntegrationEvents.disconnected(provider, provider);
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
    integrationEvents.syncStarted(provider);
    phIntegrationEvents.syncStarted(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        integrationEvents.syncCompleted(provider, data.records_created ?? 0, data.records_updated ?? 0);
        phIntegrationEvents.syncCompleted(provider, data.records_created ?? 0, data.records_updated ?? 0);
        showToast(t.integrations.syncSuccess, 'success');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        integrationEvents.syncFailed(provider, data.error || 'unknown');
        phIntegrationEvents.syncFailed(provider, data.error || 'unknown');
        phIntegrationEvents.crmSyncError(provider, data.error || 'unknown');
        showToast(data.error || `Failed to sync ${name}`, 'error');
      }
    } catch {
      integrationEvents.syncFailed(provider, 'network_error');
      phIntegrationEvents.syncFailed(provider, 'network_error');
      phIntegrationEvents.crmSyncError(provider, 'network_error');
      showToast(`Failed to sync ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable per render cycle
  }, [showToast, router]);

  // --------------------------------------------------------------------------
  // All integrations as flat list with category tags
  // --------------------------------------------------------------------------

  const allItems: IntegrationItem[] = useMemo(() => [
    {
      id: 'google-calendar', provider: 'google-calendar', name: 'Google Calendar',
      description: 'Sync call schedules, appointments, and events',
      icon: <GoogleCalendarIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'free', infoUrl: 'https://callengo.com/integrations/google-calendar',
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
      category: 'calendar', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/outlook-calendar',
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
      category: 'video', requiredPlan: 'free', infoUrl: 'https://callengo.com/integrations/google-meet',
      status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Google Calendar',
      parentProvider: 'google-calendar',
      parentConnectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
    },
    {
      id: 'microsoft-teams', provider: 'microsoft-teams', name: 'Microsoft Teams',
      description: 'Auto-generate Teams links for calendar events',
      icon: <TeamsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'video', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/microsoft-teams',
      status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Microsoft 365',
      parentProvider: 'microsoft-outlook',
      parentConnectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
    },
    {
      id: 'zoom', provider: 'zoom', name: 'Zoom',
      description: 'Server-to-server integration, always available',
      icon: <BiLogoZoom className="w-7 h-7" />, iconColor: 'text-[#2D8CFF]', iconBg: 'bg-blue-50',
      category: 'video', requiredPlan: 'free', infoUrl: 'https://callengo.com/integrations/zoom',
      status: 'connected',
      alwaysActive: true,
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
    {
      id: 'salesforce', provider: 'salesforce', name: 'Salesforce',
      description: 'Sync contacts, leads, and call data with your CRM',
      icon: <FaSalesforce className="w-7 h-7" />, iconColor: 'text-[#00A1E0]', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'teams', infoUrl: 'https://callengo.com/integrations/salesforce',
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
      category: 'communication', requiredPlan: 'starter', infoUrl: 'https://callengo.com/integrations/slack',
      status: integrations.slack.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
      connectedInfo: integrations.slack.connected ? [
        ...(integrations.slack.teamName ? [{ label: 'Workspace', value: integrations.slack.teamName }] : []),
        ...(integrations.slack.channelName ? [{ label: 'Channel', value: `#${integrations.slack.channelName}` }] : []),
      ] : undefined,
    },
    {
      id: 'google-sheets', provider: 'google-sheets', name: 'Google Sheets',
      description: 'Import contacts from your Google Sheets spreadsheets',
      icon: <GoogleSheetsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-green-50',
      category: 'crm', requiredPlan: 'free', infoUrl: 'https://callengo.com/integrations/google-sheets',
      status: integrations.google_sheets?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-sheets/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/google-sheets/disconnect',
      manageUrl: '/contacts',
      connectedInfo: integrations.google_sheets?.connected ? [
        ...(integrations.google_sheets.email ? [{ label: 'Account', value: integrations.google_sheets.email }] : []),
        ...(integrations.google_sheets.lastUsed ? [{ label: 'Last Import', value: new Date(integrations.google_sheets.lastUsed).toLocaleDateString() }] : []),
      ] : undefined,
    },
    {
      id: 'hubspot', provider: 'hubspot', name: 'HubSpot',
      description: 'Import contacts and sync call outcomes',
      icon: <FaHubspot className="w-7 h-7" />, iconColor: 'text-[#FF7A59]', iconBg: 'bg-orange-50',
      category: 'crm', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/hubspot',
      status: integrations.hubspot?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/hubspot/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/hubspot/disconnect',
      syncUrl: '/api/integrations/hubspot/sync',
      showSync: true,
      manageUrl: '/contacts/hubspot',
      connectedInfo: integrations.hubspot?.connected ? [
        ...(integrations.hubspot.displayName || integrations.hubspot.email ? [{ label: 'Account', value: integrations.hubspot.displayName || integrations.hubspot.email || '' }] : []),
        ...(integrations.hubspot.hubDomain ? [{ label: 'Portal', value: integrations.hubspot.hubDomain }] : []),
        ...(integrations.hubspot.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.hubspot.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'pipedrive', provider: 'pipedrive', name: 'Pipedrive',
      description: 'Bidirectional sync: import contacts and push call results back to your CRM',
      icon: <PipedriveIcon className="w-7 h-7" />, iconColor: 'text-black', iconBg: 'bg-[var(--color-neutral-50)]',
      category: 'crm', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/pipedrive',
      status: integrations.pipedrive?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/pipedrive/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/pipedrive/disconnect',
      syncUrl: '/api/integrations/pipedrive/sync',
      showSync: true,
      manageUrl: '/contacts/pipedrive',
      connectedInfo: integrations.pipedrive?.connected ? [
        ...(integrations.pipedrive.displayName || integrations.pipedrive.email ? [{ label: 'Account', value: integrations.pipedrive.displayName || integrations.pipedrive.email || '' }] : []),
        ...(integrations.pipedrive.companyName ? [{ label: 'Company', value: integrations.pipedrive.companyName }] : []),
        ...(integrations.pipedrive.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.pipedrive.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'clio', provider: 'clio', name: 'Clio',
      description: 'Import contacts, matters, and calendar from your legal practice management software',
      // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
      icon: <img src="/clio-logo.png" alt="Clio" className="w-7 h-7" />, iconColor: '', iconBg: 'bg-[#1B2B5B]/5',
      category: 'crm', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/clio',
      status: integrations.clio?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/clio/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/clio/disconnect',
      syncUrl: '/api/integrations/clio/sync',
      showSync: true,
      manageUrl: '/contacts/clio',
      connectedInfo: integrations.clio?.connected ? [
        ...(integrations.clio.displayName || integrations.clio.email ? [{ label: 'Account', value: integrations.clio.displayName || integrations.clio.email || '' }] : []),
        ...(integrations.clio.firmName ? [{ label: 'Firm', value: integrations.clio.firmName }] : []),
        ...(integrations.clio.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.clio.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'zoho', provider: 'zoho', name: 'Zoho CRM',
      description: 'Sync leads, contacts, and call logs bidirectionally',
      icon: <ZohoIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-red-50',
      category: 'crm', requiredPlan: 'business', infoUrl: 'https://callengo.com/integrations/zoho-crm',
      status: integrations.zoho?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/zoho/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/zoho/disconnect',
      syncUrl: '/api/integrations/zoho/sync', showSync: true,
      manageUrl: '/contacts/zoho',
      connectedInfo: integrations.zoho?.connected ? [
        ...(integrations.zoho.displayName || integrations.zoho.email ? [{ label: 'Account', value: integrations.zoho.displayName || integrations.zoho.email || '' }] : []),
        ...(integrations.zoho.orgName ? [{ label: 'Org', value: integrations.zoho.orgName }] : []),
        ...(integrations.zoho.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.zoho.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'simplybook', provider: 'simplybook', name: 'SimplyBook.me',
      description: 'Sync clients, bookings, and providers from SimplyBook.me',
      // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
      icon: <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-7 h-7 rounded" />, iconColor: '', iconBg: 'bg-sky-50',
      category: 'calendar', requiredPlan: 'starter', infoUrl: 'https://callengo.com/integrations/simplybook-me',
      status: integrations.simplybook?.connected ? 'connected' : 'available',
      connectUrl: '#simplybook-setup',
      connectMethod: 'simplybook_inline' as const,
      disconnectUrl: '/api/integrations/simplybook/disconnect',
      syncUrl: '/api/integrations/simplybook/sync', showSync: true,
      manageUrl: '/contacts/simplybook',
      connectedInfo: integrations.simplybook?.connected ? [
        ...(integrations.simplybook.displayName || integrations.simplybook.email ? [{ label: 'Account', value: integrations.simplybook.displayName || integrations.simplybook.email || '' }] : []),
        ...(integrations.simplybook.companyName ? [{ label: 'Company', value: integrations.simplybook.companyName }] : []),
        ...(integrations.simplybook.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.simplybook.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'webhooks', provider: 'webhooks', name: 'Webhooks',
      description: 'Receive real-time events via HTTP. Connect with Zapier, Make, n8n, or your own systems',
      icon: <WebhookIcon className="w-6 h-6" />, iconColor: 'text-[var(--color-neutral-700)]', iconBg: 'bg-[var(--color-neutral-100)]',
      category: 'communication', requiredPlan: 'starter', infoUrl: 'https://callengo.com/integrations/webhooks',
      status: 'available',
      connectUrl: '#webhooks-setup',
      connectMethod: 'webhooks_inline' as const,
    },
    {
      id: 'dynamics', provider: 'dynamics', name: 'Microsoft Dynamics',
      description: 'Sync contacts, leads, and opportunities with Dynamics 365',
      icon: <DynamicsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'teams', infoUrl: 'https://callengo.com/integrations/microsoft-dynamics-365',
      status: integrations.dynamics ? 'connected' : 'available',
      connectUrl: '/api/integrations/dynamics/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/dynamics/disconnect',
      syncUrl: '/api/integrations/dynamics/sync',
      showSync: true,
      manageUrl: '/contacts/microsoft-dynamics',
      connectedInfo: integrations.dynamics ? [
        { label: 'Account', value: (integrations as Record<string, unknown>).dynamics_email as string || 'Connected' },
      ] : undefined,
    },
    {
      id: 'stripe', provider: 'stripe', name: 'Stripe',
      description: 'Payment processing, overage billing, and auto-recharge for call minutes',
      icon: <StripeIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'payment', requiredPlan: 'free', infoUrl: 'https://callengo.com/integrations/stripe',
      status: 'connected',
      alwaysActive: true,
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
    // ── Upcoming integrations ──
    {
      id: 'gohighlevel', provider: 'gohighlevel', name: 'GoHighLevel',
      description: 'All-in-one marketing, CRM, and automation platform for agencies',
      // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
      icon: <img src="/gohighlevel-logo.png" alt="GoHighLevel" className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'business',
      status: 'coming_soon' as const,
    },
    {
      id: 'acuity-scheduling', provider: 'acuity-scheduling', name: 'Acuity Scheduling',
      description: 'Online appointment scheduling and calendar management for professionals',
      // eslint-disable-next-line @next/next/no-img-element -- Small brand logo
      icon: <img src="/acuity-scheduling-logo.png" alt="Acuity Scheduling" className="w-7 h-7" />, iconColor: '', iconBg: 'bg-emerald-50',
      category: 'calendar', requiredPlan: 'starter',
      status: 'coming_soon' as const,
    },
  ], [integrations]);

  const filteredItems = useMemo(() => {
    let items = allItems.filter(i => i.status !== 'coming_soon');
    if (activeFilter !== 'all') items = items.filter(i => i.category === activeFilter);
    if (planFilter !== 'all_plans') items = items.filter(i => planMeetsRequirement(planFilter, i.requiredPlan));
    return items;
  }, [allItems, activeFilter, planFilter]);

  const comingSoonItems = useMemo(() => allItems.filter(i => i.status === 'coming_soon'), [allItems]);

  const activeCount = allItems.filter(i => i.status === 'connected' || i.status === 'auto_enabled').length;

  const categoryBadges: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: t.common.all },
    { id: 'crm', label: t.integrations.crm },
    { id: 'calendar', label: t.integrations.calendar },
    { id: 'video', label: 'Video' },
    { id: 'communication', label: t.integrations.communication },
    { id: 'payment', label: 'Payment' },
  ];

  const planBadges: { id: PlanFilter; label: string }[] = [
    { id: 'all_plans', label: 'All Plans' },
    { id: 'free', label: 'Free' },
    { id: 'starter', label: 'Starter' },
    { id: 'business', label: 'Business' },
    { id: 'teams', label: 'Teams' },
    { id: 'enterprise', label: 'Enterprise' },
  ];

  // --------------------------------------------------------------------------
  // Tier info for upgrade CTA
  // --------------------------------------------------------------------------

  const currentTier = planSlug as PlanTier;
  const availableForPlan = allItems.filter(i => planMeetsRequirement(planSlug, i.requiredPlan) && i.status !== 'coming_soon').length;
  const totalAvailable = allItems.filter(i => i.status !== 'coming_soon').length;

  const upgradeInfo = useMemo(() => {
    const tier = planSlug as PlanTier;
    if (tier === 'free' || tier === 'starter') {
      const nextTier = tier === 'free' ? 'Starter' : 'Business';
      const nextItems = allItems.filter(i => !planMeetsRequirement(planSlug, i.requiredPlan) && i.status !== 'coming_soon');
      return {
        show: true,
        nextTier,
        unlocksCount: nextItems.length,
        headline: tier === 'free'
          ? 'Unlock Slack, webhooks, CRM sync, and more'
          : 'Unlock HubSpot, Pipedrive, Zoho CRM, and Microsoft 365',
        cta: `Upgrade to ${nextTier}`,
      };
    }
    if (tier === 'business') {
      return {
        show: true,
        nextTier: 'Teams',
        unlocksCount: allItems.filter(i => !planMeetsRequirement('business', i.requiredPlan) && i.status !== 'coming_soon').length,
        headline: 'Unlock Salesforce, Dynamics 365, and enterprise-grade integrations',
        cta: 'Upgrade to Teams',
      };
    }
    if (tier === 'teams') {
      return {
        show: true,
        nextTier: 'Enterprise',
        unlocksCount: 0,
        headline: 'Need custom integrations or dedicated support?',
        cta: 'Contact Sales',
      };
    }
    return { show: false, nextTier: '', unlocksCount: 0, headline: '', cta: '' };
  }, [planSlug, allItems]);

  // --------------------------------------------------------------------------
  // Tier summary for hero
  // --------------------------------------------------------------------------

  const tierSummary: { tier: PlanTier; label: string; count: number }[] = useMemo(() => {
    const tiers: PlanTier[] = ['free', 'starter', 'business', 'teams'];
    return tiers.map(t => ({
      tier: t,
      label: getPlanLabel(t),
      count: allItems.filter(i => planMeetsRequirement(t, i.requiredPlan) && i.status !== 'coming_soon').length,
    }));
  }, [allItems]);

  // --------------------------------------------------------------------------
  // Render card
  // --------------------------------------------------------------------------

  function renderCard(item: IntegrationItem) {
    const isComingSoon = item.status === 'coming_soon';
    const isConnected = item.status === 'connected';
    const isAutoEnabled = item.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, item.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;
    const isActive = (isConnected || isAutoEnabled) && !isLocked;

    return (
      <div
        key={item.id}
        className={`group relative flex flex-col p-5 rounded-2xl border transition-all duration-200 ${
          isActive
            ? 'border-[var(--color-primary-100)] bg-white shadow-sm hover:shadow-md'
            : isLocked
            ? 'border-[var(--color-accent)]/15 bg-gradient-to-br from-white to-[var(--color-accent)]/[0.03] hover:shadow-md hover:border-[var(--color-accent)]/25'
            : 'border-[var(--border-default)] bg-white hover:shadow-md hover:border-[var(--color-primary-200)]'
        }`}
      >
        {/* Status indicator line at top */}
        {isActive && (
          <div className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full bg-gradient-to-r from-[var(--color-deep-indigo)] to-[var(--color-electric)]" />
        )}

        {/* Locked overlay accent */}
        {isLocked && (
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl">
            <div className="absolute top-2 right-[-20px] w-[80px] text-center bg-gradient-to-r from-[var(--color-deep-indigo)] to-[var(--color-electric)] text-white text-[8px] font-bold uppercase tracking-wider py-0.5 rotate-45">
              {getPlanLabel(item.requiredPlan)}
            </div>
          </div>
        )}

        {/* Header row: icon + name + status + info link */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-11 h-11 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center shrink-0`}>
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-[var(--color-ink)] leading-tight">{item.name}</h3>
              {item.infoUrl && (
                <a
                  href={item.infoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-neutral-300)] hover:text-[var(--color-primary)] transition-colors shrink-0"
                  title={`Learn more about ${item.name}`}
                  onClick={e => e.stopPropagation()}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isAutoEnabled ? `via ${item.autoEnabledWith}` : item.alwaysActive ? 'Always active' : t.integrations.connected}
              </span>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-accent)] mt-0.5">
                <FaLock className="w-2 h-2" />
                Requires {getPlanLabel(item.requiredPlan)}
              </span>
            )}
          </div>
          {/* Minimal plan indicator for unlocked non-free */}
          {item.requiredPlan !== 'free' && !isActive && !isLocked && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-[var(--color-primary-50)] text-[var(--color-primary)]">
              {getPlanLabel(item.requiredPlan)}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-[11px] text-[var(--color-neutral-500)] leading-relaxed mb-4 flex-1">{item.description}</p>

        {/* Action button */}
        <div>
          {item.alwaysActive && (
            <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-50)]">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Built-in
            </span>
          )}

          {!item.alwaysActive && isAutoEnabled && (
            <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold text-emerald-600 bg-emerald-50">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Auto-enabled
            </span>
          )}

          {!item.alwaysActive && isConnected && !isAutoEnabled && !isLocked && (
            <button
              onClick={() => item.provider === 'slack' ? setShowSlackConfig(true) : item.provider === 'webhooks' ? setShowWebhooksSetup(true) : setConfigItem(item)}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] border border-[var(--color-primary-100)] transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t.integrations.configure}
            </button>
          )}

          {/* Locked - upgrade CTA */}
          {isLocked && (
            <Link href="/settings?section=billing"
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all btn-premium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              Unlock with {getPlanLabel(item.requiredPlan)}
            </Link>
          )}

          {/* Not locked, not connected - connect button */}
          {!isLocked && !isConnected && !isAutoEnabled && item.connectUrl && (
            <button
              onClick={() => handleConnect(item.provider, item.connectUrl!, item.connectMethod)}
              disabled={loadingAction === `connect-${item.provider}`}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold transition-all btn-primary"
            >
              {loadingAction === `connect-${item.provider}` ? <Spinner className="w-3.5 h-3.5" /> : t.integrations.connect}
            </button>
          )}

          {!isLocked && !isConnected && item.settingsUrl && !item.connectUrl && !item.parentConnectUrl && (
            <Link href={item.settingsUrl}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold transition-all btn-primary">
              {t.integrations.configure}
            </Link>
          )}

          {!isLocked && !isConnected && !isAutoEnabled && !item.connectUrl && item.parentConnectUrl && (
            <button
              onClick={() => handleConnect(item.parentProvider!, item.parentConnectUrl!)}
              disabled={loadingAction === `connect-${item.parentProvider}`}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-[11px] font-semibold transition-all btn-primary">
              {`Connect ${item.autoEnabledWith}`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Category icons
  // --------------------------------------------------------------------------

  const categoryIcons: Record<string, React.ReactNode> = {
    all: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
    crm: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    calendar: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
    video: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>,
    communication: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
    payment: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Integrations Tip Card */}
      <PageTipCard
        title="Getting started with Integrations"
        settingKey="tour_integrations_seen"
        companyId={companyId}
        tips={[
          { icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244', label: 'CRM sync', desc: 'Push call outcomes and contact updates to HubSpot, Salesforce, Pipedrive, and more' },
          { icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', label: 'Calendar sync', desc: 'Connect Google Calendar or Outlook for appointment-aware calling' },
          { icon: 'M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z', label: 'Webhook support', desc: 'Send real-time call events to Zapier, Make, or your own endpoint' },
          { icon: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z', label: 'One-click OAuth', desc: 'Connect most integrations in under a minute with secure OAuth' },
        ]}
      />

      {/* ================================================================== */}
      {/* HERO SECTION                                                       */}
      {/* ================================================================== */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-gradient-start)] via-[var(--color-gradient-mid)] to-[var(--color-gradient-end)]" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 75% 20%, rgba(255,255,255,0.15) 0%, transparent 40%)' }} />

        <div className="relative px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Left: headline + subtitle */}
            <div className="max-w-xl">
              <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-2">
                {t.integrations.title}
              </h1>
              <p className="text-white/70 text-sm leading-relaxed">
                {t.integrations.subtitle}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-5 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{activeCount}</span>
                  </div>
                  <span className="text-xs text-white/60 font-medium">Active</span>
                </div>
                <div className="w-px h-6 bg-white/15" />
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{availableForPlan}</span>
                  </div>
                  <span className="text-xs text-white/60 font-medium">Available</span>
                </div>
                <div className="w-px h-6 bg-white/15" />
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{totalAvailable}</span>
                  </div>
                  <span className="text-xs text-white/60 font-medium">Total</span>
                </div>
              </div>
            </div>

            {/* Right: Integration logos cloud + tier pills */}
            <div className="flex flex-col items-end gap-4">
              {/* Logo cloud */}
              <div className="flex items-center -space-x-2">
                {[
                  <GoogleCalendarIcon key="gc" className="w-5 h-5" />,
                  <SlackIcon key="sl" className="w-5 h-5" />,
                  <FaSalesforce key="sf" className="w-5 h-5 text-[#00A1E0]" />,
                  <FaHubspot key="hs" className="w-5 h-5 text-[#FF7A59]" />,
                  <BiLogoZoom key="zm" className="w-5 h-5 text-[#2D8CFF]" />,
                ].map((icon, i) => (
                  <div key={i} className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-white/50">
                    {icon}
                  </div>
                ))}
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur shadow-md flex items-center justify-center border-2 border-white/30 text-white text-[10px] font-bold">
                  +{totalAvailable - 6}
                </div>
              </div>

              {/* Tier summary pills */}
              <div className="flex items-center gap-2">
                {tierSummary.map(t => (
                  <div key={t.tier} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                    currentTier === t.tier
                      ? 'bg-white text-[var(--color-primary)] shadow-sm'
                      : 'bg-white/10 text-white/70'
                  }`}>
                    {currentTier === t.tier && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {t.label}: {t.count}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* UPGRADE CTA (subtle, tier-aware)                                   */}
      {/* ================================================================== */}
      {upgradeInfo.show && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary-50)] to-[var(--color-accent)]/5 border border-[var(--color-primary-100)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-deep-indigo)] to-[var(--color-electric)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-neutral-800)]">{upgradeInfo.headline}</p>
              {upgradeInfo.unlocksCount > 0 && (
                <p className="text-[11px] text-[var(--color-neutral-500)]">{upgradeInfo.unlocksCount} more integration{upgradeInfo.unlocksCount !== 1 ? 's' : ''} available on {upgradeInfo.nextTier}</p>
              )}
            </div>
          </div>
          <Link href="/settings?section=billing" className="shrink-0 btn-primary text-xs px-4 py-2">
            {upgradeInfo.cta}
          </Link>
        </div>
      )}

      {/* ================================================================== */}
      {/* FILTERS                                                            */}
      {/* ================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Category filters */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)]/80 rounded-xl">
          {categoryBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setActiveFilter(badge.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === badge.id
                  ? 'bg-white text-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-white/50'
              }`}
            >
              {categoryIcons[badge.id]}
              {badge.label}
            </button>
          ))}
        </div>

        {/* Plan filter */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)]/80 rounded-xl">
          <span className="text-[10px] font-semibold text-[var(--color-neutral-400)] uppercase tracking-wider px-2">Plan</span>
          {planBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setPlanFilter(badge.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                planFilter === badge.id
                  ? 'bg-white text-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-white/50'
              }`}
            >
              {badge.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* GRID                                                               */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => renderCard(item))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-neutral-100)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[var(--color-neutral-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </div>
          <p className="text-[var(--color-neutral-400)] text-sm font-medium">No integrations match your filters</p>
          <button onClick={() => { setActiveFilter('all'); setPlanFilter('all_plans'); }} className="text-xs text-[var(--color-primary)] font-semibold mt-2 hover:underline">Clear filters</button>
        </div>
      )}

      {/* ================================================================== */}
      {/* HELP BANNER                                                        */}
      {/* ================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary-50)] via-white to-[var(--color-accent)]/5" />
        <div className="relative p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-deep-indigo)] to-[var(--color-electric)] flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-ink)]">Need help setting up?</p>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">Step-by-step guides for every integration</p>
            </div>
          </div>
          <a href="https://callengo.com/integrations" target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-xs px-4 py-2 shrink-0 inline-flex items-center gap-1.5">
            View Guides
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </a>
        </div>
      </div>

      {/* ================================================================== */}
      {/* UPCOMING INTEGRATIONS                                              */}
      {/* ================================================================== */}
      {comingSoonItems.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-base font-bold text-[var(--color-ink)]">{t.integrations.comingSoon}</h2>
            <span className="text-[10px] font-semibold text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] px-2 py-0.5 rounded-full">{comingSoonItems.length} planned</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {comingSoonItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--color-neutral-50)]/50">
                <div className={`w-9 h-9 rounded-lg ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center shrink-0 opacity-60`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--color-neutral-700)]">{item.name}</p>
                  <p className="text-[10px] text-[var(--color-neutral-400)] truncate">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FEEDBACK SECTION                                                   */}
      {/* ================================================================== */}
      <FeedbackSection />

      {/* Slack Configure Modal */}
      {showSlackConfig && (
        <SlackConfigureModal
          companyId={companyId}
          slackTeamName={integrations.slack.teamName}
          slackChannelName={integrations.slack.channelName}
          onClose={() => setShowSlackConfig(false)}
          onSave={() => {
            setShowSlackConfig(false);
            showToast('Slack configuration saved', 'success');
          }}
        />
      )}

      {/* Webhooks Setup Modal */}
      {showWebhooksSetup && (
        <WebhooksSetupModal
          onClose={() => setShowWebhooksSetup(false)}
          onSuccess={() => {
            showToast('Webhook endpoint configured', 'success');
            router.refresh();
          }}
        />
      )}

      {/* SimplyBook Setup Modal */}
      {showSimplyBookSetup && (
        <SimplyBookSetupModal
          onClose={() => setShowSimplyBookSetup(false)}
          onSuccess={() => {
            setShowSimplyBookSetup(false);
            showToast('SimplyBook.me connected successfully', 'success');
            router.refresh();
          }}
        />
      )}

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
