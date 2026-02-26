// components/agents/AgentConfigModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AgentTemplate, Company, ContactList } from '@/types/supabase';
import VoiceSelector from '@/components/voice/VoiceSelector';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import { determineGender, determineCategory } from '@/lib/voices/voice-utils';
import CalendarConfigStep, { type CalendarStepConfig } from '@/components/agents/CalendarConfigStep';

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
    const voiceData = BLAND_VOICES.find(v => v.id === voice);
    if (voiceData) {
      const gender = determineGender(voiceData);
      if (gender === 'female') {
        return '/agent-avatars/female-agent.png';
      } else if (gender === 'male') {
        return '/agent-avatars/male-agent.png';
      }
    }
  }

  // Default behavior without voice - show robot avatars
  const nameMap: Record<string, string> = {
    'appointment': '/agent-avatars/appointment-confirmation.png',
    'data-validation': '/agent-avatars/data-validation.png',
    'lead-qualification': '/agent-avatars/lead-qualification.png',
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

  // Appointment Confirmation - High reliability and precision
  if (name.includes('appointment') || name.includes('confirmation')) {
    return {
      reliability: 98,
      communication: 89,
      precision: 96,
      scheduling: 94,
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
    'support': 'from-blue-400 via-blue-500 to-blue-600',
    'verification': 'from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-accent)]',
    'appointment': 'from-blue-400 via-blue-500 to-blue-600',
    'survey': 'from-blue-400 via-blue-500 to-violet-600',
  };

  const cat = category?.toLowerCase() || 'default';
  return colors[cat as keyof typeof colors] || 'from-slate-400 via-slate-500 to-slate-600';
};

// Stat bar component
const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
    <div className="h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-200 relative">
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
  const [step, setStep] = useState<'preview' | 'contacts' | 'calendar' | 'confirm'>('preview');
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Use ref instead of state
  const hasAnalyzedRef = useRef(false); // Track if call has been analyzed
  const [callAnalysis, setCallAnalysis] = useState<any>(null);
  const [analyzingCall, setAnalyzingCall] = useState(false);
  const [listContactCounts, setListContactCounts] = useState<Record<string, number>>({});
  const [contactPreview, setContactPreview] = useState<any[]>([]);
  const [setAsDefaultVoice, setSetAsDefaultVoice] = useState(false);
  const [planLimits, setPlanLimits] = useState<{ maxCallDuration: number; maxCallsPerDay: number | null; minutesIncluded: number; slug: string } | null>(null);
  const [contextSuggestions, setContextSuggestions] = useState<{ title: string; detail: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Pre-fill from company settings
  const additionalSettings = (companySettings?.settings as any) || {};
  const [settings, setSettings] = useState({
    voice: companySettings?.default_voice || '',
    maxDuration: companySettings?.default_max_duration || 5,
    intervalMinutes: companySettings?.default_interval_minutes || 5,
    maxCallsPerDay: additionalSettings.max_calls_per_day || 100,
    workingHoursStart: additionalSettings.working_hours_start || '09:00',
    workingHoursEnd: additionalSettings.working_hours_end || '18:00',
    timezone: additionalSettings.timezone || 'America/New_York',
    customTask: '',
    selectedLists: [] as string[],
    testPhoneNumber: companySettings?.test_phone_number || '',
    voicemailEnabled: additionalSettings.voicemail_enabled ?? false,
    followUpEnabled: additionalSettings.followup_enabled ?? false,
    followUpMaxAttempts: additionalSettings.followup_max_attempts || 3,
    followUpIntervalHours: additionalSettings.followup_interval_hours || 24,
    smartFollowUp: additionalSettings.smart_followup_enabled ?? false,
    companyInfo: {
      name: company.name,
      description: company.description || '',
      website: company.website || '',
      phone: company.phone_number || '',
    },
    complianceAiDisclosure: false,
    complianceConsent: false,
    complianceAcceptTerms: false,
  });

  // Calendar configuration state - pre-fill from company settings
  const [calendarConfig, setCalendarConfig] = useState<CalendarStepConfig>({
    timezone: additionalSettings.timezone || 'America/New_York',
    workingHoursStart: additionalSettings.working_hours_start || '09:00',
    workingHoursEnd: additionalSettings.working_hours_end || '18:00',
    workingDays: additionalSettings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    excludeUSHolidays: additionalSettings.exclude_holidays ?? true,
    voicemailEnabled: additionalSettings.voicemail_enabled ?? false,
    followUpEnabled: additionalSettings.followup_enabled ?? false,
    followUpMaxAttempts: additionalSettings.followup_max_attempts || 3,
    followUpIntervalHours: additionalSettings.followup_interval_hours || 24,
    smartFollowUp: additionalSettings.smart_followup_enabled ?? false,
    calendarContextEnabled: true,
    defaultMeetingDuration: 30,
    preferredVideoProvider: 'zoom',
    connectedIntegrations: [],
    slackEnabled: false,
    slackChannelId: '',
    slackChannelName: '',
    slackNotifyOnCallCompleted: true,
    slackNotifyOnAppointment: true,
    slackNotifyOnFollowUp: false,
    slackNotifyOnNoShow: true,
  });

  // Determine agent type for calendar step
  const getAgentType = (): 'appointment_confirmation' | 'lead_qualification' | 'data_validation' | 'unknown' => {
    const name = agent.name.toLowerCase();
    if (name.includes('appointment') || name.includes('confirmation')) return 'appointment_confirmation';
    if (name.includes('lead') && name.includes('qualification')) return 'lead_qualification';
    if (name.includes('data') || name.includes('validation')) return 'data_validation';
    return 'unknown';
  };

  // Load contact lists and plan limits on mount
  useEffect(() => {
    loadContactLists();
    // Fetch plan limits
    fetch('/api/billing/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.subscription?.plan) {
          const p = data.subscription.plan;
          setPlanLimits({
            maxCallDuration: p.max_call_duration || 15,
            maxCallsPerDay: p.max_calls_per_day,
            minutesIncluded: p.minutes_included || 0,
            slug: p.slug || 'free',
          });
        }
      })
      .catch(() => {});
  }, []);

  // Reload contact count when selected lists change (no skeleton on list toggle)
  useEffect(() => {
    if (step === 'contacts') {
      loadContactCount(false);
    }
  }, [selectedLists, step]);

  // Auto-load AI context suggestions when entering contacts step
  useEffect(() => {
    if (step === 'contacts' && contextSuggestions.length === 0 && !loadingSuggestions) {
      setLoadingSuggestions(true);
      fetch('/api/openai/context-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: getAgentType(),
          companyName: settings.companyInfo.name,
          companyDescription: settings.companyInfo.description,
          companyWebsite: settings.companyInfo.website,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.suggestions) setContextSuggestions(data.suggestions);
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false));
    }
  }, [step]);

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
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

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

  const loadContactCount = async (showLoading = false) => {
    if (showLoading) setLoadingContacts(true);
    try {
      // Get total count based on selection
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (selectedLists.length > 0) {
        query = query.in('list_id', selectedLists);
      }

      const { count } = await query;
      setContactCount(count || 0);

      // Load per-list counts
      const counts: Record<string, number> = {};
      for (const list of contactLists) {
        const { count: listCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('list_id', list.id);
        counts[list.id] = listCount || 0;
      }
      setListContactCounts(counts);

      // Load contact preview (first 5 contacts from selection)
      let previewQuery = supabase
        .from('contacts')
        .select('id, contact_name, phone_number, email, company_name, list_id, status')
        .eq('company_id', companyId)
        .limit(5);

      if (selectedLists.length > 0) {
        previewQuery = previewQuery.in('list_id', selectedLists);
      }

      const { data: preview } = await previewQuery;
      setContactPreview(preview || []);
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

          // Stop polling IMMEDIATELY
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Analyze the call with AI - ONLY ONCE using ref (prevents re-renders from triggering multiple analyses)
          if (!hasAnalyzedRef.current && (data.transcripts || data.concatenated_transcript)) {
            hasAnalyzedRef.current = true; // Set BEFORE calling to prevent race conditions
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

      // Reset analysis tracking for new call
      hasAnalyzedRef.current = false;
      setCallAnalysis(null);

      // Start polling for real call status every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        pollCallStatus(data.call_id);
      }, 2000);

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
      // Sync default voice to settings if requested
      if (setAsDefaultVoice && settings.voice) {
        await supabase
          .from('company_settings')
          .update({ default_voice: settings.voice })
          .eq('company_id', companyId);
      }

      // Update settings with selected lists and calendar config
      const finalSettings = {
        ...settings,
        selectedLists: selectedLists,
        calendarConfig: calendarConfig,
      };

      // Create agent run - calendar config stored in settings JSONB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: run, error } = await (supabase
        .from('agent_runs') as any)
        .insert({
          company_id: companyId,
          agent_template_id: agent.id,
          name: `${agentName || agent.name} - ${new Date().toLocaleDateString()}`,
          status: 'draft',
          total_contacts: contactCount,
          settings: finalSettings,
          follow_up_enabled: calendarConfig.followUpEnabled,
          follow_up_max_attempts: calendarConfig.followUpMaxAttempts,
          follow_up_interval_hours: calendarConfig.followUpIntervalHours,
          voicemail_enabled: calendarConfig.voicemailEnabled,
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
  const stepLabels = ['Agent', 'Campaign', 'Calendar', 'Launch'];
  const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 ${
              stepNum === currentStep
                ? `bg-gradient-to-r ${gradientColor} border-white shadow-lg scale-110`
                : stepNum < currentStep
                ? 'bg-emerald-600 border-emerald-400'
                : 'bg-slate-200 border-slate-300'
            }`}>
              {stepNum < currentStep ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className={`font-bold text-xs ${stepNum === currentStep ? 'text-white' : 'text-slate-500'}`}>{stepNum}</span>
              )}
            </div>
            <span className={`text-[10px] font-bold ${
              stepNum === currentStep ? 'text-[var(--color-primary)]' : stepNum < currentStep ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {stepLabels[stepNum - 1]}
            </span>
          </div>
          {stepNum < 4 && (
            <div className={`w-8 h-0.5 mx-1 mb-4 transition-all duration-300 ${
              stepNum < currentStep ? 'bg-emerald-400' : 'bg-slate-200'
            }`}></div>
          )}
        </div>
      ))}
    </div>
  );

  const getStepNumber = () => {
    if (step === 'preview') return 1;
    if (step === 'contacts') return 2;
    if (step === 'calendar') return 3;
    if (step === 'confirm') return 4;
    return 1;
  };

  if (step === 'preview') {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" style={{ isolation: 'isolate', willChange: 'transform' }}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col" style={{ transform: 'translateZ(0)' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-100 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Scrolleable content */}
          <div className="overflow-y-auto p-6" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}>
            <StepIndicator currentStep={getStepNumber()} />

            {/* Agent header - photo + name + description */}
            <div className="flex items-start gap-4 mb-5">
              <div className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 ${settings.voice ? 'border-[var(--color-primary)]/30' : 'border-slate-200'} shadow-md flex-shrink-0 transition-all`}>
                <Image
                  src={avatarImage}
                  alt={agentName || agent.name}
                  fill
                  className="object-cover"
                  priority
                />
                {isTransitioning && previousVoice && (
                  <div className={`absolute inset-0 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                    <Image
                      src={getAvatarImage(agent.name, previousVoice)}
                      alt={agentName || agent.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">{agentName || agent.name}</h2>
                <p className="text-xs text-slate-500 mb-1">{agentTitle}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{agentInfo.description}</p>
              </div>
            </div>

            {/* Two column layout - Identity + Call Settings */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* LEFT: Agent Identity */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Agent Identity</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Voice <span className="text-red-400">*</span>
                  </label>
                  <VoiceSelector
                    selectedVoiceId={settings.voice}
                    onVoiceSelect={(voiceId) => handleVoiceChange(voiceId)}
                    variant="light"
                  />
                  {!settings.voice && (
                    <p className="text-xs text-red-400 mt-1.5">Please select a voice to continue</p>
                  )}
                  {settings.voice && settings.voice !== companySettings?.default_voice && (
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={setAsDefaultVoice}
                        onChange={e => setSetAsDefaultVoice(e.target.checked)}
                        className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <span className="text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">Set as default voice</span>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Agent Name</label>
                    <input
                      type="text"
                      placeholder={agent.name}
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Agent Title</label>
                    <input
                      type="text"
                      placeholder="AI Sales Agent"
                      value={agentTitle}
                      onChange={(e) => setAgentTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* AI Self-Identification */}
                <div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-slate-600">Identify as AI at call start</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.complianceAiDisclosure}
                        onChange={e => setSettings({ ...settings, complianceAiDisclosure: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                    </label>
                  </div>
                  {!settings.complianceAiDisclosure && (
                    <p className="text-[10px] text-amber-600 mt-1 px-1">
                      This may be required in certain jurisdictions.{' '}
                      <a href="https://callengo.com/compliance" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-700">Learn more</a>
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: Call Settings */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 uppercase mb-3 flex items-center justify-between">
                  Call Settings
                  {planLimits && (
                    <span className="text-[10px] font-medium text-slate-400 normal-case">
                      {planLimits.slug.charAt(0).toUpperCase() + planLimits.slug.slice(1)} plan
                    </span>
                  )}
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">
                        Max Duration
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max={planLimits?.maxCallDuration || 15}
                          step="1"
                          value={settings.maxDuration}
                          onChange={e => {
                            const val = Math.round(parseInt(e.target.value) || 5);
                            const max = planLimits?.maxCallDuration || 15;
                            setSettings({ ...settings, maxDuration: Math.min(val, max) });
                          }}
                          className="w-full px-3 py-2 pr-10 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">min</span>
                      </div>
                      {planLimits && (
                        <p className="text-[10px] text-[var(--color-primary)] mt-0.5">max {planLimits.maxCallDuration}m</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">Interval</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          step="1"
                          value={settings.intervalMinutes}
                          onChange={e => setSettings({ ...settings, intervalMinutes: Math.round(parseInt(e.target.value) || 5) })}
                          className="w-full px-3 py-2 pr-10 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">min</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">Calls/Day</label>
                      <input
                        type="number"
                        min="1"
                        max={planLimits?.maxCallsPerDay || 1000}
                        step="1"
                        value={settings.maxCallsPerDay}
                        onChange={e => {
                          const val = Math.round(parseInt(e.target.value) || 100);
                          const max = planLimits?.maxCallsPerDay || 1000;
                          setSettings({ ...settings, maxCallsPerDay: Math.min(val, max) });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                      />
                      {planLimits?.maxCallsPerDay && (
                        <p className="text-[10px] text-[var(--color-primary)] mt-0.5">max {planLimits.maxCallsPerDay}</p>
                      )}
                    </div>
                  </div>
                  {planLimits && (
                    <p className="text-[10px] text-slate-400">
                      ~{Math.floor(planLimits.minutesIncluded / (settings.maxDuration || 5))} calls/month at {settings.maxDuration}min each ({planLimits.minutesIncluded} min included)
                    </p>
                  )}

                  {/* Test Agent CTA */}
                  <button
                    onClick={() => {
                      setTestPhoneNumber(settings.testPhoneNumber);
                      setShowTestModal(true);
                    }}
                    disabled={!settings.voice}
                    className={`w-full mt-1 px-4 py-2.5 border-2 border-dashed rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      settings.voice
                        ? 'border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/50'
                        : 'border-slate-200 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Test Agent
                    {!settings.voice && <span className="text-[10px] font-normal">(select a voice first)</span>}
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={onClose}
                className="flex-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-bold text-sm transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!settings.voice) return;
                  loadContactCount(true);
                  setStep('contacts');
                }}
                disabled={!settings.voice}
                className={`flex-1 px-5 py-2.5 gradient-bg text-white rounded-lg font-semibold text-sm transition-all duration-300 relative overflow-hidden ${!settings.voice ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              >
                <span className="relative z-10">Configure Campaign</span>
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
            <div key="results-view" className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[70] p-4 animate-fadeIn" style={{ isolation: 'isolate', willChange: 'transform' }}>
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-emerald-500/50 overflow-hidden flex flex-col" style={{ transform: 'translateZ(0)' }}>
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Call Completed</h2>
                        <p className="text-xs text-emerald-600">Duration: {formatDuration(callDuration)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowTestModal(false);
                        setCallStatus('idle');
                        setCallData(null);
                        setCallDuration(0);
                        setCallAnalysis(null);
                        hasAnalyzedRef.current = false;
                        if (pollingIntervalRef.current) {
                          clearInterval(pollingIntervalRef.current);
                          pollingIntervalRef.current = null;
                        }
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scrollable Results */}
                <div className="flex-1 overflow-y-auto p-6" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Call Recording */}
                      {(callData.recording_url || callData.recording || callData.concatenated_recording) && (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            Transcript
                          </h3>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {callData.transcripts.map((t: any, i: number) => {
                              const isAgent = t.user === 'assistant' || t.user === 'agent';
                              return (
                                <div key={i} className={`flex gap-2 ${isAgent ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[80%] rounded-lg p-3 ${isAgent ? 'bg-[var(--color-primary-50)] border border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20'}`}>
                                    <p className="text-xs font-bold text-slate-600 mb-1">{isAgent ? agentName || agent.name : 'Customer'}</p>
                                    <p className="text-sm text-slate-900">{t.text}</p>
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
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Call Summary
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Status:</span>
                            <span className="text-emerald-600 font-bold capitalize">{callData.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Duration:</span>
                            <span className="text-slate-900 font-bold">{formatDuration(callDuration)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Phone:</span>
                            <span className="text-slate-900 font-mono text-xs">{testPhoneNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Demo Data Used */}
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Demo Data Used
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(agentInfo.demoData).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="text-slate-900 font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Analysis */}
                      {analyzingCall ? (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Analyzing Call...
                          </h3>
                          <p className="text-sm text-slate-600">Extracting and structuring data from conversation...</p>
                        </div>
                      ) : callAnalysis && (
                        <>
                          {/* Call Outcome */}
                          {callAnalysis.outcome && (
                            <div className="bg-[var(--color-primary)]/5 rounded-lg p-4 border border-[var(--color-primary)]/20">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Call Outcome
                              </h3>
                              <p className="text-sm text-slate-600 font-medium">{callAnalysis.outcome}</p>
                            </div>
                          )}

                          {/* Extracted Data Table */}
                          {callAnalysis.extractedData && Object.keys(callAnalysis.extractedData).length > 0 && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-emerald-200">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Extracted Data
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.extractedData).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-200 hover:bg-slate-100">
                                        <td className="py-2 px-2 text-slate-600 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2 text-emerald-600 font-mono">{String(value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Validated Fields Table */}
                          {callAnalysis.validatedFields && Object.keys(callAnalysis.validatedFields).length > 0 && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-[var(--color-primary)]/20">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Validated Fields
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.validatedFields).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-200 hover:bg-slate-100">
                                        <td className="py-2 px-2 text-slate-600 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2">
                                          {String(value).toLowerCase().includes('confirmed') ? (
                                            <span className="text-emerald-600 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                              </svg>
                                              {String(value)}
                                            </span>
                                          ) : (
                                            <span className="text-amber-600">{String(value)}</span>
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
                            <div className="bg-slate-50 rounded-lg p-4 border border-[var(--color-primary)]/20">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Information Collected
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Field</th>
                                      <th className="text-left py-2 px-2 text-slate-500 font-bold">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(callAnalysis.newInformation).map(([key, value]) => (
                                      <tr key={key} className="border-b border-slate-200 hover:bg-slate-100">
                                        <td className="py-2 px-2 text-slate-600 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                        <td className="py-2 px-2 text-[var(--color-primary)] font-mono">{String(value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Next Actions */}
                          {callAnalysis.nextActions && callAnalysis.nextActions.length > 0 && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-amber-200">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Next Actions
                              </h3>
                              <ul className="space-y-2">
                                {callAnalysis.nextActions.map((action: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs">
                                    <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <span className="text-amber-600 font-bold text-[10px]">{idx + 1}</span>
                                    </div>
                                    <span className="text-slate-600 flex-1">{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Call Quality */}
                          {callAnalysis.callQuality && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                                Call Quality
                              </h3>
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full gradient-bg rounded-full transition-all"
                                    style={{ width: `${(callAnalysis.callQuality.rating || 0) * 10}%` }}
                                  ></div>
                                </div>
                                <span className="text-lg font-bold text-emerald-600">{callAnalysis.callQuality.rating}/10</span>
                              </div>
                              {callAnalysis.callQuality.reason && (
                                <p className="text-xs text-slate-500 italic">{callAnalysis.callQuality.reason}</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-200 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowTestModal(false);
                      setCallStatus('idle');
                      setCallData(null);
                      setCallDuration(0);
                      setCallAnalysis(null);
                      hasAnalyzedRef.current = false;
                      if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                      }
                    }}
                    className="w-full px-5 py-3 gradient-bg text-white rounded-lg hover:opacity-90 font-semibold text-sm transition-all"
                  >
                    Close Results
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Active call interface (dialing, ringing, connected)
            <div key="active-call-view" className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[70] p-4 animate-fadeIn" style={{ isolation: 'isolate', willChange: 'transform' }}>
              <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                <div className="grid md:grid-cols-2">
                  {/* Left: Call Status */}
                  <div className="p-8 text-center border-r border-slate-200">
                    {/* Agent Avatar */}
                    <div className="relative w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-[var(--color-primary)]/30 shadow-2xl">
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
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{agentName || agent.name}</h2>

                    {/* Call Status Text */}
                    <div className="mb-6">
                      {callStatus === 'dialing' && (
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                          <p className="text-lg font-bold text-[var(--color-primary)]">Dialing...</p>
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
                          <div className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight">
                            {formatDuration(callDuration)}
                          </div>
                          <p className="text-sm text-slate-500 mt-2">Demo call in progress</p>
                        </div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <p className="text-sm text-slate-500 mb-6">{testPhoneNumber}</p>

                    {/* Waveform Animation when connected */}
                    {callStatus === 'connected' && (
                      <div className="flex items-center justify-center gap-1 h-12">
                        {[...Array(20)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-accent)] rounded-full"
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
                  <div className="p-6 bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Demo Data Being Used
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(agentInfo.demoData).map(([key, value]) => (
                        <div key={key} className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="text-sm text-slate-900 font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg p-3">
                      <p className="text-xs text-slate-600">
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
          <div key="setup-view" className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fadeIn" style={{ isolation: 'isolate', willChange: 'transform' }}>
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden" style={{ transform: 'translateZ(0)' }}>
              {/* Header */}
              <div className="p-6 border-b border-slate-200 gradient-bg-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Test Agent</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowTestModal(false);
                      hasAnalyzedRef.current = false;
                      setCallAnalysis(null);
                      if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                      }
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-primary)] mb-1">Test with Demo Data</p>
                      <p className="text-xs text-slate-600">
                        <span className="text-[var(--color-primary)] font-bold">{agentName || agent.name}</span> will call you using the demo data. You'll experience a real conversation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agent Info Summary */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[var(--color-primary)]/30">
                      <Image
                        src={avatarImage}
                        alt={agentName || agent.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{agentName || agent.name}</p>
                      <p className="text-xs text-slate-500">
                        Voice: {(() => {
                          const voice = BLAND_VOICES.find(v => v.id === settings.voice);
                          if (!voice) return settings.voice;
                          const category = determineCategory(voice);
                          return `${voice.name} • ${category.accent} ${category.language}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--color-primary)] uppercase">Demo Data</p>
                    {Object.entries(agentInfo.demoData).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phone Number Input */}
                <div className="mb-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-3">
                    Phone Number <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-base focus:ring-2 focus:ring-[var(--color-primary)] outline-none placeholder-slate-400 mb-3"
                  />
                  <button
                    onClick={async () => {
                      if (!testPhoneNumber.trim()) return;
                      try {
                        const supabase = createClient();
                        await supabase
                          .from('company_settings')
                          .update({ test_phone_number: testPhoneNumber })
                          .eq('company_id', companyId);
                        setSettings({ ...settings, testPhoneNumber });
                        // Show success feedback
                        alert('Default test phone number saved!');
                      } catch (error) {
                        console.error('Error saving default phone number:', error);
                        alert('Failed to save default phone number');
                      }
                    }}
                    disabled={!testPhoneNumber.trim()}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Set as Default
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    You'll receive a demo call at this number
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowTestModal(false);
                      hasAnalyzedRef.current = false;
                      setCallAnalysis(null);
                      if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                      }
                    }}
                    disabled={testingAgent}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-bold text-sm transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      console.log('🚀 Start Test Call button clicked in modal!');
                      handleTestAgent();
                    }}
                    disabled={!testPhoneNumber.trim() || testingAgent}
                    className="flex-1 px-4 py-3 gradient-bg text-white rounded-lg hover:opacity-90 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
    const getContextPlaceholder = () => {
      const t = getAgentType();
      if (t === 'appointment_confirmation') return 'e.g. Confirm appointments for Dr. Smith at Downtown Clinic, offer rescheduling...';
      if (t === 'lead_qualification') return 'e.g. Qualify leads for our Enterprise SaaS plan, ask about budget and timeline...';
      return 'e.g. Verify email, phone, and address for all contacts, mention privacy policy...';
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" style={{ isolation: 'isolate', willChange: 'transform' }}>
        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col" style={{ transform: 'translateZ(0)' }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="overflow-y-auto p-6" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}>
            <StepIndicator currentStep={getStepNumber()} />

            {loadingContacts ? (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-14 bg-slate-200 rounded"></div>
                    <div className="h-14 bg-slate-200 rounded"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Contact Lists */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Select Contact Lists</h3>
                    <a
                      href="/contacts"
                      target="_blank"
                      className="text-xs text-[var(--color-primary)] font-bold hover:underline"
                    >
                      Manage Lists
                    </a>
                  </div>

                  {contactLists.length === 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <p className="text-sm text-slate-600 mb-2">You don&apos;t have any lists yet.</p>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Create lists to organize contacts for better targeting, or call all contacts at once.
                      </p>
                      <a
                        href="/contacts"
                        target="_blank"
                        className="px-3 py-1.5 gradient-bg text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all inline-block"
                      >
                        Create a List
                      </a>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedLists([])}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left mb-2 ${
                          selectedLists.length === 0
                            ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedLists.length === 0 ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-slate-300'
                            }`}>
                              {selectedLists.length === 0 && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">All contacts</p>
                              <p className="text-[11px] text-slate-400">Call everyone in your database</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{contactCount}</span>
                        </div>
                      </button>

                      <div className="space-y-1.5">
                        {contactLists.map((list) => (
                          <button
                            key={list.id}
                            onClick={() => toggleListSelection(list.id)}
                            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                              selectedLists.includes(list.id)
                                ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                  selectedLists.includes(list.id) ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-slate-300'
                                }`}>
                                  {selectedLists.includes(list.id) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {list.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: list.color }} />}
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{list.name}</p>
                                    {list.description && <p className="text-[11px] text-slate-400">{list.description}</p>}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-slate-500">{listContactCounts[list.id] ?? '...'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Contact count - compact */}
                {contactCount > 0 && (
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{contactCount} contacts</p>
                        <p className="text-[11px] text-slate-500">
                          {selectedLists.length > 0 ? `${selectedLists.length} list${selectedLists.length > 1 ? 's' : ''} selected` : 'All contacts'}
                        </p>
                      </div>
                    </div>
                    {contactPreview.length > 0 && (
                      <div className="flex -space-x-2">
                        {contactPreview.slice(0, 4).map((c: any) => (
                          <div key={c.id} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-500">{(c.contact_name || '?')[0].toUpperCase()}</span>
                          </div>
                        ))}
                        {contactCount > 4 && (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                            <span className="text-[9px] font-bold text-slate-400">+{contactCount - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Campaign Context with AI suggestions */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Campaign Context</h3>
                    <div className="relative group">
                      <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-[11px] rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                        <p className="leading-relaxed">Campaign context tells the AI agent what to say and how to behave during calls. Include specific details like company name, services, tone, and any special instructions.</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  </div>

                  <textarea
                    placeholder={getContextPlaceholder()}
                    value={settings.customTask}
                    onChange={e => setSettings({ ...settings, customTask: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none placeholder-slate-300"
                    rows={3}
                  />

                  {/* AI Context Capsules - always visible */}
                  <div className="flex flex-wrap gap-2">
                    {loadingSuggestions ? (
                      <>
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-8 w-32 bg-slate-200 rounded-full animate-pulse"></div>
                        ))}
                      </>
                    ) : contextSuggestions.length > 0 ? (
                      contextSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSettings(prev => ({ ...prev, customTask: suggestion.detail }))}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-700 hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all group"
                        >
                          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </span>
                          <span className="group-hover:text-[var(--color-primary)] transition-colors">
                            {suggestion.title}
                          </span>
                        </button>
                      ))
                    ) : null}
                  </div>
                </div>

                {/* Company Summary - verify/edit with save option */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Company Info</h3>
                    <button
                      onClick={async () => {
                        try {
                          const s = createClient();
                          await s.from('companies').update({
                            name: settings.companyInfo.name,
                            description: settings.companyInfo.description,
                            website: settings.companyInfo.website,
                          }).eq('id', companyId);
                          alert('Company info saved!');
                        } catch {
                          alert('Failed to save.');
                        }
                      }}
                      className="text-[11px] font-bold text-[var(--color-primary)] hover:underline"
                    >
                      Save to settings
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Company</label>
                      <input
                        type="text"
                        value={settings.companyInfo.name}
                        onChange={e => setSettings({ ...settings, companyInfo: { ...settings.companyInfo, name: e.target.value } })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Website</label>
                      <input
                        type="text"
                        value={settings.companyInfo.website}
                        onChange={e => setSettings({ ...settings, companyInfo: { ...settings.companyInfo, website: e.target.value } })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none placeholder-slate-300"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description</label>
                      <textarea
                        value={settings.companyInfo.description}
                        onChange={e => setSettings({ ...settings, companyInfo: { ...settings.companyInfo, description: e.target.value } })}
                        placeholder="Brief description of your company..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none placeholder-slate-300 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!loadingContacts && (
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStep('preview')}
                  className="flex-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-sm transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('calendar')}
                  disabled={contactCount === 0}
                  className={`flex-1 px-5 py-2.5 gradient-bg text-white rounded-lg font-semibold text-sm transition-all duration-300 ${contactCount === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'calendar') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" style={{ isolation: 'isolate', willChange: 'transform' }}>
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col" style={{ transform: 'translateZ(0)' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-100 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Scrolleable content */}
          <div className="overflow-y-auto p-6" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}>
            <StepIndicator currentStep={getStepNumber()} />

            <CalendarConfigStep
              companyId={companyId}
              agentType={getAgentType()}
              config={calendarConfig}
              onConfigChange={setCalendarConfig}
              gradientColor={gradientColor}
              planSlug={companySettings?.plan_slug || 'free'}
              companySettings={companySettings}
            />

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={() => setStep('contacts')}
                className="flex-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-sm transition-all duration-300"
              >
                Back
              </button>
              <button
                onClick={() => {
                  // Sync calendar config back to main settings
                  setSettings(prev => ({
                    ...prev,
                    timezone: calendarConfig.timezone,
                    workingHoursStart: calendarConfig.workingHoursStart,
                    workingHoursEnd: calendarConfig.workingHoursEnd,
                    followUpEnabled: calendarConfig.followUpEnabled,
                    followUpMaxAttempts: calendarConfig.followUpMaxAttempts,
                    followUpIntervalHours: calendarConfig.followUpIntervalHours,
                    smartFollowUp: calendarConfig.smartFollowUp,
                  }));
                  setStep('confirm');
                }}
                className={`flex-1 px-5 py-2.5 gradient-bg text-white rounded-lg hover:opacity-90 font-semibold text-sm transition-all duration-300`}
              >
                Review & Launch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" style={{ isolation: 'isolate', willChange: 'transform' }}>
        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col" style={{ transform: 'translateZ(0)' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-100 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="overflow-y-auto p-6" style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}>
            <StepIndicator currentStep={getStepNumber()} />

            {/* Launch Card - visually attractive */}
            <div className="relative mb-6 bg-gradient-to-br from-[var(--color-primary)]/5 via-white to-[var(--color-accent)]/5 rounded-2xl p-6 border border-[var(--color-primary)]/15 overflow-hidden">
              <div className="relative flex items-center gap-5">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-[var(--color-primary)]/20 shadow-lg flex-shrink-0">
                  <Image
                    src={avatarImage}
                    alt={agentName || agent.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-slate-900 mb-0.5 truncate">{agentName || agent.name}</h3>
                  <p className="text-sm text-slate-500 mb-2">{agentTitle}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-primary)]/10 rounded-full text-xs font-bold text-[var(--color-primary)]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      {BLAND_VOICES.find(v => v.id === settings.voice)?.name || 'Voice'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full text-xs font-bold text-emerald-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {contactCount} contacts
                    </span>
                    {settings.complianceAiDisclosure && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">
                        AI Disclosure On
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Summary - symmetric grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Call Config */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-900 uppercase mb-2.5">Call Settings</h4>
                <div className="space-y-1.5">
                  {[
                    ['Duration', `${settings.maxDuration} min`],
                    ['Interval', `${settings.intervalMinutes} min`],
                    ['Max/Day', String(settings.maxCallsPerDay)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <span className="text-[11px] font-bold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-900 uppercase mb-2.5">Schedule</h4>
                <div className="space-y-1.5">
                  {[
                    ['Hours', `${calendarConfig.workingHoursStart} - ${calendarConfig.workingHoursEnd}`],
                    ['Days', `${calendarConfig.workingDays.length} days/week`],
                    ['Holidays', calendarConfig.excludeUSHolidays ? 'Excluded' : 'Included'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <span className="text-[11px] font-bold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-900 uppercase mb-2.5">Integrations</h4>
                <div className="space-y-1.5">
                  {calendarConfig.connectedIntegrations.length > 0 ? (
                    calendarConfig.connectedIntegrations.map(int => (
                      <div key={int} className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-[11px] font-medium text-slate-700 capitalize">{int.replace('_', ' ')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-400">No integrations</p>
                  )}
                  {calendarConfig.preferredVideoProvider !== 'none' && (
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 mt-1.5">
                      <span className="text-[11px] text-slate-500">Video</span>
                      <span className="text-[11px] font-bold text-[var(--color-primary)] capitalize">{calendarConfig.preferredVideoProvider.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-900 uppercase mb-2.5">Features</h4>
                <div className="space-y-1.5">
                  {[
                    ['Voicemail', calendarConfig.voicemailEnabled],
                    ['Follow-ups', calendarConfig.followUpEnabled],
                    ['Smart Scheduling', calendarConfig.smartFollowUp],
                    ['Slack', calendarConfig.slackEnabled],
                  ].map(([label, enabled]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-[11px] text-slate-500">{label as string}</span>
                      <span className={`text-[11px] font-bold ${enabled ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('calendar')}
                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-sm transition-all duration-300"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setSettings(prev => ({ ...prev, complianceAcceptTerms: true }));
                  handleStartCampaign();
                }}
                disabled={loading}
                className={`flex-1 px-5 py-3 gradient-bg text-white rounded-xl hover:opacity-90 font-bold text-sm transition-all duration-300 disabled:opacity-50 relative overflow-hidden shadow-lg shadow-[var(--color-primary)]/20`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                      Launching...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Launch Campaign
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Inline compliance text - subtle */}
            <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
              By launching, you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Modal is now embedded in the preview step above

  return null;
}
