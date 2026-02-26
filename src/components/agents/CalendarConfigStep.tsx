// components/agents/CalendarConfigStep.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BiLogoZoom } from 'react-icons/bi';
import { GoogleCalendarIcon, OutlookIcon, GoogleMeetIcon, TeamsIcon, SlackIcon } from '@/components/icons/BrandIcons';
import type { CalendarStepConfig } from '@/types/calendar';

// Re-export for consumers
export type { CalendarStepConfig } from '@/types/calendar';

// ============================================================================
// TYPES
// ============================================================================

interface IntegrationStatuses {
  google_calendar: { connected: boolean; email?: string };
  microsoft_outlook: { connected: boolean; email?: string };
  zoom: { connected: boolean; email?: string };
  slack: { connected: boolean; team_name?: string; channel_name?: string };
}

interface SlackChannel {
  id: string;
  name: string;
}

interface CalendarConfigStepProps {
  companyId: string;
  agentType: 'appointment_confirmation' | 'lead_qualification' | 'data_validation' | 'unknown';
  config: CalendarStepConfig;
  onConfigChange: (config: CalendarStepConfig) => void;
  gradientColor: string;
  planSlug?: string;
  companySettings?: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'America/Bogota', label: 'Bogota (COT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const ALL_DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

// ============================================================================
// US HOLIDAYS
// ============================================================================

function getUSHolidaysForYear(year: number): { date: string; name: string }[] {
  const fmt = (m: number, d: number) =>
    `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const nthWeekday = (month: number, weekday: number, n: number): number => {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getMonth() !== month - 1) break;
      if (dt.getDay() === weekday) {
        count++;
        if (count === n) return d;
      }
    }
    return 1;
  };

  const lastWeekday = (month: number, weekday: number): number => {
    let last = 1;
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getMonth() !== month - 1) break;
      if (dt.getDay() === weekday) last = d;
    }
    return last;
  };

  return [
    { date: fmt(1, 1), name: "New Year's Day" },
    { date: fmt(1, nthWeekday(1, 1, 3)), name: 'MLK Day' },
    { date: fmt(2, nthWeekday(2, 1, 3)), name: "Presidents' Day" },
    { date: fmt(5, lastWeekday(5, 1)), name: 'Memorial Day' },
    { date: fmt(6, 19), name: 'Juneteenth' },
    { date: fmt(7, 4), name: 'Independence Day' },
    { date: fmt(9, nthWeekday(9, 1, 1)), name: 'Labor Day' },
    { date: fmt(10, nthWeekday(10, 1, 2)), name: 'Columbus Day' },
    { date: fmt(11, 11), name: 'Veterans Day' },
    { date: fmt(11, nthWeekday(11, 4, 4)), name: 'Thanksgiving' },
    { date: fmt(12, 25), name: 'Christmas' },
  ];
}

// ============================================================================
// MINI CALENDAR PREVIEW
// ============================================================================

function MiniCalendarPreview({
  workingDays,
  workingHoursStart,
  workingHoursEnd,
  excludeHolidays,
  timezone,
}: {
  workingDays: string[];
  workingHoursStart: string;
  workingHoursEnd: string;
  excludeHolidays: boolean;
  timezone: string;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const holidays = useMemo(() => {
    if (!excludeHolidays) return new Set<string>();
    const h = getUSHolidaysForYear(year);
    return new Set(h.map(hol => hol.date));
  }, [year, excludeHolidays]);

  const holidayNames = useMemo(() => {
    if (!excludeHolidays) return new Map<string, string>();
    const h = getUSHolidaysForYear(year);
    const map = new Map<string, string>();
    h.forEach(hol => map.set(hol.date, hol.name));
    return map;
  }, [year, excludeHolidays]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const cells: { day: number | null; isWorking: boolean; isHoliday: boolean; isToday: boolean; holidayName?: string }[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, isWorking: false, isHoliday: false, isToday: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = (date.getDay() + 6) % 7;
    const dayKey = dayNames[dayOfWeek];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHoliday = holidays.has(dateStr);
    const isWorking = workingDays.includes(dayKey) && !isHoliday;
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    cells.push({
      day: d,
      isWorking,
      isHoliday,
      isToday,
      holidayName: holidayNames.get(dateStr),
    });
  }

  const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">{monthName}</h4>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]"></div>
            Working
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            Holiday
          </span>
        </div>
      </div>

      <div className="px-4 py-2 bg-[var(--color-primary)]/5 border-b border-[var(--color-primary)]/10">
        <p className="text-xs text-[var(--color-primary)] font-medium">
          {workingHoursStart} - {workingHoursEnd} ({TIMEZONE_OPTIONS.find(t => t.value === timezone)?.label || timezone})
        </p>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {dayHeaders.map(h => (
            <div key={h} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
              {h}
            </div>
          ))}

          {cells.map((cell, i) => (
            <div
              key={i}
              className={`relative text-center py-1.5 rounded-md text-xs transition-all ${
                !cell.day
                  ? ''
                  : cell.isToday
                  ? 'bg-[var(--color-primary)] text-white font-bold ring-2 ring-[var(--color-primary)]/30'
                  : cell.isHoliday
                  ? 'bg-red-50 text-red-400 border border-red-100'
                  : cell.isWorking
                  ? 'bg-[var(--color-primary)]/5 text-slate-700 font-medium'
                  : 'text-slate-300'
              }`}
              title={cell.holidayName || ''}
            >
              {cell.day || ''}
              {cell.isHoliday && cell.day && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-400"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOGGLE SWITCH
// ============================================================================

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  color = 'var(--color-primary)',
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        className="sr-only peer"
        disabled={disabled}
      />
      <div
        className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"
        style={{ backgroundColor: checked ? color : undefined }}
      ></div>
    </label>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarConfigStep({
  companyId,
  agentType,
  config,
  onConfigChange,
  gradientColor,
  planSlug: propPlanSlug = 'free',
  companySettings,
}: CalendarConfigStepProps) {
  const [integrations, setIntegrations] = useState<IntegrationStatuses>({
    google_calendar: { connected: false },
    microsoft_outlook: { connected: false },
    zoom: { connected: false },
    slack: { connected: false },
  });
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [loadingSlackChannels, setLoadingSlackChannels] = useState(false);
  const [savingToSettings, setSavingToSettings] = useState(false);

  // Self-fetch plan slug from subscription API for reliability
  const [fetchedPlanSlug, setFetchedPlanSlug] = useState<string | null>(null);
  const planSlug = fetchedPlanSlug || propPlanSlug;

  const isPremium = ['business', 'teams', 'enterprise'].includes(planSlug);
  const isStarter = ['starter', 'business', 'teams', 'enterprise'].includes(planSlug);

  const isAppointment = agentType === 'appointment_confirmation';
  const isLeadQual = agentType === 'lead_qualification';

  // Fetch plan slug from subscription API
  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch('/api/billing/subscription');
        if (res.ok) {
          const data = await res.json();
          const slug = data?.subscription?.plan?.slug;
          if (slug) setFetchedPlanSlug(slug);
        }
      } catch {
        // Fallback to prop-based plan slug
      }
    };
    fetchPlan();
  }, []);

  // Fetch integration statuses
  useEffect(() => {
    fetchIntegrationStatus();
  }, [companyId]);

  const fetchIntegrationStatus = async () => {
    setLoadingIntegrations(true);
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        const slackData = data.all?.slack || { connected: false };
        setIntegrations({
          google_calendar: data.all?.google_calendar || { connected: false },
          microsoft_outlook: data.all?.microsoft_outlook || { connected: false },
          zoom: data.all?.zoom || { connected: false },
          slack: slackData,
        });

        const connected: string[] = [];
        if (data.all?.google_calendar?.connected) connected.push('google_calendar');
        if (data.all?.microsoft_outlook?.connected) connected.push('microsoft_outlook');
        if (data.all?.zoom?.connected) connected.push('zoom');
        if (slackData.connected) connected.push('slack');
        onConfigChange({ ...config, connectedIntegrations: connected });

        // Fetch Slack channels if connected
        if (slackData.connected) {
          fetchSlackChannels();
        }
      }
    } catch (err) {
      console.error('Error fetching integration status:', err);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const fetchSlackChannels = async () => {
    setLoadingSlackChannels(true);
    try {
      const res = await fetch('/api/integrations/slack/channels');
      if (res.ok) {
        const data = await res.json();
        setSlackChannels(data.channels || []);
      }
    } catch {
      // Slack channels fetch failed silently
    } finally {
      setLoadingSlackChannels(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider);
    try {
      let endpoint = '';
      switch (provider) {
        case 'google_calendar':
          endpoint = '/api/integrations/google-calendar/connect';
          break;
        case 'microsoft_outlook':
          endpoint = '/api/integrations/microsoft-outlook/connect';
          break;
        case 'zoom':
          endpoint = '/api/integrations/zoom/connect';
          break;
      }

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          const popup = window.open(data.url, `connect_${provider}`, 'width=600,height=700,scrollbars=yes');

          const checkClosed = setInterval(() => {
            if (!popup || popup.closed) {
              clearInterval(checkClosed);
              setConnectingProvider(null);
              fetchIntegrationStatus();
            }
          }, 1000);
        }
      }
    } catch (err) {
      console.error(`Error connecting ${provider}:`, err);
      setConnectingProvider(null);
    }
  };

  const update = useCallback((partial: Partial<CalendarStepConfig>) => {
    onConfigChange({ ...config, ...partial });
  }, [config, onConfigChange]);

  const toggleWorkingDay = (day: string) => {
    const newDays = config.workingDays.includes(day)
      ? config.workingDays.filter(d => d !== day)
      : [...config.workingDays, day];
    update({ workingDays: newDays });
  };

  // Agent-specific description (short)
  const getAgentCapability = () => {
    if (isAppointment) return 'confirm appointments, reschedule when needed, and suggest available times from your calendar.';
    if (isLeadQual) return 'schedule meetings with qualified leads and send calendar invites with video links.';
    return 'schedule callbacks at convenient times and manage follow-up calls.';
  };

  // Sync voicemail/follow-up settings to company settings
  const syncSettingsToCompany = useCallback(async (partial: Partial<CalendarStepConfig>) => {
    setSavingToSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            voicemail_enabled: partial.voicemailEnabled ?? config.voicemailEnabled,
            follow_up_enabled: partial.followUpEnabled ?? config.followUpEnabled,
            follow_up_max_attempts: partial.followUpMaxAttempts ?? config.followUpMaxAttempts,
            follow_up_interval_hours: partial.followUpIntervalHours ?? config.followUpIntervalHours,
            smart_follow_up: partial.smartFollowUp ?? config.smartFollowUp,
          },
        }),
      });
      if (!res.ok) console.error('Failed to sync settings');
    } catch {
      // Silently fail - settings sync is best-effort
    } finally {
      setSavingToSettings(false);
    }
  }, [config]);

  return (
    <div className="space-y-5">
      {/* Calendar Context Info - compact */}
      <div className="bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-accent)]/5 rounded-xl px-4 py-3 border border-[var(--color-primary)]/15">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800">Calendar context is always on.</span>{' '}
            Your agent can {getAgentCapability()}
          </p>
        </div>
      </div>

      {/* Integrations - compact inline */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold text-slate-900 uppercase">Integrations</h3>
        </div>
        {loadingIntegrations ? (
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 flex-1 bg-slate-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Google Calendar */}
            {integrations.google_calendar.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <GoogleCalendarIcon className="w-4 h-4" />
                <span className="text-[11px] font-semibold text-emerald-700">Google</span>
              </span>
            ) : (
              <button onClick={() => handleConnect('google_calendar')} disabled={!!connectingProvider} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all disabled:opacity-50">
                <GoogleCalendarIcon className="w-4 h-4 opacity-50" />
                <span className="text-[11px] font-semibold text-slate-400">{connectingProvider === 'google_calendar' ? '...' : 'Google'}</span>
              </button>
            )}

            {/* Microsoft Outlook */}
            {integrations.microsoft_outlook.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <OutlookIcon className="w-4 h-4" />
                <span className="text-[11px] font-semibold text-emerald-700">Outlook</span>
              </span>
            ) : isPremium ? (
              <button onClick={() => handleConnect('microsoft_outlook')} disabled={!!connectingProvider} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all disabled:opacity-50">
                <OutlookIcon className="w-4 h-4 opacity-50" />
                <span className="text-[11px] font-semibold text-slate-400">{connectingProvider === 'microsoft_outlook' ? '...' : 'Outlook'}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg opacity-50">
                <OutlookIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold text-slate-400">Business+</span>
              </span>
            )}

            {/* Zoom */}
            {(isLeadQual || isAppointment) && (
              integrations.zoom.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <BiLogoZoom className="w-4 h-4 text-[#2D8CFF]" />
                  <span className="text-[11px] font-semibold text-emerald-700">Zoom</span>
                </span>
              ) : (
                <button onClick={() => handleConnect('zoom')} disabled={!!connectingProvider} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all disabled:opacity-50">
                  <BiLogoZoom className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-400">{connectingProvider === 'zoom' ? '...' : 'Zoom'}</span>
                </button>
              )
            )}

            {/* Slack indicator */}
            {integrations.slack.connected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <SlackIcon className="w-4 h-4" />
                <span className="text-[11px] font-semibold text-emerald-700">Slack</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Two column: Calendar Preview + Schedule */}
      <div className="grid md:grid-cols-2 gap-4">
        <MiniCalendarPreview
          workingDays={config.workingDays}
          workingHoursStart={config.workingHoursStart}
          workingHoursEnd={config.workingHoursEnd}
          excludeHolidays={config.excludeUSHolidays}
          timezone={config.timezone}
        />

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase">Work Schedule</h3>

          {/* Timezone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Timezone</label>
            <select
              value={config.timezone}
              onChange={e => update({ timezone: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Working Hours */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Start</label>
              <input
                type="time"
                value={config.workingHoursStart}
                onChange={e => update({ workingHoursStart: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">End</label>
              <input
                type="time"
                value={config.workingHoursEnd}
                onChange={e => update({ workingHoursEnd: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Working Days</label>
            <div className="flex gap-1">
              {ALL_DAYS.map(day => (
                <button
                  key={day.key}
                  onClick={() => toggleWorkingDay(day.key)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    config.workingDays.includes(day.key)
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* US Holidays */}
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
            <p className="text-xs font-medium text-slate-700">Skip US Holidays</p>
            <ToggleSwitch
              checked={config.excludeUSHolidays}
              onChange={val => update({ excludeUSHolidays: val })}
            />
          </div>
        </div>
      </div>

      {/* Voicemail & Follow-ups */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Voicemail & Follow-ups
          </h3>
          {savingToSettings && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              Syncing...
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Voicemail toggle */}
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Voicemail detection</p>
              <p className="text-[11px] text-slate-400">Leave a message when voicemail is detected</p>
            </div>
            <ToggleSwitch
              checked={config.voicemailEnabled}
              onChange={val => {
                update({ voicemailEnabled: val });
                syncSettingsToCompany({ voicemailEnabled: val });
              }}
            />
          </div>

          {/* Follow-ups toggle */}
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Automatic follow-ups</p>
              <p className="text-[11px] text-slate-400">Retry contacts who didn&apos;t answer</p>
            </div>
            <ToggleSwitch
              checked={config.followUpEnabled}
              onChange={val => {
                update({ followUpEnabled: val });
                syncSettingsToCompany({ followUpEnabled: val });
              }}
            />
          </div>

          {config.followUpEnabled && (
            <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-[var(--color-primary)]/20">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Max Attempts</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.followUpMaxAttempts}
                  onChange={e => update({ followUpMaxAttempts: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Interval (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={config.followUpIntervalHours}
                  onChange={e => update({ followUpIntervalHours: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>

              {/* Smart Follow-up - Business+ only */}
              <div className="col-span-2 bg-white rounded-lg px-3 py-2.5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      Smart scheduling
                      {!isPremium && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">BUSINESS</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isPremium
                        ? 'When a contact asks to be called at a specific time, the agent schedules it automatically.'
                        : 'Upgrade to Business to auto-schedule calls when contacts request a specific time.'}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={config.smartFollowUp}
                    onChange={val => update({ smartFollowUp: val })}
                    disabled={!isPremium}
                  />
                </div>
                {!isPremium && isStarter && (
                  <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">
                    Without smart scheduling, call preferences are recorded but retries follow the default interval above.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video meeting preference - only for agents that schedule meetings */}
      {(isLeadQual || isAppointment) && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase mb-1 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video Meeting Preference
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            {isLeadQual
              ? 'When scheduling meetings, the agent sends an invite with your preferred platform.'
              : 'When rescheduling to a video call, the agent uses your preferred platform.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'none', label: 'No Video', desc: 'In-person or phone', icon: null },
              { key: 'google_meet', label: 'Google Meet', desc: integrations.google_calendar.connected ? 'Ready' : 'Connect Google first', icon: <GoogleMeetIcon className="w-4 h-4" /> },
              { key: 'zoom', label: 'Zoom', desc: integrations.zoom.connected ? 'Ready' : 'Connect Zoom first', icon: <BiLogoZoom className="w-5 h-5 text-[#2D8CFF]" /> },
              { key: 'microsoft_teams', label: 'Microsoft Teams', desc: isPremium ? (integrations.microsoft_outlook.connected ? 'Ready' : 'Connect Outlook first') : 'Business plan', icon: <TeamsIcon className="w-4 h-4" /> },
            ].map(opt => {
              const isDisabled =
                (opt.key === 'zoom' && !integrations.zoom.connected) ||
                (opt.key === 'microsoft_teams' && (!isPremium || !integrations.microsoft_outlook.connected)) ||
                (opt.key === 'google_meet' && !integrations.google_calendar.connected);
              return (
                <button
                  key={opt.key}
                  onClick={() => update({ preferredVideoProvider: opt.key as CalendarStepConfig['preferredVideoProvider'] })}
                  disabled={isDisabled}
                  className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                    config.preferredVideoProvider === opt.key
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                    {!opt.icon && (
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                    <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-[22px]">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Meeting duration */}
          <div className="mt-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Default meeting duration</label>
            <select
              value={config.defaultMeetingDuration}
              onChange={e => update({ defaultMeetingDuration: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
            </select>
          </div>
        </div>
      )}

      {/* Upsell for Starter plan users */}
      {isStarter && !isPremium && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 mb-0.5">Unlock smart scheduling</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Upgrade to <span className="font-bold">Business</span> to let your agent automatically schedule calls at times your contacts request, connect Microsoft 365, and use advanced scheduling features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Slack Notifications - simplified, multi-channel */}
      {integrations.slack.connected && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
              <SlackIcon className="w-3.5 h-3.5" />
              Slack
              {integrations.slack.team_name && (
                <span className="text-[10px] font-medium text-slate-400 normal-case">({integrations.slack.team_name})</span>
              )}
            </h3>
            <ToggleSwitch
              checked={config.slackEnabled}
              onChange={val => update({ slackEnabled: val })}
            />
          </div>

          {config.slackEnabled && (
            <div className="space-y-3">
              {/* Multi-channel selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Channels</label>
                {loadingSlackChannels ? (
                  <div className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-400 text-sm animate-pulse">Loading...</div>
                ) : slackChannels.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(config.slackChannelIds || (config.slackChannelId ? [config.slackChannelId] : [])).map(chId => {
                        const ch = slackChannels.find(c => c.id === chId);
                        return ch ? (
                          <span key={chId} className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-md text-xs font-medium text-[var(--color-primary)]">
                            #{ch.name}
                            <button
                              onClick={() => {
                                const ids = (config.slackChannelIds || []).filter(id => id !== chId);
                                const names = ids.map(id => slackChannels.find(c => c.id === id)?.name || '').filter(Boolean);
                                update({
                                  slackChannelIds: ids,
                                  slackChannelNames: names,
                                  slackChannelId: ids[0] || '',
                                  slackChannelName: names[0] || '',
                                });
                              }}
                              className="text-[var(--color-primary)] hover:text-red-500 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                    <select
                      value=""
                      onChange={e => {
                        if (!e.target.value) return;
                        const channel = slackChannels.find(c => c.id === e.target.value);
                        if (!channel) return;
                        const currentIds = config.slackChannelIds || (config.slackChannelId ? [config.slackChannelId] : []);
                        if (currentIds.includes(channel.id)) return;
                        const newIds = [...currentIds, channel.id];
                        const newNames = newIds.map(id => slackChannels.find(c => c.id === id)?.name || '').filter(Boolean);
                        update({
                          slackChannelIds: newIds,
                          slackChannelNames: newNames,
                          slackChannelId: newIds[0] || '',
                          slackChannelName: newNames[0] || '',
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                    >
                      <option value="">Add a channel...</option>
                      {slackChannels
                        .filter(ch => !(config.slackChannelIds || []).includes(ch.id))
                        .map(ch => (
                          <option key={ch.id} value={ch.id}>#{ch.name}</option>
                        ))
                      }
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200">
                    {integrations.slack.channel_name ? `Default: #${integrations.slack.channel_name}` : 'No channels found'}
                  </p>
                )}
              </div>

              {/* Notification types - compact */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'slackNotifyOnCallCompleted' as const, label: 'Calls' },
                  { key: 'slackNotifyOnAppointment' as const, label: 'Appointments' },
                  { key: 'slackNotifyOnFollowUp' as const, label: 'Follow-ups' },
                  { key: 'slackNotifyOnNoShow' as const, label: 'No-shows' },
                ].map(notif => (
                  <button
                    key={notif.key}
                    onClick={() => update({ [notif.key]: !config[notif.key] })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      config[notif.key]
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {notif.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[11px] text-slate-400 leading-relaxed px-1">
        These settings apply to this campaign. Calendar events, contacts, and call history sync automatically.
      </p>
    </div>
  );
}
