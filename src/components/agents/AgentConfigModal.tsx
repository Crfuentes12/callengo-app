// components/agents/AgentConfigModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AgentTemplate, Company, ContactList } from '@/types/supabase';

interface AgentConfigModalProps {
  agent: AgentTemplate;
  companyId: string;
  company: Company;
  onClose: () => void;
}

// Map agent names to avatar images
const getAvatarImage = (name: string, voice?: string) => {
  // If voice is selected, use gender-specific avatar
  if (voice) {
    const femaleVoices = ['maya', 'nat'];
    const maleVoices = ['josh', 'matt'];

    if (femaleVoices.includes(voice)) {
      return '/agent-avatars/female-agent.png';
    } else if (maleVoices.includes(voice)) {
      return '/agent-avatars/male-agent.png';
    }
  }

  // Default behavior without voice - show robot avatars
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

// Generate realistic agent stats based on agent type
const getAgentStats = (agent: AgentTemplate) => {
  const name = agent.name.toLowerCase();

  // Data Validation Agent - High accuracy, medium persuasion
  if (name.includes('data') || name.includes('validation')) {
    return {
      accuracy: 98,
      communication: 85,
      speed: 92,
      technical: 95,
    };
  }

  // Lead Reactivation - High persuasion and persistence
  if (name.includes('reactivation') || name.includes('lead')) {
    return {
      persuasion: 94,
      persistence: 96,
      empathy: 88,
      communication: 91,
    };
  }

  // Abandoned Cart - High urgency and conversion focus
  if (name.includes('cart') || name.includes('abandoned')) {
    return {
      persuasion: 92,
      urgency: 95,
      empathy: 87,
      conversion: 93,
    };
  }

  // Feedback Collection - High empathy and communication
  if (name.includes('feedback') || name.includes('survey')) {
    return {
      empathy: 96,
      communication: 94,
      patience: 90,
      listening: 93,
    };
  }

  // Appointment Confirmation - High reliability and precision
  if (name.includes('appointment') || name.includes('confirmation')) {
    return {
      reliability: 98,
      communication: 89,
      precision: 96,
      scheduling: 94,
    };
  }

  // Winback campaigns - Maximum persuasion
  if (name.includes('winback') || name.includes('win-back')) {
    return {
      persuasion: 97,
      empathy: 91,
      persistence: 89,
      value_proposition: 94,
    };
  }

  // Default stats for unknown agents
  return {
    communication: 88,
    efficiency: 90,
    adaptability: 86,
    intelligence: 92,
  };
};

const getCategoryColor = (category: string | null) => {
  const colors = {
    'sales': 'from-emerald-400 via-emerald-500 to-teal-600',
    'support': 'from-blue-400 via-blue-500 to-cyan-600',
    'verification': 'from-purple-400 via-purple-500 to-pink-600',
    'appointment': 'from-blue-400 via-blue-500 to-cyan-600',
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
  const [agentName, setAgentName] = useState('');
  const [agentTitle, setAgentTitle] = useState('AI Sales Agent');
  const [imageTransitioning, setImageTransitioning] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    voice: '',
    maxDuration: 5,
    intervalMinutes: 5,
    maxCallsPerDay: 100,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    timezone: 'America/New_York',
    customTask: '',
    selectedLists: [] as string[],
    companyInfo: {
      name: company.name,
      description: company.description || '',
      website: company.website || '',
      phone: company.phone_number || '',
    },
  });

  // Load contact lists on mount
  useEffect(() => {
    loadContactLists();
  }, []);

  // Reload contact count when selected lists change
  useEffect(() => {
    if (step === 'contacts') {
      loadContactCount();
    }
  }, [selectedLists, step]);

  const loadContactLists = async () => {
    const { data, error } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (data) {
      setContactLists(data);
    }
  };

  // Handle voice change with smooth transition
  const handleVoiceChange = (newVoice: string) => {
    setImageTransitioning(true);
    setTimeout(() => {
      setSettings({ ...settings, voice: newVoice });
      setTimeout(() => setImageTransitioning(false), 50);
    }, 300);
  };

  const loadContactCount = async () => {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'Pending');

    // Filter by selected lists if any
    if (selectedLists.length > 0) {
      query = query.in('list_id', selectedLists);
    }

    const { count } = await query;
    setContactCount(count || 0);
  };

  const toggleListSelection = (listId: string) => {
    setSelectedLists(prev => {
      const newSelection = prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId];
      return newSelection;
    });
  };

  const handleStartCampaign = async () => {
    setLoading(true);
    try {
      // Update settings with selected lists
      const finalSettings = {
        ...settings,
        selectedLists: selectedLists,
      };

      // Create agent run
      const { data: run, error } = await supabase
        .from('agent_runs')
        .insert({
          company_id: companyId,
          agent_template_id: agent.id,
          name: `${agentName || agent.name} - ${new Date().toLocaleDateString()}`,
          status: 'draft',
          total_contacts: contactCount,
          settings: finalSettings,
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

  const avatarImage = getAvatarImage(agent.name, settings.voice);
  const stats = getAgentStats(agent);
  const gradientColor = getCategoryColor(agent.category);

  // Step indicator component
  const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <div className="flex items-center justify-center gap-3 mb-6">
      {[1, 2, 3].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
            stepNum === currentStep
              ? `bg-gradient-to-r ${gradientColor} border-white shadow-lg scale-110`
              : stepNum < currentStep
              ? 'bg-emerald-600 border-emerald-400'
              : 'bg-slate-800 border-slate-600'
          }`}>
            <span className="text-white font-black text-sm">{stepNum}</span>
          </div>
          {stepNum < 3 && (
            <div className={`w-12 h-0.5 mx-1 transition-all duration-300 ${
              stepNum < currentStep ? 'bg-emerald-400' : 'bg-slate-700'
            }`}></div>
          )}
        </div>
      ))}
    </div>
  );

  const getStepNumber = () => {
    if (step === 'preview') return 1;
    if (step === 'contacts') return 2;
    if (step === 'confirm') return 3;
    return 1;
  };

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border-2 border-slate-700/50 overflow-hidden relative flex flex-col">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Scrolleable content */}
          <div className="overflow-y-auto p-6">
            <StepIndicator currentStep={getStepNumber()} />

            {/* Single column optimized layout */}
            <div className="space-y-5">
              {/* Agent Profile Section - Centered */}
              <div className="flex flex-col items-center">
                {/* Agent avatar - 1:1 Square ratio */}
                <div className={`relative w-64 h-64 rounded-xl overflow-hidden border-2 ${settings.voice ? `border-cyan-500/50` : 'border-slate-700'} shadow-2xl transition-all duration-500 ${imageTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                  <Image
                    src={avatarImage}
                    alt={agentName || agent.name}
                    fill
                    className="object-cover"
                    key={settings.voice}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>

                  {/* Agent name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-0.5">
                      {agentName || agent.name}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {agentTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration Grid - Two columns */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Voice & Identity Configuration */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50 space-y-3">
                  <h3 className="text-xs font-black text-white uppercase mb-3">Agent Identity</h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                      Voice <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={settings.voice}
                      onChange={(e) => handleVoiceChange(e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-900/50 border ${!settings.voice ? 'border-red-500/50' : 'border-slate-700'} rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all`}
                    >
                      <option value="">Select a voice...</option>
                      <option value="maya">Maya (Female)</option>
                      <option value="nat">Natalie (Female)</option>
                      <option value="josh">Josh (Male)</option>
                      <option value="matt">Matt (Male)</option>
                    </select>
                    {!settings.voice && (
                      <p className="text-xs text-red-400 mt-1">Please select a voice to continue</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Agent Name</label>
                    <input
                      type="text"
                      placeholder={agent.name}
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Agent Title</label>
                    <input
                      type="text"
                      placeholder="AI Sales Agent"
                      value={agentTitle}
                      onChange={(e) => setAgentTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Core Capabilities */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
                  <h3 className="text-xs font-black text-white uppercase mb-3">Core Capabilities</h3>
                  <div className="space-y-2.5">
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-cyan-500/30">
                      <p className="text-xs font-bold text-cyan-300">Advanced NLP</p>
                      <p className="text-xs text-slate-400 mt-1">Natural language understanding</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-purple-500/30">
                      <p className="text-xs font-bold text-purple-300">Real-time Adaptation</p>
                      <p className="text-xs text-slate-400 mt-1">Dynamic conversation flow</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-pink-500/30">
                      <p className="text-xs font-bold text-pink-300">Context Memory</p>
                      <p className="text-xs text-slate-400 mt-1">Conversation history tracking</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:border-slate-600 font-bold text-sm transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!settings.voice) return;
                  loadContactCount();
                  setStep('contacts');
                }}
                disabled={!settings.voice}
                className={`flex-1 px-5 py-2.5 bg-gradient-to-r ${gradientColor} text-white rounded-lg font-black text-sm transition-all duration-300 relative overflow-hidden ${!settings.voice ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}`}
              >
                <span className="relative z-10">Deploy Agent</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'contacts') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border-2 border-slate-700/50 overflow-hidden relative flex flex-col">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Campaign Configuration</h2>
            <p className="text-sm text-slate-400 mt-1">Configure deployment settings for {agentName || agent.name}</p>
          </div>

          {/* Scrolleable content */}
          <div className="overflow-y-auto p-6">
            <StepIndicator currentStep={getStepNumber()} />

            {/* Agent summary from step 1 */}
            <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-600">
                  <Image
                    src={avatarImage}
                    alt={agentName || agent.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{agentName || agent.name}</p>
                  <p className="text-xs text-slate-400">{agentTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">Voice:</span>
                    <span className="text-xs font-bold text-cyan-400 capitalize">{settings.voice}</span>
                  </div>
                </div>
              </div>
            </div>

            {contactCount === 0 ? (
              <div className="text-center py-12 bg-amber-900/20 rounded-xl border border-amber-500/30">
                <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-amber-400 font-bold mb-2 text-lg">No Contacts Available</p>
                <p className="text-sm text-amber-300/80 mb-6">Import contacts first to start calling</p>
                <a
                  href="/dashboard/contacts"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold transition-all"
                >
                  Go to Contacts
                </a>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Contact Lists Selector */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-white uppercase">Select Contact Lists</h3>
                    <a
                      href="/dashboard/contacts"
                      target="_blank"
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                    >
                      Manage Lists →
                    </a>
                  </div>

                  {contactLists.length === 0 ? (
                    <div className="text-center py-6 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      <p className="text-sm text-slate-400 mb-3">No contact lists found</p>
                      <a
                        href="/dashboard/contacts"
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-bold text-sm transition-all"
                      >
                        Create First List
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contactLists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => toggleListSelection(list.id)}
                          className={`w-full p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                            selectedLists.includes(list.id)
                              ? 'bg-cyan-600/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                              : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                  selectedLists.includes(list.id)
                                    ? 'bg-cyan-500 border-cyan-500'
                                    : 'border-slate-600'
                                }`}
                              >
                                {selectedLists.includes(list.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{list.name}</p>
                                {list.description && (
                                  <p className="text-xs text-slate-400 mt-0.5">{list.description}</p>
                                )}
                              </div>
                            </div>
                            {list.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: list.color }}
                              />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedLists.length > 0 && (
                    <p className="text-xs text-slate-400 mt-3">
                      {selectedLists.length} list{selectedLists.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {/* Contacts Info */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                        Target Contacts
                        {selectedLists.length > 0 && (
                          <span className="ml-2 text-cyan-400">(from selected lists)</span>
                        )}
                      </p>
                      <p className="text-3xl font-black text-white">{contactCount}</p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Company Info (Editable) */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Company Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Company Name</label>
                      <input
                        type="text"
                        value={settings.companyInfo.name}
                        onChange={(e) => setSettings({ ...settings, companyInfo: { ...settings.companyInfo, name: e.target.value } })}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Description</label>
                      <textarea
                        value={settings.companyInfo.description}
                        onChange={(e) => setSettings({ ...settings, companyInfo: { ...settings.companyInfo, description: e.target.value } })}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Task Instructions */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Custom Instructions</h3>
                  <textarea
                    placeholder="Add specific instructions or context for this campaign..."
                    value={settings.customTask}
                    onChange={(e) => setSettings({ ...settings, customTask: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none placeholder-slate-500"
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Voice & Call Settings */}
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                    <h3 className="text-sm font-black text-white uppercase mb-4">Call Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Voice</label>
                        <select
                          value={settings.voice}
                          onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        >
                          <option value="maya">Maya (Female)</option>
                          <option value="nat">Natalie (Female)</option>
                          <option value="josh">Josh (Male)</option>
                          <option value="matt">Matt (Male)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Max Duration (min)</label>
                        <input
                          type="number"
                          min="1"
                          max="15"
                          value={settings.maxDuration}
                          onChange={(e) => setSettings({ ...settings, maxDuration: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Call Interval (min)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={settings.intervalMinutes}
                          onChange={(e) => setSettings({ ...settings, intervalMinutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Limits */}
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
                    <h3 className="text-sm font-black text-white uppercase mb-4">Schedule & Limits</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Max Calls/Day</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={settings.maxCallsPerDay}
                          onChange={(e) => setSettings({ ...settings, maxCallsPerDay: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Timezone</label>
                        <select
                          value={settings.timezone}
                          onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        >
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="America/Anchorage">Alaska Time (AKT)</option>
                          <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                          <option value="Europe/London">London (GMT)</option>
                          <option value="Europe/Paris">Paris (CET)</option>
                          <option value="Asia/Tokyo">Tokyo (JST)</option>
                          <option value="Asia/Dubai">Dubai (GST)</option>
                          <option value="Australia/Sydney">Sydney (AEDT)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Start Time</label>
                        <input
                          type="time"
                          value={settings.workingHoursStart}
                          onChange={(e) => setSettings({ ...settings, workingHoursStart: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">End Time</label>
                        <input
                          type="time"
                          value={settings.workingHoursEnd}
                          onChange={(e) => setSettings({ ...settings, workingHoursEnd: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {contactCount > 0 && (
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-700/50">
                <button
                  onClick={() => setStep('preview')}
                  className="flex-1 px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:border-slate-600 font-bold text-sm transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className={`flex-1 px-5 py-2.5 bg-gradient-to-r ${gradientColor} text-white rounded-lg hover:shadow-xl font-black text-sm transition-all duration-300`}
                >
                  Review & Launch
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border-2 border-slate-700/50 overflow-hidden relative flex flex-col">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Launch Campaign</h2>
            <p className="text-sm text-slate-400 mt-1">Final review before deployment</p>
          </div>

          {/* Scrolleable content */}
          <div className="overflow-y-auto p-6">
            <StepIndicator currentStep={getStepNumber()} />

            {/* Agent Summary Card */}
            <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
              <div className="flex items-start gap-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-cyan-500/50">
                  <Image
                    src={avatarImage}
                    alt={agentName || agent.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white mb-1">{agentName || agent.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{agentTitle}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Voice:</span>
                      <span className="text-xs font-bold text-cyan-400 capitalize">{settings.voice}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Contacts:</span>
                      <span className="text-xs font-bold text-emerald-400">{contactCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-xs font-black text-white uppercase mb-3">Call Configuration</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Max Duration</span>
                    <span className="text-sm font-bold text-white">{settings.maxDuration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Call Interval</span>
                    <span className="text-sm font-bold text-white">{settings.intervalMinutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Max Calls/Day</span>
                    <span className="text-sm font-bold text-white">{settings.maxCallsPerDay}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-xs font-black text-white uppercase mb-3">Schedule</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Working Hours</span>
                    <span className="text-sm font-bold text-white">{settings.workingHoursStart} - {settings.workingHoursEnd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Timezone</span>
                    <span className="text-sm font-bold text-white text-xs">{settings.timezone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('contacts')}
                className="flex-1 px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:border-slate-600 font-bold text-sm transition-all duration-300"
              >
                Back
              </button>
              <button
                onClick={handleStartCampaign}
                disabled={loading}
                className={`flex-1 px-5 py-3 bg-gradient-to-r ${gradientColor} text-white rounded-lg hover:shadow-2xl font-black text-sm transition-all duration-300 disabled:opacity-50 relative overflow-hidden`}
              >
                <span className="relative z-10">{loading ? 'Launching...' : '🚀 Launch Campaign'}</span>
                {!loading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}