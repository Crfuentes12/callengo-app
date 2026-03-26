// components/onboarding/AgentTestExperience.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
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

interface AgentSpecificData {
  // appointment-confirmation
  appointmentStatus?: 'confirmed' | 'rescheduled' | 'cancelled';
  newDay?: string | null;
  newTime?: string | null;
  originalDay?: string | null;
  rescheduleReason?: string | null;
  // data-validation
  updatedFields?: Array<{ field: string; oldValue: string; newValue: string }>;
  confirmedFields?: string[];
  newFields?: Record<string, string>;
  // lead-qualification
  bantScores?: { budget: number; authority: number; need: number; timeline: number };
  bantNotes?: { budget: string; authority: string; need: string; timeline: string };
  leadTemperature?: 'hot' | 'warm' | 'cold';
  recommendedAction?: string;
}

interface CallAnalysis {
  sentiment?: 'positive' | 'neutral' | 'negative';
  callScore?: number;
  summary?: string;
  key_points?: string[];
  outcome?: string;
  nextActions?: string[];
  agentSpecific?: AgentSpecificData;
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
    task: 'You are Vera, an AI data validation agent calling on behalf of TechCorp Solutions. You are calling John Smith to verify and update his contact information on file. Confirm: email john.smith@example.com, phone +1 (555) 123-4567. Be professional and friendly. If they provide updated information, acknowledge it clearly. Keep the call under 2 minutes.',
    tips: [
      'Give a different email and watch Vera update it',
      'Say the phone number changed',
      'Ask her to confirm your job title',
    ],
  },
  'appointment-confirmation': {
    name: 'Nicole',
    color: 'from-[var(--color-primary-600)] to-[var(--color-primary-800)]',
    tagline: 'Appointment Confirmation Agent',
    demoData: {
      Clinic: 'Sunrise Family Clinic',
      Patient: 'Robert Taylor',
      Appointment: 'Tomorrow (Tue) at 2:00 PM',
      Type: 'Annual Check-up',
    },
    task: 'You are Nicole, an AI appointment confirmation agent calling on behalf of Sunrise Family Clinic. You are calling Robert Taylor to confirm his Annual Check-up appointment scheduled for tomorrow, Tuesday, at 2:00 PM. Start with a warm, professional greeting and confirm the appointment details. If he wants to reschedule, offer Wednesday, Thursday, or Friday of the same week, or slots next week — morning or afternoon. Be concise, friendly, and helpful. Keep the call under 3 minutes.',
    tips: [
      'Say "can we move it to Thursday?" — watch her reschedule instantly',
      'Confirm you\'ll be there — she logs it and closes the loop',
      'Ask what to bring to the appointment',
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
    task: 'You are Mia, an AI lead qualification agent calling on behalf of Sales Pro Inc. You are reaching out to Alex Martinez, who filled out a form on the website showing interest in the Enterprise Plan. Your goal is to qualify this lead using BANT criteria (Budget, Authority, Need, Timeline). Ask natural, conversational questions — do not interrogate. Be warm and professional. Keep the call under 3 minutes.',
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
  const [step, setStep] = useState<'setup' | 'calling' | 'processing' | 'analysis'>('setup');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callData, setCallData] = useState<Record<string, unknown> | null>(null);
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [processingTimerDone, setProcessingTimerDone] = useState(false);
  const [processingPhrase, setProcessingPhrase] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
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

  // Transition to analysis once BOTH timer and AI analysis are done
  useEffect(() => {
    if (analysisDone && processingTimerDone && step === 'processing') {
      setStep('analysis');
    }
  }, [analysisDone, processingTimerDone, step]);

  // Processing screen: progress bar + phrase rotation (10s)
  useEffect(() => {
    if (step !== 'processing') return;
    setProcessingProgress(0);
    setProcessingPhrase(0);
    setProcessingTimerDone(false);
    const start = Date.now();
    const totalMs = 15000;
    const frameId = { current: 0 };
    // Phrases change every 500ms for a smooth, readable pace
    const phraseInterval = setInterval(() => {
      setProcessingPhrase(prev => (prev + 1) % 30);
    }, 500);
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / totalMs, 1);
      setProcessingProgress(pct);
      if (pct < 1) {
        frameId.current = requestAnimationFrame(tick);
      } else {
        setProcessingTimerDone(true);
      }
    };
    frameId.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameId.current); clearInterval(phraseInterval); };
  }, [step]);

  // Bland processes recordings async — re-fetch call data 4s after entering analysis
  useEffect(() => {
    if (step === 'analysis' && callIdRef.current && !callData?.recording_url) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/bland/call-status?call_id=${callIdRef.current}`);
          if (res.ok) {
            const data = await res.json();
            if (data.recording_url) setCallData(data);
          }
        } catch { /* best-effort */ }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [step, callData?.recording_url]);

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
      setStep('processing');
      setAnalysisDone(true);
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
      const task = `${agent.task}${agentDescription ? `\n\nAdditional context: ${agentDescription}` : ''}`;
      const firstSentence = agentSlug === 'appointment-confirmation'
        ? `Hi, is this Robert Taylor? This is Nicole calling from Sunrise Family Clinic.`
        : agentSlug === 'data-validation'
        ? `Hi, am I speaking with John Smith? This is Vera calling from TechCorp Solutions.`
        : `Hi, is this Alex Martinez? This is Mia calling from Sales Pro Inc.`;
      const response = await fetch('/api/bland/send-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          task,
          voice: DEFAULT_VOICE_ID,
          first_sentence: firstSentence,
          wait_for_greeting: true,
          noise_cancellation: true,
          interruption_threshold: 120,
          max_duration: 4,
          company_id: companyId,
          metadata: { type: 'test_call', agent_slug: agentSlug, agent_name: agent.name, is_onboarding: true, is_test: true },
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
    setStep('processing');
    setAnalysisDone(false);
    try {
      const response = await fetch('/api/openai/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: data.transcripts || [],
          transcript: data.concatenated_transcript || '',
          agent_type: agentTitle,
          agent_slug: agentSlug,
          demoData: agent.demoData,
          call_duration: data.call_length ? Math.floor(Number(data.call_length)) : callDuration,
        }),
      });
      if (response.ok) {
        const json = await response.json();
        setCallAnalysis(json.analysis ?? json);
      }
    } catch (error) {
      console.error('Error analyzing call:', error);
    } finally {
      setAnalysisDone(true);
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
              &quot;Hi, is this {agentSlug === 'appointment-confirmation' ? 'Robert Taylor' : agentSlug === 'data-validation' ? 'John Smith' : 'Alex Martinez'}? This is <span className="font-semibold">{agent.name}</span> calling — do you have a moment?&quot;
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

  // ─── PROCESSING ───────────────────────────────────────────────────────────
  const PROCESSING_PHRASES = [
    'Extracting conversation...', 'Analyzing sentiment...', 'Decoding caller intent...',
    'Processing voice patterns...', 'Mapping key data points...', 'Identifying rescheduling signals...',
    'Scoring conversation quality...', 'Verifying extracted information...', 'Structuring call transcript...',
    'Detecting outcome signals...', 'Analyzing response patterns...', 'Cross-referencing contact data...',
    'Building call summary...', 'Assessing call effectiveness...', 'Classifying appointment status...',
    'Extracting action items...', 'Calibrating confidence scores...', 'Resolving ambiguous responses...',
    'Parsing dialogue structure...', 'Running BANT analysis...', 'Detecting follow-up triggers...',
    'Mapping conversation flow...', 'Computing sentiment score...', 'Identifying key moments...',
    'Synthesizing insights...', 'Preparing analysis report...', 'Validating data accuracy...',
    'Processing timestamps...', 'Finalizing recommendations...', 'Almost there...',
  ];

  if (step === 'processing') {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-8">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-lg mb-6`}>
          <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-[var(--color-ink)] mb-1">Analyzing your call</h2>
        <p className="text-sm text-[var(--color-neutral-400)] mb-8">Your AI agent is crunching the conversation...</p>

        {/* Thick progress bar */}
        <div className="w-full bg-[var(--color-neutral-100)] rounded-full h-4 mb-4 overflow-hidden shadow-inner">
          <div
            className={`h-4 rounded-full bg-gradient-to-r ${agent.color} transition-none`}
            style={{ width: `${processingProgress * 100}%` }}
          />
        </div>

        {/* Rotating phrase with CSS fade */}
        <style>{`
          @keyframes phraseFade {
            0%   { opacity: 0; transform: translateY(4px); }
            12%  { opacity: 1; transform: translateY(0); }
            80%  { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-4px); }
          }
        `}</style>
        <p
          key={processingPhrase}
          className="text-sm font-semibold text-[var(--color-primary)] min-h-[1.5rem]"
          style={{ animation: 'phraseFade 0.5s ease-in-out forwards' }}
        >
          {PROCESSING_PHRASES[processingPhrase]}
        </p>
        <p className="text-xs text-[var(--color-neutral-300)] mt-1">{Math.round(processingProgress * 100)}%</p>
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
            <p className="text-[11px] text-[var(--color-neutral-400)] text-center mt-0.5 leading-tight">Simulating real scenario</p>
            <p className="text-[10px] text-[var(--color-neutral-300)] text-center font-mono leading-tight">{phoneNumber}</p>

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
                    className={`flex items-start gap-4 px-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-[var(--border-subtle,var(--border-default))]' : ''}`}
                  >
                    <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">{key}</span>
                    <span className="text-xs font-semibold text-[var(--color-ink)] flex-1 min-w-0 leading-relaxed">{value}</span>
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

  // Sits as the last child inside a border-2 rounded-2xl overflow-hidden card — no outer margin needed
  const ImpactBanner = ({ color, icon, headline, sub }: { color: string; icon: React.ReactNode; headline: string; sub: string }) => (
    <div className={`px-5 py-4 ${color} flex gap-3 items-center`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <p className="font-extrabold text-sm leading-snug">{headline}</p>
        <p className="text-xs opacity-75 mt-0.5 leading-relaxed">{sub}</p>
      </div>
    </div>
  );

  // Per-agent AI-driven result cards
  const renderAgentResult = () => {
    const aSpec = callAnalysis?.agentSpecific;

    if (agentSlug === 'data-validation') {
      // Use AI-extracted fields, fallback to demo data structure
      const updated = aSpec?.updatedFields ?? [];
      const confirmed = aSpec?.confirmedFields ?? Object.keys(agent.demoData).slice(1);
      const hasUpdates = updated.length > 0;

      return (
        <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden mb-4">
          <div className="bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">Contact Record {hasUpdates ? 'Updated' : 'Verified'}</p>
              <p className="text-xs text-emerald-600">{agent.demoData.Contact} at {agent.demoData.Company}</p>
            </div>
            <span className="flex-shrink-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">CRM Synced</span>
          </div>
          <div className="bg-white divide-y divide-[var(--border-default)]">
            {updated.map((row) => (
              <div key={row.field} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase w-12 flex-shrink-0">{row.field}</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                  <span className="text-xs text-[var(--color-neutral-400)] line-through truncate">{row.oldValue}</span>
                  <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <span className="text-xs font-semibold text-emerald-700">{row.newValue}</span>
                </div>
                <span className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">UPDATED</span>
              </div>
            ))}
            {confirmed.map((field) => (
              <div key={field} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase w-12 flex-shrink-0">{field}</span>
                <span className="text-xs font-semibold text-[var(--color-ink)] flex-1">{agent.demoData[field] ?? '—'}</span>
                <span className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">CONFIRMED</span>
              </div>
            ))}
          </div>
          <ImpactBanner
            color="bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            headline="Vera does this for hundreds of contacts automatically — zero manual data entry."
            sub="Your CRM stays clean and up to date, 24/7, without your team lifting a finger."
          />
        </div>
      );
    }

    if (agentSlug === 'appointment-confirmation') {
      const monday = getUpcomingMonday();
      const tuesday = addDays(monday, 1);
      const thursday = addDays(monday, 3);
      const friday = addDays(monday, 4);
      const saturday = addDays(monday, 5);
      const sunday = addDays(monday, 6);
      const nxtMon = addDays(monday, 7);
      const nxtTue = addDays(monday, 8);
      const nxtWed = addDays(monday, 9);
      const nxtThu = addDays(monday, 10);
      const nxtFri = addDays(monday, 11);

      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fmtN = (d: Date) => d.getDate();
      const fmtWD = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

      // Determine what happened based on AI analysis
      const apptStatus = aSpec?.appointmentStatus ?? 'rescheduled';
      const newTime = aSpec?.newTime ?? '2:00 PM';

      // Extract the rescheduled day name robustly:
      // 1. Check agentSpecific.newDay from AI
      // 2. Fall back to searching all analysis text fields for day mentions
      const dayOffsetMap: Record<string, number> = {
        'next monday': 7, 'next tuesday': 8, 'next wednesday': 9, 'next thursday': 10, 'next friday': 11,
        'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4,
      };
      const extractDayOffset = (text: string | null | undefined): number | null => {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const [key, offset] of Object.entries(dayOffsetMap)) {
          if (lower.includes(key)) return offset;
        }
        return null;
      };
      const combinedAnalysisText = [
        callAnalysis?.outcome,
        callAnalysis?.summary,
        ...(callAnalysis?.key_points ?? []),
      ].filter(Boolean).join(' ');

      const rescheduledOffset =
        extractDayOffset(aSpec?.newDay) ??
        extractDayOffset(combinedAnalysisText) ??
        null; // null = couldn't determine

      const rescheduledDate = rescheduledOffset !== null ? addDays(monday, rescheduledOffset) : null;
      const showNextWeek = rescheduledOffset !== null && rescheduledOffset >= 7;
      const isConfirmed = apptStatus === 'confirmed';
      const isRescheduled = apptStatus === 'rescheduled';

      type DayCell = { date: Date; role: 'call-day' | 'original' | 'confirmed' | 'rescheduled' | 'available' | 'blocked' };

      const getRoleW1 = (date: Date): DayCell['role'] => {
        if (date.toDateString() === monday.toDateString()) return 'call-day';
        if (date.toDateString() === tuesday.toDateString()) {
          return isConfirmed ? 'confirmed' : 'original';
        }
        if (isRescheduled && rescheduledDate && date.toDateString() === rescheduledDate.toDateString()) return 'rescheduled';
        if (date.toDateString() === saturday.toDateString() || date.toDateString() === sunday.toDateString()) return 'blocked';
        return 'available';
      };

      const week1: DayCell[] = [monday, tuesday, addDays(monday, 2), thursday, friday, saturday, sunday]
        .map((date) => ({ date, role: getRoleW1(date) }));

      const week2: DayCell[] = [nxtMon, nxtTue, nxtWed, nxtThu, nxtFri].map((date) => {
        if (isRescheduled && rescheduledDate && date.toDateString() === rescheduledDate.toDateString()) return { date, role: 'rescheduled' as const };
        return { date, role: 'available' as const };
      });

      const cellStyle = (role: DayCell['role']) => {
        switch (role) {
          case 'call-day':    return 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-200)]';
          case 'original':    return 'bg-red-50 text-red-300 line-through opacity-60';
          case 'confirmed':   return 'bg-[var(--color-primary-600)] text-white shadow-md ring-2 ring-[var(--color-primary-400)] scale-110';
          case 'rescheduled': return 'bg-[var(--color-primary-600)] text-white shadow-md ring-2 ring-[var(--color-primary-400)] scale-110';
          case 'available':   return 'bg-white text-[var(--color-primary)]';
          case 'blocked':     return 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-300)] cursor-not-allowed';
        }
      };

      const headerLabel = isConfirmed ? 'Appointment Confirmed' : 'Appointment Rescheduled';
      const statusBadge = isConfirmed ? 'CONFIRMED' : 'RESCHEDULED';
      const newDayLabel = isConfirmed
        ? `${fmtWD(tuesday)} ${fmt(tuesday)} · 2:00 PM`
        : rescheduledDate
          ? `${fmtWD(rescheduledDate)} ${fmt(rescheduledDate)} · ${newTime}`
          : `New slot · ${newTime}`;

      return (
        <div className="border-2 border-[var(--color-primary-200)] rounded-2xl overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-800)] px-4 py-3">
            <p className="text-sm font-bold text-white">{headerLabel}</p>
          </div>

          {/* Summary row */}
          <div className="bg-white px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
            {isRescheduled && (
              <>
                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-400 text-xs px-2 py-1 rounded-lg line-through">
                  {fmtWD(tuesday)} {fmt(tuesday)} · 2:00 PM
                </span>
                <svg className="w-4 h-4 text-[var(--color-primary-400)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </>
            )}
            <span className="inline-flex items-center gap-1 bg-[var(--color-primary-600)] text-white text-xs px-2 py-1 rounded-lg font-bold shadow-sm">
              {newDayLabel}
            </span>
            <span className="ml-auto text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-2 py-0.5 rounded-full">{statusBadge}</span>
          </div>

          {/* Calendar grid */}
          <div className="bg-white px-4 pt-3 pb-2">
            <div className="bg-[var(--color-primary-50)] rounded-xl p-3">
              {/* This week */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-[var(--color-primary-400)] uppercase tracking-widest">This week</span>
                <span className="text-[9px] text-[var(--color-primary-300)]">{monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {week1.map(({ date }) => (
                  <div key={date.toISOString()} className="text-center text-[9px] font-bold text-[var(--color-primary-400)]">{fmtWD(date)}</div>
                ))}
              </div>
              <div className={`grid grid-cols-7 gap-1 ${showNextWeek ? 'mb-4' : ''}`}>
                {week1.map(({ date, role }) => (
                  <div key={date.toISOString()} className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cellStyle(role)}`}>
                    {fmtN(date)}
                  </div>
                ))}
              </div>

              {/* Next week — only shown when rescheduled day falls there */}
              {showNextWeek && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-[var(--color-primary-400)] uppercase tracking-widest">Next week</span>
                    <span className="text-[9px] text-[var(--color-primary-300)]">{nxtMon.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <div key={d} className={`text-center text-[9px] font-bold ${d === 'Sat' || d === 'Sun' ? 'text-[var(--color-primary-200)]' : 'text-[var(--color-primary-400)]'}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {week2.map(({ date, role }) => (
                      <div key={date.toISOString()} className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cellStyle(role)}`}>
                        {fmtN(date)}
                      </div>
                    ))}
                    <div className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cellStyle('blocked')}`}>{fmtN(addDays(monday, 12))}</div>
                    <div className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cellStyle('blocked')}`}>{fmtN(addDays(monday, 13))}</div>
                  </div>
                </>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-primary-400)]"><span className="w-2.5 h-2.5 rounded bg-[var(--color-primary-100)] ring-1 ring-[var(--color-primary-200)] inline-block" />Call day</span>
              {isRescheduled && <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-2.5 h-2.5 rounded bg-red-50 border border-red-200 inline-block" />Original</span>}
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-primary-600)] font-bold"><span className="w-2.5 h-2.5 rounded bg-[var(--color-primary-600)] inline-block" />{isConfirmed ? 'Confirmed' : 'Rescheduled'}</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-neutral-400)]"><span className="w-2.5 h-2.5 rounded bg-[var(--color-neutral-100)] inline-block" />Blocked</span>
            </div>
          </div>

          <ImpactBanner
            color="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] text-white"
            icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            headline="Nicole confirms hundreds of appointments while you sleep — zero no-shows, ever."
            sub="Google Calendar, Outlook, Teams, Zoom and SimplyBook sync automatically. Your team wakes up to a clean, confirmed schedule."
          />
        </div>
      );
    }

    // lead-qualification — AI-driven BANT scores
    const rawBant = aSpec?.bantScores;
    const rawNotes = aSpec?.bantNotes;
    const temp = aSpec?.leadTemperature ?? (callAnalysis?.callScore && callAnalysis.callScore > 75 ? 'hot' : 'warm');
    const nextAction = aSpec?.recommendedAction ?? callAnalysis?.nextActions?.[0] ?? 'Schedule a demo with the sales team';

    const bantItems = [
      { letter: 'B', label: 'Budget',    score: rawBant?.budget    ?? 75, note: rawNotes?.budget    ?? 'Discussed budget range',  color: 'from-indigo-500 to-violet-500' },
      { letter: 'A', label: 'Authority', score: rawBant?.authority ?? 80, note: rawNotes?.authority ?? 'Role confirmed',           color: 'from-indigo-500 to-violet-500' },
      { letter: 'N', label: 'Need',      score: rawBant?.need      ?? 70, note: rawNotes?.need      ?? 'Clear use case identified', color: 'from-indigo-400 to-violet-400' },
      { letter: 'T', label: 'Timeline',  score: rawBant?.timeline  ?? 60, note: rawNotes?.timeline  ?? 'Q2-Q3 timeframe',          color: 'from-indigo-300 to-violet-300' },
    ];
    const avgScore = Math.round(bantItems.reduce((a, b) => a + b.score, 0) / bantItems.length);
    const tempLabel = temp === 'hot' ? 'HOT LEAD' : temp === 'warm' ? 'WARM LEAD' : 'COLD LEAD';
    const tempColors = { hot: 'bg-red-500', warm: 'bg-amber-500', cold: 'bg-slate-400' };

    return (
      <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden mb-4">
        <div className="bg-indigo-50 px-4 py-3 flex items-center gap-3">
          <span className={`${tempColors[temp as keyof typeof tempColors] ?? 'bg-indigo-600'} text-white text-xs font-black px-3 py-1 rounded-full tracking-wide`}>{tempLabel}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-indigo-800">{agent.demoData.Lead ?? 'Lead'} Qualified</p>
            <p className="text-xs text-indigo-500">{agent.demoData.Company ?? ''} · {agent.demoData.Interest ?? ''}</p>
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
                  <span className="text-[10px] text-[var(--color-neutral-400)] max-w-[120px] truncate">{item.note}</span>
                </div>
                <div className="h-1.5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700`} style={{ width: `${item.score}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600 w-8 text-right flex-shrink-0">{item.score}%</span>
            </div>
          ))}
        </div>
        {nextAction && (
          <div className="bg-indigo-50 px-4 py-2.5 flex items-center gap-2 border-t border-indigo-100">
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            <span className="text-xs text-indigo-600 font-medium">Next: {nextAction}</span>
          </div>
        )}
        <ImpactBanner
          color="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          headline="Mia qualifies your entire lead list and routes hot leads straight to your sales team — automatically."
          sub="No lead falls through the cracks. Your closers spend 100% of their time on leads that are ready to buy."
        />
      </div>
    );
  };

  // Parse transcript into speaker-labelled lines
  const rawTranscript = (callData?.concatenated_transcript as string) || '';
  const transcriptLines = rawTranscript.split('\n').filter((l: string) => l.trim());

  // Robust speaker detection — handles "assistant:", "user:", agent name, etc.
  // Passes index so fallback can alternate correctly when no prefix found.
  const parseLine = (line: string, idx: number): { speaker: 'agent' | 'user'; text: string } => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    const agentNames = ['assistant', 'agent', agent.name.toLowerCase(), 'sofia', 'mia', 'vera', 'callengo'];
    const userNames = ['user', 'caller', 'human', 'customer', 'client'];
    // Check agent prefixes
    for (const name of agentNames) {
      if (lower.startsWith(`${name}:`)) {
        return { speaker: 'agent', text: trimmed.replace(/^[^:]+:\s*/, '').trim() };
      }
    }
    // Check user prefixes
    for (const name of userNames) {
      if (lower.startsWith(`${name}:`)) {
        return { speaker: 'user', text: trimmed.replace(/^[^:]+:\s*/, '').trim() };
      }
    }
    // Fallback: alternate by line index (agent starts, then user, etc.)
    return { speaker: idx % 2 === 0 ? 'agent' : 'user', text: trimmed };
  };

  const recordingUrl = (callData?.recording_url as string) || '';

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
      {(() => {
        const sentiment = callAnalysis?.sentiment;
        const score = callAnalysis?.callScore;
        const sentimentConfig = {
          positive: { label: 'Positive', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
          neutral:  { label: 'Neutral',  color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100',   dot: 'bg-amber-400'  },
          negative: { label: 'Negative', color: 'text-red-600',    bg: 'bg-red-50 border-red-100',       dot: 'bg-red-500'    },
        };
        const sc = sentiment ? sentimentConfig[sentiment] : null;
        return (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[var(--color-ink)] mb-0.5">{formatDuration(callDuration)}</div>
              <div className="text-[10px] text-[var(--color-neutral-400)] font-bold uppercase tracking-wide">{t.onboarding.agentTest.duration}</div>
            </div>
            {score != null ? (
              <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[var(--color-primary)] mb-0.5">{score}<span className="text-xs font-normal text-[var(--color-neutral-400)]">/100</span></div>
                <div className="text-[10px] text-[var(--color-neutral-400)] font-bold uppercase tracking-wide">Call Score</div>
              </div>
            ) : (
              <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-600 mb-0.5">{t.onboarding.agentTest.demo}</div>
                <div className="text-[10px] text-[var(--color-neutral-400)] font-bold uppercase tracking-wide">{t.onboarding.agentTest.callType}</div>
              </div>
            )}
            {sc ? (
              <div className={`border rounded-xl p-3 text-center ${sc.bg}`}>
                <div className={`flex items-center justify-center gap-1 mb-0.5`}>
                  <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  <span className={`text-sm font-bold ${sc.color}`}>{sc.label}</span>
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wide ${sc.color} opacity-70`}>Sentiment</div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <svg className="w-5 h-5 mx-auto text-emerald-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">{t.onboarding.agentTest.completed}</div>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Recording player — only show if URL is available */}
      {recordingUrl ? (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
            Call Recording
          </h3>
          <audio controls controlsList="nodownload" src={recordingUrl} className="w-full h-9 rounded-lg" style={{ colorScheme: 'light' }} />
        </div>
      ) : null}

      {/* Transcript — chat bubble style */}
      {transcriptLines.length > 0 && (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Call Transcript
          </h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {transcriptLines.slice(0, 24).map((line: string, i: number) => {
              const { speaker, text } = parseLine(line, i);
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
