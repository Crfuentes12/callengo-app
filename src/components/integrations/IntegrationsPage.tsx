// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { FaSalesforce, FaHubspot, FaSlack } from 'react-icons/fa';
import { SiZapier, SiTwilio, SiGooglecalendar, SiCalendly, SiGooglesheets } from 'react-icons/si';
import { MdOutlineWebhook } from 'react-icons/md';
import { AiFillApi } from 'react-icons/ai';
import { PiMicrosoftTeamsLogoFill } from 'react-icons/pi';

type PlanTier = 'free' | 'starter' | 'business' | 'enterprise';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  icon: React.ReactNode;
  status: 'available' | 'coming_soon' | 'connected';
  color: string;
  iconColor: string;
  requiredPlan: PlanTier;
  action?: () => void;
}

const planBadgeLabel: Record<PlanTier, string | null> = {
  free: null,
  starter: null,
  business: 'Business+',
  enterprise: 'Enterprise',
};

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'crm' | 'communication' | 'telephony' | 'automation' | 'productivity' | 'calendar'>('all');
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [calendlyConnected, setCalendlyConnected] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Handle OAuth callback success params
  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');
    if (integration && status === 'connected') {
      const name = integration === 'google_calendar' ? 'Google Calendar' : 'Calendly';
      showToast(`${name} connected successfully!`, 'success');
      if (integration === 'google_calendar') setGoogleCalendarConnected(true);
      if (integration === 'calendly') setCalendlyConnected(true);
      // Clean the URL params
      router.replace('/integrations', { scroll: false });
    }
  }, [searchParams, showToast, router]);

  // Fetch real integration status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        // Fetch calendar integrations status
        const res = await fetch('/api/integrations/status');
        if (res.ok) {
          const data = await res.json();
          const googleStatus = data.integrations?.find((i: { provider: string }) => i.provider === 'google_calendar');
          const calendlyStatus = data.integrations?.find((i: { provider: string }) => i.provider === 'calendly');
          if (googleStatus?.connected) setGoogleCalendarConnected(true);
          if (calendlyStatus?.connected) setCalendlyConnected(true);
        }

        // Fetch Twilio status from company_settings
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

          if (userData?.company_id) {
            const { data: companySettings } = await supabase
              .from('company_settings')
              .select('settings')
              .eq('company_id', userData.company_id)
              .single();

            const settings = companySettings?.settings as Record<string, unknown> | null;
            if (settings?.twilio_encrypted_key) {
              setTwilioConnected(true);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch integration status:', error);
      }
    }
    fetchStatus();
  }, []);

  const handleDisconnectGoogle = useCallback(async () => {
    setDisconnecting('google-calendar');
    try {
      const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      if (res.ok) {
        setGoogleCalendarConnected(false);
        showToast('Google Calendar disconnected', 'success');
      } else {
        showToast('Failed to disconnect Google Calendar', 'error');
      }
    } catch {
      showToast('Failed to disconnect Google Calendar', 'error');
    } finally {
      setDisconnecting(null);
    }
  }, [showToast]);

  const handleDisconnectCalendly = useCallback(async () => {
    setDisconnecting('calendly');
    try {
      const res = await fetch('/api/integrations/calendly/disconnect', { method: 'POST' });
      if (res.ok) {
        setCalendlyConnected(false);
        showToast('Calendly disconnected', 'success');
      } else {
        showToast('Failed to disconnect Calendly', 'error');
      }
    } catch {
      showToast('Failed to disconnect Calendly', 'error');
    } finally {
      setDisconnecting(null);
    }
  }, [showToast]);

  const integrations: Integration[] = [
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Sync contacts and call data with your Salesforce CRM. Automatically update lead status after calls.',
      category: 'crm',
      categoryLabel: 'CRM',
      status: 'coming_soon',
      color: 'bg-blue-50',
      iconColor: 'text-[#00A1E0]',
      icon: <FaSalesforce className="w-7 h-7" />,
      requiredPlan: 'business',
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Connect your HubSpot CRM to import contacts and sync call outcomes automatically.',
      category: 'crm',
      categoryLabel: 'CRM',
      status: 'coming_soon',
      color: 'bg-orange-50',
      iconColor: 'text-[#FF7A59]',
      icon: <FaHubspot className="w-7 h-7" />,
      requiredPlan: 'business',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get real-time notifications about call completions, campaign progress, and important events.',
      category: 'communication',
      categoryLabel: 'Communication',
      status: 'coming_soon',
      color: 'bg-purple-50',
      iconColor: 'text-[#4A154B]',
      icon: <FaSlack className="w-6 h-6" />,
      requiredPlan: 'free',
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect Callengo with 5000+ apps. Automate workflows and trigger actions based on call outcomes.',
      category: 'automation',
      categoryLabel: 'Automation',
      status: 'coming_soon',
      color: 'bg-orange-50',
      iconColor: 'text-[#FF4F00]',
      icon: <SiZapier className="w-6 h-6" />,
      requiredPlan: 'free',
    },
    {
      id: 'twilio',
      name: 'Twilio',
      description: 'Bring your own Twilio phone number for outbound and inbound calls. Full BYOP integration with number management.',
      category: 'telephony',
      categoryLabel: 'Telephony',
      status: twilioConnected ? 'connected' : 'available',
      color: 'bg-red-50',
      iconColor: 'text-[#F22F46]',
      icon: <SiTwilio className="w-6 h-6" />,
      requiredPlan: 'free',
      action: () => router.push('/settings?tab=calling&section=phone-numbers'),
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync your call schedules, appointments, and no-show retries directly with Google Calendar. Manage everything from the Calendar page.',
      category: 'calendar',
      categoryLabel: 'Calendar',
      status: googleCalendarConnected ? 'connected' : 'available',
      color: 'bg-blue-50',
      iconColor: 'text-[#4285F4]',
      icon: <SiGooglecalendar className="w-6 h-6" />,
      requiredPlan: 'starter',
      action: () => {
        if (!googleCalendarConnected) {
          window.location.href = '/api/integrations/google-calendar/connect';
        }
      },
    },
    {
      id: 'calendly',
      name: 'Calendly',
      description: 'Automatically schedule follow-up meetings based on call outcomes. Let prospects book directly from call results. Manage from Calendar page.',
      category: 'calendar',
      categoryLabel: 'Calendar',
      status: calendlyConnected ? 'connected' : 'available',
      color: 'bg-blue-50',
      iconColor: 'text-[#006BFF]',
      icon: <SiCalendly className="w-6 h-6" />,
      requiredPlan: 'starter',
      action: () => {
        if (!calendlyConnected) {
          window.location.href = '/api/integrations/calendly/connect';
        }
      },
    },
    {
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Receive call summaries and campaign alerts directly in your Teams channels. Stay informed without switching apps.',
      category: 'communication',
      categoryLabel: 'Communication',
      status: 'coming_soon',
      color: 'bg-indigo-50',
      iconColor: 'text-[#6264A7]',
      icon: <PiMicrosoftTeamsLogoFill className="w-7 h-7" />,
      requiredPlan: 'business',
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      description: 'Export call logs, campaign results, and contact data to Google Sheets for easy reporting and analysis.',
      category: 'productivity',
      categoryLabel: 'Productivity',
      status: 'coming_soon',
      color: 'bg-green-50',
      iconColor: 'text-[#0F9D58]',
      icon: <SiGooglesheets className="w-6 h-6" />,
      requiredPlan: 'starter',
    },
  ];

  const filteredIntegrations = filter === 'all'
    ? integrations
    : integrations.filter(i => i.category === filter);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'crm', label: 'CRM' },
    { id: 'communication', label: 'Communication' },
    { id: 'telephony', label: 'Telephony' },
    { id: 'automation', label: 'Automation' },
    { id: 'productivity', label: 'Productivity' },
  ];

  const handleDisconnect = (integrationId: string) => {
    if (integrationId === 'google-calendar') handleDisconnectGoogle();
    else if (integrationId === 'calendly') handleDisconnectCalendly();
    else if (integrationId === 'twilio') router.push('/settings?tab=calling&section=phone-numbers');
  };

  const getButtonLabel = (integration: Integration): string => {
    if (integration.status === 'connected') {
      if (integration.id === 'twilio') return 'Configured';
      return 'Connected';
    }
    if (integration.status === 'coming_soon') return 'Coming Soon';
    if (integration.id === 'twilio') return 'Configure Phone Numbers';
    if (integration.id === 'google-calendar') return 'Connect Google Calendar';
    if (integration.id === 'calendly') return 'Connect Calendly';
    return 'Connect';
  };

  const getDisconnectLabel = (integrationId: string): string => {
    if (integrationId === 'twilio') return 'Manage';
    return 'Disconnect';
  };

  return (
    <div className="space-y-6">
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
        <p className="text-slate-600 mt-1">Connect Callengo with your favorite tools and services</p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id as typeof filter)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === cat.id
                ? 'gradient-bg text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map(integration => (
          <div
            key={integration.id}
            className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow flex flex-col ${
              integration.status === 'connected'
                ? 'border-emerald-200'
                : integration.status === 'available'
                ? 'border-[var(--color-primary)]/30 shadow-sm'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${integration.color} ${integration.iconColor} flex items-center justify-center shrink-0`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{integration.name}</h3>
                  <span className="text-xs text-slate-500">{integration.categoryLabel}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {integration.status === 'connected' && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                    {integration.id === 'twilio' ? 'Configured' : 'Connected'}
                  </span>
                )}
                {integration.status === 'available' && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                    Available
                  </span>
                )}
                {planBadgeLabel[integration.requiredPlan] && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide whitespace-nowrap">
                    {planBadgeLabel[integration.requiredPlan]}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4 leading-relaxed flex-1">{integration.description}</p>

            {integration.status === 'connected' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {getButtonLabel(integration)}
                </div>
                <button
                  onClick={() => handleDisconnect(integration.id)}
                  disabled={disconnecting === integration.id}
                  className="px-3 py-2.5 rounded-lg font-medium text-sm text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                >
                  {disconnecting === integration.id ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : getDisconnectLabel(integration.id)}
                </button>
              </div>
            ) : (
              <button
                disabled={integration.status === 'coming_soon'}
                onClick={integration.action}
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                  integration.status === 'coming_soon'
                    ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'btn-primary w-full justify-center'
                }`}
              >
                {getButtonLabel(integration)}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Developer Tools */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Developer Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Webhooks */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center shrink-0">
                  <MdOutlineWebhook className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Webhooks</h3>
                  <span className="text-xs text-slate-500">Automation</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed flex-1">Send real-time event data to your own endpoints. Perfect for custom integrations and workflows.</p>
            <button
              disabled
              className="w-full py-2.5 rounded-lg font-medium text-sm bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* API Access */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <AiFillApi className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">API Access</h3>
                  <span className="text-xs text-slate-500">Developer</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide whitespace-nowrap">
                Enterprise
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed flex-1">Access your Callengo data programmatically. Create contacts, trigger campaigns, and retrieve call results through our REST API.</p>
            <button
              disabled
              className="w-full py-2.5 rounded-lg font-medium text-sm bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
