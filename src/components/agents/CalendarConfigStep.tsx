// components/agents/CalendarConfigStep.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BiLogoZoom } from 'react-icons/bi';
import { GoogleCalendarIcon, OutlookIcon } from '@/components/icons/BrandIcons';
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
}

interface CalendarConfigStepProps {
  companyId: string;
  agentType: 'appointment_confirmation' | 'lead_qualification' | 'data_validation' | 'unknown';
  config: CalendarStepConfig;
  onConfigChange: (config: CalendarStepConfig) => void;
  gradientColor: string;
  planSlug?: string;
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

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const cells: { day: number | null; isWorking: boolean; isHoliday: boolean; isToday: boolean; holidayName?: string }[] = [];

  // Empty cells before first day
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
      {/* Month header */}
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
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
            Off
          </span>
        </div>
      </div>

      {/* Working hours banner */}
      <div className="px-4 py-2 bg-[var(--color-primary)]/5 border-b border-[var(--color-primary)]/10">
        <p className="text-xs text-[var(--color-primary)] font-medium">
          Working hours: {workingHoursStart} - {workingHoursEnd} ({TIMEZONE_OPTIONS.find(t => t.value === timezone)?.label || timezone})
        </p>
      </div>

      {/* Calendar grid */}
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {dayHeaders.map(h => (
            <div key={h} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
              {h}
            </div>
          ))}

          {/* Day cells */}
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
// PREMIUM BADGE
// ============================================================================

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      PRO
    </span>
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
  planSlug = 'free',
}: CalendarConfigStepProps) {
  const [integrations, setIntegrations] = useState<IntegrationStatuses>({
    google_calendar: { connected: false },
    microsoft_outlook: { connected: false },
    zoom: { connected: false },
  });
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const isPremium = ['business', 'teams', 'enterprise'].includes(planSlug);
  const isStarter = ['starter', 'business', 'teams', 'enterprise'].includes(planSlug);

  const isAppointment = agentType === 'appointment_confirmation';
  const isLeadQual = agentType === 'lead_qualification';
  const isDataVal = agentType === 'data_validation';

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
        setIntegrations({
          google_calendar: data.all?.google_calendar || { connected: false },
          microsoft_outlook: data.all?.microsoft_outlook || { connected: false },
          zoom: data.all?.zoom || { connected: false },
        });

        // Update connected integrations in config
        const connected: string[] = [];
        if (data.all?.google_calendar?.connected) connected.push('google_calendar');
        if (data.all?.microsoft_outlook?.connected) connected.push('microsoft_outlook');
        if (data.all?.zoom?.connected) connected.push('zoom');
        onConfigChange({ ...config, connectedIntegrations: connected });
      }
    } catch (err) {
      console.error('Error fetching integration status:', err);
    } finally {
      setLoadingIntegrations(false);
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
          // Open OAuth in new window
          const popup = window.open(data.url, `connect_${provider}`, 'width=600,height=700,scrollbars=yes');

          // Poll for popup close
          const checkClosed = setInterval(() => {
            if (!popup || popup.closed) {
              clearInterval(checkClosed);
              setConnectingProvider(null);
              // Refresh integration statuses
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

  // Agent-specific context message
  const getContextMessage = () => {
    if (isAppointment) {
      return 'Your calendar is connected so the agent can read your appointment schedule, confirm upcoming appointments, handle rescheduling requests, and suggest alternative times based on your real availability. When a contact needs to move their appointment, the agent will find the best available slot and update everything automatically across your calendar, contacts, and call history.';
    }
    if (isLeadQual) {
      return 'Your calendar is connected so the agent can schedule meetings with qualified leads directly. When a lead is ready to move forward, the agent will check your availability, propose a time, and send a calendar invite with a video call link — all in real-time during the conversation.';
    }
    if (isDataVal) {
      return 'Your calendar is connected so the agent can schedule callbacks at convenient times. If a contact needs to be reached again, the agent will find an available slot and schedule the follow-up call automatically.';
    }
    return 'Your calendar is connected so the agent can understand your schedule context and make intelligent scheduling decisions.';
  };

  return (
    <div className="space-y-5">
      {/* Calendar Context Info Banner */}
      <div className="bg-gradient-to-r from-[var(--color-primary)]/5 via-[var(--color-accent)]/5 to-[var(--color-primary)]/5 rounded-xl p-4 border border-[var(--color-primary)]/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Calendar-Aware Agent</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {getContextMessage()}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Integrations Quick Connect */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Calendar Integrations
          </h3>
          {loadingIntegrations && (
            <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Connect your calendars to give the agent real-time access to your schedule. This enables availability checking, appointment management, and smart scheduling.
        </p>

        <div className="space-y-2">
          {/* Google Calendar */}
          <div className={`flex items-center justify-between bg-white rounded-lg px-4 py-3 border ${integrations.google_calendar.connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'} transition-all`}>
            <div className="flex items-center gap-3">
              <GoogleCalendarIcon className="w-6 h-6" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Google Calendar</p>
                {integrations.google_calendar.connected ? (
                  <p className="text-xs text-emerald-600 font-medium">{integrations.google_calendar.email || 'Connected'}</p>
                ) : (
                  <p className="text-xs text-slate-400">Not connected</p>
                )}
              </div>
            </div>
            {integrations.google_calendar.connected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 rounded-lg">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-bold text-emerald-700">Connected</span>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('google_calendar')}
                disabled={connectingProvider === 'google_calendar'}
                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {connectingProvider === 'google_calendar' ? (
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                )}
                Connect
              </button>
            )}
          </div>

          {/* Microsoft Outlook */}
          <div className={`flex items-center justify-between bg-white rounded-lg px-4 py-3 border ${integrations.microsoft_outlook.connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'} transition-all`}>
            <div className="flex items-center gap-3">
              <OutlookIcon className="w-6 h-6" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Microsoft Outlook</p>
                {integrations.microsoft_outlook.connected ? (
                  <p className="text-xs text-emerald-600 font-medium">{integrations.microsoft_outlook.email || 'Connected'}</p>
                ) : (
                  <p className="text-xs text-slate-400">{isPremium ? 'Not connected' : 'Requires Business plan'}</p>
                )}
              </div>
            </div>
            {integrations.microsoft_outlook.connected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 rounded-lg">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-bold text-emerald-700">Connected</span>
              </div>
            ) : isPremium ? (
              <button
                onClick={() => handleConnect('microsoft_outlook')}
                disabled={connectingProvider === 'microsoft_outlook'}
                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                Connect
              </button>
            ) : (
              <PremiumBadge />
            )}
          </div>

          {/* Zoom */}
          <div className={`flex items-center justify-between bg-white rounded-lg px-4 py-3 border ${integrations.zoom.connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'} transition-all`}>
            <div className="flex items-center gap-3">
              <BiLogoZoom className="w-6 h-6 text-[#2D8CFF]" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Zoom</p>
                {integrations.zoom.connected ? (
                  <p className="text-xs text-emerald-600 font-medium">{integrations.zoom.email || 'Connected'}</p>
                ) : (
                  <p className="text-xs text-slate-400">Not connected</p>
                )}
              </div>
            </div>
            {integrations.zoom.connected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 rounded-lg">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-bold text-emerald-700">Connected</span>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('zoom')}
                disabled={connectingProvider === 'zoom'}
                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two column layout: Calendar Preview + Schedule Config */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: Calendar Preview */}
        <div>
          <MiniCalendarPreview
            workingDays={config.workingDays}
            workingHoursStart={config.workingHoursStart}
            workingHoursEnd={config.workingHoursEnd}
            excludeHolidays={config.excludeUSHolidays}
            timezone={config.timezone}
          />
        </div>

        {/* Right: Schedule Config */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase">Work Schedule</h3>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Timezone</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Start</label>
              <input
                type="time"
                value={config.workingHoursStart}
                onChange={e => update({ workingHoursStart: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">End</label>
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
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Working Days</label>
            <div className="flex gap-1.5">
              {ALL_DAYS.map(day => (
                <button
                  key={day.key}
                  onClick={() => toggleWorkingDay(day.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    config.workingDays.includes(day.key)
                      ? 'bg-[var(--color-primary)] text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* US Holidays */}
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-700">Exclude US Holidays</p>
              <p className="text-[10px] text-slate-400">Skip federal holidays automatically</p>
            </div>
            <ToggleSwitch
              checked={config.excludeUSHolidays}
              onChange={val => update({ excludeUSHolidays: val })}
            />
          </div>
        </div>
      </div>

      {/* Follow-ups & Callbacks */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Follow-ups & Callbacks
        </h3>

        <div className="space-y-3">
          {/* Follow-ups toggle */}
          <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Automatic Follow-ups</p>
              <p className="text-xs text-slate-500">Retry contacts who didn&apos;t answer</p>
            </div>
            <ToggleSwitch
              checked={config.followUpEnabled}
              onChange={val => update({ followUpEnabled: val })}
            />
          </div>

          {config.followUpEnabled && (
            <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-[var(--color-primary)]/20">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Max Attempts</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Interval (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={config.followUpIntervalHours}
                  onChange={e => update({ followUpIntervalHours: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>

              {/* Smart Follow-up */}
              <div className="col-span-2 flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3 border border-purple-200">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      Smart Follow-up
                      {!isPremium && <PremiumBadge />}
                    </p>
                    <p className="text-xs text-slate-500">Schedule callbacks at times requested by contacts</p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.smartFollowUp}
                  onChange={val => update({ smartFollowUp: val })}
                  disabled={!isPremium}
                  color="#9333ea"
                />
              </div>
            </div>
          )}

          {/* Callbacks */}
          <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Smart Callbacks</p>
              <p className="text-xs text-slate-500">Let the agent schedule callbacks on the calendar</p>
            </div>
            <ToggleSwitch
              checked={config.callbackEnabled}
              onChange={val => update({ callbackEnabled: val })}
            />
          </div>

          {config.callbackEnabled && (
            <div className="pl-3 border-l-2 border-[var(--color-primary)]/20">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Max Callback Attempts</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={config.callbackMaxAttempts}
                  onChange={e => update({ callbackMaxAttempts: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent-Specific: Appointment Confirmation */}
      {isAppointment && (
        <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-200/50">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-1 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Appointment Settings
          </h3>
          <p className="text-xs text-slate-500 mb-4">Configure how the agent handles appointment confirmations, rescheduling, and no-shows.</p>

          <div className="space-y-3">
            {/* Availability Calendar */}
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">Availability-Based Rescheduling</p>
                <p className="text-xs text-slate-500">Agent suggests available slots from your calendar when rescheduling</p>
              </div>
              <ToggleSwitch
                checked={config.appointmentAvailabilityEnabled}
                onChange={val => update({ appointmentAvailabilityEnabled: val })}
              />
            </div>

            {/* Allow rescheduling */}
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">Allow Rescheduling</p>
                <p className="text-xs text-slate-500">Contacts can request to move their appointment during the call</p>
              </div>
              <ToggleSwitch
                checked={config.allowRescheduling}
                onChange={val => update({ allowRescheduling: val })}
              />
            </div>

            {/* Default meeting duration */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Default Meeting Duration</label>
              <select
                value={config.defaultMeetingDuration}
                onChange={e => update({ defaultMeetingDuration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {/* No-show auto retry */}
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">No-Show Auto-Retry</p>
                <p className="text-xs text-slate-500">Automatically reschedule calls for no-shows</p>
              </div>
              <ToggleSwitch
                checked={config.noShowAutoRetry}
                onChange={val => update({ noShowAutoRetry: val })}
              />
            </div>

            {config.noShowAutoRetry && (
              <div className="pl-3 border-l-2 border-blue-200">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Retry After (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={config.noShowRetryDelayHours}
                  onChange={e => update({ noShowRetryDelayHours: parseInt(e.target.value) || 24 })}
                  className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent-Specific: Lead Qualification - Video Call Settings */}
      {(isLeadQual || isAppointment) && (
        <div className="bg-emerald-50/50 rounded-xl p-5 border border-emerald-200/50">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-1 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video Meeting Preference
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {isLeadQual
              ? 'When a qualified lead wants to schedule a meeting, the agent will send an invitation with your preferred video platform.'
              : 'When rescheduling to a video call, the agent will use your preferred platform.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'none', label: 'No Video', icon: null, desc: 'In-person or phone only' },
              {
                key: 'google_meet',
                label: 'Google Meet',
                icon: <svg className="w-5 h-5" viewBox="0 0 87.5 72" fill="none"><path fill="#00832d" d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"/><path fill="#0066da" d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"/><path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z"/><path fill="#2684fc" d="M20.5 20.5H0v31h20.5z"/><path fill="#00ac47" d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"/><path fill="#ffba00" d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"/></svg>,
                desc: 'Google Calendar required',
              },
              {
                key: 'zoom',
                label: 'Zoom',
                icon: <BiLogoZoom className="w-5 h-5 text-[#2D8CFF]" />,
                desc: integrations.zoom.connected ? 'Connected' : 'Connect above first',
              },
              {
                key: 'microsoft_teams',
                label: 'MS Teams',
                icon: <svg className="w-5 h-5" viewBox="0 0 24 24"><rect fill="#5059C9" x="13" y="4" width="8" height="8" rx="1"/><rect fill="#7B83EB" x="3" y="4" width="18" height="16" rx="2"/><path fill="#FFF" d="M10 8H7v8h2V12h1.5L13 16h2.5l-3-4.5L15 8h-2.3L10.5 11.5H10V8z"/></svg>,
                desc: isPremium ? (integrations.microsoft_outlook.connected ? 'Connected' : 'Connect Outlook first') : 'Business plan',
              },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => update({ preferredVideoProvider: opt.key as CalendarStepConfig['preferredVideoProvider'] })}
                disabled={
                  (opt.key === 'zoom' && !integrations.zoom.connected) ||
                  (opt.key === 'microsoft_teams' && (!isPremium || !integrations.microsoft_outlook.connected)) ||
                  (opt.key === 'google_meet' && !integrations.google_calendar.connected)
                }
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  config.preferredVideoProvider === opt.key
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${
                  (opt.key === 'zoom' && !integrations.zoom.connected) ||
                  (opt.key === 'microsoft_teams' && (!isPremium || !integrations.microsoft_outlook.connected)) ||
                  (opt.key === 'google_meet' && !integrations.google_calendar.connected)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {opt.icon && <div className="flex-shrink-0">{opt.icon}</div>}
                  <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                </div>
                <p className="text-[10px] text-slate-400">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-slate-600 leading-relaxed">
              These calendar settings apply to this campaign only. Changes made by the agent during calls (rescheduling, new appointments, callbacks) will be automatically synced across your calendar, contacts database, campaign history, and call logs — keeping everything in sync in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
