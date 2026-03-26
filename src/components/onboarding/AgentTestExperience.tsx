// components/onboarding/AgentTestExperience.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { AgentTypeIcon } from '@/components/agents/AgentTypeIcon';

const DEFAULT_VOICE_ID = '13843c96-ab9e-4938-baf3-ad53fcee541d'; // Nat — American Female
const TEST_CALL_MAX_SECONDS = 3 * 60; // 3 min

interface AgentConfig {
  name: string;
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

// ─── Dynamic calendar helpers ─────────────────────────────────────────────
// We simulate: the AI calls on Monday (call day), appointment is Tuesday.
// Person reschedules to Wednesday. Thu/Fri = available. Sat/Sun = blocked.

function getUpcomingMonday(): Date {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMon = day === 1 ? 7 : (1 - day + 7) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMon);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
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
    task: 'You are Vera, an AI data validation agent. This is a DEMO call. Confirm: TechCorp Solutions, John Smith, email john.smith@example.com, phone +1 (555) 123-4567. Be friendly and keep it under 2 minutes.',
    tips: [
      'Give a different email and watch Vera update it',
      'Say the phone number changed',
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
      Appointment: 'Tomorrow (Tue) at 2:00 PM',
      Type: 'Consultation',
    },
    task: 'You are Sofia, an AI appointment confirmation agent. This is a DEMO call for Healthcare Clinic. You are calling Robert Taylor on a Monday to confirm their appointment tomorrow, Tuesday, at 2:00 PM for a Consultation. If they want to reschedule, offer Wednesday, Thursday, or Friday of the same week, or slots next week. Keep it under 2 minutes.',
    tips: [
      'Say "move it to Wednesday" — watch her reschedule instantly',
      'Confirm you\'ll be there — she logs it and closes the loop',
      'Ask for next week — she\'ll show you available slots',
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
    task: 'You are Mia, an AI lead qualification agent. This is a DEMO call. Sales Pro Inc, Alex Martinez, interested in Enterprise Plan. Run BANT qualification. Keep it under 2 minutes.',
    tips: [
      'Tell her you have a $10k budget and she will qualify you',
      'Say you are the decision-maker',
      'Give a vague timeline and see how she probes',
    ],
  },
};

// ─── Waveform ──────────────────────────────────────────────────────────────
// Natural speech pattern: bars animate up during speech, drop to near-zero during pauses.
// Each bar has a staggered delay so the wave looks organic, not robotic.

const WAVE_BARS = [
  { delay: 0.00, maxH: 0.88, midH: 0.55 },
  { delay: 0.06, maxH: 0.95, midH: 0.65 },
  { delay: 0.12, maxH: 0.72, midH: 0.46 },
  { delay: 0.04, maxH: 0.82, midH: 0.52 },
  { delay: 0.09, maxH: 0.90, midH: 0.60 },
  { delay: 0.15, maxH: 0.78, midH: 0.50 },
  { delay: 0.03, maxH: 0.85, midH: 0.55 },
  { delay: 0.10, maxH: 0.68, midH: 0.43 },
  { delay: 0.07, maxH: 0.92, midH: 0.62 },
  { delay: 0.13, maxH: 0.75, midH: 0.48 },
  { delay: 0.01, maxH: 0.86, midH: 0.56 },
  { delay: 0.11, maxH: 0.70, midH: 0.45 },
  { delay: 0.05, maxH: 0.80, midH: 0.52 },
  { delay: 0.14, maxH: 0.94, midH: 0.63 },
];

function AudioSpectrum({ active, color }: { active: boolean; color: string }) {
  return (
    <>
      <style>{`
        @keyframes waveSpeak {
          /* Silence at start */
          0%   { transform: scaleY(0.03); }
          /* Build up quickly */
          6%   { transform: scaleY(var(--h-mid)); }
          12%  { transform: scaleY(var(--h-max)); }
          /* Natural speech variation */
          18%  { transform: scaleY(var(--h-mid)); }
          24%  { transform: scaleY(var(--h-max)); }
          30%  { transform: scaleY(var(--h-mid)); }
          /* Drop to zero — pause/breath */
          37%  { transform: scaleY(0.03); }
          48%  { transform: scaleY(0.03); }
          /* Resume speaking */
          54%  { transform: scaleY(var(--h-mid)); }
          60%  { transform: scaleY(var(--h-max)); }
          66%  { transform: scaleY(var(--h-mid)); }
          72%  { transform: scaleY(var(--h-max)); }
          78%  { transform: scaleY(var(--h-mid)); }
          /* Final drop to silence */
          85%  { transform: scaleY(0.03); }
          100% { transform: scaleY(0.03); }
        }
      `}</style>
      <div className={`flex items-end justify-center gap-[2.5px] h-10 ${color}`}>
        {WAVE_BARS.map((bar, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-current"
            style={{
              height: '100%',
              transformOrigin: 'bottom',
              '--h-max': bar.maxH,
              '--h-mid': bar.midH,
              transform: 'scaleY(0.03)',
              transition: active ? 'none' : 'transform 0.4s ease',
              animation: active
                ? `waveSpeak 4.8s ease-in-out ${bar.delay}s infinite`
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

// ─── Main Component ──────────────────────────────────────────────────────────

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
    if (!phoneNumber.trim()) { setErrorMessage(t.onboarding.agentTest.enterPhoneAndVoice); return; }
    setErrorMessage(null);
    setLoading(true);
    setStep('calling');
    setCallStatus('dialing');
    setCallDuration(0);
    hasAnalyzedRef.current = false;

    try {
      const task = `You are ${agent.name}, an AI ${agentTitle.toLowerCase()}.\nThis is a DEMO call.\n${agent.task}\n${agentDescription}`;
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
          metadata: { type: 'demo_call', agent_slug: agentSlug, agent_name: agent.name, is_onboarding: true, is_test: true },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to start call');
      }

      const data = await response.json();
      const id = data.call_id;
      callIdRef.current = id;
      setCallStatus('ringing');

      pollingIntervalRef.current = setInterval(() => {
        if (callIdRef.current) pollCallStatus(callIdRef.current);
      }, 2000);

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

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
      const response = await fetch(`/api/bland/call-status?call_id=${id}`);
      if (!response.ok) return;
      const data = await response.json();
      setCallData(data);
      const status = data.status as string;
      if (status === 'completed' || status === 'failed' || status === 'voicemail' || status === 'no-answer' || status === 'busy') {
        await finishCall(data);
      } else if (status === 'in-progress') {
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
          call_duration: data.call_length ? Math.floor(Number(data.call_length)) : callDuration,
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

  // ─── SETUP ────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-7">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} shadow-lg mb-4 text-white`}>
            <AgentTypeIcon slug={agentSlug} className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight mb-1">
            {t.onboarding.agentTest.testYourAgent.replace('{agentTitle}', agentTitle)}
          </h2>
          <p className="text-sm text-[var(--color-neutral-500)]">{t.onboarding.agentTest.phoneHint}</p>
        </div>

        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${agent.color}`} />
            <span className="text-[11px] font-bold text-[var(--color-neutral-500)] uppercase tracking-wide">{t.onboarding.agentTest.demoScenario}</span>
            <span className="ml-auto text-[11px] font-semibold text-[var(--color-neutral-400)] bg-[var(--color-neutral-200)] px-2 py-0.5 rounded-full">{agent.tagline}</span>
          </div>
          <div className="flex items-start gap-2.5 mb-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-white font-bold text-sm`}>{agent.name[0]}</div>
            <div className="bg-white border border-[var(--border-default)] rounded-xl rounded-tl-none px-3 py-2 text-sm text-[var(--color-ink)] shadow-sm max-w-xs">
              &quot;Hi! This is <span className="font-semibold">{agent.name}</span>, calling for a quick demo. Do you have a moment?&quot;
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-default)]">
            {Object.entries(agent.demoData).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-[var(--color-neutral-400)] block">{key}</span>
                <span className="text-[var(--color-ink)] font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] font-bold text-[var(--color-neutral-600)] uppercase tracking-wide mb-2">{t.onboarding.agentTest.yourPhoneNumber}</label>
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
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              {errorMessage}
            </div>
          )}
          <p className="text-xs text-[var(--color-neutral-400)] mt-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            {t.onboarding.agentTest.voiceNote}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={startCall}
            disabled={!phoneNumber.trim() || loading}
            className={`w-full px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2.5 shadow-md ${!phoneNumber.trim() || loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}`}
          >
            <PhoneIcon className="w-5 h-5" />
            {loading ? t.onboarding.agentTest.dialing : t.onboarding.agentTest.startTestCall}
          </button>
          <button onClick={onSkip} className="text-sm text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] text-center py-1.5 transition-colors">
            {t.onboarding.agentTest.skip}
          </button>
        </div>
      </div>
    );
  }

  // ─── CALLING ──────────────────────────────────────────────────────────────
  if (step === 'calling') {
    const isConnected = callStatus === 'connected';
    const isRinging = callStatus === 'ringing' || callStatus === 'dialing';
    const pulseColor = isConnected ? 'bg-emerald-400' : 'bg-[var(--color-primary)]';
    const ringBg = isConnected ? 'bg-gradient-to-br from-emerald-400 to-green-500' : `bg-gradient-to-br ${agent.color}`;
    const accentText = isConnected ? 'text-emerald-500' : 'text-[var(--color-primary)]';
    const statusLabel = isRinging
      ? (callStatus === 'dialing' ? t.onboarding.agentTest.dialing : t.onboarding.agentTest.ringing)
      : isConnected ? t.onboarding.agentTest.connected : t.onboarding.agentTest.callEnded;

    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex gap-6 items-center">

          {/* Left column: ring animation + status + duration — vertically centered */}
          <div className="flex flex-col items-center flex-shrink-0 w-44">
            {/* Ring animation — fixed container so absolute rings don't misalign */}
            <div className="relative flex items-center justify-center w-36 h-36 mb-3">
              {isRinging && (
                <>
                  <div className={`absolute w-36 h-36 rounded-full ${pulseColor} opacity-10 animate-ping`} style={{ animationDuration: '2.4s' }} />
                  <div className={`absolute w-28 h-28 rounded-full ${pulseColor} opacity-15 animate-ping`} style={{ animationDuration: '1.7s', animationDelay: '0.4s' }} />
                </>
              )}
              {isConnected && (
                <>
                  <div className="absolute w-36 h-36 rounded-full bg-emerald-400 opacity-10 animate-ping" style={{ animationDuration: '2.8s' }} />
                  <div className="absolute w-28 h-28 rounded-full bg-emerald-400 opacity-15 animate-ping" style={{ animationDuration: '2.0s', animationDelay: '0.6s' }} />
                </>
              )}
              <div className={`w-20 h-20 rounded-full ${ringBg} flex items-center justify-center shadow-2xl transition-all duration-700 z-10`}>
                <PhoneIcon className="w-10 h-10 text-white" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${pulseColor} animate-pulse`} />
              <span className="text-[10px] font-bold text-[var(--color-neutral-500)] uppercase tracking-widest">{statusLabel}</span>
            </div>

            <p className="text-sm font-extrabold text-[var(--color-ink)] text-center">{agent.name}</p>
            <p className="text-[11px] text-[var(--color-neutral-400)] text-center font-mono mt-0.5 leading-tight">{phoneNumber}</p>

            {isConnected && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {formatDuration(callDuration)}
              </div>
            )}
          </div>

          {/* Right column: call brief card + spectrum + tips */}
          <div className="flex-1 min-w-0 pt-1">

            {/* Call Brief card */}
            <div className="rounded-xl border border-[var(--border-default)] overflow-hidden shadow-sm mb-4">
              <div className={`bg-gradient-to-r ${agent.color} px-3 py-2 flex items-center justify-between`}>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Call Brief</span>
                <span className="text-[11px] font-bold text-white">{agent.tagline}</span>
              </div>
              <div className="bg-white">
                {Object.entries(agent.demoData).map(([key, value], i, arr) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 px-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-[var(--border-subtle,var(--border-default))]' : ''}`}
                  >
                    <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wide w-16 flex-shrink-0">{key}</span>
                    <span className="text-xs font-semibold text-[var(--color-ink)] flex-1 min-w-0 truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio spectrum */}
            <div className={`mb-4 ${accentText}`}>
              <AudioSpectrum active={isConnected} color={accentText} />
            </div>

            {/* Tips */}
            <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wide mb-2">Try saying:</p>
            <div className="space-y-1.5">
              {agent.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl px-3 py-2">
                  <span className={`flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br ${agent.color} text-white flex items-center justify-center text-[9px] font-bold mt-0.5`}>{i + 1}</span>
                  <span className="text-xs text-[var(--color-neutral-600)] leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ANALYSIS ─────────────────────────────────────────────────────────────

  // Per-agent simulated result cards
  const renderAgentResult = () => {
    if (agentSlug === 'data-validation') {
      return (
        <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden mb-4">
          <div className="bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">Contact Record Updated</p>
              <p className="text-xs text-emerald-600">John Smith at TechCorp Solutions</p>
            </div>
            <span className="flex-shrink-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">CRM Synced</span>
          </div>
          <div className="bg-white divide-y divide-[var(--border-default)]">
            {[
              { field: 'Email', before: 'john.smith.old@techcorp.com', after: 'john.smith@example.com', type: 'updated' },
              { field: 'Phone', value: '+1 (555) 123-4567', type: 'confirmed' },
              { field: 'Status', value: 'Active', type: 'confirmed' },
            ].map((row) => (
              <div key={row.field} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase w-10 flex-shrink-0">{row.field}</span>
                {row.type === 'updated' && row.before ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                    <span className="text-xs text-[var(--color-neutral-400)] line-through truncate">{row.before}</span>
                    <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    <span className="text-xs font-semibold text-emerald-700">{row.after}</span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-[var(--color-ink)] flex-1">{row.value}</span>
                )}
                <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${row.type === 'updated' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {row.type === 'updated' ? 'UPDATED' : 'CONFIRMED'}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 px-4 py-2 text-xs text-emerald-600 font-medium">
            In a real campaign, Vera would do this for hundreds of contacts automatically — no manual data entry.
          </div>
        </div>
      );
    }

    if (agentSlug === 'appointment-confirmation') {
      // Dynamic demo week: Monday = call day, Tuesday = original appt, Wednesday = rescheduled
      const monday = getUpcomingMonday();
      const tuesday = addDays(monday, 1);   // original appointment
      const wednesday = addDays(monday, 2); // rescheduled to
      const thursday = addDays(monday, 3);
      const friday = addDays(monday, 4);
      const saturday = addDays(monday, 5);
      const sunday = addDays(monday, 6);
      // Next week
      const nxtMon = addDays(monday, 7);
      const nxtTue = addDays(monday, 8);
      const nxtWed = addDays(monday, 9);
      const nxtThu = addDays(monday, 10);
      const nxtFri = addDays(monday, 11);

      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtN = (d: Date) => d.getDate();
      const fmtWD = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

      type DayCell = {
        date: Date;
        role: 'call-day' | 'original' | 'rescheduled' | 'available' | 'blocked';
      };

      const week1: DayCell[] = [
        { date: monday,    role: 'call-day' },
        { date: tuesday,   role: 'original' },
        { date: wednesday, role: 'rescheduled' },
        { date: thursday,  role: 'available' },
        { date: friday,    role: 'available' },
        { date: saturday,  role: 'blocked' },
        { date: sunday,    role: 'blocked' },
      ];
      const week2: DayCell[] = [
        { date: nxtMon, role: 'available' },
        { date: nxtTue, role: 'available' },
        { date: nxtWed, role: 'available' },
        { date: nxtThu, role: 'available' },
        { date: nxtFri, role: 'available' },
      ];

      const cellStyle = (role: DayCell['role']) => {
        switch (role) {
          case 'call-day':   return 'bg-blue-100 text-blue-700 ring-1 ring-blue-300';
          case 'original':   return 'bg-red-50 text-red-400 line-through opacity-70';
          case 'rescheduled': return 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-110';
          case 'available':  return 'bg-white text-blue-500 hover:bg-blue-50';
          case 'blocked':    return 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-300)] cursor-not-allowed';
        }
      };

      return (
        <div className="border-2 border-blue-200 rounded-2xl overflow-hidden mb-4">
          <div className="bg-blue-50 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-800">Appointment Rescheduled</p>
              <p className="text-xs text-blue-600">Robert Taylor · Healthcare Clinic</p>
            </div>
            <span className="flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Calendar Updated</span>
          </div>

          {/* Reschedule summary */}
          <div className="bg-white px-4 pt-3 pb-1 flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-400 text-xs px-2 py-1 rounded-lg line-through">
                Tue {fmt(tuesday)} · 2:00 PM
              </span>
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-bold shadow-sm">
                Wed {fmt(wednesday)} · 2:00 PM
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">Consultation</span>
          </div>

          {/* Calendar grid */}
          <div className="bg-white p-4">
            <div className="bg-blue-50 rounded-xl p-3">
              {/* Week 1 header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">This week</span>
                <span className="text-[9px] text-blue-300">{monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {week1.map(({ date }) => (
                  <div key={date.toISOString()} className="text-center text-[9px] font-bold text-blue-400">{fmtWD(date)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {week1.map(({ date, role }) => (
                  <div
                    key={date.toISOString()}
                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cellStyle(role)}`}
                  >
                    {fmtN(date)}
                    {role === 'rescheduled' && <span className="sr-only">(new)</span>}
                  </div>
                ))}
              </div>

              {/* Week 2 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Next week</span>
                <span className="text-[9px] text-blue-300">{nxtMon.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className={`text-center text-[9px] font-bold ${d === 'Sat' || d === 'Sun' ? 'text-blue-200' : 'text-blue-400'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {week2.map(({ date, role }) => (
                  <div
                    key={date.toISOString()}
                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cellStyle(role)}`}
                  >
                    {fmtN(date)}
                  </div>
                ))}
                {/* Sat/Sun next week — blocked */}
                <div className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cellStyle('blocked')}`}>{fmtN(addDays(monday, 12))}</div>
                <div className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cellStyle('blocked')}`}>{fmtN(addDays(monday, 13))}</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-blue-400"><span className="w-2.5 h-2.5 rounded bg-blue-100 ring-1 ring-blue-300 inline-block" />Call day</span>
              <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-2.5 h-2.5 rounded bg-red-50 border border-red-200 inline-block" />Original</span>
              <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold"><span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />Rescheduled</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-neutral-400)]"><span className="w-2.5 h-2.5 rounded bg-[var(--color-neutral-100)] inline-block" />Blocked</span>
            </div>
          </div>

          <div className="bg-blue-50 px-4 py-2 text-xs text-blue-600 font-medium">
            In a real campaign, Sofia confirms hundreds of appointments while you sleep — zero no-shows.
          </div>
        </div>
      );
    }

    // lead-qualification
    const bantItems = [
      { letter: 'B', label: 'Budget', score: 82, note: '$10k confirmed', color: 'from-indigo-500 to-violet-500' },
      { letter: 'A', label: 'Authority', score: 100, note: 'Decision maker', color: 'from-indigo-500 to-violet-500' },
      { letter: 'N', label: 'Need', score: 74, note: 'Scalability issues', color: 'from-indigo-400 to-violet-400' },
      { letter: 'T', label: 'Timeline', score: 62, note: 'Q2 target', color: 'from-indigo-300 to-violet-300' },
    ];
    const avgScore = Math.round(bantItems.reduce((a, b) => a + b.score, 0) / bantItems.length);
    return (
      <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden mb-4">
        <div className="bg-indigo-50 px-4 py-3 flex items-center gap-3">
          <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full tracking-wide">HOT LEAD</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-indigo-800">Alex Martinez Qualified</p>
            <p className="text-xs text-indigo-500">Sales Pro Inc · Enterprise Plan</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xl font-black text-indigo-700">{avgScore}</p>
            <p className="text-[9px] font-bold text-indigo-400 uppercase">BANT Score</p>
          </div>
        </div>
        <div className="bg-white p-4 space-y-3">
          {bantItems.map((item) => (
            <div key={item.letter} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">{item.letter}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-[var(--color-ink)]">{item.label}</span>
                  <span className="text-[10px] text-[var(--color-neutral-400)]">{item.note}</span>
                </div>
                <div className="h-1.5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700`} style={{ width: `${item.score}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600 w-8 text-right flex-shrink-0">{item.score}%</span>
            </div>
          ))}
        </div>
        <div className="bg-indigo-50 px-4 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          <span className="text-xs text-indigo-600 font-medium">Next action: Demo meeting scheduled for next week</span>
        </div>
        <div className="bg-indigo-50 border-t border-indigo-100 px-4 py-2 text-xs text-indigo-500 font-medium">
          In a real campaign, Mia qualifies your leads and passes hot ones straight to your sales team.
        </div>
      </div>
    );
  };

  // Parse transcript into speaker bubbles
  const rawTranscript = (callData?.concatenated_transcript as string) || '';
  const transcriptLines = rawTranscript.split('\n').filter((l: string) => l.trim());

  // Detect speaker from line prefix (e.g. "Agent: ..." or "User: ..." or "assistant:"/"user:")
  const parseLine = (line: string): { speaker: 'agent' | 'user'; text: string } => {
    const lower = line.toLowerCase();
    if (lower.startsWith('assistant:') || lower.startsWith('agent:') || lower.startsWith(`${agent.name.toLowerCase()}:`)) {
      return { speaker: 'agent', text: line.replace(/^[^:]+:\s*/i, '') };
    }
    if (lower.startsWith('user:') || lower.startsWith('caller:') || lower.startsWith('human:')) {
      return { speaker: 'user', text: line.replace(/^[^:]+:\s*/i, '') };
    }
    // Fallback: alternate by index
    return { speaker: 'user', text: line };
  };

  const recordingUrl = callData?.recording_url as string | undefined;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 shadow mb-3">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
          <svg className="w-5 h-5 mx-auto text-emerald-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">{t.onboarding.agentTest.completed}</div>
        </div>
      </div>

      {/* Per-agent WOW result */}
      {renderAgentResult()}

      {/* AI Analysis */}
      {callAnalysis && (callAnalysis.summary || (callAnalysis.key_points && callAnalysis.key_points.length > 0)) && (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            {t.onboarding.agentTest.callAnalysis}
          </h3>
          {callAnalysis.summary && (
            <p className="text-sm text-[var(--color-neutral-700)] mb-3 leading-relaxed">{callAnalysis.summary}</p>
          )}
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

      {/* Recording player */}
      <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-4">
        <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
          Call Recording
        </h3>
        {recordingUrl ? (
          <audio controls src={recordingUrl} className="w-full h-9 rounded-lg" style={{ colorScheme: 'light' }} />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-[var(--border-default)] rounded-xl px-3 py-2.5">
            <button className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 bg-[var(--color-neutral-200)] rounded-full overflow-hidden">
                <div className="h-full w-2/5 bg-gradient-to-r from-[var(--color-primary)] to-blue-400 rounded-full" />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-[var(--color-neutral-400)] font-mono">{formatDuration(Math.floor(callDuration * 0.4))}</span>
                <span className="text-[10px] text-[var(--color-neutral-400)] font-mono">{formatDuration(callDuration)}</span>
              </div>
            </div>
            <span className="text-[10px] text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] px-2 py-0.5 rounded-full whitespace-nowrap">Processing…</span>
          </div>
        )}
      </div>

      {/* Transcript — chat bubble style */}
      {transcriptLines.length > 0 && (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Call Transcript
          </h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {transcriptLines.slice(0, 24).map((line: string, i: number) => {
              const { speaker, text } = parseLine(line);
              const isAgent = speaker === 'agent';
              return (
                <div key={i} className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5
                    ${isAgent ? `bg-gradient-to-br ${agent.color} text-white` : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)]'}`}>
                    {isAgent ? agent.name[0] : 'U'}
                  </div>
                  <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed
                    ${isAgent
                      ? 'bg-white border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-tl-none'
                      : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-700)] rounded-tr-none'}`}>
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onComplete(callData ?? {})}
        className={`w-full px-6 py-4 bg-gradient-to-r ${agent.color} text-white rounded-xl font-bold text-base hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2.5 shadow-md`}
      >
        {t.onboarding.agentTest.continueToDashboard}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
      </button>
    </div>
  );
}
