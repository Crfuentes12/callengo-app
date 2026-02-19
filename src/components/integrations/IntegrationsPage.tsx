// components/integrations/IntegrationsPage.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [filter, setFilter] = useState<'all' | 'crm' | 'communication' | 'telephony' | 'automation' | 'productivity'>('all');

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
      status: 'available',
      color: 'bg-red-50',
      iconColor: 'text-[#F22F46]',
      icon: <SiTwilio className="w-6 h-6" />,
      requiredPlan: 'free',
      action: () => router.push('/settings?tab=calling&section=phone-numbers'),
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync your call schedules and campaign timelines directly with Google Calendar for seamless scheduling.',
      category: 'productivity',
      categoryLabel: 'Productivity',
      status: 'coming_soon',
      color: 'bg-blue-50',
      iconColor: 'text-[#4285F4]',
      icon: <SiGooglecalendar className="w-6 h-6" />,
      requiredPlan: 'starter',
    },
    {
      id: 'calendly',
      name: 'Calendly',
      description: 'Automatically schedule follow-up meetings based on call outcomes. Let prospects book directly from call results.',
      category: 'productivity',
      categoryLabel: 'Productivity',
      status: 'coming_soon',
      color: 'bg-blue-50',
      iconColor: 'text-[#006BFF]',
      icon: <SiCalendly className="w-6 h-6" />,
      requiredPlan: 'starter',
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
    { id: 'crm', label: 'CRM' },
    { id: 'communication', label: 'Communication' },
    { id: 'telephony', label: 'Telephony' },
    { id: 'automation', label: 'Automation' },
    { id: 'productivity', label: 'Productivity' },
  ];

  return (
    <div className="space-y-6">
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
              integration.status === 'available'
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

            <button
              disabled={integration.status === 'coming_soon'}
              onClick={integration.action}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                integration.status === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : integration.status === 'coming_soon'
                  ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'btn-primary w-full justify-center'
              }`}
            >
              {integration.status === 'connected'
                ? 'Connected'
                : integration.status === 'coming_soon'
                ? 'Coming Soon'
                : integration.id === 'twilio'
                ? 'Configure Phone Numbers'
                : 'Connect'}
            </button>
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
