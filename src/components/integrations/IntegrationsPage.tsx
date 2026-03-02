// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiTwilio } from 'react-icons/si';
import { FaSalesforce, FaHubspot, FaLock } from 'react-icons/fa';
import Link from 'next/link';
import { BiLogoZoom } from 'react-icons/bi';
import { createClient } from '@/lib/supabase/client';
import { GoogleCalendarIcon, GoogleMeetIcon, GoogleSheetsIcon, OutlookIcon, TeamsIcon, SlackIcon } from '@/components/icons/BrandIcons';

// ============================================================================
// TYPES
// ============================================================================

type PlanTier = 'free' | 'starter' | 'business' | 'teams' | 'enterprise';
type CategoryFilter = 'all' | 'calendar' | 'video' | 'communication' | 'crm' | 'payment';
type PlanFilter = 'all_plans' | 'free' | 'starter' | 'business' | 'teams' | 'enterprise';

interface IntegrationsPageProps {
  integrations: {
    google_calendar: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    microsoft_outlook: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    zoom: { connected: boolean };
    slack: { connected: boolean; teamName?: string; channelName?: string };
    twilio: { connected: boolean };
    salesforce: { connected: boolean; email?: string; username?: string; displayName?: string; lastSynced?: string; integrationId?: string };
    hubspot?: { connected: boolean; email?: string; displayName?: string; hubDomain?: string; lastSynced?: string; integrationId?: string };
    pipedrive?: { connected: boolean; email?: string; displayName?: string; companyName?: string; companyDomain?: string; lastSynced?: string; integrationId?: string };
    clio?: { connected: boolean; email?: string; displayName?: string; firmName?: string; firmId?: string; lastSynced?: string; integrationId?: string };
    google_sheets?: { connected: boolean; email?: string; displayName?: string; lastUsed?: string; integrationId?: string };
  };
  planSlug: string;
  companyId: string;
}

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  category: CategoryFilter;
  requiredPlan: PlanTier;
  status: 'connected' | 'available' | 'auto_enabled' | 'coming_soon';
  connectedInfo?: { label: string; value: string }[];
  autoEnabledWith?: string;
  connectUrl?: string;
  connectMethod?: 'redirect' | 'post' | 'twilio_inline';
  disconnectUrl?: string;
  syncUrl?: string;
  settingsUrl?: string;
  showSync?: boolean;
  manageUrl?: string;
  alwaysActive?: boolean;
  parentProvider?: string;
  parentConnectUrl?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const PLAN_ORDER: Record<PlanTier, number> = { free: 0, starter: 1, business: 2, teams: 3, enterprise: 4 };

function planMeetsRequirement(currentPlan: string, requiredPlan: PlanTier): boolean {
  return (PLAN_ORDER[currentPlan as PlanTier] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
}

function getPlanLabel(plan: PlanTier): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getPlanBadgeColors(plan: PlanTier): string {
  switch (plan) {
    case 'free': return 'bg-slate-100 text-slate-500';
    case 'starter': return 'bg-blue-50 text-blue-600';
    case 'business': return 'bg-violet-50 text-violet-600';
    case 'teams': return 'bg-amber-50 text-amber-600';
    case 'enterprise': return 'bg-rose-50 text-rose-600';
  }
}

function formatLastSynced(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group/tip inline-flex">
      <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

// Coming soon brand icons as simple SVG components
function WebhookIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.032 4.132c0-1.039.843-1.882 1.886-1.882.709 0 1.328.39 1.65.97a.75.75 0 101.311-.728A3.385 3.385 0 007.918.75a3.383 3.383 0 00-3.386 3.382c0 .94.385 1.79 1.003 2.402l-2.054 3.594a1.25 1.25 0 00.151 2.49h.007a1.25 1.25 0 001.146-1.75l2.369-4.144a.75.75 0 00-.249-1.005 1.879 1.879 0 01-.873-1.587z"/>
      <path d="M7.793 5.375a1.25 1.25 0 01.125-2.494h.006a1.25 1.25 0 011.157 1.725l2.159 3.572a3.383 3.383 0 014.51 3.19 3.383 3.383 0 01-4.23 3.275.75.75 0 11.373-1.452 1.883 1.883 0 002.357-1.822 1.883 1.883 0 00-2.897-1.588.75.75 0 01-1.045-.245l-2.515-4.16z"/>
      <path d="M2.002 10.429a.75.75 0 00-1.298-.752 3.383 3.383 0 002.932 5.073c1.61 0 2.96-1.124 3.301-2.632h4.42c.229.304.592.5 1.001.5h.007a1.25 1.25 0 000-2.5h-.007c-.409 0-.772.197-1 .5H6.271a.75.75 0 00-.75.75 1.883 1.883 0 01-1.886 1.882 1.883 1.883 0 01-1.633-2.821z"/>
    </svg>
  );
}

function PipedriveIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" />
    </svg>
  );
}

function ZohoIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 450" fill="none">
      <path d="M458.1,353c-7.7,0-15.5-1.6-23-4.9l0,0l-160-71.3c-28.6-12.7-41.5-46.4-28.8-75l71.3-160c12.7-28.6,46.4-41.5,75-28.8l160,71.3c28.6,12.7,41.5,46.4,28.8,75l-71.3,160C500.6,340.5,479.8,353,458.1,353z M448.4,318.1c12.1,5.4,26.3-0.1,31.7-12.1l71.3-160c5.4-12.1-0.1-26.3-12.1-31.7L379.2,43c-12.1-5.4-26.3,0.1-31.7,12.1l-71.3,160c-5.4,12.1,0.1,26.3,12.1,31.7L448.4,318.1z" fill="#089949"/>
      <path d="M960,353.1H784.8c-31.3,0-56.8-25.5-56.8-56.8V121.1c0-31.3,25.5-56.8,56.8-56.8H960c31.3,0,56.8,25.5,56.8,56.8v175.2C1016.8,327.6,991.3,353.1,960,353.1z M784.8,97.1c-13.2,0-24,10.8-24,24v175.2c0,13.2,10.8,24,24,24H960c13.2,0,24-10.8,24-24V121.1c0-13.2-10.8-24-24-24H784.8z" fill="#F9B21D"/>
      <path d="M303.9,153.2L280.3,206c-0.3,0.6-0.6,1.1-0.9,1.6l9.2,56.8c2.1,13.1-6.8,25.4-19.8,27.5l-173,28c-6.3,1-12.7-0.5-17.9-4.2c-5.2-3.7-8.6-9.3-9.6-15.6l-28-173c-1-6.3,0.5-12.7,4.2-17.9c3.7-5.2,9.3-8.6,15.6-9.6l173-28c1.3-0.2,2.6-0.3,3.8-0.3c11.5,0,21.8,8.4,23.7,20.2l9.3,57.2L294.3,94l-1.3-7.7c-5-30.9-34.2-52-65.1-47l-173,28C40,69.6,26.8,77.7,18,90c-8.9,12.3-12.4,27.3-10,42.3l28,173c2.4,15,10.5,28.1,22.8,37C68.5,349.4,80,353,91.9,353c3,0,6.1-0.2,9.2-0.7l173-28c30.9-5,52-34.2,47-65.1L303.9,153.2z" fill="#E42527"/>
      <path d="M511.4,235.8l25.4-56.9l-7.2-52.9c-0.9-6.3,0.8-12.6,4.7-17.7c3.9-5.1,9.5-8.4,15.9-9.2l173.6-23.6c1.1-0.1,2.2-0.2,3.3-0.2c5.2,0,10.2,1.7,14.5,4.9c0.8,0.6,1.5,1.3,2.2,1.9c7.7-8.1,17.8-13.9,29.1-16.4c-3.2-4.4-7-8.3-11.5-11.7c-12.1-9.2-27-13.1-42-11.1L545.6,66.5c-15,2-28.4,9.8-37.5,21.9c-9.2,12.1-13.1,27-11.1,42L511.4,235.8z" fill="#226DB4"/>
      <path d="M806.8,265.1l-22.8-168c-12.8,0.4-23.1,11-23.1,23.9v49.3l13.5,99.2c0.9,6.3-0.8,12.6-4.7,17.7s-9.5,8.4-15.9,9.2l-173.6,23.6c-6.3,0.9-12.6-0.8-17.7-4.7c-5.1-3.9-8.4-9.5-9.2-15.9l-8-58.9l-25.4,56.9l0.9,6.4c2,15,9.8,28.4,21.9,37.5c10,7.6,21.9,11.6,34.3,11.6c2.6,0,5.2-0.2,7.8-0.5L758.2,329c15-2,28.4-9.8,37.5-21.9C804.9,295,808.8,280.1,806.8,265.1z" fill="#226DB4"/>
    </svg>
  );
}

function StripeIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="54 36 360 150" fill="#635BFF">
      <path d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z"/>
      <path d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z"/>
      <polygon points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3"/>
      <rect x="223.8" y="69.3" width="25.1" height="87.5"/>
      <path d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z"/>
      <path d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z"/>
      <path d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z"/>
    </svg>
  );
}

function DynamicsIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <img src="/dynamic-logo.png" alt="Microsoft Dynamics" className={className} />
  );
}

// ============================================================================
// TWILIO SETUP MODAL
// ============================================================================

function TwilioSetupModal({
  companyId,
  onClose,
  onSuccess,
}: {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!accountSid || !authToken) {
      setError('Please enter both Account SID and Auth Token');
      return;
    }
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      const res = await fetch('/api/bland/twilio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken, test_only: true }),
      });
      if (res.ok) {
        setTestResult('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setTestResult('error');
        setError(data.error || 'Invalid credentials. Check your Account SID and Auth Token.');
      }
    } catch {
      setTestResult('error');
      setError('Connection failed. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!accountSid || !authToken) {
      setError('Please enter both Account SID and Auth Token');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const res = await fetch('/api/bland/twilio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');

      // Save encrypted key to company settings
      const { data: currentSettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      const existingSettings = (currentSettings?.settings as any) || {};
      await supabase
        .from('company_settings')
        .update({
          settings: {
            ...existingSettings,
            twilio_encrypted_key: data.encrypted_key,
            twilio_connected_at: new Date().toISOString(),
          },
        })
        .eq('company_id', companyId);

      // Import phone numbers if provided
      if (phoneNumbers.trim()) {
        const numbers = phoneNumbers.split(/[,\n]/).map(n => n.trim()).filter(Boolean);
        if (numbers.length > 0) {
          await fetch('/api/bland/twilio/import-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, encrypted_key: data.encrypted_key }),
          });
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to connect Twilio');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Connect Twilio</h3>
                <p className="text-sm text-slate-500">Step {step} of 3</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-[#F22F46]' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Where to find your credentials</p>
                    <p className="text-blue-700">Log in to <strong>twilio.com/console</strong>. Your Account SID and Auth Token are on the main dashboard page.</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Account SID</label>
                  <Tooltip text="Your Twilio Account SID starts with 'AC' and is 34 characters long. Find it on your Twilio Console dashboard." />
                </div>
                <input
                  type="text" value={accountSid} onChange={e => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all font-mono text-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Auth Token</label>
                  <Tooltip text="Your Auth Token is a 32-character string visible below your Account SID in Twilio Console. Click the eye icon to reveal it." />
                </div>
                <input
                  type="password" value={authToken} onChange={e => setAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all text-sm"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Test your credentials</p>
                    <p className="text-blue-700">We&apos;ll validate your Account SID and Auth Token before saving. This ensures a smooth setup.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Account SID</span>
                  <span className="font-mono text-slate-900 text-xs">{accountSid.slice(0, 6)}...{accountSid.slice(-4)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Auth Token</span>
                  <span className="font-mono text-slate-900 text-xs">{'*'.repeat(8)}...{authToken.slice(-4)}</span>
                </div>
              </div>

              {testResult === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs text-emerald-800 font-semibold">Credentials verified successfully</p>
                </div>
              )}

              <button
                onClick={handleTest}
                disabled={testing}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#F22F46] text-[#F22F46] hover:bg-[#F22F46]/5 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {testing ? <Spinner className="w-4 h-4" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                {testing ? 'Testing...' : testResult === 'success' ? 'Re-test Connection' : 'Test Connection'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Import your phone numbers</p>
                    <p className="text-blue-700">In Twilio Console go to <strong>Phone Numbers &rarr; Manage &rarr; Active Numbers</strong>. Copy them in E.164 format (e.g. +12223334444).</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Phone Numbers <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Tooltip text="Add your Twilio phone numbers in E.164 format. You can also add them later from Settings. One per line or comma-separated." />
                </div>
                <textarea
                  value={phoneNumbers} onChange={e => setPhoneNumbers(e.target.value)}
                  placeholder={"+12223334444\n+13334445555"}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all font-mono text-sm resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-2">
          {step > 1 && (
            <button
              onClick={() => { setStep(step - 1); setError(''); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Back
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => {
                if (!accountSid || !authToken) { setError('Fill in both fields to continue'); return; }
                setError(''); setStep(2);
              }}
              disabled={!accountSid || !authToken}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all disabled:opacity-50"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => { setError(''); setStep(3); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all"
            >
              {testResult === 'success' ? 'Continue' : 'Skip Test & Continue'}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {connecting ? <Spinner className="w-4 h-4" /> : null}
              {connecting ? 'Connecting...' : 'Connect Twilio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SLACK CONFIGURE MODAL
// ============================================================================

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackDefaultConfig {
  enabled: boolean;
  channelIds: string[];
  channelNames: string[];
  notifyOnCallCompleted: boolean;
  notifyOnAppointment: boolean;
  notifyOnFollowUp: boolean;
  notifyOnNoShow: boolean;
  setAsDefault: boolean;
}

function SlackConfigureModal({
  companyId,
  slackTeamName,
  slackChannelName,
  onClose,
  onSave,
}: {
  companyId: string;
  slackTeamName?: string;
  slackChannelName?: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SlackDefaultConfig>({
    enabled: true,
    channelIds: [],
    channelNames: [],
    notifyOnCallCompleted: true,
    notifyOnAppointment: true,
    notifyOnFollowUp: true,
    notifyOnNoShow: true,
    setAsDefault: true,
  });

  // Load channels and existing config
  useEffect(() => {
    const load = async () => {
      // Fetch channels
      try {
        const res = await fetch('/api/integrations/slack/channels');
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels || []);
        }
      } catch { /* ignore */ }
      setLoadingChannels(false);

      // Load existing default config from company_settings
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('settings')
          .eq('company_id', companyId)
          .single();
        const settings = (data?.settings as Record<string, unknown>) || {};
        const saved = settings.slack_default_config as SlackDefaultConfig | undefined;
        if (saved) {
          setConfig(saved);
        }
      } catch { /* ignore */ }
    };
    load();
  }, [companyId, supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      const existingSettings = (current?.settings as Record<string, unknown>) || {};
      await supabase
        .from('company_settings')
        .update({
          settings: {
            ...existingSettings,
            slack_default_config: config as unknown as Record<string, unknown>,
          },
        })
        .eq('company_id', companyId);
      onSave();
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const addChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || config.channelIds.includes(channelId)) return;
    setConfig(prev => ({
      ...prev,
      channelIds: [...prev.channelIds, channelId],
      channelNames: [...prev.channelNames, channel.name],
    }));
  };

  const removeChannel = (channelId: string) => {
    setConfig(prev => {
      const idx = prev.channelIds.indexOf(channelId);
      if (idx === -1) return prev;
      const newIds = prev.channelIds.filter((_, i) => i !== idx);
      const newNames = prev.channelNames.filter((_, i) => i !== idx);
      return { ...prev, channelIds: newIds, channelNames: newNames };
    });
  };

  const notificationTypes = [
    { key: 'notifyOnCallCompleted' as const, label: 'Call Completed', description: 'When an AI call finishes' },
    { key: 'notifyOnAppointment' as const, label: 'Appointments', description: 'New, confirmed, or rescheduled appointments' },
    { key: 'notifyOnFollowUp' as const, label: 'Follow-ups', description: 'When follow-up calls are scheduled' },
    { key: 'notifyOnNoShow' as const, label: 'No-shows', description: 'When a contact is marked as no-show' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <SlackIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Slack Notifications</h3>
                {slackTeamName && <p className="text-sm text-slate-500">{slackTeamName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Channels */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Notification Channels</label>
            {config.channelIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {config.channelIds.map((chId, idx) => (
                  <span key={chId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700">
                    #{config.channelNames[idx] || chId}
                    <button onClick={() => removeChannel(chId)} className="text-purple-400 hover:text-red-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            {loadingChannels ? (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 text-sm animate-pulse">Loading channels...</div>
            ) : (
              <select
                value=""
                onChange={e => { if (e.target.value) addChannel(e.target.value); }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none"
              >
                <option value="">Add a channel...</option>
                {channels.filter(ch => !config.channelIds.includes(ch.id)).map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            )}
            {config.channelIds.length === 0 && slackChannelName && (
              <p className="text-[11px] text-slate-400 mt-1">Default: #{slackChannelName}</p>
            )}
          </div>

          {/* Notification Types */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Notification Types</label>
            <div className="space-y-2">
              {notificationTypes.map(notif => (
                <div key={notif.key} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{notif.label}</p>
                    <p className="text-[11px] text-slate-400">{notif.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[notif.key]}
                      onChange={e => setConfig(prev => ({ ...prev, [notif.key]: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Set as default */}
          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-3 border border-purple-200">
            <div>
              <p className="text-sm font-bold text-purple-800">Set as default</p>
              <p className="text-[11px] text-purple-600">New campaigns will use this Slack configuration automatically</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.setAsDefault}
                onChange={e => setConfig(prev => ({ ...prev, setAsDefault: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-purple-200 rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-purple-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Spinner className="w-4 h-4" /> : null}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONFIGURE MODAL
// ============================================================================

function ConfigureModal({
  item,
  onClose,
  onSync,
  onDisconnect,
  loadingAction,
}: {
  item: IntegrationItem;
  onClose: () => void;
  onSync: (provider: string, name: string) => void;
  onDisconnect: (provider: string, name: string) => void;
  loadingAction: string | null;
}) {
  const isConnected = item.status === 'connected';
  const isAutoEnabled = item.status === 'auto_enabled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center`}>
              {item.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
              <p className="text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-600">Status</span>
            {isConnected || isAutoEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isAutoEnabled ? 'Auto-enabled' : 'Connected'}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Not connected</span>
            )}
          </div>

          {/* Connected Info */}
          {(isConnected || isAutoEnabled) && item.connectedInfo && item.connectedInfo.length > 0 && (
            <div className="space-y-2">
              {item.connectedInfo.map((info, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-sm text-slate-600">{info.label}</span>
                  <span className="text-sm font-medium text-slate-900 truncate ml-4 max-w-[200px]">{info.value}</span>
                </div>
              ))}
            </div>
          )}

          {isAutoEnabled && item.autoEnabledWith && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Automatically enabled via {item.autoEnabledWith}
            </p>
          )}

          {/* Manage URL */}
          {isConnected && item.manageUrl && (
            <Link
              href={item.manageUrl}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Manage Integration
            </Link>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-6 pt-0 flex gap-2">
          {isConnected && item.showSync && item.syncUrl && (
            <button
              onClick={() => onSync(item.provider, item.name)}
              disabled={loadingAction === `sync-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
            >
              {loadingAction === `sync-${item.provider}` ? <Spinner className="w-4 h-4" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync Now
            </button>
          )}
          {isConnected && !item.settingsUrl && !item.alwaysActive && (
            <button
              onClick={() => onDisconnect(item.provider, item.name)}
              disabled={loadingAction === `disconnect-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {loadingAction === `disconnect-${item.provider}` ? <Spinner className="w-4 h-4" /> : 'Disconnect'}
            </button>
          )}
          {isConnected && item.settingsUrl && (
            <Link
              href={item.settingsUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage({ integrations, planSlug, companyId }: IntegrationsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all_plans');
  const [configItem, setConfigItem] = useState<IntegrationItem | null>(null);
  const [showTwilioSetup, setShowTwilioSetup] = useState(false);
  const [showSlackConfig, setShowSlackConfig] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Handle OAuth callback params
  const integrationParam = searchParams.get('integration');
  const statusParam = searchParams.get('status');
  if (integrationParam && statusParam === 'connected') {
    if (typeof window !== 'undefined') {
      setTimeout(() => router.replace('/integrations', { scroll: false }), 0);
    }
  }

  // --------------------------------------------------------------------------
  // Actions - OAuth opens in NEW TAB
  // --------------------------------------------------------------------------

  const handleConnect = useCallback(async (provider: string, connectUrl: string, method?: 'redirect' | 'post' | 'twilio_inline') => {
    if (method === 'twilio_inline') {
      setShowTwilioSetup(true);
      return;
    }
    if (method === 'post') {
      setLoadingAction(`connect-${provider}`);
      try {
        const res = await fetch(connectUrl, { method: 'POST' });
        if (res.ok) {
          showToast('Connected successfully', 'success');
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Failed to connect', 'error');
        }
      } catch {
        showToast('Failed to connect', 'error');
      } finally {
        setLoadingAction(null);
      }
    } else {
      // Open OAuth in a new tab so the app doesn't close
      window.open(connectUrl, '_blank', 'noopener,noreferrer');
    }
  }, [router, showToast]);

  const handleDisconnect = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`disconnect-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} disconnected`, 'success');
        setConfigItem(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to disconnect ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to disconnect ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  const handleSync = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`sync-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} synced successfully`, 'success');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to sync ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to sync ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  // --------------------------------------------------------------------------
  // All integrations as flat list with category tags
  // --------------------------------------------------------------------------

  const allItems: IntegrationItem[] = useMemo(() => [
    {
      id: 'google-calendar', provider: 'google-calendar', name: 'Google Calendar',
      description: 'Sync call schedules, appointments, and events',
      icon: <GoogleCalendarIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
      syncUrl: '/api/integrations/google-calendar/sync', showSync: true,
      connectedInfo: integrations.google_calendar.connected ? [
        ...(integrations.google_calendar.email ? [{ label: 'Account', value: integrations.google_calendar.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.google_calendar.lastSynced) },
      ] : undefined,
    },
    {
      id: 'microsoft-outlook', provider: 'microsoft-outlook', name: 'Microsoft 365',
      description: 'Sync Outlook calendar events and schedules',
      icon: <OutlookIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
      syncUrl: '/api/integrations/microsoft-outlook/sync', showSync: true,
      connectedInfo: integrations.microsoft_outlook.connected ? [
        ...(integrations.microsoft_outlook.email ? [{ label: 'Account', value: integrations.microsoft_outlook.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.microsoft_outlook.lastSynced) },
      ] : undefined,
    },
    {
      id: 'google-meet', provider: 'google-meet', name: 'Google Meet',
      description: 'Auto-generate Meet links for calendar events',
      icon: <GoogleMeetIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-teal-50',
      category: 'video', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Google Calendar',
      parentProvider: 'google-calendar',
      parentConnectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
    },
    {
      id: 'microsoft-teams', provider: 'microsoft-teams', name: 'Microsoft Teams',
      description: 'Auto-generate Teams links for calendar events',
      icon: <TeamsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'video', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Microsoft 365 Outlook',
      parentProvider: 'microsoft-outlook',
      parentConnectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
    },
    {
      id: 'zoom', provider: 'zoom', name: 'Zoom',
      description: 'Server-to-server integration, always available',
      icon: <BiLogoZoom className="w-7 h-7" />, iconColor: 'text-[#2D8CFF]', iconBg: 'bg-blue-50',
      category: 'video', requiredPlan: 'free',
      status: 'connected',
      alwaysActive: true,
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
    {
      id: 'salesforce', provider: 'salesforce', name: 'Salesforce',
      description: 'Sync contacts, leads, and call data with your CRM',
      icon: <FaSalesforce className="w-7 h-7" />, iconColor: 'text-[#00A1E0]', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'teams',
      status: integrations.salesforce.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/salesforce/connect?return_to=/integrations',
      syncUrl: '/api/integrations/salesforce/sync', showSync: true,
      manageUrl: '/contacts/salesforce',
      connectedInfo: integrations.salesforce.connected ? [
        ...(integrations.salesforce.username ? [{ label: 'User', value: integrations.salesforce.displayName || integrations.salesforce.username }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.salesforce.lastSynced) },
      ] : undefined,
    },
    {
      id: 'slack', provider: 'slack', name: 'Slack',
      description: 'Real-time notifications and slash commands',
      icon: <SlackIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-purple-50',
      category: 'communication', requiredPlan: 'starter',
      status: integrations.slack.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
      connectedInfo: integrations.slack.connected ? [
        ...(integrations.slack.teamName ? [{ label: 'Workspace', value: integrations.slack.teamName }] : []),
        ...(integrations.slack.channelName ? [{ label: 'Channel', value: `#${integrations.slack.channelName}` }] : []),
      ] : undefined,
    },
    {
      id: 'twilio', provider: 'twilio', name: 'Twilio',
      description: 'Voice calling and SMS phone numbers',
      icon: <SiTwilio className="w-6 h-6" />, iconColor: 'text-[#F22F46]', iconBg: 'bg-red-50',
      category: 'communication', requiredPlan: 'business',
      status: integrations.twilio.connected ? 'connected' : 'available',
      connectUrl: '#twilio-setup',
      connectMethod: 'twilio_inline',
      settingsUrl: integrations.twilio.connected ? '/settings?section=call-settings&scroll=phone-numbers' : undefined,
      connectedInfo: integrations.twilio.connected ? [{ label: 'Config', value: 'Managed via Settings' }] : undefined,
    },
    {
      id: 'google-sheets', provider: 'google-sheets', name: 'Google Sheets',
      description: 'Import contacts from your Google Sheets spreadsheets',
      icon: <GoogleSheetsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-green-50',
      category: 'crm', requiredPlan: 'free',
      status: integrations.google_sheets?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-sheets/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/google-sheets/disconnect',
      manageUrl: '/contacts',
      connectedInfo: integrations.google_sheets?.connected ? [
        ...(integrations.google_sheets.email ? [{ label: 'Account', value: integrations.google_sheets.email }] : []),
        ...(integrations.google_sheets.lastUsed ? [{ label: 'Last Import', value: new Date(integrations.google_sheets.lastUsed).toLocaleDateString() }] : []),
      ] : undefined,
    },
    {
      id: 'hubspot', provider: 'hubspot', name: 'HubSpot',
      description: 'Import contacts and sync call outcomes',
      icon: <FaHubspot className="w-7 h-7" />, iconColor: 'text-[#FF7A59]', iconBg: 'bg-orange-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.hubspot?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/hubspot/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/hubspot/disconnect',
      syncUrl: '/api/integrations/hubspot/sync',
      showSync: true,
      manageUrl: '/contacts/hubspot',
      connectedInfo: integrations.hubspot?.connected ? [
        ...(integrations.hubspot.displayName || integrations.hubspot.email ? [{ label: 'Account', value: integrations.hubspot.displayName || integrations.hubspot.email || '' }] : []),
        ...(integrations.hubspot.hubDomain ? [{ label: 'Portal', value: integrations.hubspot.hubDomain }] : []),
        ...(integrations.hubspot.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.hubspot.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'pipedrive', provider: 'pipedrive', name: 'Pipedrive',
      description: 'Bidirectional sync: import contacts and push call results back to your CRM',
      icon: <PipedriveIcon className="w-7 h-7" />, iconColor: 'text-black', iconBg: 'bg-slate-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.pipedrive?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/pipedrive/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/pipedrive/disconnect',
      syncUrl: '/api/integrations/pipedrive/sync',
      showSync: true,
      manageUrl: '/contacts/pipedrive',
      connectedInfo: integrations.pipedrive?.connected ? [
        ...(integrations.pipedrive.displayName || integrations.pipedrive.email ? [{ label: 'Account', value: integrations.pipedrive.displayName || integrations.pipedrive.email || '' }] : []),
        ...(integrations.pipedrive.companyName ? [{ label: 'Company', value: integrations.pipedrive.companyName }] : []),
        ...(integrations.pipedrive.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.pipedrive.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'clio', provider: 'clio', name: 'Clio',
      description: 'Import contacts, matters, and calendar from your legal practice management software',
      icon: <img src="/clio-logo.png" alt="Clio" className="w-7 h-7" />, iconColor: '', iconBg: 'bg-[#1B2B5B]/5',
      category: 'crm', requiredPlan: 'teams',
      status: integrations.clio?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/clio/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/clio/disconnect',
      syncUrl: '/api/integrations/clio/sync',
      showSync: true,
      manageUrl: '/contacts/clio',
      connectedInfo: integrations.clio?.connected ? [
        ...(integrations.clio.displayName || integrations.clio.email ? [{ label: 'Account', value: integrations.clio.displayName || integrations.clio.email || '' }] : []),
        ...(integrations.clio.firmName ? [{ label: 'Firm', value: integrations.clio.firmName }] : []),
        ...(integrations.clio.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.clio.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'zoho', provider: 'zoho', name: 'Zoho CRM',
      description: 'Sync leads, contacts, and call logs bidirectionally',
      icon: <ZohoIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-red-50',
      category: 'crm', requiredPlan: 'business', status: 'coming_soon',
    },
    {
      id: 'simplybook', provider: 'simplybook', name: 'SimplyBook.me',
      description: 'Appointment scheduling and booking management',
      icon: <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-7 h-7 rounded" />, iconColor: '', iconBg: 'bg-sky-50',
      category: 'calendar', requiredPlan: 'starter', status: 'coming_soon',
    },
    {
      id: 'webhooks', provider: 'webhooks', name: 'Webhooks',
      description: 'Receive real-time events via HTTP. Connect with Zapier, Make, n8n, or your own systems',
      icon: <WebhookIcon className="w-6 h-6" />, iconColor: 'text-slate-700', iconBg: 'bg-slate-100',
      category: 'communication', requiredPlan: 'starter',
      status: 'available',
      connectUrl: '/settings?section=webhooks',
      connectMethod: 'redirect' as const,
    },
    {
      id: 'dynamics', provider: 'dynamics', name: 'Microsoft Dynamics',
      description: 'Sync contacts, leads, and opportunities with Dynamics 365',
      icon: <DynamicsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'teams', status: 'coming_soon',
    },
    {
      id: 'stripe', provider: 'stripe', name: 'Stripe',
      description: 'Payment processing, overage billing, and auto-recharge for call minutes',
      icon: <StripeIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'payment', requiredPlan: 'free',
      status: 'connected',
      alwaysActive: true,
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
  ], [integrations]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (activeFilter !== 'all') items = items.filter(i => i.category === activeFilter);
    if (planFilter !== 'all_plans') items = items.filter(i => planMeetsRequirement(planFilter, i.requiredPlan));
    return items;
  }, [allItems, activeFilter, planFilter]);

  const activeCount = allItems.filter(i => i.status === 'connected' || i.status === 'auto_enabled').length;

  const categoryBadges: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'video', label: 'Video' },
    { id: 'communication', label: 'Communication' },
    { id: 'payment', label: 'Payment' },
  ];

  const planBadges: { id: PlanFilter; label: string }[] = [
    { id: 'all_plans', label: 'All Plans' },
    { id: 'free', label: 'Free' },
    { id: 'starter', label: 'Starter' },
    { id: 'business', label: 'Business' },
    { id: 'teams', label: 'Teams' },
    { id: 'enterprise', label: 'Enterprise' },
  ];

  // --------------------------------------------------------------------------
  // Render card
  // --------------------------------------------------------------------------

  function renderCard(item: IntegrationItem) {
    const isComingSoon = item.status === 'coming_soon';
    const isConnected = item.status === 'connected';
    const isAutoEnabled = item.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, item.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;

    return (
      <div
        key={item.id}
        className={`relative flex flex-col p-5 rounded-xl border transition-all ${
          isConnected || isAutoEnabled
            ? 'border-emerald-100 bg-white hover:shadow-md hover:border-emerald-200'
            : isLocked
            ? 'border-slate-100 bg-slate-50/40'
            : 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
        }`}
      >
        {/* Plan badge - top right */}
        <div className="absolute top-3 right-3">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getPlanBadgeColors(item.requiredPlan)} uppercase tracking-wider`}>
            {item.requiredPlan === 'free' ? 'Free' : `${getPlanLabel(item.requiredPlan)}+`}
          </span>
        </div>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center mb-3`}>
          {item.icon}
        </div>

        {/* Name */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
          {(isConnected || isAutoEnabled) && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">{item.description}</p>

        {/* Action button */}
        <div>
          {isComingSoon && (
            <span className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 w-full justify-center">
              Coming Soon
            </span>
          )}

          {/* Always-active integrations (Stripe, Zoom) - no button, just a status label */}
          {!isComingSoon && item.alwaysActive && (
            <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Always Active
            </span>
          )}

          {/* Auto-enabled (Google Meet when Google Calendar connected, Teams when Outlook connected) - no configure button */}
          {!isComingSoon && !item.alwaysActive && isAutoEnabled && (
            <span className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active via {item.autoEnabledWith}
            </span>
          )}

          {/* Connected integrations that are NOT always-active and NOT auto-enabled - show Configure */}
          {!isComingSoon && !item.alwaysActive && isConnected && !isAutoEnabled && (
            <button
              onClick={() => item.provider === 'slack' ? setShowSlackConfig(true) : setConfigItem(item)}
              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure
            </button>
          )}

          {/* Not connected, not auto-enabled - show Connect button or parent connect */}
          {!isComingSoon && !item.alwaysActive && !isConnected && !isAutoEnabled && item.connectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(item.provider, item.connectUrl!, item.connectMethod);
              }}
              disabled={isLocked || loadingAction === `connect-${item.provider}`}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade to {getPlanLabel(item.requiredPlan)}
                </>
              ) : loadingAction === `connect-${item.provider}` ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : (
                'Connect'
              )}
            </button>
          )}

          {!isComingSoon && !isConnected && item.settingsUrl && !item.connectUrl && !item.parentConnectUrl && (
            <Link
              href={isLocked ? '#' : item.settingsUrl}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed pointer-events-none' : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade
                </>
              ) : (
                'Configure'
              )}
            </Link>
          )}

          {/* Google Meet / Teams not connected - show Connect button that opens the parent (Google Calendar / Microsoft 365) */}
          {!isComingSoon && !isConnected && !isAutoEnabled && !item.connectUrl && item.parentConnectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(item.parentProvider!, item.parentConnectUrl!);
              }}
              disabled={isLocked || loadingAction === `connect-${item.parentProvider}`}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade to {getPlanLabel(item.requiredPlan)}
                </>
              ) : (
                `Connect ${item.autoEnabledWith}`
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">Connect your tools to streamline your workflow</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">{activeCount} active</span>
        </div>
      </div>

      {/* Filter badges - category + plan */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {categoryBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setActiveFilter(badge.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === badge.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {badge.label}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-200 mx-1" />
          {planBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setPlanFilter(badge.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                planFilter === badge.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {badge.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => renderCard(item))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No integrations match your filters</p>
        </div>
      )}

      {/* Help Banner */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Need help setting up integrations?</p>
            <p className="text-xs text-slate-500 mt-0.5">Step-by-step guides for connecting all your tools with Callengo</p>
          </div>
        </div>
        <a
          href="https://callengo.com/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all shrink-0"
        >
          View Guides
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* Twilio Setup Modal */}
      {showTwilioSetup && (
        <TwilioSetupModal
          companyId={companyId}
          onClose={() => setShowTwilioSetup(false)}
          onSuccess={() => {
            setShowTwilioSetup(false);
            showToast('Twilio connected successfully', 'success');
            router.refresh();
          }}
        />
      )}

      {/* Slack Configure Modal */}
      {showSlackConfig && (
        <SlackConfigureModal
          companyId={companyId}
          slackTeamName={integrations.slack.teamName}
          slackChannelName={integrations.slack.channelName}
          onClose={() => setShowSlackConfig(false)}
          onSave={() => {
            setShowSlackConfig(false);
            showToast('Slack configuration saved', 'success');
          }}
        />
      )}

      {/* Configure Modal */}
      {configItem && (
        <ConfigureModal
          item={configItem}
          onClose={() => setConfigItem(null)}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          loadingAction={loadingAction}
        />
      )}
    </div>
  );
}
