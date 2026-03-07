// components/settings/CallSettings.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import VoiceSelector from '@/components/voice/VoiceSelector';
import { useTranslation } from '@/i18n';
import type { Json } from '@/types/supabase';

interface CallSettingsProps {
  settings: {
    default_voice: string;
    default_interval_minutes: number;
    default_max_duration: number;
    test_phone_number: string;
    timezone: string;
    working_hours_start: string;
    working_hours_end: string;
    max_calls_per_day: number;
    working_days?: string[];
    exclude_holidays?: boolean;
    voicemail_enabled?: boolean;
    followup_enabled?: boolean;
    followup_max_attempts?: number;
    followup_interval_hours?: number;
    smart_followup_enabled?: boolean;
  };
  onSettingsChange: (settings: Record<string, unknown>) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  success: string;
  companyId: string;
  initialSection?: string;
}

interface SubscriptionPlan {
  name: string;
  slug: string;
  minutes_included: number;
  max_call_duration: number;
  price_per_extra_minute: string;
  max_concurrent_calls: number;
  max_calls_per_day: number | null;
  max_calls_per_hour: number | null;
}

interface UsageStats {
  minutesUsed: number;
  minutesIncluded: number;
  averageCallDuration: number | null;
  totalCalls: number;
  periodStart: string;
  periodEnd: string;
}

interface PhoneNumber {
  phone_number: string;
  type: 'rotated';
  created_at?: string;
  last_used?: string;
  status: 'active' | 'inactive';
}

export default function CallSettings({ settings, onSettingsChange, onSubmit, loading, success, companyId, initialSection }: CallSettingsProps) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const phoneNumbersRef = useRef<HTMLDivElement>(null);

  // Phone Number Management State
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);

  useEffect(() => {
    loadPlanAndUsage();
  }, [companyId]);

  useEffect(() => {
    if (initialSection === 'phone-numbers' && phoneNumbersRef.current && !loadingData) {
      setTimeout(() => {
        phoneNumbersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [initialSection, loadingData]);

  useEffect(() => {
    if (plan && (!settings.default_max_duration || settings.default_max_duration > plan.max_call_duration)) {
      onSettingsChange({ ...settings, default_max_duration: plan.max_call_duration });
    }
  }, [plan]);

  useEffect(() => {
    if (companyId) {
      loadPhoneNumbers();
    }
  }, [companyId]);

  const loadPlanAndUsage = async () => {
    try {
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (
            name, slug, minutes_included, max_call_duration,
            price_per_extra_minute, max_concurrent_calls,
            max_calls_per_day, max_calls_per_hour
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      const planData = subscription?.subscription_plans as unknown as SubscriptionPlan;
      if (planData) setPlan(planData);

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('minutes_used, minutes_included, period_start, period_end')
        .eq('company_id', companyId)
        .lte('period_start', now.toISOString())
        .gte('period_end', now.toISOString())
        .single();

      const { data: calls } = await supabase
        .from('call_logs')
        .select('call_length')
        .eq('company_id', companyId)
        .gte('created_at', periodStart.toISOString())
        .not('call_length', 'is', null);

      let avgDuration = null;
      if (calls && calls.length > 0) {
        const totalSeconds = calls.reduce((sum, call) => sum + (call.call_length || 0), 0);
        avgDuration = Math.round(totalSeconds / calls.length / 60);
      }

      setUsageStats({
        minutesUsed: usage?.minutes_used || 0,
        minutesIncluded: planData?.minutes_included || 0,
        averageCallDuration: avgDuration,
        totalCalls: calls?.length || 0,
        periodStart: usage?.period_start || periodStart.toISOString(),
        periodEnd: usage?.period_end || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
      });
    } catch (error) {
      console.error('Error loading plan and usage:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadPhoneNumbers = async () => {
    setLoadingPhones(true);
    try {
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();

      const settingsData = companySettings?.settings as Record<string, unknown> | undefined;
      if (settingsData?.phone_numbers) {
        setPhoneNumbers(settingsData.phone_numbers as unknown as PhoneNumber[]);
      }

      const { data: recentCalls } = await supabase
        .from('call_logs')
        .select('metadata, created_at')
        .eq('company_id', companyId)
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentCalls && recentCalls.length > 0) {
        const uniqueNumbers = new Map<string, string>();
        recentCalls.forEach(call => {
          const meta = call.metadata as Record<string, unknown> | undefined;
          const fromNumber = (meta?.from_number || meta?.from) as string | undefined;
          if (fromNumber && !uniqueNumbers.has(fromNumber)) {
            uniqueNumbers.set(fromNumber, call.created_at as string);
          }
        });

        if (uniqueNumbers.size > 0) {
          const rotatedNums: PhoneNumber[] = Array.from(uniqueNumbers.entries())
            .slice(0, 5)
            .map(([number, lastUsed]) => ({
              phone_number: number, type: 'rotated' as const,
              last_used: lastUsed, status: 'active' as const,
            }));

          setPhoneNumbers(prev => {
            const existing = new Set(prev.map(p => p.phone_number));
            return [...prev, ...rotatedNums.filter(r => !existing.has(r.phone_number))];
          });
        }
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error);
    } finally {
      setLoadingPhones(false);
    }
  };

  const savePhoneNumbers = async (numbers: PhoneNumber[]) => {
    try {
      const { data: currentSettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();

      const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

      await supabase
        .from('company_settings')
        .update({
          settings: { ...existingSettings, phone_numbers: numbers.filter(n => n.type !== 'rotated') } as unknown as { [key: string]: Json | undefined }
        })
        .eq('company_id', companyId);
    } catch (error) {
      console.error('Error saving phone numbers:', error);
    }
  };

  const calculateApproximateCalls = (duration: number) => {
    if (!plan) return 0;
    return Math.floor(plan.minutes_included / duration);
  };

  const getOptimizationSuggestion = () => {
    if (!usageStats || !usageStats.averageCallDuration || !plan) return null;
    const avgDuration = usageStats.averageCallDuration;
    const currentDuration = settings.default_max_duration;

    if (avgDuration < currentDuration - 1) {
      const difference = calculateApproximateCalls(avgDuration) - calculateApproximateCalls(currentDuration);
      return { type: 'optimize', message: `Your average call is ${avgDuration} min. Set max duration to ${avgDuration + 1} min to make ~${difference} more calls/month.`, suggestedDuration: avgDuration + 1 };
    }
    if (avgDuration > currentDuration) {
      return { type: 'warning', message: `Your calls average ${avgDuration} min but limit is ${currentDuration} min. Calls may be cut off.`, suggestedDuration: avgDuration };
    }
    return null;
  };

  const getPlanLimitIndicator = () => {
    if (!plan) return null;
    const percentage = ((settings.default_max_duration - 0.25) / (plan.max_call_duration - 0.25)) * 100;
    return { maxDuration: plan.max_call_duration, currentDuration: settings.default_max_duration, percentage };
  };

  const isFreePlan = plan?.slug === 'free';
  const suggestion = getOptimizationSuggestion();
  const limitIndicator = getPlanLimitIndicator();
  const approximateCalls = calculateApproximateCalls(settings.default_max_duration);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      {plan && (
        <div className="gradient-bg-subtle rounded-xl p-6 border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                {plan.name} Plan
              </h3>
              <p className="text-sm text-slate-600 mt-1">Your current subscription limits and usage</p>
            </div>
            {usageStats && (
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--color-primary)]">{usageStats.minutesUsed}/{usageStats.minutesIncluded}</div>
                <div className="text-xs text-slate-600 font-medium">{t.common.minutes} used</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-600 font-medium mb-1">{t.settings.calling.maxDuration}</div><div className="text-lg font-bold text-slate-900">{plan.max_call_duration} min</div></div>
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-600 font-medium mb-1">Concurrent Calls</div><div className="text-lg font-bold text-slate-900">{plan.max_concurrent_calls}</div></div>
            {plan.max_calls_per_day && (<div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-600 font-medium mb-1">{t.settings.calling.maxCallsPerDay}</div><div className="text-lg font-bold text-slate-900">{plan.max_calls_per_day}</div></div>)}
            {usageStats && usageStats.averageCallDuration && (<div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-emerald-100"><div className="text-xs text-slate-600 font-medium mb-1">Avg Call Duration</div><div className="text-lg font-bold text-emerald-600">{usageStats.averageCallDuration} min</div></div>)}
          </div>
          {usageStats && usageStats.totalCalls > 0 && (
            <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium mb-2">Monthly Usage</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-200 rounded-full h-2.5"><div className="gradient-bg h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((usageStats.minutesUsed / usageStats.minutesIncluded) * 100, 100)}%` }}></div></div>
                <div className="text-sm font-bold text-slate-700">{Math.round((usageStats.minutesUsed / usageStats.minutesIncluded) * 100)}%</div>
              </div>
              <div className="text-xs text-slate-500 mt-2">{usageStats.totalCalls} calls this month</div>
            </div>
          )}
        </div>
      )}

      {/* Optimization Suggestion */}
      {suggestion && (
        <div className={`rounded-xl p-4 border ${suggestion.type === 'optimize' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {suggestion.type === 'optimize' ? (
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
            </div>
            <div className="flex-1">
              <h4 className={`text-sm font-bold mb-1 ${suggestion.type === 'optimize' ? 'text-emerald-900' : 'text-amber-900'}`}>{suggestion.type === 'optimize' ? 'Optimization Opportunity' : 'Configuration Warning'}</h4>
              <p className={`text-sm ${suggestion.type === 'optimize' ? 'text-emerald-700' : 'text-amber-700'}`}>{suggestion.message}</p>
              {suggestion.type === 'optimize' && (
                <button type="button" onClick={() => onSettingsChange({ ...settings, default_max_duration: suggestion.suggestedDuration })} className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline">Apply suggestion →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHONE NUMBER MANAGEMENT */}
      <div ref={phoneNumbersRef} className="scroll-mt-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-slate-900">Auto-Rotating Numbers</h4>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                </div>
                <p className="text-xs text-slate-500">Callengo rotates numbers from our pool to maximize pickup rates and avoid spam flags. Included on all plans.</p>
              </div>
            </div>
            {!isFreePlan && (
              <a
                href="/settings?tab=billing"
                onClick={async (e) => {
                  e.preventDefault();
                  // redirect to billing settings with addon tab
                  window.location.href = '/settings?tab=billing';
                }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Dedicated Number — $15/mo
              </a>
            )}
          </div>
          {!isFreePlan && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <p className="text-xs text-slate-500">Want your own number for better brand recognition? Add a <strong>Dedicated Number</strong> for $15/mo and calls always show your number.</p>
            </div>
          )}
        </div>
      </div>

      {/* CALL RECORDINGS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-sm font-bold text-slate-900">Call Recordings</h4>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">30-day retention</span>
              </div>
              <p className="text-xs text-slate-500">All calls are recorded automatically. Recordings are stored for 30 days then deleted.</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="w-11 h-6 bg-slate-300 rounded-full relative opacity-60 cursor-not-allowed">
              <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow"></div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <p className="text-xs text-slate-500">Upgrade to <strong className="text-slate-700">Recording Vault ($12/mo)</strong> to keep recordings for 12 months, searchable & downloadable anytime.</p>
            </div>
            {!isFreePlan && (
              <a
                href="/settings?tab=billing"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                Unlock Recording Vault
              </a>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Call Duration Optimizer */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Call Duration Settings
          </h4>
          <div>
            <div className="flex items-end justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700">{t.settings.calling.maxDuration}</label>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--color-primary)]">{settings.default_max_duration % 1 === 0 ? `${settings.default_max_duration} min` : `${Math.floor(settings.default_max_duration)} min ${Math.round((settings.default_max_duration % 1) * 60)} sec`}</div>
                <div className="text-xs text-slate-500">~{approximateCalls} calls/month</div>
              </div>
            </div>
            <input type="range" min="0.25" max={plan?.max_call_duration || 15} step="0.25" value={settings.default_max_duration} onChange={(e) => onSettingsChange({ ...settings, default_max_duration: parseFloat(e.target.value) })} className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]" style={{ background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${limitIndicator?.percentage}%, rgb(226 232 240) ${limitIndicator?.percentage}%, rgb(226 232 240) 100%)` }} />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-500">15 sec</span>
              {plan && <span className="text-xs font-bold text-[var(--color-primary)]">Limit: {plan.max_call_duration} min</span>}
            </div>
            {settings.default_max_duration < 2 && (<div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><div className="flex gap-2"><svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><p className="text-xs text-red-800 font-medium"><strong>Warning:</strong> Calls shorter than 2 minutes may not achieve their objectives.</p></div></div>)}
            {plan && settings.default_max_duration >= plan.max_call_duration && (<div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-xs text-amber-800">You&apos;ve reached your plan&apos;s maximum call duration limit.</p></div>)}
          </div>
          <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-sm text-slate-900"><p className="font-semibold mb-1">Duration Optimizer</p><p className="text-slate-700">Lower duration = more calls per month.{plan && ` With ${plan.minutes_included} minutes included, you can make ~${approximateCalls} calls at ${settings.default_max_duration} min each.`}</p></div>
            </div>
          </div>
        </div>

        {/* Voice & Language */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>Voice & Language</h4>
          <div><label className="block text-sm font-bold text-slate-700 mb-3">{t.settings.calling.voice}</label><VoiceSelector selectedVoiceId={settings.default_voice} onVoiceSelect={(voiceId) => onSettingsChange({ ...settings, default_voice: voiceId })} /></div>
        </div>

        {/* Call Timing */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Call Scheduling</h4>
          <div className="grid md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.interval} ({t.common.minutes})</label><input type="number" min="1" max="60" value={settings.default_interval_minutes} onChange={(e) => onSettingsChange({ ...settings, default_interval_minutes: parseInt(e.target.value) })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.maxCallsPerDay}{plan && plan.max_calls_per_day && <span className="ml-2 text-xs text-[var(--color-primary)]">(Plan limit: {plan.max_calls_per_day})</span>}</label><input type="number" min="1" max={plan?.max_calls_per_day || 1000} value={settings.max_calls_per_day} onChange={(e) => onSettingsChange({ ...settings, max_calls_per_day: parseInt(e.target.value) })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" /></div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>{t.settings.calling.workingHours}</h4>
          <div className="grid md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label><input type="time" value={settings.working_hours_start} onChange={(e) => onSettingsChange({ ...settings, working_hours_start: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-2">End Time</label><input type="time" value={settings.working_hours_end} onChange={(e) => onSettingsChange({ ...settings, working_hours_end: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.timezone}</label><select value={settings.timezone} onChange={(e) => onSettingsChange({ ...settings, timezone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white outline-none transition-all cursor-pointer hover:border-slate-300"><option value="America/New_York">Eastern Time (ET)</option><option value="America/Chicago">Central Time (CT)</option><option value="America/Denver">Mountain Time (MT)</option><option value="America/Los_Angeles">Pacific Time (PT)</option><option value="America/Phoenix">Arizona (MST)</option><option value="America/Anchorage">Alaska (AKT)</option><option value="Pacific/Honolulu">Hawaii (HST)</option><option value="Europe/London">London (GMT)</option><option value="Europe/Paris">Paris (CET)</option><option value="Asia/Tokyo">Tokyo (JST)</option><option value="Australia/Sydney">Sydney (AEDT)</option></select></div>
          </div>
          <div><label className="block text-sm font-bold text-slate-700 mb-3">{t.settings.calling.workingDays}</label><div className="grid grid-cols-7 gap-2">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => { const dayLower = day.toLowerCase(); const isSelected = settings.working_days?.includes(dayLower) ?? true; return (<button key={day} type="button" onClick={() => { const currentDays = settings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']; const newDays = isSelected ? currentDays.filter(d => d !== dayLower) : [...currentDays, dayLower]; onSettingsChange({ ...settings, working_days: newDays }); }} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${isSelected ? 'gradient-bg text-white border-[var(--color-primary)] hover:opacity-90' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{day.slice(0, 3)}</button>); })}</div><p className="text-xs text-slate-500 mt-2">Select which days of the week calls should be placed</p></div>
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4"><input type="checkbox" id="exclude-holidays" checked={settings.exclude_holidays ?? false} onChange={(e) => onSettingsChange({ ...settings, exclude_holidays: e.target.checked })} className="mt-1 w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer" /><div className="flex-1"><label htmlFor="exclude-holidays" className="text-sm font-bold text-slate-700 cursor-pointer block mb-1">{t.settings.calling.excludeHolidays}</label><p className="text-xs text-slate-600">Automatically skip calls on major US federal holidays.</p></div></div>
        </div>

        {/* Voicemail & Follow-up Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {t.settings.calling.voicemail} & {t.settings.calling.followUp}s
          </h4>
          <p className="text-xs text-slate-500 -mt-4">Configure automatic voicemail detection and follow-up call behavior. Available from Starter plan and above.</p>

          {isFreePlan ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">Upgrade to unlock Voicemail & Follow-ups</p>
              <p className="text-xs text-slate-500 mt-1">Available on Starter plan and above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Voicemail Toggle */}
              <div className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label htmlFor="voicemail-enabled" className="text-sm font-bold text-slate-700 cursor-pointer">{t.settings.calling.voicemail}</label>
                    {plan && plan.slug !== 'starter' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Custom Message</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Automatically detect voicemail and leave a message. {plan && plan.slug === 'starter' ? 'Standard voicemail on Starter plan.' : 'Business+ plans can customize the voicemail message.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" id="voicemail-enabled" checked={settings.voicemail_enabled ?? false} onChange={(e) => onSettingsChange({ ...settings, voicemail_enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                </label>
              </div>

              {/* Follow-up Toggle */}
              <div className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label htmlFor="followup-enabled" className="text-sm font-bold text-slate-700 cursor-pointer">{t.settings.calling.followUp}</label>
                    {plan && plan.slug === 'starter' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Max 1</span>
                    )}
                    {plan && plan.slug !== 'starter' && plan.slug !== 'free' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Unlimited</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Automatically schedule follow-up calls for contacts that didn&apos;t answer or requested a callback.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" id="followup-enabled" checked={settings.followup_enabled ?? false} onChange={(e) => onSettingsChange({ ...settings, followup_enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                </label>
              </div>

              {settings.followup_enabled && (
                <div className="ml-4 pl-4 border-l-2 border-[var(--color-primary)]/20 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.followUp} Max Attempts</label>
                      <input type="number" min="1" max={plan && plan.slug === 'starter' ? 1 : 10} value={settings.followup_max_attempts ?? 1} onChange={(e) => onSettingsChange({ ...settings, followup_max_attempts: parseInt(e.target.value) })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" />
                      {plan && plan.slug === 'starter' && <p className="text-xs text-slate-400 mt-1">Starter plan limited to 1 follow-up</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.followUp} {t.settings.calling.interval} ({t.common.hours})</label>
                      <input type="number" min="1" max="168" value={settings.followup_interval_hours ?? 24} onChange={(e) => onSettingsChange({ ...settings, followup_interval_hours: parseInt(e.target.value) })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" />
                      <p className="text-xs text-slate-400 mt-1">Time between follow-up attempts</p>
                    </div>
                  </div>

                  {/* Smart Follow-up - Business+ only */}
                  {plan && plan.slug !== 'starter' && plan.slug !== 'free' && (
                    <div className="flex items-start gap-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <label htmlFor="smart-followup" className="text-sm font-bold text-slate-700 cursor-pointer">{t.settings.calling.smartFollowUp}</label>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Business+</span>
                        </div>
                        <p className="text-xs text-slate-500">When a contact requests a callback at a specific time (e.g., &quot;call me Friday at 5 PM&quot;), Callengo will automatically schedule the follow-up for that exact time instead of using the default interval.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input type="checkbox" id="smart-followup" checked={settings.smart_followup_enabled ?? false} onChange={(e) => onSettingsChange({ ...settings, smart_followup_enabled: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-purple-400/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Phone */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>Test Configuration</h4>
          <div><label className="block text-sm font-bold text-slate-700 mb-2">{t.settings.calling.testPhone}</label><input type="tel" value={settings.test_phone_number} onChange={(e) => onSettingsChange({ ...settings, test_phone_number: e.target.value })} placeholder="+1 (555) 123-4567" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300" /><p className="text-xs text-slate-500 mt-2">Use this number for testing agent configurations before launching campaigns</p></div>
        </div>

        <button type="submit" disabled={loading} className="w-full px-6 py-4 gradient-bg text-white rounded-xl font-semibold text-base hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? (<><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{t.settings.calling.saving}</span></>) : t.settings.calling.saveButton}
        </button>

        {success && (<div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"><div className="flex gap-3"><svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm font-medium text-emerald-800">{success}</p></div></div>)}
      </form>
    </div>
  );
}
