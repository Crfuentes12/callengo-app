// components/agents/AgentConfigModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AgentTemplate, Company } from '@/types/supabase';

interface AgentConfigModalProps {
  agent: AgentTemplate;
  companyId: string;
  company: Company;
  onClose: () => void;
}

// Map agent names to avatar images
const getAvatarImage = (name: string) => {
  const nameMap: Record<string, string> = {
    'abandoned-cart': '/agent-avatars/abandoned-cart.png',
    'appointment': '/agent-avatars/appointment-confirmation.png',
    'data-validation': '/agent-avatars/data-validation.png',
    'feedback': '/agent-avatars/feedback.png',
    'lead-qualification': '/agent-avatars/lead-qualification.png',
    'lead-reactivation': '/agent-avatars/lead-reactivation.png',
    'winback': '/agent-avatars/winback.png',
  };

  const slug = name.toLowerCase().replace(/\s+/g, '-');
  if (nameMap[slug]) return nameMap[slug];

  for (const key in nameMap) {
    if (slug.includes(key) || key.includes(slug)) {
      return nameMap[key];
    }
  }

  return '/agent-avatars/lead-qualification.png';
};

// Generate agent stats based on agent type
const getAgentStats = (agent: AgentTemplate) => {
  // Base stats with some randomization based on agent name
  const hash = agent.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return {
    power: 85 + (hash % 15),
    speed: 82 + ((hash * 7) % 18),
    intelligence: 88 + ((hash * 3) % 12),
    charisma: 80 + ((hash * 5) % 20),
    efficiency: 90 + ((hash * 11) % 10),
    adaptability: 86 + ((hash * 13) % 14),
  };
};

const getCategoryColor = (category: string | null) => {
  const colors = {
    'sales': 'from-emerald-400 via-emerald-500 to-teal-600',
    'support': 'from-blue-400 via-blue-500 to-cyan-600',
    'verification': 'from-purple-400 via-purple-500 to-pink-600',
    'appointment': 'from-orange-400 via-orange-500 to-red-600',
    'survey': 'from-indigo-400 via-indigo-500 to-violet-600',
  };

  const cat = category?.toLowerCase() || 'default';
  return colors[cat as keyof typeof colors] || 'from-slate-400 via-slate-500 to-slate-600';
};

// Stat bar component
const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
    <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50 relative">
      <div
        className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
        style={{ width: `${value}%` }}
      >
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
      </div>
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px)'
      }}></div>
    </div>
  </div>
);

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

  const avatarImage = getAvatarImage(agent.name);
  const stats = getAgentStats(agent);
  const gradientColor = getCategoryColor(agent.category);

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl max-w-5xl w-full shadow-2xl border-2 border-slate-700/50 overflow-hidden relative">
          {/* Animated background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 animate-pulse"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative grid md:grid-cols-2 gap-6 p-8">
            {/* Left side - Agent Image & Basic Info */}
            <div className="space-y-6">
              {/* Character portrait */}
              <div className="relative group">
                <div className={`absolute -inset-1 bg-gradient-to-r ${gradientColor} rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-500`}></div>
                <div className="relative h-[400px] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                  <Image
                    src={avatarImage}
                    alt={agent.name}
                    fill
                    className="object-cover"
                  />
                  {/* Bottom gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>

                  {/* Agent name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
                    <div className={`inline-block px-3 py-1 bg-gradient-to-r ${gradientColor} rounded-md text-xs font-black uppercase mb-2`}>
                      {agent.category || 'Elite'}
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-tight mb-1">
                      {agent.name}
                    </h2>
                    <p className="text-sm text-slate-300">
                      {agent.description}
                    </p>
                  </div>

                  {/* Corner accents */}
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400"></div>
                  <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400"></div>
                </div>
              </div>

              {/* Company context */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Representing</p>
                    <p className="text-sm font-bold text-white">{company.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Agent will use company data to personalize every conversation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Stats & Abilities */}
            <div className="space-y-6">
              {/* Stats panel */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Combat Stats</h3>
                </div>

                <div className="space-y-4">
                  <StatBar label="Power" value={stats.power} color="from-red-500 to-orange-600" />
                  <StatBar label="Speed" value={stats.speed} color="from-cyan-500 to-blue-600" />
                  <StatBar label="Intelligence" value={stats.intelligence} color="from-purple-500 to-pink-600" />
                  <StatBar label="Charisma" value={stats.charisma} color="from-yellow-500 to-orange-600" />
                  <StatBar label="Efficiency" value={stats.efficiency} color="from-emerald-500 to-teal-600" />
                  <StatBar label="Adaptability" value={stats.adaptability} color="from-indigo-500 to-violet-600" />
                </div>

                {/* Overall rating */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Overall Rating</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className={`w-5 h-5 ${i < 4 ? 'text-yellow-500' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-lg font-black text-white">S-Tier</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Abilities */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Abilities</h3>
                </div>

                <div className="space-y-3 max-h-40 overflow-y-auto">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-cyan-500/30">
                    <p className="text-xs font-bold text-cyan-300 uppercase mb-1">🎯 Natural Language Processing</p>
                    <p className="text-xs text-slate-400">Advanced conversation understanding</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-purple-500/30">
                    <p className="text-xs font-bold text-purple-300 uppercase mb-1">⚡ Real-time Adaptation</p>
                    <p className="text-xs text-slate-400">Adjusts strategy based on responses</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-pink-500/30">
                    <p className="text-xs font-bold text-pink-300 uppercase mb-1">🧠 Context Awareness</p>
                    <p className="text-xs text-slate-400">Remembers conversation history</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 bg-slate-800 border-2 border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 hover:border-slate-600 font-bold uppercase text-sm tracking-wider transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    loadContactCount();
                    setStep('contacts');
                  }}
                  className={`flex-1 px-6 py-3.5 bg-gradient-to-r ${gradientColor} text-white rounded-xl hover:shadow-2xl font-black uppercase text-sm tracking-wider transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden border-2 border-white/20`}
                >
                  <span className="relative z-10">⚡ Deploy Agent</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] hover:translate-x-[200%] transition-transform duration-1000"></div>
                </button>
              </div>
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