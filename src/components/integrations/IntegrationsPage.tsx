// components/integrations/IntegrationsPage.tsx
'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  status: 'available' | 'coming_soon' | 'connected';
  color: string;
}

export default function IntegrationsPage() {
  const [filter, setFilter] = useState<'all' | 'crm' | 'communication' | 'analytics' | 'automation'>('all');

  const integrations: Integration[] = [
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Sync contacts and call data with your Salesforce CRM. Automatically update lead status after calls.',
      category: 'crm',
      status: 'coming_soon',
      color: 'bg-blue-50 text-blue-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      ),
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Connect your HubSpot CRM to import contacts and sync call outcomes automatically.',
      category: 'crm',
      status: 'coming_soon',
      color: 'bg-orange-50 text-orange-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      ),
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get real-time notifications about call completions, campaign progress, and important events.',
      category: 'communication',
      status: 'coming_soon',
      color: 'bg-purple-50 text-purple-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
      ),
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect Callengo with 5000+ apps. Automate workflows and trigger actions based on call outcomes.',
      category: 'automation',
      status: 'coming_soon',
      color: 'bg-orange-50 text-orange-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      description: 'Import contacts from Google Sheets and export call results automatically to spreadsheets.',
      category: 'analytics',
      status: 'coming_soon',
      color: 'bg-green-50 text-green-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
        </svg>
      ),
    },
    {
      id: 'webhook',
      name: 'Webhooks',
      description: 'Send real-time event data to your own endpoints. Perfect for custom integrations and workflows.',
      category: 'automation',
      status: 'coming_soon',
      color: 'bg-slate-50 text-slate-600',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
  ];

  const filteredIntegrations = filter === 'all'
    ? integrations
    : integrations.filter(i => i.category === filter);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'communication', label: 'Communication' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'automation', label: 'Automation' },
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
            onClick={() => setFilter(cat.id as any)}
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
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${integration.color} flex items-center justify-center`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{integration.name}</h3>
                  <span className="text-xs text-slate-500 capitalize">{integration.category}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4 leading-relaxed">{integration.description}</p>

            <button
              disabled={integration.status === 'coming_soon'}
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
                : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      {/* API Access Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl gradient-bg-subtle flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">API Access</h3>
            <p className="text-sm text-slate-500">Build custom integrations with our REST API</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Access your Callengo data programmatically. Create contacts, trigger campaigns, and retrieve call results through our API.
        </p>
        <button className="btn-secondary" disabled>
          Coming Soon
        </button>
      </div>
    </div>
  );
}
