// components/onboarding/AgentTestExperience.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';

// Nat — American Female, top-rated voice
const DEFAULT_VOICE_ID = '13843c96-ab9e-4938-baf3-ad53fcee541d';

// Test call max duration (seconds) — used for auto-advance timeout
const TEST_CALL_MAX_SECONDS = 3 * 60; // 3 min (matches max_duration: 3 in Bland)

interface AgentConfig {
  name: string;         // Female name matching Nat's voice
  color: string;
  tagline: string;
  demoData: Record<string, string>;
  task: string;
  tips: string[];
}

interface CallAnalysis {
  summary?: string;
  key_points?: string[];
}

interface AgentTestExperienceProps {
  agentSlug: string;
  agentTitle: string;
  agentDescription: string;
  companyId: string;
  companyName: string;
  onComplete: (callData: Record<string, unknown>) => void;
  onSkip: () => void;
}

const AGENT_CONFIG: Record<string, AgentConfig> = {
  'data-validation': {
    name: 'Vera',
    color: 'from-emerald-500 to-teal-600',
    tagline: 'Data Validation Agent',
    demoData: {
      Company: 'TechCorp Solutions',
      Contact: 'John Smith',
      Email: 'john.smith@example.com',
      Phone: '+1 (555) 123-4567',
    },
    task: 'You are Vera, an AI data validation agent. This is a DEMO call. Use demo data: TechCorp Solutions, contact John Smith. Be friendly, confirm email john.smith@example.com and phone +1 (555) 123-4567. Keep it under 2 minutes.',
    tips: [
      'Try giving a wrong email — watch Vera correct it',
      'Say the phone is different — she\'ll update it',
      'Ask her to confirm your job title',
    ],
  },
  'appointment-confirmation': {
    name: 'Sofia',
    color: 'from-blue-500 to-blue-700',
    tagline: 'Appointment Confirmation Agent',
    demoData: {
      Clinic: 'Healthcare Clinic',
      Patient: 'Robert Taylor',
      Appointment: 'Tomorrow at 2:00 PM',
      Type: 'Consultation',
    },
    task: 'You are Sofia, an AI appointment confirmation agent. This is a DEMO call. Use demo data: Healthcare Clinic, appointment tomorrow at 2:00 PM for Robert Taylor. Confirm attendance and offer to reschedule if needed. Keep it under 2 minutes.',
    tips: [
      'Say you need to reschedule — watch her handle it',
      'Confirm you\'ll be there — she\'ll log it',
      'Ask for the clinic address',
    ],
  },
  'lead-qualification': {
    name: 'Mia',
    color: 'from-indigo-500 to-violet-600',
    tagline: 'Lead Qualification Agent',
    demoData: {
      Company: 'Sales Pro Inc',
      Lead: 'Alex Martinez',
      Source: 'Website Form',
      Interest: 'Enterprise Plan',
    },
    task: 'You are Mia, an AI lead qualification agent. This is a DEMO call. Use demo data: Sales Pro Inc, Alex Martinez from website form interested in Enterprise Plan. Run BANT qualification: Budget, Authority, Need, Timeline. Keep it under 2 minutes.',
    tips: [
      'Tell her you have a $10k budget — she\'ll qualify you',
      'Say you\'re the decision-maker',
      'Give a vague timeline — see how she probes',
    ],
  },
};

// Audio spectrum bar configs — varied timing to simulate speech
const SPECTRUM_BARS = [
  { dur: 0.42, delay: 0.00, minH: 15, maxH: 90 },
  { dur: 0.68, delay: 0.08, minH: 30, maxH: 100 },
  { dur: 0.35, delay: 0.15, minH: 20, maxH: 75 },
  { dur: 0.55, delay: 0.05, minH: 40, maxH: 95 },
  { dur: 0.48, delay: 0.22, minH: 10, maxH: 85 },
  { dur: 0.72, delay: 0.12, minH: 50, maxH: 100 },
  { dur: 0.38, delay: 0.30, minH: 25, maxH: 70 },
  { dur: 0.60, delay: 0.18, minH: 35, maxH: 90 },
  { dur: 0.45, delay: 0.25, minH: 15, maxH: 80 },
  { dur: 0.52, delay: 0.08, minH: 45, maxH: 95 },
  { dur: 0.33, delay: 0.35, minH: 20, maxH: 65 },
  { dur: 0.65, delay: 0.10, minH: 30, maxH: 100 },
];

function AudioSpectrum({ active, colorClass }: { active: boolean; colorClass: string }) {
  return (
    <>
      <style>{`
        @keyframes specBar {
          0% { transform: scaleY(var(--min-h)); }
          50% { transform: scaleY(var(--max-h)); }
          100% { transform: scaleY(var(--min-h)); }
        }
        @keyframes specPause {
          0%, 40% { opacity: 1; }
          42%, 58% { opacity: 0.15; }
          60%, 100% { opacity: 1; }
        }
      `}</style>
      <div
        className={`flex items-end justify-center gap-[3px] h-10 transition-opacity duration-500 ${colorClass} ${active ? 'opacity-100' : 'opacity-20'}`}
        style={{ animation: active ? 'specPause 3.8s ease-in-out infinite' : 'none' }}
      >
        {SPECTRUM_BARS.map((bar, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-current"
            style={{
              height: '100%',
              transformOrigin: 'bottom',
              '--min-h': `${bar.minH / 100}`,
              '--max-h': `${bar.maxH / 100}`,
              transform: `scaleY(${bar.minH / 100})`,
              animation: active
                ? `specBar ${bar.dur}s ease-in-out ${bar.delay}s infinite`
                : 'none',
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

export default function AgentTestExperience({
  agentSlug,
  agentTitle,
  agentDescription,
  companyId,
  companyName: _companyName,
  onComplete,
  onSkip,
}: AgentTestExperienceProps) {
  const { t } = useTranslation();
  const agent = AGENT_CONFIG[agentSlug] || AGENT_CONFIG['lead-qualification'];
  const [step, setStep] = useState<'setup' | 'calling' | 'analysis'>('setup');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<Record<string, unknown> | null>(null);
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAnalyzedRef = useRef(false);
  const callIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopTimers = () => {
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const finishCall = async (data: Record<string, unknown>) => {
    stopTimers();
    setCallStatus('ended');
    if (!hasAnalyzedRef.current) {
      hasAnalyzedRef.current = true;
      await analyzeCall(data);
    } else {
      setStep('analysis');
    }
  };

  const startCall = async () => {
    if (!phoneNumber.trim()) {
      setErrorMessage(t.onboarding.agentTest.enterPhoneAndVoice);
      return;
    }

    setErrorMessage(null);
    setLoading(true);
    setStep('calling');
    setCallStatus('dialing');
    setCallDuration(0);
    hasAnalyzedRef.current = false;

    try {
      const task = `You are ${agent.name}, an AI ${agentTitle.toLowerCase()}.
This is a DEMO call to showcase your capabilities.
${agent.task}
${agentDescription}`;

      const response = await fetch('/api/bland/send-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          task,
          voice: DEFAULT_VOICE_ID,
          first_sentence: `Hi! This is ${agent.name}, calling for a quick demo. Do you have a moment?`,
          max_duration: 3,
          company_id: companyId,
          metadata: {
            type: 'demo_call',
            agent_slug: agentSlug,
            agent_name: agent.name,
            is_onboarding: true,
            is_test: true,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to start call');
      }

      const data = await response.json();
      const id = data.call_id;
      setCallId(id);
      callIdRef.current = id;
      setCallStatus('ringing');

      // Poll Bland for call status every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        if (callIdRef.current) pollCallStatus(callIdRef.current);
      }, 2000);

      // Local duration counter (for UI display — resets when connected status fires)
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      // Safety timeout: auto-advance to analysis after max call duration + 30s buffer
      timeoutRef.current = setTimeout(async () => {
        if (!hasAnalyzedRef.current) {
          stopTimers();
          setCallStatus('ended');
          hasAnalyzedRef.current = true;
          await analyzeCall({});
        }
      }, (TEST_CALL_MAX_SECONDS + 30) * 1000);

    } catch (error) {
      console.error('Error starting call:', error);
      setLoading(false);
      setStep('setup');
      setCallStatus('idle');
      setErrorMessage(t.onboarding.agentTest.failedToStartCall);
    }
  };

  const pollCallStatus = async (id: string) => {
    try {
      // Use lightweight call-status endpoint (no call_logs ownership required for test calls)
      const response = await fetch(`/api/bland/call-status?call_id=${id}`);
      if (!response.ok) return;

      const data = await response.json();
      setCallData(data);

      const status = data.status as string;

      if (status === 'completed' || status === 'failed' || status === 'voicemail' || status === 'no-answer' || status === 'busy') {
        await finishCall(data);
      } else if (status === 'in-progress') {
        // Bland uses 'in-progress' (not 'active' or 'answered')
        setCallStatus('connected');
      }
    } catch (error) {
      console.error('Error polling call status:', error);
    }
  };

  const analyzeCall = async (data: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/openai/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.concatenated_transcript || 'Demo call completed.',
          agent_type: agentTitle,
          call_duration: data.call_length ? Math.floor(Number(data.call_length) / 1000) : callDuration,
        }),
      });
      if (response.ok) {
        const analysis = await response.json();
        setCallAnalysis(analysis);
      }
    } catch (error) {
      console.error('Error analyzing call:', error);
    } finally {
      setStep('analysis');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── STEP 1: Setup ──────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="w-full max-w-lg mx-auto">
        {/* Agent hero */}
        <div className="text-center mb-7">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} shadow-lg mb-4`}>
            <PhoneIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight mb-1">
            {t.onboarding.agentTest.testYourAgent.replace('{agentTitle}', agentTitle)}
          </h2>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {t.onboarding.agentTest.phoneHint}
          </p>
        </div>

        {/* Demo scenario preview */}
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${agent.color}`} />
            <span className="text-[11px] font-bold text-[var(--color-neutral-500)] uppercase tracking-wide">
              {t.onboarding.agentTest.demoScenario}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-[var(--color-neutral-400)] bg-[var(--color-neutral-200)] px-2 py-0.5 rounded-full">
              {agent.tagline}
            </span>
          </div>

          {/* Agent intro bubble */}
          <div className="flex items-start gap-2.5 mb-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-white font-bold text-sm`}>
              {agent.name[0]}
            </div>
            <div className="bg-white border border-[var(--border-default)] rounded-xl rounded-tl-none px-3 py-2 text-sm text-[var(--color-ink)] shadow-sm max-w-xs">
              "Hi! This is <span className="font-semibold">{agent.name}</span>, calling for a quick demo. Do you have a moment?"
            </div>
          </div>

          {/* Demo data */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-default)]">
            {Object.entries(agent.demoData).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-[var(--color-neutral-400)] block">{key}</span>
                <span className="text-[var(--color-ink)] font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phone input */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-[var(--color-neutral-600)] uppercase tracking-wide mb-2">
            {t.onboarding.agentTest.yourPhoneNumber}
          </label>
          <div className="relative">
            <PhoneIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)]" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => { setPhoneNumber(e.target.value); setErrorMessage(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && phoneNumber.trim()) startCall(); }}
              className="w-full pl-10 pr-4 py-3.5 bg-white border-2 border-[var(--border-default)] rounded-xl text-[var(--color-ink)] text-base focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all font-medium placeholder:text-[var(--color-neutral-300)]"
              placeholder="+1 (555) 123-4567"
              autoFocus
            />
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {errorMessage}
            </div>
          )}

          <p className="text-xs text-[var(--color-neutral-400)] mt-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            {t.onboarding.agentTest.voiceNote}
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={startCall}
            disabled={!phoneNumber.trim() || loading}
            className={`
              w-full px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-xl font-bold text-base
              transition-all duration-300 flex items-center justify-center gap-2.5 shadow-md
              ${!phoneNumber.trim() || loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}
            `}
          >
            <PhoneIcon className="w-5 h-5" />
            {loading ? t.onboarding.agentTest.dialing : t.onboarding.agentTest.startTestCall}
          </button>

          <button
            onClick={onSkip}
            className="text-sm text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] text-center py-1.5 transition-colors"
          >
            {t.onboarding.agentTest.skip}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 2: Calling ────────────────────────────────────────────
  if (step === 'calling') {
    const isConnected = callStatus === 'connected';
    const isRinging = callStatus === 'ringing' || callStatus === 'dialing';
    const accentColorClass = isConnected ? 'text-emerald-500' : 'text-[var(--color-primary)]';
    const pulseColor = isConnected ? 'bg-emerald-400' : 'bg-[var(--color-primary)]';
    const ringBg = isConnected ? 'bg-gradient-to-br from-emerald-400 to-green-500' : `bg-gradient-to-br ${agent.color}`;

    const statusLabel = isRinging
      ? (callStatus === 'dialing' ? t.onboarding.agentTest.dialing : t.onboarding.agentTest.ringing)
      : isConnected
      ? t.onboarding.agentTest.connected
      : t.onboarding.agentTest.callEnded;

    return (
      <div className="w-full max-w-lg mx-auto">
        {/* Phone ring animation */}
        <div className="flex flex-col items-center py-8">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className={`absolute w-36 h-36 rounded-full ${pulseColor} opacity-10 animate-ping`} style={{ animationDuration: '2.2s' }} />
            <div className={`absolute w-28 h-28 rounded-full ${pulseColor} opacity-15 animate-ping`} style={{ animationDuration: '1.6s', animationDelay: '0.35s' }} />
            <div className={`w-24 h-24 rounded-full ${ringBg} flex items-center justify-center shadow-2xl transition-all duration-700`}>
              <PhoneIcon className="w-11 h-11 text-white" />
            </div>
          </div>

          {/* Status label */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex w-2 h-2 rounded-full ${pulseColor} animate-pulse`} />
            <span className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-widest">
              {statusLabel}
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-[var(--color-ink)] mb-0.5">
            {t.onboarding.agentTest.callingYou.replace('{agentName}', agent.name)}
          </h2>
          <p className="text-sm text-[var(--color-neutral-400)] mb-4 font-mono">{phoneNumber}</p>

          {/* Audio spectrum — subtle when ringing, full when connected */}
          <div className={`mb-5 transition-all duration-500 ${accentColorClass}`}>
            <AudioSpectrum active={isConnected} colorClass={accentColorClass} />
          </div>

          {/* Duration counter when connected */}
          {isConnected && (
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-5 py-2 text-xl font-bold tabular-nums shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Demo data + tips card */}
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4">
          <p className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3">
            {t.onboarding.agentTest.callScenarioLabel}
          </p>

          {/* Demo data */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
            {Object.entries(agent.demoData).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-[var(--color-neutral-400)]">{key}: </span>
                <span className="text-[var(--color-ink)] font-semibold">{value}</span>
              </div>
            ))}
          </div>

          {/* Interaction tips */}
          <div className="border-t border-[var(--border-default)] pt-3">
            <p className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wide mb-2">
              {t.onboarding.agentTest.tipsLabel}
            </p>
            <ul className="space-y-1.5">
              {agent.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-neutral-600)]">
                  <span className="flex-shrink-0 text-[var(--color-primary)] font-bold mt-0.5">→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 3: Analysis / Results ─────────────────────────────────
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Success header */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 shadow mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight mb-1">
          {t.onboarding.agentTest.callComplete}
        </h2>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {t.onboarding.agentTest.agentPerformance.replace('{agentName}', agent.name)}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-ink)] mb-0.5">{formatDuration(callDuration)}</div>
          <div className="text-[10px] text-[var(--color-neutral-400)] font-bold uppercase tracking-wide">{t.onboarding.agentTest.duration}</div>
        </div>
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-600 mb-0.5">{t.onboarding.agentTest.demo}</div>
          <div className="text-[10px] text-[var(--color-neutral-400)] font-bold uppercase tracking-wide">{t.onboarding.agentTest.callType}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <svg className="w-5 h-5 mx-auto text-emerald-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">{t.onboarding.agentTest.completed}</div>
        </div>
      </div>

      {/* AI Analysis */}
      {callAnalysis && (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-5 mb-5">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {t.onboarding.agentTest.callAnalysis}
          </h3>
          <p className="text-sm text-[var(--color-neutral-700)] mb-3 leading-relaxed">
            {callAnalysis.summary || t.onboarding.agentTest.callCompletedSuccess}
          </p>
          {callAnalysis.key_points && callAnalysis.key_points.length > 0 && (
            <ul className="space-y-1.5">
              {callAnalysis.key_points.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-neutral-600)]">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold mt-0.5">{idx + 1}</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Single CTA — no going back */}
      <button
        onClick={() => onComplete(callData ?? {})}
        className={`
          w-full px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-xl font-bold text-base
          hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300
          flex items-center justify-center gap-2.5 shadow-md
        `}
      >
        {t.onboarding.agentTest.continueToDashboard}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
}
