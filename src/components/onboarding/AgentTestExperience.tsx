// components/onboarding/AgentTestExperience.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import { determineGender } from '@/lib/voices/voice-utils';
import VoiceSelector from '@/components/voice/VoiceSelector';

interface AgentTestExperienceProps {
  agentSlug: string;
  agentTitle: string;
  agentDescription: string;
  companyId: string;
  companyName: string;
  onComplete: (callData: any) => void;
  onSkip: () => void;
}

const AGENT_CONFIG: Record<string, any> = {
  'data-validation': {
    name: 'Data Validation Agent',
    icon: '🔍',
    color: 'from-emerald-500 to-teal-600',
    demoData: {
      companyName: 'TechCorp Solutions',
      contactName: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1 (555) 123-4567',
    },
    task: 'This is a DEMO call to showcase data validation capabilities. Use demo data: TechCorp Solutions, contact John Smith. Be friendly and professional, ask to verify email and phone number.',
  },
  'appointment-confirmation': {
    name: 'Appointment Confirmation Agent',
    icon: '📅',
    color: 'from-blue-500 to-indigo-600',
    demoData: {
      companyName: 'Healthcare Clinic',
      contactName: 'Robert Taylor',
      appointmentDate: 'Tomorrow at 2:00 PM',
      appointmentType: 'Consultation',
    },
    task: 'This is a DEMO call to showcase appointment confirmation. Use demo data: Healthcare Clinic, appointment tomorrow at 2:00 PM. Confirm the appointment and ask if they need directions.',
  },
  'lead-qualification': {
    name: 'Lead Qualification Agent',
    icon: '🎯',
    color: 'from-purple-500 to-pink-600',
    demoData: {
      companyName: 'Sales Pro Inc',
      contactName: 'Alex Martinez',
      leadSource: 'Website Form',
      interest: 'Enterprise Plan',
    },
    task: 'This is a DEMO call to showcase lead qualification. Use demo data: Sales Pro Inc, lead from website interested in Enterprise Plan. Ask about budget, timeline, and decision-making authority.',
  },
};

export default function AgentTestExperience({
  agentSlug,
  agentTitle,
  agentDescription,
  companyId,
  companyName,
  onComplete,
  onSkip,
}: AgentTestExperienceProps) {
  const agent = AGENT_CONFIG[agentSlug];
  const [step, setStep] = useState<'setup' | 'calling' | 'analysis'>('setup');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [agentName, setAgentName] = useState(agent?.name || 'AI Agent');
  const [loading, setLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<any>(null);
  const [callAnalysis, setCallAnalysis] = useState<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAnalyzedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const startCall = async () => {
    if (!phoneNumber.trim() || !selectedVoice) {
      alert('Please enter your phone number and select a voice');
      return;
    }

    setLoading(true);
    setStep('calling');
    setCallStatus('dialing');
    setCallDuration(0);
    hasAnalyzedRef.current = false;

    try {
      const demoDataText = Object.entries(agent.demoData)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const task = `You are ${agentName}, an AI ${agentTitle.toLowerCase()}.
This is a DEMO call to showcase your capabilities. Use the following demo data: ${demoDataText}.
${agentDescription}
Keep the call brief (under 2 minutes) and demonstrate your key capabilities.`;

      const response = await fetch('/api/bland/send-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          task: task,
          voice: selectedVoice,
          first_sentence: `Hi! This is ${agentName}, calling for a quick demo. Do you have a moment?`,
          max_duration: 3,
          company_id: companyId,
          metadata: {
            type: 'demo_call',
            agent_slug: agentSlug,
            agent_name: agentName,
            is_onboarding: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start call');
      }

      const data = await response.json();
      setCallId(data.call_id);
      setCallStatus('ringing');

      // Start polling for call status
      pollingIntervalRef.current = setInterval(() => pollCallStatus(data.call_id), 2000);

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please try again.');
      setLoading(false);
      setStep('setup');
      setCallStatus('idle');
    }
  };

  const pollCallStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/bland/call-status?call_id=${id}`);
      if (response.ok) {
        const data = await response.json();
        setCallData(data);

        if (data.status === 'completed' && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setCallStatus('ended');

          if (!hasAnalyzedRef.current && data.transcript_object) {
            hasAnalyzedRef.current = true;
            await analyzeCall(data);
          }
        } else if (data.status === 'active' || data.status === 'answered') {
          setCallStatus('connected');
          if (data.call_length) {
            setCallDuration(Math.floor(data.call_length / 1000));
          }
        }
      }
    } catch (error) {
      console.error('Error polling call status:', error);
    }
  };

  const analyzeCall = async (data: any) => {
    try {
      const response = await fetch('/api/openai/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.concatenated_transcript || 'Call completed',
          agent_type: agentTitle,
          call_duration: data.call_length ? Math.floor(data.call_length / 1000) : 0,
        }),
      });

      if (response.ok) {
        const analysis = await response.json();
        setCallAnalysis(analysis);
        setStep('analysis');
      }
    } catch (error) {
      console.error('Error analyzing call:', error);
      setStep('analysis'); // Still show analysis screen even if analysis fails
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'dialing': return 'from-yellow-500 to-orange-500';
      case 'ringing': return 'from-blue-500 to-indigo-500';
      case 'connected': return 'from-emerald-500 to-green-500';
      case 'ended': return 'from-purple-500 to-pink-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'dialing': return 'Dialing...';
      case 'ringing': return 'Ringing...';
      case 'connected': return 'Connected';
      case 'ended': return 'Call Ended';
      default: return 'Ready';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Setup Step */}
        {step === 'setup' && (
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-2 border-slate-800">
            {/* Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} mb-4 shadow-lg`}>
                <span className="text-3xl">{agent.icon}</span>
              </div>
              <h2 className="text-3xl font-black text-white mb-2">Test Your {agentTitle}</h2>
              <p className="text-slate-400">
                Experience how {agentName} will interact with your contacts
              </p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Agent Name */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g., Sarah, Mike, Alex"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Your Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="+1 (555) 123-4567"
                />
                <p className="text-xs text-slate-500 mt-2">
                  You'll receive a call from the AI agent in a few seconds
                </p>
              </div>

              {/* Voice Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Select Voice
                </label>
                <VoiceSelector
                  selectedVoiceId={selectedVoice}
                  onVoiceSelect={setSelectedVoice}
                  variant="dark"
                />
              </div>

              {/* Demo Data Info */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-2">Demo Data</h3>
                <div className="space-y-1">
                  {Object.entries(agent.demoData).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="text-slate-300 font-medium">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={startCall}
                  disabled={!phoneNumber || !selectedVoice || loading}
                  className={`
                    flex-1 px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-lg font-bold
                    transition-all duration-300 flex items-center justify-center gap-2
                    ${!phoneNumber || !selectedVoice || loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'}
                  `}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Start Test Call
                </button>
                <button
                  onClick={onSkip}
                  className="px-6 py-4 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calling Step */}
        {step === 'calling' && (
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm rounded-3xl p-12 shadow-2xl border-2 border-slate-800 text-center">
            {/* Status Indicator */}
            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${getStatusColor()} mb-6 shadow-2xl animate-pulse`}>
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>

            <h2 className="text-4xl font-black text-white mb-2">{getStatusText()}</h2>
            <p className="text-xl text-slate-400 mb-6">{agentName} is calling you...</p>

            {callStatus === 'connected' && (
              <div className="text-6xl font-black text-white tabular-nums">
                {formatDuration(callDuration)}
              </div>
            )}

            <div className="mt-8 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-white font-mono">{phoneNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Agent:</span>
                  <span className="text-white">{agentName}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Step */}
        {step === 'analysis' && (
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-2 border-slate-800">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-white mb-2">Call Complete!</h2>
              <p className="text-slate-400">
                Here's how {agentName} performed
              </p>
            </div>

            {/* Call Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-black text-white mb-1">{formatDuration(callDuration)}</div>
                <div className="text-xs text-slate-400">Duration</div>
              </div>
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-black text-emerald-400 mb-1">Demo</div>
                <div className="text-xs text-slate-400">Call Type</div>
              </div>
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-black text-white mb-1">✓</div>
                <div className="text-xs text-slate-400">Completed</div>
              </div>
            </div>

            {/* Analysis */}
            {callAnalysis && (
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Call Analysis</h3>
                <div className="space-y-3 text-slate-300">
                  <p>{callAnalysis.summary || 'Call completed successfully.'}</p>
                  {callAnalysis.key_points && callAnalysis.key_points.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-slate-400 mb-2">Key Points:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {callAnalysis.key_points.map((point: string, idx: number) => (
                          <li key={idx} className="text-sm">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={() => onComplete(callData)}
              className={`
                w-full px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-lg font-bold text-lg
                hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2
              `}
            >
              Continue to Dashboard
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>

            <button
              onClick={onSkip}
              className="w-full mt-3 px-6 py-3 text-slate-400 hover:text-slate-300 text-sm font-medium transition-colors"
            >
              Skip to dashboard without testing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
