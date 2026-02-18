// components/settings/CallSettings.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import VoiceSelector from '@/components/voice/VoiceSelector';
import { SiTwilio } from 'react-icons/si';

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
  };
  onSettingsChange: (settings: any) => void;
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
  type: 'purchased' | 'twilio' | 'rotated';
  created_at?: string;
  last_used?: string;
  status: 'active' | 'inactive';
}

export default function CallSettings({ settings, onSettingsChange, onSubmit, loading, success, companyId, initialSection }: CallSettingsProps) {
  const supabase = createClient();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const phoneNumbersRef = useRef<HTMLDivElement>(null);

  // Phone Number Management State
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [showTwilioSetup, setShowTwilioSetup] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioEncryptedKey, setTwilioEncryptedKey] = useState('');
  const [twilioNumbers, setTwilioNumbers] = useState('');
  const [twilioConnecting, setTwilioConnecting] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [twilioError, setTwilioError] = useState('');
  const [purchaseAreaCode, setPurchaseAreaCode] = useState('');
  const [purchaseType, setPurchaseType] = useState<'inbound' | 'outbound'>('outbound');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState('');
  const [purchaseError, setPurchaseError] = useState('');

  useEffect(() => {
    loadPlanAndUsage();
  }, [companyId]);

  // Auto-scroll to phone numbers section if directed from integrations
  useEffect(() => {
    if (initialSection === 'phone-numbers' && phoneNumbersRef.current && !loadingData) {
      setTimeout(() => {
        phoneNumbersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [initialSection, loadingData]);

  // Initialize slider to plan's max_call_duration when plan loads
  useEffect(() => {
    if (plan && (!settings.default_max_duration || settings.default_max_duration > plan.max_call_duration)) {
      onSettingsChange({ ...settings, default_max_duration: plan.max_call_duration });
    }
  }, [plan]);

  // Load phone numbers
  useEffect(() => {
    if (companyId) {
      loadPhoneNumbers();
      loadTwilioConnection();
    }
  }, [companyId]);

  const loadPlanAndUsage = async () => {
    try {
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (
            name,
            slug,
            minutes_included,
            max_call_duration,
            price_per_extra_minute,
            max_concurrent_calls,
            max_calls_per_day,
            max_calls_per_hour
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      const planData = subscription?.subscription_plans as any;
      if (planData) {
        setPlan(planData);
      }

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('minutes_used, minutes_included, period_start, period_end')
        .eq('company_id', companyId)
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString())
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
        periodEnd: usage?.period_end || periodEnd.toISOString(),
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
      // Load from company_settings phone_numbers JSON field
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();

      const settingsData = companySettings?.settings as any;
      if (settingsData?.phone_numbers) {
        setPhoneNumbers(settingsData.phone_numbers);
      }

      // Rotated numbers are managed by Bland AI's pool. We extract them
      // from call metadata if the from_number was stored there by our webhook.
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
          const meta = call.metadata as any;
          const fromNumber = meta?.from_number || meta?.from;
          if (fromNumber && !uniqueNumbers.has(fromNumber)) {
            uniqueNumbers.set(fromNumber, call.created_at);
          }
        });

        if (uniqueNumbers.size > 0) {
          const rotatedNumbers: PhoneNumber[] = Array.from(uniqueNumbers.entries())
            .slice(0, 5)
            .map(([number, lastUsed]) => ({
              phone_number: number,
              type: 'rotated' as const,
              last_used: lastUsed,
              status: 'active' as const,
            }));

          setPhoneNumbers(prev => {
            const existingNumbers = new Set(prev.map(p => p.phone_number));
            const newRotated = rotatedNumbers.filter(r => !existingNumbers.has(r.phone_number));
            return [...prev, ...newRotated];
          });
        }
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error);
    } finally {
      setLoadingPhones(false);
    }
  };

  const loadTwilioConnection = async () => {
    try {
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();

      const settingsData = companySettings?.settings as any;
      if (settingsData?.twilio_encrypted_key) {
        setTwilioConnected(true);
        setTwilioEncryptedKey(settingsData.twilio_encrypted_key);
      }
    } catch (error) {
      console.error('Error loading Twilio connection:', error);
    }
  };

  const handleConnectTwilio = async () => {
    if (!twilioAccountSid || !twilioAuthToken) {
      setTwilioError('Please enter both Account SID and Auth Token');
      return;
    }

    setTwilioConnecting(true);
    setTwilioError('');

    try {
      // Step 1: Generate encrypted key via Bland AI
      const response = await fetch('/api/bland/twilio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_sid: twilioAccountSid,
          auth_token: twilioAuthToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Twilio account');
      }

      // Store encrypted key in company settings
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
          }
        })
        .eq('company_id', companyId);

      setTwilioConnected(true);
      setTwilioEncryptedKey(data.encrypted_key);
      setShowTwilioSetup(false);
      setTwilioAccountSid('');
      setTwilioAuthToken('');

      // If user provided Twilio numbers to import, do it
      if (twilioNumbers.trim()) {
        const numbers = twilioNumbers.split(',').map(n => n.trim()).filter(Boolean);
        if (numbers.length > 0) {
          await handleImportTwilioNumbers(numbers, data.encrypted_key);
        }
      }
    } catch (error: any) {
      setTwilioError(error.message || 'Failed to connect Twilio account');
    } finally {
      setTwilioConnecting(false);
    }
  };

  const handleImportTwilioNumbers = async (numbers: string[], encryptedKey: string) => {
    try {
      const response = await fetch('/api/bland/twilio/import-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          encrypted_key: encryptedKey,
        }),
      });

      const data = await response.json();
      if (response.ok && data.inserted) {
        const newNumbers: PhoneNumber[] = data.inserted.map((num: string) => ({
          phone_number: num,
          type: 'twilio' as const,
          created_at: new Date().toISOString(),
          status: 'active' as const,
        }));

        setPhoneNumbers(prev => [...newNumbers, ...prev]);

        // Save to company settings
        await savePhoneNumbers([...newNumbers, ...phoneNumbers]);
      }
    } catch (error) {
      console.error('Error importing Twilio numbers:', error);
    }
  };

  const handleDisconnectTwilio = async () => {
    try {
      // Remove encrypted key from Bland AI
      if (twilioEncryptedKey) {
        await fetch('/api/bland/twilio/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encrypted_key: twilioEncryptedKey }),
        });
      }

      // Remove from company settings
      const { data: currentSettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();

      const existingSettings = (currentSettings?.settings as any) || {};
      delete existingSettings.twilio_encrypted_key;
      delete existingSettings.twilio_connected_at;

      await supabase
        .from('company_settings')
        .update({ settings: existingSettings })
        .eq('company_id', companyId);

      setTwilioConnected(false);
      setTwilioEncryptedKey('');

      // Remove Twilio numbers from list
      const filtered = phoneNumbers.filter(p => p.type !== 'twilio');
      setPhoneNumbers(filtered);
      await savePhoneNumbers(filtered);
    } catch (error) {
      console.error('Error disconnecting Twilio:', error);
    }
  };

  const handlePurchaseNumber = async () => {
    if (!purchaseAreaCode || purchaseAreaCode.length !== 3) {
      setPurchaseError('Please enter a valid 3-digit area code');
      return;
    }

    setPurchasing(true);
    setPurchaseError('');
    setPurchaseSuccess('');

    try {
      const response = await fetch('/api/bland/phone-numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_code: purchaseAreaCode,
          type: purchaseType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase number');
      }

      const newNumber: PhoneNumber = {
        phone_number: data.phone_number,
        type: 'purchased',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      const updated = [newNumber, ...phoneNumbers];
      setPhoneNumbers(updated);
      await savePhoneNumbers(updated);

      setPurchaseSuccess(`Successfully purchased ${data.phone_number}`);
      setPurchaseAreaCode('');
    } catch (error: any) {
      setPurchaseError(error.message || 'Failed to purchase number');
    } finally {
      setPurchasing(false);
    }
  };

  const savePhoneNumbers = async (numbers: PhoneNumber[]) => {
    try {
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
            phone_numbers: numbers.filter(n => n.type !== 'rotated'),
          }
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
      const potentialCalls = calculateApproximateCalls(avgDuration);
      const currentPotentialCalls = calculateApproximateCalls(currentDuration);
      const difference = potentialCalls - currentPotentialCalls;

      return {
        type: 'optimize',
        message: `Your average call is ${avgDuration} min. Set max duration to ${avgDuration + 1} min to make ~${difference} more calls/month.`,
        suggestedDuration: avgDuration + 1,
      };
    }

    if (avgDuration > currentDuration) {
      return {
        type: 'warning',
        message: `Your calls average ${avgDuration} min but limit is ${currentDuration} min. Calls may be cut off.`,
        suggestedDuration: avgDuration,
      };
    }

    return null;
  };

  const getPlanLimitIndicator = () => {
    if (!plan) return null;

    const minDuration = 0.25;
    const maxDuration = plan.max_call_duration;
    const currentDuration = settings.default_max_duration;

    const percentage = ((currentDuration - minDuration) / (maxDuration - minDuration)) * 100;

    return { maxDuration, currentDuration, percentage };
  };

  const isFreePlan = plan?.slug === 'free';
  const canAccessPhoneNumbers = !isFreePlan; // Starter and above
  const canConnectTwilio = !isFreePlan; // Starter and above
  const canPurchaseNumbers = !isFreePlan; // Starter and above

  const suggestion = getOptimizationSuggestion();
  const limitIndicator = getPlanLimitIndicator();
  const approximateCalls = calculateApproximateCalls(settings.default_max_duration);

  const purchasedNumbers = phoneNumbers.filter(p => p.type === 'purchased');
  const twilioImportedNumbers = phoneNumbers.filter(p => p.type === 'twilio');
  const rotatedNumbers = phoneNumbers.filter(p => p.type === 'rotated');

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
                <div className="text-2xl font-bold text-[var(--color-primary)]">
                  {usageStats.minutesUsed}/{usageStats.minutesIncluded}
                </div>
                <div className="text-xs text-slate-600 font-medium">minutes used</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium mb-1">Max Duration</div>
              <div className="text-lg font-bold text-slate-900">{plan.max_call_duration} min</div>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium mb-1">Concurrent Calls</div>
              <div className="text-lg font-bold text-slate-900">{plan.max_concurrent_calls}</div>
            </div>
            {plan.max_calls_per_day && (
              <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-600 font-medium mb-1">Max Calls/Day</div>
                <div className="text-lg font-bold text-slate-900">{plan.max_calls_per_day}</div>
              </div>
            )}
            {usageStats && usageStats.averageCallDuration && (
              <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-emerald-100">
                <div className="text-xs text-slate-600 font-medium mb-1">Avg Call Duration</div>
                <div className="text-lg font-bold text-emerald-600">{usageStats.averageCallDuration} min</div>
              </div>
            )}
          </div>

          {usageStats && usageStats.totalCalls > 0 && (
            <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium mb-2">Monthly Usage</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-200 rounded-full h-2.5">
                  <div
                    className="gradient-bg h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((usageStats.minutesUsed / usageStats.minutesIncluded) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-sm font-bold text-slate-700">
                  {Math.round((usageStats.minutesUsed / usageStats.minutesIncluded) * 100)}%
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">{usageStats.totalCalls} calls this month</div>
            </div>
          )}
        </div>
      )}

      {/* Optimization Suggestion */}
      {suggestion && (
        <div className={`rounded-xl p-4 border ${
          suggestion.type === 'optimize'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {suggestion.type === 'optimize' ? (
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h4 className={`text-sm font-bold mb-1 ${
                suggestion.type === 'optimize' ? 'text-emerald-900' : 'text-amber-900'
              }`}>
                {suggestion.type === 'optimize' ? 'Optimization Opportunity' : 'Configuration Warning'}
              </h4>
              <p className={`text-sm ${
                suggestion.type === 'optimize' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {suggestion.message}
              </p>
              {suggestion.type === 'optimize' && (
                <button
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, default_max_duration: suggestion.suggestedDuration })}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
                >
                  Apply suggestion →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PHONE NUMBER MANAGEMENT
          ═══════════════════════════════════════════════════ */}
      <div ref={phoneNumbersRef} className="scroll-mt-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Phone Numbers</h4>
                  <p className="text-xs text-slate-500">Manage your calling numbers, connect Twilio, or purchase new numbers</p>
                </div>
              </div>
              {!isFreePlan && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseModal(true)}
                    disabled={!canPurchaseNumbers}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg gradient-bg text-white hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    Buy Number
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTwilioSetup(true)}
                    disabled={!canConnectTwilio || twilioConnected}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <SiTwilio className="w-3.5 h-3.5 text-[#F22F46]" />
                    {twilioConnected ? 'Twilio Connected' : 'Connect Twilio'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {isFreePlan ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Phone Numbers Available on Paid Plans</h4>
              <p className="text-sm text-slate-600 mb-1">
                Upgrade to Starter or above to access phone number management.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Purchase dedicated numbers, connect your Twilio account, or use auto-rotated numbers for spam protection.
              </p>
              <div className="inline-flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Auto-rotated numbers
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Buy dedicated numbers
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Twilio BYOP
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Auto-Rotated Numbers Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Auto-Rotating Numbers (Active)</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Callengo automatically rotates outbound numbers from our pool to protect against spam flags and maximize pickup rates. This is enabled by default on all plans.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recently Used Rotated Numbers */}
              {rotatedNumbers.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recently Used Numbers
                  </h5>
                  <div className="space-y-2">
                    {rotatedNumbers.map((num) => (
                      <div key={num.phone_number} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-200/50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-sm font-mono font-medium text-slate-900">{num.phone_number}</span>
                            <span className="text-xs text-slate-400 ml-2">Rotated</span>
                          </div>
                        </div>
                        {num.last_used && (
                          <span className="text-xs text-slate-500">
                            Last used {new Date(num.last_used).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchased Numbers */}
              {purchasedNumbers.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Purchased Numbers
                    <span className="text-xs text-slate-400 font-normal">($15/mo each)</span>
                  </h5>
                  <div className="space-y-2">
                    {purchasedNumbers.map((num) => (
                      <div key={num.phone_number} className="flex items-center justify-between bg-emerald-50/50 rounded-lg px-4 py-2.5 border border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-sm font-mono font-medium text-slate-900">{num.phone_number}</span>
                            <span className="text-xs text-emerald-600 ml-2 font-medium">Dedicated</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          num.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {num.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Twilio Numbers */}
              {twilioConnected && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <SiTwilio className="w-4 h-4 text-[#F22F46]" />
                      Twilio Numbers (BYOP)
                    </h5>
                    <button
                      type="button"
                      onClick={handleDisconnectTwilio}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Disconnect Twilio
                    </button>
                  </div>
                  {twilioImportedNumbers.length > 0 ? (
                    <div className="space-y-2">
                      {twilioImportedNumbers.map((num) => (
                        <div key={num.phone_number} className="flex items-center justify-between bg-red-50/30 rounded-lg px-4 py-2.5 border border-red-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                              <SiTwilio className="w-4 h-4 text-[#F22F46]" />
                            </div>
                            <div>
                              <span className="text-sm font-mono font-medium text-slate-900">{num.phone_number}</span>
                              <span className="text-xs text-[#F22F46] ml-2 font-medium">Twilio BYOP</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-slate-600">Twilio connected. Import your numbers above to start using them.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state when no numbers at all */}
              {purchasedNumbers.length === 0 && twilioImportedNumbers.length === 0 && rotatedNumbers.length === 0 && !loadingPhones && (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500">No phone numbers configured yet. Your calls use auto-rotated numbers by default.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TWILIO SETUP MODAL
          ═══════════════════════════════════════════════════ */}
      {showTwilioSetup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <SiTwilio className="w-6 h-6 text-[#F22F46]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Connect Twilio Account</h3>
                <p className="text-sm text-slate-500">Bring your own phone numbers (BYOP)</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex gap-2">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-900">
                  <p className="font-semibold mb-1">How it works</p>
                  <p className="text-blue-700">
                    Your Twilio credentials are encrypted and stored securely. Once connected, you can import your Twilio phone numbers for both outbound and inbound calls. Transfer time on BYOP numbers is free.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Twilio Account SID
                </label>
                <input
                  type="text"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Twilio Auth Token
                </label>
                <input
                  type="password"
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Phone Numbers to Import <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={twilioNumbers}
                  onChange={(e) => setTwilioNumbers(e.target.value)}
                  placeholder="+12223334444, +13334445555"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">Comma-separated E.164 format. You can also import later.</p>
              </div>
            </div>

            {twilioError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-800 font-medium">{twilioError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowTwilioSetup(false); setTwilioError(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectTwilio}
                disabled={twilioConnecting || !twilioAccountSid || !twilioAuthToken}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {twilioConnecting ? (
                  <>
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    Connecting...
                  </>
                ) : (
                  'Connect & Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PURCHASE NUMBER MODAL
          ═══════════════════════════════════════════════════ */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-bg-subtle flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Purchase Phone Number</h3>
                <p className="text-sm text-slate-500">$15/month per dedicated number</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Area Code
                </label>
                <input
                  type="text"
                  value={purchaseAreaCode}
                  onChange={(e) => setPurchaseAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="415"
                  maxLength={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all font-mono text-lg text-center tracking-wider"
                />
                <p className="text-xs text-slate-500 mt-1 text-center">Enter a 3-digit US area code</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Number Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPurchaseType('outbound')}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      purchaseType === 'outbound'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold mb-1">Outbound</div>
                    <div className="text-xs text-slate-500">For making calls</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseType('inbound')}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      purchaseType === 'inbound'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold mb-1">Inbound</div>
                    <div className="text-xs text-slate-500">For receiving calls</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-800">
                  <strong>Pricing:</strong> $15/month per number, billed to your Callengo account. Number is available in US and Canada regions.
                </p>
              </div>
            </div>

            {purchaseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-800 font-medium">{purchaseError}</p>
              </div>
            )}

            {purchaseSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-emerald-800 font-medium">{purchaseSuccess}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowPurchaseModal(false); setPurchaseError(''); setPurchaseSuccess(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurchaseNumber}
                disabled={purchasing || purchaseAreaCode.length !== 3}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {purchasing ? (
                  <>
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    Purchasing...
                  </>
                ) : (
                  'Purchase Number — $15/mo'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Call Duration Optimizer */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Call Duration Settings
          </h4>

          <div>
            <div className="flex items-end justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700">
                Maximum Call Duration
              </label>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--color-primary)]">
                  {settings.default_max_duration % 1 === 0
                    ? `${settings.default_max_duration} min`
                    : `${Math.floor(settings.default_max_duration)} min ${Math.round((settings.default_max_duration % 1) * 60)} sec`
                  }
                </div>
                <div className="text-xs text-slate-500">
                  ~{approximateCalls} calls/month
                </div>
              </div>
            </div>

            <input
              type="range"
              min="0.25"
              max={plan?.max_call_duration || 15}
              step="0.25"
              value={settings.default_max_duration}
              onChange={(e) => onSettingsChange({ ...settings, default_max_duration: parseFloat(e.target.value) })}
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              style={{
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${limitIndicator?.percentage}%, rgb(226 232 240) ${limitIndicator?.percentage}%, rgb(226 232 240) 100%)`
              }}
            />

            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-500">15 sec</span>
              {plan && (
                <span className="text-xs font-bold text-[var(--color-primary)]">
                  Limit: {plan.max_call_duration} min
                </span>
              )}
            </div>

            {settings.default_max_duration < 2 && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-red-800 font-medium">
                    <strong>Warning:</strong> Calls shorter than 2 minutes may not achieve their objectives. Consider setting a longer duration for better results.
                  </p>
                </div>
              </div>
            )}

            {plan && settings.default_max_duration >= plan.max_call_duration && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  You've reached your plan's maximum call duration limit.
                </p>
              </div>
            )}
          </div>

          <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-900">
                <p className="font-semibold mb-1">Duration Optimizer</p>
                <p className="text-slate-700">
                  Lower duration = more calls per month. Adjust based on your average call needs.
                  {plan && ` With ${plan.minutes_included} minutes included, you can make approximately ${approximateCalls} calls at ${settings.default_max_duration} min each.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Voice & Language */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice & Language
          </h4>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Default Voice
            </label>
            <VoiceSelector
              selectedVoiceId={settings.default_voice}
              onVoiceSelect={(voiceId) => onSettingsChange({ ...settings, default_voice: voiceId })}
            />
          </div>
        </div>

        {/* Call Timing */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Call Scheduling
          </h4>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Interval Between Calls (min)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.default_interval_minutes}
                onChange={(e) => onSettingsChange({ ...settings, default_interval_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Max Calls Per Day
                {plan && plan.max_calls_per_day && (
                  <span className="ml-2 text-xs text-[var(--color-primary)]">(Plan limit: {plan.max_calls_per_day})</span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max={plan?.max_calls_per_day || 1000}
                value={settings.max_calls_per_day}
                onChange={(e) => onSettingsChange({ ...settings, max_calls_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300"
              />
              {plan && plan.max_calls_per_day && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-xs text-blue-800">
                    <svg className="w-3.5 h-3.5 inline mr-1 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <strong>Overage:</strong> When daily limit is reached, additional calls will be queued for the next day. Standard per-minute rates apply to all calls.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Working Hours & Timezone */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Working Hours & Schedule
          </h4>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
              <input
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => onSettingsChange({ ...settings, working_hours_start: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">End Time</label>
              <input
                type="time"
                value={settings.working_hours_end}
                onChange={(e) => onSettingsChange({ ...settings, working_hours_end: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => onSettingsChange({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white outline-none transition-all cursor-pointer hover:border-slate-300"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (MST)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HST)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Australia/Sydney">Sydney (AEDT)</option>
              </select>
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Working Days</label>
            <div className="grid grid-cols-7 gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const dayLower = day.toLowerCase();
                const isSelected = settings.working_days?.includes(dayLower) ?? true;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const currentDays = settings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                      const newDays = isSelected
                        ? currentDays.filter(d => d !== dayLower)
                        : [...currentDays, dayLower];
                      onSettingsChange({ ...settings, working_days: newDays });
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? 'gradient-bg text-white border-[var(--color-primary)] hover:opacity-90'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">Select which days of the week calls should be placed</p>
          </div>

          {/* Holiday Filter */}
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <input
              type="checkbox"
              id="exclude-holidays"
              checked={settings.exclude_holidays ?? false}
              onChange={(e) => onSettingsChange({ ...settings, exclude_holidays: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer"
            />
            <div className="flex-1">
              <label htmlFor="exclude-holidays" className="text-sm font-bold text-slate-700 cursor-pointer block mb-1">
                Exclude US Federal Holidays
              </label>
              <p className="text-xs text-slate-600">
                Automatically skip calls on major US federal holidays (New Year's Day, Independence Day, Thanksgiving, Christmas, etc.)
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Schedule Settings</p>
                <p className="text-blue-700">Calls will only be placed during selected hours, on selected days, and respecting holiday exclusions. This ensures appropriate contact timing.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Phone */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Test Configuration
          </h4>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Test Phone Number</label>
            <input
              type="tel"
              value={settings.test_phone_number}
              onChange={(e) => onSettingsChange({ ...settings, test_phone_number: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all hover:border-slate-300"
            />
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Use this number for testing agent configurations before launching campaigns
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-4 gradient-bg text-white rounded-xl font-semibold text-base hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            'Save Call Settings'
          )}
        </button>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-emerald-800">{success}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
