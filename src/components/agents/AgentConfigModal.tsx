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
  companySettings?: any;
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

// Generate agent description based on agent type
const getAgentDescription = (agent: AgentTemplate) => {
  const name = agent.name.toLowerCase();

  if (name.includes('data') || name.includes('validation')) {
    return {
      title: 'Data Validation Agent',
      description: 'This agent calls your contacts to verify and update their information. It asks specific questions to ensure your database remains accurate and up-to-date, improving the quality of your contact data.',
      demoData: {
        companyName: 'TechCorp Solutions',
        contactName: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+1 (555) 123-4567',
      }
    };
  }

  if (name.includes('qualification') && name.includes('lead')) {
    return {
      title: 'Lead Qualification Agent',
      description: 'Qualifies NEW leads by asking targeted questions to determine if they\'re a good fit for your product or service. Scores leads based on budget, authority, need, and timeline to prioritize your sales efforts.',
      demoData: {
        companyName: 'Sales Pro Inc',
        contactName: 'Alex Martinez',
        leadSource: 'Website Form',
        interest: 'Enterprise Plan',
      }
    };
  }

  if (name.includes('reactivation')) {
    return {
      title: 'Lead Reactivation Agent',
      description: 'Reconnects with DORMANT leads who showed interest months ago but didn\'t convert. Uses personalized conversation to understand their current situation and reignite their interest with new offers or solutions.',
      demoData: {
        companyName: 'Growth Marketing Inc',
        contactName: 'Sarah Johnson',
        lastInteraction: '3 months ago',
        previousInterest: 'Premium Plan',
      }
    };
  }

  if (name.includes('cart') || name.includes('abandoned')) {
    return {
      title: 'Abandoned Cart Recovery Agent',
      description: 'Reaches out to customers who left items in their cart without completing purchase. Offers assistance, answers questions, and provides incentives to help close the sale.',
      demoData: {
        companyName: 'E-Shop Online',
        contactName: 'Mike Davis',
        cartValue: '$249.99',
        itemsLeft: '3 items',
      }
    };
  }

  if (name.includes('feedback') || name.includes('survey')) {
    return {
      title: 'Feedback Collection Agent',
      description: 'Conducts friendly conversations to gather customer feedback and satisfaction ratings. Creates a natural dialogue that encourages honest responses and valuable insights.',
      demoData: {
        companyName: 'Customer Success Co',
        contactName: 'Emily Chen',
        recentPurchase: 'Premium Service',
        purchaseDate: '2 weeks ago',
      }
    };
  }

  if (name.includes('appointment') || name.includes('confirmation')) {
    return {
      title: 'Appointment Confirmation Agent',
      description: 'Confirms upcoming appointments with your contacts, reduces no-shows, and handles rescheduling requests. Ensures your calendar stays organized and efficient.',
      demoData: {
        companyName: 'Healthcare Clinic',
        contactName: 'Robert Taylor',
        appointmentDate: 'Tomorrow at 2:00 PM',
        appointmentType: 'Consultation',
      }
    };
  }

  if (name.includes('winback') || name.includes('win-back')) {
    return {
      title: 'Winback Campaign Agent',
      description: 'Re-engages with former customers to bring them back. Uses empathy and special offers to understand why they left and presents compelling reasons to return.',
      demoData: {
        companyName: 'Subscription Services Ltd',
        contactName: 'Lisa Anderson',
        lastSubscription: '6 months ago',
        cancellationReason: 'Price concerns',
      }
    };
  }

  return {
    title: agent.name,
    description: 'This AI agent helps automate your outbound calling campaigns with natural conversations and intelligent responses.',
    demoData: {
      companyName: 'Demo Company',
      contactName: 'Test Contact',
    }
  };
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

  // Lead Qualification - High analysis and questioning
  if (name.includes('qualification') && name.includes('lead')) {
    return {
      analysis: 96,
      questioning: 94,
      efficiency: 92,
      insight: 93,
    };
  }

  // Lead Reactivation - High persuasion and persistence
  if (name.includes('reactivation')) {
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

export default function AgentConfigModal({ agent, companyId, company, companySettings, onClose }: AgentConfigModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<'preview' | 'contacts' | 'confirm'>('preview');
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [agentName, setAgentName] = useState('');
  const [agentTitle, setAgentTitle] = useState('AI Sales Agent');
  const [previousVoice, setPreviousVoice] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testingAgent, setTestingAgent] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [callAnalysis, setCallAnalysis] = useState<any>(null);
  const [analyzingCall, setAnalyzingCall] = useState(false);
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
    testPhoneNumber: companySettings?.test_phone_number || '', // Pre-fill with saved test phone number
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

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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

  // Handle voice change with smooth crossfade transition
  const handleVoiceChange = (newVoice: string) => {
    if (settings.voice && settings.voice !== newVoice) {
      setPreviousVoice(settings.voice);
      setIsTransitioning(true);

      // Update the voice immediately - crossfade will handle the visual transition
      setSettings({ ...settings, voice: newVoice });

      // Reset transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setPreviousVoice('');
      }, 300);
    } else {
      setSettings({ ...settings, voice: newVoice });
    }
  };

  const loadContactCount = async () => {
    setLoadingContacts(true);
    try {
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
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleListSelection = (listId: string) => {
    setSelectedLists(prev => {
      const newSelection = prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId];
      return newSelection;
    });
  };

  // Analyze call with OpenAI
  const analyzeCall = async (callData: any) => {
    setAnalyzingCall(true);
    try {
      const response = await fetch('/api/openai/analyze-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcripts: callData.transcripts || callData.concatenated_transcript || [],
          agentType: agent.name,
          demoData: agentInfo.demoData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCallAnalysis(result.analysis);
        console.log('✅ Call analysis complete:', result.analysis);
      }
    } catch (error) {
      console.error('❌ Error analyzing call:', error);
    } finally {
      setAnalyzingCall(false);
    }
  };

  // Poll call status from Bland API
  const pollCallStatus = async (callId: string) => {
    try {
      const response = await fetch(`/api/bland/get-call/${callId}?company_id=${companyId}`);
      const data = await response.json();

      console.log('📊 Call status poll:', data);

      if (response.ok && data.status) {
        const blandStatus = data.status.toLowerCase();

        // Map Bland status to our status
        if (blandStatus === 'queued' || blandStatus === 'initiated') {
          setCallStatus('dialing');
        } else if (blandStatus === 'ringing') {
          setCallStatus('ringing');
        } else if (blandStatus === 'in-progress' || blandStatus === 'answered') {
          setCallStatus('connected');
        } else if (blandStatus === 'completed' || blandStatus === 'ended' || blandStatus === 'no-answer' || blandStatus === 'busy' || blandStatus === 'failed') {
          setCallStatus('ended');
          setCallData(data);

          // Stop polling
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }

          // Analyze the call with AI - ONLY ONCE (check if not already analyzing or analyzed)
          if (!callAnalysis && !analyzingCall && (data.transcripts || data.concatenated_transcript)) {
            analyzeCall(data);
          }
        }
      }
    } catch (error) {
      console.error('Error polling call status:', error);
    }
  };

  const handleTestAgent = async () => {
    console.log('🔥 handleTestAgent called!');
    console.log('testPhoneNumber:', testPhoneNumber);
    console.log('settings.voice:', settings.voice);
    console.log('settings.testPhoneNumber:', settings.testPhoneNumber);

    if (!testPhoneNumber.trim() || !settings.voice) {
      console.error('❌ Validation failed - missing phone or voice');
      return;
    }

    console.log('✅ Starting test call...');
    setTestingAgent(true);
    setCallStatus('dialing');
    setCallDuration(0);

    try {
      // Build the task prompt with demo data
      const agentDesc = getAgentDescription(agent);
      const demoDataText = Object.entries(agentDesc.demoData)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const task = `You are ${agentName || agent.name}, an AI ${agentDesc.title.toLowerCase()}.
This is a DEMO call to showcase your capabilities. Use the following demo data for this conversation: ${demoDataText}.
${agentDesc.description}
Be natural, professional, and demonstrate your key capabilities in this brief demo call.`;

      console.log('📞 Calling API with:', {
        phone_number: testPhoneNumber,
        voice: settings.voice,
        company_id: companyId,
      });

      const response = await fetch('/api/bland/send-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: testPhoneNumber,
          task: task,
          voice: settings.voice,
          first_sentence: `Hi! This is ${agentName || agent.name}, calling for a quick demo. Do you have a moment?`,
          max_duration: 3, // Short demo call
          company_id: companyId,
          metadata: {
            type: 'demo_call',
            agent_template_id: agent.id,
            agent_name: agentName || agent.name,
          },
        }),
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📡 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      console.log('✅ Call initiated! Call ID:', data.call_id);
      setCallId(data.call_id);

      // Start polling for real call status every 2 seconds
      const interval = setInterval(() => {
        pollCallStatus(data.call_id);
      }, 2000);
      setPollingInterval(interval);

      // Do initial poll immediately
      pollCallStatus(data.call_id);

    } catch (error) {
      console.error('❌ Test call error:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      setCallStatus('ended');
      alert(`❌ Failed to initiate test call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => {
        setShowTestModal(false);
        setCallStatus('idle');
      }, 2000);
    } finally {
      console.log('🏁 Setting testingAgent to false');
      setTestingAgent(false);
    }
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
  const agentInfo = getAgentDescription(agent);

  // Format call duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      <>
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

            {/* Two column layout - Avatar + About */}
            <div className="space-y-5">
              {/* Agent Profile Section - Side by Side */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Agent avatar */}
                <div className="flex flex-col">
                  <div className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 ${settings.voice ? `border-cyan-500/50` : 'border-slate-700'} shadow-2xl transition-all duration-300`}>
                    {/* Current image (base layer) */}
                    <div className="absolute inset-0 z-10">
                      <Image
                        src={avatarImage}
                        alt={agentName || agent.name}
                        fill
                        className="object-cover"
                        priority
                      />
                    </div>

                    {/* Previous image (fading out during transition) */}
                    {isTransitioning && previousVoice && (
                      <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        <Image
                          src={getAvatarImage(agent.name, previousVoice)}
                          alt={agentName || agent.name}
                          fill
                          className="object-cover"
                          priority
                        />
                      </div>
                    )}

                    <div className="absolute inset-0 z-30 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>

                    {/* Agent name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none">
                      <h2 className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-0.5">
                        {agentName || agent.name}
                      </h2>
                      <p className="text-xs text-slate-300">
                        {agentTitle}
                      </p>
                    </div>
                  </div>

                  {/* Test Agent Button */}
                  <button
                    onClick={() => {
                      console.log('🎯 Test Agent button clicked!');
                      console.log('settings.testPhoneNumber:', settings.testPhoneNumber);
                      console.log('settings.voice:', settings.voice);
                      setTestPhoneNumber(settings.testPhoneNumber);
                      setShowTestModal(true);
                      console.log('✅ Modal should open now');
                    }}
                    disabled={!settings.voice || !settings.testPhoneNumber}
                    className={`mt-4 w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${(!settings.voice || !settings.testPhoneNumber) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Test Agent
                  </button>
                  {(!settings.voice || !settings.testPhoneNumber) && (
                    <p className="text-xs text-red-400 mt-2 text-center">
                      {!settings.voice && !settings.testPhoneNumber ? 'Voice and phone number required' : !settings.voice ? 'Voice required' : 'Phone number required'}
                    </p>
                  )}
                </div>

                {/* Right: About this agent */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      About this agent
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                      {agentInfo.description}
                    </p>

                    {/* Demo Data Preview */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mb-4">
                      <p className="text-xs font-bold text-cyan-400 uppercase mb-2">Demo Data Used</p>
                      <div className="space-y-1.5">
                        {Object.entries(agentInfo.demoData).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="text-white font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Phone Number Input */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <p className="text-xs font-bold text-purple-400 uppercase mb-3">Enter your phone number to test it</p>
                      <input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={settings.testPhoneNumber}
                        onChange={(e) => setSettings({ ...settings, testPhoneNumber: e.target.value })}
                        className={`w-full px-3 py-3 bg-slate-900/50 border-2 ${!settings.testPhoneNumber ? 'border-red-500/50' : 'border-purple-500/50'} rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500`}
                      />
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-red-400 font-bold">*</span> Required - You'll receive a demo call
                      </p>
                    </div>
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

      {/* Test Agent Modal Overlay */}
      {showTestModal && (
        callStatus !== 'idle' ? (
          callStatus === 'ended' && callData ? (
            // Call Results View
            <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[70] p-4">
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border-2 border-emerald-500/50 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white">Call Completed</h2>
                        <p className="text-xs text-emerald-400">Duration: {formatDuration(callDuration)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowTestModal(false);
                        setCallStatus('idle');
                        setCallData(null);
                        setCallDuration(0);
                        setCallAnalysis(null);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scrollable Results */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Call Recording */}
                      {(callData.recording_url || callData.recording || callData.concatenated_recording) && (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                          <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828 2.828" />
                            </svg>
                            Call Recording
                          </h3>
                          <audio controls className="w-full" controlsList="nodownload">
                            <source src={callData.recording_url || callData.recording || callData.concatenated_recording} type="audio/mpeg" />
                            <source src={callData.recording_url || callData.recording || callData.concatenated_recording} type="audio/wav" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}

                      {/* Transcript */}
                      {callData.transcripts && (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                          <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            Transcript
                          </h3>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {callData.transcripts.map((t: any, i: number) => {
                              const isAgent = t.user === 'assistant' || t.user === 'agent';
                              return (
                                <div key={i} className={`flex gap-2 ${isAgent ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[80%] rounded-lg p-3 ${isAgent ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-cyan-600/20 border border-cyan-500/30'}`}>
                                    <p className="text-xs font-bold text-slate-300 mb-1">{isAgent ? agentName || agent.name : 'Customer'}</p>
                                    <p className="text-sm text-white">{t.text}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Call Summary */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                        <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Call Summary
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Status:</span>
                            <span className="text-emerald-400 font-bold capitalize">{callData.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Duration:</span>
                            <span className="text-white font-bold">{formatDuration(callDuration)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Phone:</span>
                            <span className="text-white font-mono text-xs">{testPhoneNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Demo Data Used */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                        <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Demo Data Used
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(agentInfo.demoData).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="text-white font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Analysis */}
                      {analyzingCall ? (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                          <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Analyzing Call...
                          </h3>
                          <p className="text-sm text-slate-400">Extracting and structuring data from conversation...</p>
                        </div>
                      ) : callAnalysis && (
                        <>
                          {/* Call Outcome */}
                          {callAnalysis.outcome && (
                            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg p-4 border border-indigo-500/30">
                              <h3 className="text-sm font-black text-white uppercase mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Call Outcome
                              </h3>
                              <p className="text-sm text-indigo-200 font-medium">{callAnalysis.outcome}</p>
                            </div>
                          )}

                          {/* Extracted Data Table */}
                          {callAnalysis.extractedData && Object.keys(callAnalysis.extractedData).length > 0 && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-emerald-500/30">
                              <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Extracted Data
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-700">
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.extractedData).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                        <td className="py-2 px-2 text-slate-300 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2 text-emerald-400 font-mono">{String(value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Validated Fields Table */}
                          {callAnalysis.validatedFields && Object.keys(callAnalysis.validatedFields).length > 0 && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                              <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Validated Fields
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-700">
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.validatedFields).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                        <td className="py-2 px-2 text-slate-300 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2">
                                          {String(value).toLowerCase().includes('confirmed') ? (
                                            <span className="text-green-400 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                              </svg>
                                              {String(value)}
                                            </span>
                                          ) : (
                                            <span className="text-yellow-400">{String(value)}</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* New Information Table */}
                          {callAnalysis.newInformation && Object.keys(callAnalysis.newInformation).length > 0 && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
                              <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Information Collected
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-700">
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-400 font-bold">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.newInformation).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                        <td className="py-2 px-2 text-slate-300 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2 text-purple-400 font-mono">{String(value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Next Actions */}
                          {callAnalysis.nextActions && callAnalysis.nextActions.length > 0 && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                              <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Next Actions
                              </h3>
                              <ul className="space-y-2">
                                {callAnalysis.nextActions.map((action: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs">
                                    <div className="w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <span className="text-yellow-400 font-bold text-[10px]">{idx + 1}</span>
                                    </div>
                                    <span className="text-slate-200 flex-1">{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Call Quality */}
                          {callAnalysis.callQuality && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                              <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                                Call Quality
                              </h3>
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                                    style={{ width: `${(callAnalysis.callQuality.rating || 0) * 10}%` }}
                                  ></div>
                                </div>
                                <span className="text-lg font-black text-emerald-400">{callAnalysis.callQuality.rating}/10</span>
                              </div>
                              {callAnalysis.callQuality.reason && (
                                <p className="text-xs text-slate-400 italic">{callAnalysis.callQuality.reason}</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-700/50 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowTestModal(false);
                      setCallStatus('idle');
                      setCallData(null);
                      setCallDuration(0);
                      setCallAnalysis(null);
                    }}
                    className="w-full px-5 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white rounded-lg hover:shadow-xl font-bold text-sm transition-all"
                  >
                    Close Results
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Active call interface (dialing, ringing, connected)
            <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[70] p-4">
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border-2 border-purple-500/50 overflow-hidden">
                <div className="grid md:grid-cols-2">
                  {/* Left: Call Status */}
                  <div className="p-8 text-center border-r border-slate-700/50">
                    {/* Agent Avatar */}
                    <div className="relative w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-purple-500/50 shadow-2xl">
                      <Image
                        src={avatarImage}
                        alt={agentName || agent.name}
                        fill
                        className="object-cover"
                      />
                      {/* Pulsing ring animation when connected */}
                      {callStatus === 'connected' && (
                        <>
                          <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-75"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-emerald-400"></div>
                        </>
                      )}
                    </div>

                    {/* Agent Name */}
                    <h2 className="text-2xl font-black text-white mb-2">{agentName || agent.name}</h2>

                    {/* Call Status Text */}
                    <div className="mb-6">
                      {callStatus === 'dialing' && (
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                          <p className="text-lg font-bold text-cyan-400">Dialing...</p>
                        </div>
                      )}
                      {callStatus === 'ringing' && (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 text-yellow-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <p className="text-lg font-bold text-yellow-400">Ringing...</p>
                        </div>
                      )}
                      {callStatus === 'connected' && (
                        <div>
                          <p className="text-lg font-bold text-emerald-400 mb-2">Connected</p>
                          {/* Call Duration Timer */}
                          <div className="text-5xl font-black text-white tabular-nums tracking-tight">
                            {formatDuration(callDuration)}
                          </div>
                          <p className="text-sm text-slate-400 mt-2">Demo call in progress</p>
                        </div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <p className="text-sm text-slate-400 mb-6">{testPhoneNumber}</p>

                    {/* Waveform Animation when connected */}
                    {callStatus === 'connected' && (
                      <div className="flex items-center justify-center gap-1 h-12">
                        {[...Array(20)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                            style={{
                              height: `${Math.random() * 100}%`,
                              animation: `wave 0.${5 + Math.random() * 10}s ease-in-out infinite`,
                              animationDelay: `${i * 0.05}s`,
                            }}
                          ></div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Demo Data */}
                  <div className="p-6 bg-slate-800/30">
                    <h3 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Demo Data Being Used
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(agentInfo.demoData).map(([key, value]) => (
                        <div key={key} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="text-sm text-white font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-xs text-purple-300">
                        <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        The agent is using this demo data in the conversation to showcase its capabilities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          // Initial modal to enter phone number and start test
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70] p-4">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-md w-full shadow-2xl border-2 border-purple-500/50 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-black text-white">Test Agent</h2>
                  </div>
                  <button
                    onClick={() => setShowTestModal(false)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-purple-300 mb-1">Test with Demo Data</p>
                      <p className="text-xs text-purple-200/80">
                        <span className="text-cyan-400 font-bold">{agentName || agent.name}</span> will call you using the demo data. You'll experience a real conversation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agent Info Summary */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-purple-500/50">
                      <Image
                        src={avatarImage}
                        alt={agentName || agent.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{agentName || agent.name}</p>
                      <p className="text-xs text-slate-400 capitalize">Voice: {settings.voice}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-purple-400 uppercase">Demo Data</p>
                    {Object.entries(agentInfo.demoData).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phone Number Display */}
                <div className="mb-6 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                    Calling <span className="text-emerald-400">*</span>
                  </label>
                  <p className="text-lg font-bold text-white">{testPhoneNumber}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTestModal(false)}
                    disabled={testingAgent}
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 font-bold text-sm transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      console.log('🚀 Start Test Call button clicked in modal!');
                      handleTestAgent();
                    }}
                    disabled={!testPhoneNumber.trim() || testingAgent}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testingAgent ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Calling...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Start Test Call
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </>
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

            {loadingContacts ? (
              <div className="space-y-6">
                {/* Loading skeleton */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-16 bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-700 rounded"></div>
                  </div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 animate-pulse">
                  <div className="h-24 bg-slate-700 rounded"></div>
                </div>
              </div>
            ) : contactCount === 0 ? (
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
            {!loadingContacts && contactCount > 0 && (
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
                    <span className="text-sm font-bold text-white">{settings.timezone}</span>
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

  // Modal is now embedded in the preview step above

  return null;
}
