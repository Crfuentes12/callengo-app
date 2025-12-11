// components/agents/AgentConfigModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AgentTemplate, Company } from '@/types/supabase';

interface AgentConfigModalProps {
  agent: AgentTemplate;
  companyId: string;
  company: Company;
  onClose: () => void;
}

export default function AgentConfigModal({ agent, companyId, company, onClose }: AgentConfigModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<'preview' | 'contacts' | 'confirm'>('preview');
  const [loading, setLoading] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [settings, setSettings] = useState({
    voice: 'maya',
    maxDuration: 5,
    intervalMinutes: 5,
  });

  const loadContactCount = async () => {
    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'Pending');
    
    setContactCount(count || 0);
  };

  const handleStartCampaign = async () => {
    setLoading(true);
    try {
      // Create agent run
      const { data: run, error } = await supabase
        .from('agent_runs')
        .insert({
          company_id: companyId,
          agent_template_id: agent.id,
          name: `${agent.name} - ${new Date().toLocaleDateString()}`,
          status: 'draft',
          total_contacts: contactCount,
          settings: settings,
        })
        .select()
        .single();

      if (error) throw error;

      // Redirect to campaign page
      router.push(`/dashboard/campaigns/${run.id}`);
    } catch (error) {
      alert('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">
                  {agent.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{agent.name}</h2>
                  <p className="text-sm text-slate-500">{agent.description}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Agent Behavior Preview
            </h3>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-2">Introduction</p>
                  <p className="text-sm text-slate-700">
                    {agent.first_sentence_template?.replace('{{agentName}}', 'Maya').replace('{{userCompany}}', company.name) || 
                     `"Hi, this is Maya from ${company.name}. Can you hear me okay?"`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-2">Main Task</p>
                  <p className="text-sm text-slate-700 line-clamp-3">
                    {agent.task_template.substring(0, 200)}...
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-2">Voicemail Message</p>
                  <p className="text-sm text-slate-700">
                    {agent.voicemail_template?.replace('{{agentName}}', 'Maya').replace('{{userCompany}}', company.name) || 
                     'Standard voicemail message will be left'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Agent Context</p>
                  <p className="text-sm text-blue-700">
                    This agent will represent <strong>{company.name}</strong> and will use your company information to personalize conversations.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  loadContactCount();
                  setStep('contacts');
                }}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'contacts') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Select Contacts</h2>
            <p className="text-sm text-slate-500 mt-1">Choose which contacts this agent will call</p>
          </div>

          <div className="p-6">
            <div className="bg-gradient from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Pending Contacts</p>
                  <p className="text-4xl font-bold text-slate-900">{contactCount}</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                This agent will call all pending contacts in your database. You can add more contacts before starting.
              </p>
            </div>

            {contactCount === 0 ? (
              <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-200">
                <svg className="w-12 h-12 text-amber-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-amber-900 font-medium mb-2">No pending contacts found</p>
                <p className="text-sm text-amber-700 mb-4">Import contacts first to start calling</p>
                <a
                  href="/dashboard/contacts"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Go to Contacts
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                  Call Settings
                </h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Voice Agent
                    </label>
                    <select
                      value={settings.voice}
                      onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                    >
                      <option value="maya">Maya (Female)</option>
                      <option value="nat">Natalie (Female)</option>
                      <option value="josh">Josh (Male)</option>
                      <option value="matt">Matt (Male)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Max Call Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={settings.maxDuration}
                      onChange={(e) => setSettings({ ...settings, maxDuration: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Interval Between Calls (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.intervalMinutes}
                      onChange={(e) => setSettings({ ...settings, intervalMinutes: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('preview')}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Review & Start
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    const estimatedCost = contactCount * 0.09;
    const estimatedDuration = contactCount * settings.intervalMinutes;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Confirm Campaign</h2>
            <p className="text-sm text-slate-500 mt-1">Review details before starting</p>
          </div>

          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Agent</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{agent.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Total Contacts</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{contactCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Voice</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{settings.voice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Max Duration</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{settings.maxDuration} min</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Estimated Campaign Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700">Estimated Cost:</p>
                    <p className="font-bold text-blue-900">${estimatedCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Estimated Duration:</p>
                    <p className="font-bold text-blue-900">{Math.ceil(estimatedDuration / 60)} hours</p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  * Costs are approximate and depend on actual call durations
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('contacts')}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleStartCampaign}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Creating...' : 'Start Campaign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}