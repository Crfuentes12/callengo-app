// components/settings/CallSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import VoiceSelector from '@/components/voice/VoiceSelector';

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
    working_days?: string[]; // ['monday', 'tuesday', etc.]
    exclude_holidays?: boolean;
  };
  onSettingsChange: (settings: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  success: string;
  companyId: string;
}

interface SubscriptionPlan {
  name: string;
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

export default function CallSettings({ settings, onSettingsChange, onSubmit, loading, success, companyId }: CallSettingsProps) {
  const supabase = createClient();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadPlanAndUsage();
  }, [companyId]);

  // Initialize slider to plan's max_call_duration when plan loads
  useEffect(() => {
    if (plan && (!settings.default_max_duration || settings.default_max_duration > plan.max_call_duration)) {
      onSettingsChange({ ...settings, default_max_duration: plan.max_call_duration });
    }
  }, [plan]);

  const loadPlanAndUsage = async () => {
    try {
      // Get current subscription
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (
            name,
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

      // Get current period usage
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

      // Get call statistics
      const { data: calls } = await supabase
        .from('call_logs')
        .select('call_length')
        .eq('company_id', companyId)
        .gte('created_at', periodStart.toISOString())
        .not('call_length', 'is', null);

      let avgDuration = null;
      if (calls && calls.length > 0) {
        const totalSeconds = calls.reduce((sum, call) => sum + (call.call_length || 0), 0);
        avgDuration = Math.round(totalSeconds / calls.length / 60); // Convert to minutes
      }

      // Always use plan's minutes_included, not usage_tracking's value
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

  const calculateApproximateCalls = (duration: number) => {
    if (!plan) return 0;
    // Handle decimal minutes (e.g., 2.25, 2.5, 2.75)
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

    const minDuration = 0.25; // Minimum value of the slider
    const maxDuration = plan.max_call_duration;
    const currentDuration = settings.default_max_duration;

    // Calculate percentage considering the actual range (0.25 to max)
    const percentage = ((currentDuration - minDuration) / (maxDuration - minDuration)) * 100;

    return { maxDuration, currentDuration, percentage };
  };

  const suggestion = getOptimizationSuggestion();
  const limitIndicator = getPlanLimitIndicator();
  const approximateCalls = calculateApproximateCalls(settings.default_max_duration);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      {plan && (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-6 border-2 border-indigo-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                {plan.name} Plan
              </h3>
              <p className="text-sm text-slate-600 mt-1">Your current subscription limits and usage</p>
            </div>
            {usageStats && (
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600">
                  {usageStats.minutesUsed}/{usageStats.minutesIncluded}
                </div>
                <div className="text-xs text-slate-600 font-medium">minutes used</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-indigo-100">
              <div className="text-xs text-slate-600 font-medium mb-1">Max Duration</div>
              <div className="text-lg font-black text-slate-900">{plan.max_call_duration} min</div>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-indigo-100">
              <div className="text-xs text-slate-600 font-medium mb-1">Concurrent Calls</div>
              <div className="text-lg font-black text-slate-900">{plan.max_concurrent_calls}</div>
            </div>
            {plan.max_calls_per_day && (
              <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-indigo-100">
                <div className="text-xs text-slate-600 font-medium mb-1">Max Calls/Day</div>
                <div className="text-lg font-black text-slate-900">{plan.max_calls_per_day}</div>
              </div>
            )}
            {usageStats && usageStats.averageCallDuration && (
              <div className="bg-white/80 backdrop-blur rounded-lg p-3 border border-emerald-100">
                <div className="text-xs text-slate-600 font-medium mb-1">Avg Call Duration</div>
                <div className="text-lg font-black text-emerald-600">{usageStats.averageCallDuration} min</div>
              </div>
            )}
          </div>

          {usageStats && usageStats.totalCalls > 0 && (
            <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-3 border border-indigo-100">
              <div className="text-xs text-slate-600 font-medium mb-2">Monthly Usage</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-200 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
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
        <div className={`rounded-xl p-4 border-2 ${
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

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Call Duration Optimizer */}
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <div className="text-2xl font-black text-indigo-600">
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
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              style={{
                background: `linear-gradient(to right, rgb(79 70 229) 0%, rgb(79 70 229) ${limitIndicator?.percentage}%, rgb(226 232 240) ${limitIndicator?.percentage}%, rgb(226 232 240) 100%)`
              }}
            />

            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-500">15 sec</span>
              {plan && (
                <span className="text-xs font-bold text-indigo-600">
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
                  ⚠️ You've reached your plan's maximum call duration limit.
                </p>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-indigo-900">
                <p className="font-semibold mb-1">Duration Optimizer</p>
                <p className="text-indigo-700">
                  Lower duration = more calls per month. Adjust based on your average call needs.
                  {plan && ` With ${plan.minutes_included} minutes included, you can make approximately ${approximateCalls} calls at ${settings.default_max_duration} min each.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Voice & Language */}
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Max Calls Per Day
                {plan && plan.max_calls_per_day && (
                  <span className="ml-2 text-xs text-indigo-600">(Plan limit: {plan.max_calls_per_day})</span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max={plan?.max_calls_per_day || 1000}
                value={settings.max_calls_per_day}
                onChange={(e) => onSettingsChange({ ...settings, max_calls_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
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
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Working Hours & Schedule
          </h4>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => onSettingsChange({ ...settings, working_hours_start: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={settings.working_hours_end}
                onChange={(e) => onSettingsChange({ ...settings, working_hours_end: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => onSettingsChange({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all cursor-pointer hover:border-slate-300"
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
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Working Days
            </label>
            <div className="grid grid-cols-7 gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const dayLower = day.toLowerCase();
                const isSelected = settings.working_days?.includes(dayLower) ?? true; // Default to all days selected
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
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
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
              className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
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
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-4">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Test Configuration
          </h4>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Test Phone Number
            </label>
            <input
              type="tel"
              value={settings.test_phone_number}
              onChange={(e) => onSettingsChange({ ...settings, test_phone_number: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
            />
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Use this number for testing agent configurations before launching campaigns
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-base hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
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
