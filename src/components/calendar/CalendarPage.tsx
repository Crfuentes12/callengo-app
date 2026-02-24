// components/calendar/CalendarPage.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BiLogoZoom } from 'react-icons/bi';
import { GoogleCalendarIcon, GoogleMeetIcon, OutlookIcon, TeamsIcon } from '@/components/icons/BrandIcons';
import type { CalendarEvent, CalendarIntegrationStatus } from '@/types/calendar';

// ============================================================================
// TYPES
// ============================================================================

interface CalendarSettings {
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  exclude_holidays: boolean;
}

interface CalendarPageProps {
  events: CalendarEvent[];
  integrations: CalendarIntegrationStatus[];
  companyId: string;
  workingHours: { start: string; end: string };
  workingDays: string[];
  excludeHolidays: boolean;
  timezone: string;
  calendarSettings: CalendarSettings;
  zoomConnected?: boolean;
  contacts: {
    id: string;
    contact_name: string | null;
    phone_number: string;
    email: string | null;
  }[];
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';
type FilterType = 'all' | 'call' | 'follow_up' | 'no_show_retry' | 'meeting' | 'appointment' | 'callback';

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
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

const ALL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DISPLAY_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DISPLAY_DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

// ============================================================================
// US HOLIDAYS (for calendar display)
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

  const holidays: { date: string; name: string }[] = [];

  const addFixed = (month: number, day: number, name: string) => {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    holidays.push({ date: fmt(month, day), name });
    if (dow === 6) holidays.push({ date: fmt(month, day - 1), name: `${name} (Observed)` });
    if (dow === 0) holidays.push({ date: fmt(month, day + 1), name: `${name} (Observed)` });
  };

  addFixed(1, 1, "New Year's Day");
  holidays.push({ date: fmt(1, nthWeekday(1, 1, 3)), name: 'MLK Day' });
  holidays.push({ date: fmt(2, nthWeekday(2, 1, 3)), name: "Presidents' Day" });
  holidays.push({ date: fmt(5, lastWeekday(5, 1)), name: 'Memorial Day' });
  addFixed(6, 19, 'Juneteenth');
  addFixed(7, 4, 'Independence Day');
  holidays.push({ date: fmt(9, nthWeekday(9, 1, 1)), name: 'Labor Day' });
  holidays.push({ date: fmt(10, nthWeekday(10, 1, 2)), name: 'Columbus Day' });
  addFixed(11, 11, 'Veterans Day');
  holidays.push({ date: fmt(11, nthWeekday(11, 4, 4)), name: 'Thanksgiving' });
  addFixed(12, 25, 'Christmas');

  return holidays;
}

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ============================================================================
// STYLE MAPS
// ============================================================================

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  call: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  follow_up: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  no_show_retry: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  meeting: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  appointment: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  callback: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  voicemail_followup: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  confirmed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  no_show: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  cancelled: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500' },
  rescheduled: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  pending_confirmation: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  campaign: 'Campaign',
  google_calendar: 'Google Calendar',
  microsoft_outlook: 'Microsoft Outlook',
  ai_agent: 'AI Agent',
  follow_up_queue: 'Follow-up Queue',
  webhook: 'Webhook',
};


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarPage({
  events: initialEvents,
  integrations: initialIntegrations,
  companyId,
  workingHours,
  workingDays: initialWorkingDays,
  excludeHolidays: initialExcludeHolidays,
  timezone: initialTimezone,
  calendarSettings: initialCalendarSettings,
  zoomConnected: initialZoomConnected = false,
  contacts,
}: CalendarPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Calendar settings state (from calendarSettings prop)
  const [calSettings, setCalSettings] = useState<CalendarSettings>({
    timezone: initialCalendarSettings.timezone || initialTimezone || 'America/New_York',
    working_hours_start: initialCalendarSettings.working_hours_start || workingHours.start || '09:00',
    working_hours_end: initialCalendarSettings.working_hours_end || workingHours.end || '18:00',
    working_days: initialCalendarSettings.working_days?.length ? initialCalendarSettings.working_days : (initialWorkingDays?.length ? initialWorkingDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
    exclude_holidays: initialCalendarSettings.exclude_holidays ?? initialExcludeHolidays ?? false,
  });

  // Timezone-aware formatting helpers
  const tz = calSettings.timezone;
  const formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { timeZone: tz, ...options });
  };
  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { timeZone: tz, ...options });
  };
  const getHourInTz = (date: Date): number => {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date), 10);
  };
  const getDayInTz = (date: Date): number => {
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date).toLowerCase();
    return ALL_DAYS.indexOf(dayStr);
  };
  const getDateStringInTz = (date: Date): string => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date); // returns YYYY-MM-DD
  };
  const getMinutesInTz = (date: Date): number => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date);
    return parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  };
  // Get YYYY-MM-DD from a Date's local parts (for calendar grid dates that represent abstract dates)
  const getLocalDateString = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Derived working hours from settings
  const workStart = parseInt(calSettings.working_hours_start.split(':')[0], 10);
  const workEnd = parseInt(calSettings.working_hours_end.split(':')[0], 10);
  const isWorkingHour = (hour: number) => hour >= workStart && hour < workEnd;
  const isWorkingDay = (date: Date) => {
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date).toLowerCase();
    return calSettings.working_days.includes(dayStr);
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [zoomConnected, setZoomConnected] = useState(initialZoomConnected);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsForm, setSettingsForm] = useState<CalendarSettings>({ ...calSettings });
  const [savingSettings, setSavingSettings] = useState(false);
  const [schedulingEvent, setSchedulingEvent] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Working hours visibility & drag-to-select state
  const [showFullDay, setShowFullDay] = useState(false);
  const [dragSelection, setDragSelection] = useState<{
    dayDate: Date;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ dayDate: Date; minutes: number } | null>(null);
  const dragSelRef = useRef<{ dayDate: Date; startMinutes: number; endMinutes: number } | null>(null);
  const openScheduleRef = useRef<(date: Date, startMin: number, endMin: number, x: number, y: number) => void>(() => {});
  const weekGridRef = useRef<HTMLDivElement>(null);
  const dayGridRef = useRef<HTMLDivElement>(null);

  // Inline panel state (replaces modal popup – Google Calendar style)
  const [inlinePanel, setInlinePanel] = useState<{
    mode: 'create' | 'view';
    x: number;
    y: number;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const inlinePanelRef = useRef<HTMLDivElement>(null);

  // Event resize state (drag top/bottom edge to change start/end time)
  const isResizingRef = useRef(false);
  const resizeRef = useRef<{
    eventId: string;
    edge: 'top' | 'bottom';
    originalStartMin: number;
    originalEndMin: number;
  } | null>(null);
  const resizePreviewRef = useRef<{ eventId: string; startMinutes: number; endMinutes: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    eventId: string;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const handleResizeCompleteRef = useRef<(eventId: string, startMin: number, endMin: number) => void>(() => {});

  // Custom tooltip state (replaces native title attributes)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showCalTooltip = useCallback((e: React.MouseEvent, text: string) => {
    if (!text) return;
    clearTimeout(tooltipTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimeout.current = setTimeout(() => {
      setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    }, 400);
  }, []);
  const hideCalTooltip = useCallback(() => {
    clearTimeout(tooltipTimeout.current);
    setTooltip(null);
  }, []);

  // Schedule form state – restore last sync preferences from localStorage
  const [scheduleForm, setScheduleForm] = useState(() => {
    let syncGoogle = true;
    let syncMicrosoft = false;
    try {
      const saved = localStorage.getItem('callengo_sync_preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (typeof prefs.sync_to_google === 'boolean') syncGoogle = prefs.sync_to_google;
        if (typeof prefs.sync_to_microsoft === 'boolean') syncMicrosoft = prefs.sync_to_microsoft;
      }
    } catch { /* ignore */ }
    return {
      event_type: 'call' as string,
      contact_id: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 15,
      notes: '',
      sync_to_google: syncGoogle,
      sync_to_microsoft: syncMicrosoft,
      video_provider: '' as string,
    };
  });

  // Show toast if redirected from OAuth callback
  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');
    if (integration && status === 'connected') {
      showToast(`${integration === 'google_calendar' ? 'Google Calendar' : 'Microsoft Outlook'} connected successfully!`, 'success');
      refreshIntegrations();
    }
  }, [searchParams]);

  // Update current time every minute for the day view time indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Clean up tooltip timeout on unmount
  useEffect(() => {
    return () => clearTimeout(tooltipTimeout.current);
  }, []);

  // Close settings menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    }
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  // Keep openScheduleRef in sync
  useEffect(() => {
    openScheduleRef.current = openScheduleFromSlot;
  });

  // Global mouseup handler for drag-to-select and resize
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Handle resize completion
      if (isResizingRef.current && resizePreviewRef.current) {
        const preview = { ...resizePreviewRef.current };
        isResizingRef.current = false;
        resizeRef.current = null;
        resizePreviewRef.current = null;
        setResizePreview(null);
        handleResizeCompleteRef.current(preview.eventId, preview.startMinutes, preview.endMinutes);
        return;
      }
      if (isDraggingRef.current && dragSelRef.current) {
        const sel = { ...dragSelRef.current };
        isDraggingRef.current = false;
        dragStartRef.current = null;
        dragSelRef.current = null;
        // If selection is very small (just a click), default to 1 hour
        if (sel.endMinutes - sel.startMinutes <= 15) {
          sel.endMinutes = Math.min(24 * 60, sel.startMinutes + 60);
        }
        // Keep drag selection visible (blue highlight persists)
        setDragSelection(sel);
        openScheduleRef.current(sel.dayDate, sel.startMinutes, sel.endMinutes, e.clientX, e.clientY);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Prevent text selection during drag or resize
  useEffect(() => {
    if (dragSelection || resizePreview) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
    return () => { document.body.style.userSelect = ''; };
  }, [dragSelection, resizePreview]);


  // Close inline panel (and selection)
  const closePanel = useCallback(() => {
    setInlinePanel(null);
    setSelectedEvent(null);
    setDragSelection(null);
    setScheduleWarning(null);
  }, []);

  // Close inline panel on Escape key
  useEffect(() => {
    if (!inlinePanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [inlinePanel, closePanel]);

  // Click outside inline panel to close
  useEffect(() => {
    if (!inlinePanel) return;
    const handler = (e: MouseEvent) => {
      if (inlinePanelRef.current && !inlinePanelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    // Delay so the opening click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [inlinePanel, closePanel]);

  // Open event detail panel
  const openEventPanel = useCallback((event: CalendarEvent, x: number, y: number) => {
    setSelectedEvent(event);
    setDragSelection(null);
    setInlinePanel({ mode: 'view', x, y });
  }, []);

  // Event edge resize: start
  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    eventId: string,
    edge: 'top' | 'bottom',
    originalStartMin: number,
    originalEndMin: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // Close any inline panel
    setInlinePanel(null);
    setSelectedEvent(null);
    setDragSelection(null);
    isResizingRef.current = true;
    resizeRef.current = { eventId, edge, originalStartMin, originalEndMin };
    const preview = { eventId, startMinutes: originalStartMin, endMinutes: originalEndMin };
    resizePreviewRef.current = preview;
    setResizePreview(preview);
  }, []);

  // ============================================================================
  // API CALLS
  // ============================================================================

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
        if (data.all?.zoom) {
          setZoomConnected(!!data.all.zoom.connected);
        }
      }
    } catch (error) {
      console.error('Failed to refresh integrations:', error);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAhead = new Date();
      threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

      const res = await fetch(
        `/api/calendar/events?start_date=${threeMonthsAgo.toISOString()}&end_date=${threeMonthsAhead.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to refresh events:', error);
    }
  }, []);

  const handleConnectGoogle = useCallback(() => {
    window.location.href = '/api/integrations/google-calendar/connect?return_to=/calendar';
  }, []);

  const handleDisconnect = useCallback(async (provider: string) => {
    const endpoint = provider === 'google_calendar'
      ? '/api/integrations/google-calendar/disconnect'
      : '/api/integrations/microsoft-outlook/disconnect';

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        showToast(`${provider === 'google_calendar' ? 'Google Calendar' : 'Microsoft Outlook'} disconnected`, 'success');
        await refreshIntegrations();
      } else {
        showToast('Failed to disconnect', 'error');
      }
    } catch {
      showToast('Failed to disconnect', 'error');
    }
  }, [refreshIntegrations, showToast]);

  const handleSync = useCallback(async (provider: string) => {
    setSyncing(prev => ({ ...prev, [provider]: true }));
    try {
      const endpoint = provider === 'google_calendar'
        ? '/api/integrations/google-calendar/sync'
        : '/api/integrations/microsoft-outlook/sync';

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        showToast(`Synced ${data.created + data.updated} events from ${provider === 'google_calendar' ? 'Google Calendar' : 'Microsoft Outlook'}`, 'success');
        await refreshEvents();
        await refreshIntegrations();
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(prev => ({ ...prev, [provider]: false }));
    }
  }, [refreshEvents, refreshIntegrations, showToast]);

  const handleMarkNoShow = useCallback(async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          action: 'no_show',
          schedule_retry: true,
        }),
      });
      if (res.ok) {
        showToast('Marked as no-show. Retry scheduled.', 'success');
        await refreshEvents();
      } else {
        showToast('Failed to mark as no-show', 'error');
      }
    } catch {
      showToast('Failed to mark as no-show', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [refreshEvents, showToast]);

  const handleConfirm = useCallback(async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, action: 'confirm' }),
      });
      if (res.ok) {
        showToast('Appointment confirmed', 'success');
        await refreshEvents();
      } else {
        showToast('Failed to confirm', 'error');
      }
    } catch {
      showToast('Failed to confirm', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [refreshEvents, showToast]);

  const handleCancel = useCallback(async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, action: 'cancel' }),
      });
      if (res.ok) {
        showToast('Event cancelled', 'success');
        await refreshEvents();
      } else {
        showToast('Failed to cancel', 'error');
      }
    } catch {
      showToast('Failed to cancel', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [refreshEvents, showToast]);

  // Event edge resize: complete (API call to reschedule)
  const handleResizeComplete = useCallback(async (eventId: string, newStartMin: number, newEndMin: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const eventDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(event.start_time));
    const toTzDate = (dateStr: string, minutes: number) => {
      const h = String(Math.floor(minutes / 60)).padStart(2, '0');
      const m = String(minutes % 60).padStart(2, '0');
      const naive = new Date(`${dateStr}T${h}:${m}:00`);
      const inTz = new Date(naive.toLocaleString('en-US', { timeZone: tz }));
      return new Date(naive.getTime() + (naive.getTime() - inTz.getTime()));
    };
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          action: 'reschedule',
          new_start_time: toTzDate(eventDate, newStartMin).toISOString(),
          new_end_time: toTzDate(eventDate, newEndMin).toISOString(),
        }),
      });
      if (res.ok) {
        showToast('Event resized', 'success');
        await refreshEvents();
      } else {
        showToast('Failed to resize event', 'error');
      }
    } catch {
      showToast('Failed to resize event', 'error');
    }
  }, [events, tz, showToast, refreshEvents]);

  // Keep resize complete ref in sync
  useEffect(() => {
    handleResizeCompleteRef.current = handleResizeComplete;
  });

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings/calendar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        setCalSettings({ ...settingsForm });
        showToast('Calendar settings saved', 'success');
        setShowSettingsMenu(false);
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  }, [settingsForm, showToast]);

  const handleScheduleSubmit = useCallback(async () => {
    if (schedulingEvent) return;
    setSchedulingEvent(true);

    const contact = contacts.find(c => c.id === scheduleForm.contact_id);
    // Timezone-aware: interpret date/time in the configured TZ, not browser local TZ
    const naive = new Date(`${scheduleForm.date}T${scheduleForm.time}:00`);
    const inTzStr = naive.toLocaleString('en-US', { timeZone: tz });
    const inTzDate = new Date(inTzStr);
    const tzOffset = naive.getTime() - inTzDate.getTime();
    const startTime = new Date(naive.getTime() + tzOffset);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + scheduleForm.duration);

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${scheduleForm.event_type.replace(/_/g, ' ')}: ${contact?.contact_name || 'Event'}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          event_type: scheduleForm.event_type,
          contact_id: scheduleForm.contact_id || undefined,
          contact_name: contact?.contact_name || undefined,
          contact_phone: contact?.phone_number || undefined,
          contact_email: contact?.email || undefined,
          notes: scheduleForm.notes || undefined,
          sync_to_google: scheduleForm.sync_to_google,
          sync_to_microsoft: scheduleForm.sync_to_microsoft,
          video_provider: scheduleForm.video_provider || undefined,
        }),
      });

      if (res.ok) {
        showToast('Event scheduled successfully', 'success');
        setInlinePanel(null);
        setDragSelection(null);
        setScheduleWarning(null);
        try {
          localStorage.setItem('callengo_sync_preferences', JSON.stringify({
            sync_to_google: scheduleForm.sync_to_google,
            sync_to_microsoft: scheduleForm.sync_to_microsoft,
          }));
        } catch { /* ignore */ }
        await refreshEvents();
      } else {
        showToast('Failed to schedule event', 'error');
      }
    } catch {
      showToast('Failed to schedule event', 'error');
    } finally {
      setSchedulingEvent(false);
    }
  }, [scheduleForm, contacts, refreshEvents, showToast, schedulingEvent]);

  // Open inline create panel pre-filled from a time slot click/drag
  const openScheduleFromSlot = useCallback((date: Date, startMinutes: number, endMinutes: number, x: number, y: number) => {
    const dayName = ALL_DAYS[date.getDay()];
    const startHour = Math.floor(startMinutes / 60);
    const working = isWorkingHour(startHour) && calSettings.working_days.includes(dayName);
    const warning = working ? null : 'This time slot is outside your working hours. Callengo agents will not operate during this time.';
    setScheduleWarning(warning);
    const h = String(Math.floor(startMinutes / 60)).padStart(2, '0');
    const m = String(startMinutes % 60).padStart(2, '0');
    const duration = endMinutes - startMinutes;
    setScheduleForm(prev => ({
      ...prev,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${h}:${m}`,
      duration: duration > 0 ? duration : 30,
    }));
    setSelectedEvent(null);
    setInlinePanel({ mode: 'create', x, y });
  }, [calSettings.working_days, isWorkingHour]);


  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  // Filter events by type
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(e => e.status !== 'cancelled');
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.event_type === filterType);
    }
    return filtered;
  }, [events, filterType]);

  // Calendar grid helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean; events: CalendarEvent[] }[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = getFirstDayOfMonth(currentDate);
    const firstDayOffset = (firstDay + 6) % 7;
    const daysInMonth = getDaysInMonth(currentDate);
    const prevMonthDays = getDaysInMonth(new Date(year, month - 1));

    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => {
          return getDateStringInTz(new Date(e.start_time)) === getLocalDateString(date);
        }),
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        events: filteredEvents.filter(e => {
          return getDateStringInTz(new Date(e.start_time)) === getLocalDateString(date);
        }),
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => {
          return getDateStringInTz(new Date(e.start_time)) === getLocalDateString(date);
        }),
      });
    }

    return days;
  }, [currentDate, filteredEvents]);

  // Week view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - mondayOffset);
    const days: { date: Date; events: CalendarEvent[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        events: filteredEvents.filter(e => {
          return getDateStringInTz(new Date(e.start_time)) === getLocalDateString(date);
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      });
    }
    return days;
  }, [currentDate, filteredEvents]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayTzStr = getDateStringInTz(today);
    const todayEvents = events.filter(e => getDateStringInTz(new Date(e.start_time)) === todayTzStr && e.status !== 'cancelled');
    const scheduled = events.filter(e => e.status === 'scheduled' || e.status === 'confirmed');
    const noShows = events.filter(e => e.event_type === 'no_show_retry' && e.status === 'scheduled');
    const upcoming = events.filter(e => new Date(e.start_time) > today && (e.status === 'scheduled' || e.status === 'confirmed'));
    const pendingConfirmation = events.filter(e => e.confirmation_status === 'unconfirmed' && e.status === 'scheduled');

    return {
      todayCount: todayEvents.length,
      scheduledCount: scheduled.length,
      noShowRetries: noShows.length,
      upcomingCount: upcoming.length,
      pendingConfirmation: pendingConfirmation.length,
    };
  }, [events]);

  // Holiday map (date string -> holiday name)
  const holidayMap = useMemo(() => {
    const year = currentDate.getFullYear();
    const combined = new Map<string, string>();
    for (const h of getUSHolidaysForYear(year - 1)) combined.set(h.date, h.name);
    for (const h of getUSHolidaysForYear(year)) combined.set(h.date, h.name);
    for (const h of getUSHolidaysForYear(year + 1)) combined.set(h.date, h.name);
    return combined;
  }, [currentDate]);

  // Visible hours (for collapsing non-working hours in week/day views)
  const visibleHours = useMemo(() => {
    if (showFullDay) return Array.from({ length: 24 }, (_, i) => i);
    const start = Math.max(0, workStart);
    const end = Math.min(24, workEnd);
    return Array.from({ length: end - start }, (_, i) => i + start);
  }, [showFullDay, workStart, workEnd]);

  const visibleStartHour = showFullDay ? 0 : workStart;

  // Format minutes (0-1440) to readable time string
  const formatTimeFromMinutes = useCallback((totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }, []);

  // Drag start handler for time grid cells
  const handleCellMouseDown = useCallback((dayDate: Date, hour: number, e: React.MouseEvent, quarterHeight: number) => {
    e.preventDefault();
    // Close any existing inline panel
    setInlinePanel(null);
    setSelectedEvent(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const yInCell = e.clientY - rect.top;
    const quarterInCell = Math.min(3, Math.max(0, Math.floor(yInCell / quarterHeight)));
    const startMinutes = hour * 60 + quarterInCell * 15;
    isDraggingRef.current = true;
    dragStartRef.current = { dayDate, minutes: startMinutes };
    const sel = { dayDate, startMinutes, endMinutes: startMinutes + 15 };
    dragSelRef.current = sel;
    setDragSelection(sel);
  }, []);

  // Drag move handler for time grid container (also handles resize)
  const handleGridMouseMove = useCallback((e: React.MouseEvent, quarterHeight: number) => {
    // Handle resize tracking
    if (isResizingRef.current && resizeRef.current) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = Math.max(0, e.clientY - rect.top);
      const quarterInGrid = Math.floor(y / quarterHeight);
      const absoluteMinutes = Math.min(23 * 60 + 45, Math.max(0, (quarterInGrid + visibleStartHour * 4) * 15));
      const info = resizeRef.current;
      let newStart = info.originalStartMin;
      let newEnd = info.originalEndMin;
      if (info.edge === 'bottom') {
        newEnd = Math.max(newStart + 15, absoluteMinutes + 15);
      } else {
        newStart = Math.min(newEnd - 15, absoluteMinutes);
      }
      const preview = { eventId: info.eventId, startMinutes: newStart, endMinutes: newEnd };
      resizePreviewRef.current = preview;
      setResizePreview(preview);
      return;
    }
    if (!isDraggingRef.current || !dragStartRef.current) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = Math.max(0, e.clientY - rect.top);
    const quarterInGrid = Math.floor(y / quarterHeight);
    const absoluteMinutes = Math.min(23 * 60 + 45, Math.max(0, (quarterInGrid + visibleStartHour * 4) * 15));
    const startMin = dragStartRef.current.minutes;
    const sel = {
      dayDate: dragStartRef.current.dayDate,
      startMinutes: Math.min(startMin, absoluteMinutes),
      endMinutes: Math.max(startMin, absoluteMinutes) + 15,
    };
    dragSelRef.current = sel;
    setDragSelection(sel);
  }, [visibleStartHour]);

  // Navigation
  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const todayStr = getDateStringInTz(new Date());
    const [y, m, d] = todayStr.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d));
  };
  const isToday = (date: Date) => getLocalDateString(date) === getDateStringInTz(currentTime);

  const monthYearLabel = formatDate(currentDate, { month: 'long', year: 'numeric' });
  const weekLabel = viewMode === 'week' ? (() => {
    const start = new Date(currentDate);
    const dow = start.getDay();
    const mondayOff = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - mondayOff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })() : '';

  const googleIntegration = integrations.find(i => i.provider === 'google_calendar');
  const microsoftIntegration = integrations.find(i => i.provider === 'microsoft_outlook');


  // ============================================================================
  // HELPER: Source badge
  // ============================================================================
  const SourceBadge = ({ source }: { source: string }) => {
    if (source === 'google_calendar') {
      return <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium"><GoogleCalendarIcon className="w-3 h-3" /> Google</span>;
    }
    if (source === 'microsoft_outlook') {
      return <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium"><OutlookIcon className="w-3 h-3" /> Outlook</span>;
    }
    if (source === 'ai_agent') {
      return <span className="text-[10px] text-violet-600 font-medium">AI Agent</span>;
    }
    return source !== 'manual' ? <span className="text-[10px] text-slate-400 font-medium">{SOURCE_LABELS[source] || source}</span> : null;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Diagonal stripe pattern for non-working days */}
      <svg className="absolute w-0 h-0">
        <defs>
          <pattern id="non-working-day-pattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(148,163,184,0.15)" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Custom tooltip (replaces native title attributes) */}
      {tooltip && (
        <div
          className="fixed px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg whitespace-pre-line z-[100] pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Header */}
      <div className="gradient-bg-subtle rounded-2xl p-8 shadow-md border border-slate-200">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
                <CalendarIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Calendar</h2>
                <p className="text-slate-500 font-medium">Manage appointments, follow-ups, and scheduling</p>
                <p className="text-xs text-slate-400 mt-0.5">Timezone: {TIMEZONE_OPTIONS.find(t => t.value === calSettings.timezone)?.label || calSettings.timezone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Google Calendar badge */}
              {googleIntegration?.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-emerald-200 rounded-lg">
                  <GoogleCalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Google Calendar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <button
                    onClick={() => handleSync('google_calendar')}
                    disabled={syncing.google_calendar}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    onMouseEnter={e => showCalTooltip(e, 'Sync Google Calendar')}
                    onMouseLeave={hideCalTooltip}
                  >
                    <svg className={`w-3 h-3 text-slate-400 ${syncing.google_calendar ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all text-[11px] font-semibold text-slate-500"
                >
                  <GoogleCalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Google Calendar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              {/* Microsoft Outlook badge */}
              {microsoftIntegration?.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-emerald-200 rounded-lg">
                  <OutlookIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Outlook</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <button
                    onClick={() => handleSync('microsoft_outlook')}
                    disabled={syncing.microsoft_outlook}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    onMouseEnter={e => showCalTooltip(e, 'Sync Microsoft Outlook')}
                    onMouseLeave={hideCalTooltip}
                  >
                    <svg className={`w-3 h-3 text-slate-400 ${syncing.microsoft_outlook ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { window.location.href = '/api/integrations/microsoft-outlook/connect?return_to=/calendar'; }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all text-[11px] font-semibold text-slate-500"
                >
                  <OutlookIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Outlook</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              <button
                onClick={(e) => {
                  setScheduleWarning(null);
                  setSelectedEvent(null);
                  setDragSelection(null);
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setInlinePanel({ mode: 'create', x: rect.right - 380, y: rect.bottom + 12 });
                }}
                className="btn-primary flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Schedule Event
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-slate-500 font-semibold">Today</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.todayCount}</span>
              <p className="text-xs text-slate-500 mt-1">events scheduled</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-xs text-slate-500 font-semibold">Upcoming</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.upcomingCount}</span>
              <p className="text-xs text-slate-500 mt-1">future appointments</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-xs text-slate-500 font-semibold">No-Show Retries</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.noShowRetries}</span>
              <p className="text-xs text-slate-500 mt-1">auto-scheduled</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-slate-500 font-semibold">Pending</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.pendingConfirmation}</span>
              <p className="text-xs text-slate-500 mt-1">need confirmation</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
                <span className="text-xs text-slate-500 font-semibold">Total Scheduled</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.scheduledCount}</span>
              <p className="text-xs text-slate-500 mt-1">all pending</p>
            </div>
          </div>
        </div>
      </div>


      {/* Calendar Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronLeftIcon className="w-4 h-4 text-slate-600" />
              </button>
              <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronRightIcon className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {viewMode === 'week' ? weekLabel : viewMode === 'day' ? formatDate(currentDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : monthYearLabel}
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-nowrap shrink-0">
            {/* Filter */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 flex-nowrap shrink-0">
              {([
                { id: 'all', label: 'All' },
                { id: 'call', label: 'Calls' },
                { id: 'follow_up', label: 'Follow-ups' },
                { id: 'appointment', label: 'Appointments' },
                { id: 'meeting', label: 'Meetings' },
              ] as { id: FilterType; label: string }[]).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    filterType === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* View Mode */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 flex-nowrap shrink-0">
              {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize whitespace-nowrap ${
                    viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {/* Settings Menu (three dots) */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setSettingsForm({ ...calSettings });
                  setShowSettingsMenu(!showSettingsMenu);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                onMouseEnter={e => showCalTooltip(e, 'Calendar Settings')}
                onMouseLeave={hideCalTooltip}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {/* Settings Dropdown Panel */}
              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-sm font-bold text-slate-900">Calendar Settings</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Configure your working hours and preferences</p>
                  </div>
                  <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Timezone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Timezone</label>
                      <select
                        value={settingsForm.timezone}
                        onChange={e => setSettingsForm(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                      >
                        {TIMEZONE_OPTIONS.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Working Hours */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Working Hours</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={settingsForm.working_hours_start}
                          onChange={e => setSettingsForm(prev => ({ ...prev, working_hours_start: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                        />
                        <span className="text-xs text-slate-400 font-medium">to</span>
                        <input
                          type="time"
                          value={settingsForm.working_hours_end}
                          onChange={e => setSettingsForm(prev => ({ ...prev, working_hours_end: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                        />
                      </div>
                    </div>

                    {/* Working Days */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Working Days</label>
                      <div className="flex gap-1">
                        {DISPLAY_DAYS.map(day => {
                          const isActive = settingsForm.working_days.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setSettingsForm(prev => ({
                                  ...prev,
                                  working_days: isActive
                                    ? prev.working_days.filter(d => d !== day)
                                    : [...prev.working_days, day],
                                }));
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                                isActive
                                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {DAY_LABELS[day]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Exclude US Holidays */}
                    <div>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={settingsForm.exclude_holidays}
                            onChange={e => setSettingsForm(prev => ({ ...prev, exclude_holidays: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 rounded-full transition-colors ${settingsForm.exclude_holidays ? 'bg-[var(--color-primary)]' : 'bg-slate-200'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${settingsForm.exclude_holidays ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-700">Exclude US Holidays</span>
                          <p className="text-[10px] text-slate-400">Callengo agents will not operate on US holidays</p>
                        </div>
                      </label>
                    </div>

                    {/* Show Full Day Hours */}
                    <div>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={showFullDay}
                            onChange={e => setShowFullDay(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 rounded-full transition-colors ${showFullDay ? 'bg-[var(--color-primary)]' : 'bg-slate-200'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${showFullDay ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-700">Show Full Day</span>
                          <p className="text-[10px] text-slate-400">Display all 24 hours instead of just working hours</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                    <button
                      onClick={() => setShowSettingsMenu(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-600)] rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {savingSettings ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Month View */}
        {viewMode === 'month' && (
          <div className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {DISPLAY_DAY_HEADERS.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-l border-slate-200">
              {calendarDays.map((day, idx) => {
                const holidayName = holidayMap.get(getLocalDateString(day.date));
                return (
                <div
                  key={idx}
                  onClick={() => { setCurrentDate(day.date); setViewMode('day'); }}
                  className={`min-h-[100px] p-1.5 border-r border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                  } ${isToday(day.date) ? 'bg-blue-50/50' : ''} ${holidayName ? 'bg-red-50/30' : ''}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                      isToday(day.date) ? 'gradient-bg text-white' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {day.date.getDate()}
                    </div>
                    {holidayName && (
                      <span className="text-[9px] text-red-600 font-semibold truncate leading-tight">{holidayName}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {day.events.slice(0, 3).map(event => {
                      const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                      return (
                        <div key={event.id} className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} truncate border font-medium cursor-pointer hover:shadow-sm`} onClick={(e) => { e.stopPropagation(); openEventPanel(event, e.clientX, e.clientY); }}>
                          {formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })} {(event.contact_name || event.title).split(' ')[0]}
                        </div>
                      );
                    })}
                    {day.events.length > 3 && (
                      <div className="text-[10px] text-slate-500 font-medium px-1.5">+{day.events.length - 3} more</div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-[64px_repeat(7,1fr)]">
                <div className="w-16" />
                {weekDays.map((day, idx) => {
                  const dayWorking = isWorkingDay(day.date);
                  const holiday = holidayMap.get(getLocalDateString(day.date));
                  return (
                    <div
                      key={idx}
                      className={`text-center py-2 border-b border-l ${
                        isToday(day.date) ? 'bg-[var(--color-primary-50)]/40 border-b-[var(--color-primary)]/30' : 'border-slate-200'
                      } ${!dayWorking ? 'bg-slate-100/60' : ''} ${idx === 6 ? 'border-r border-slate-200' : ''} ${holiday ? 'bg-red-50/30' : ''}`}
                    >
                      <div className={`text-xs font-medium ${!dayWorking ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(day.date, { weekday: 'short' })}</div>
                      <div className={`text-lg font-bold ${isToday(day.date) ? 'text-[var(--color-primary)]' : !dayWorking ? 'text-slate-400' : 'text-slate-900'}`}>
                        {day.date.getDate()}
                      </div>
                      {holiday && <div className="text-[9px] text-red-600 font-semibold truncate px-1">{holiday}</div>}
                      {!dayWorking && !holiday && <div className="text-[9px] text-slate-400 font-medium">Off</div>}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div
                ref={weekGridRef}
                className="relative select-none"
                onMouseMove={(e) => handleGridMouseMove(e, 12)}
              >
                {/* Current time indicator */}
                {(() => {
                  const todayIdx = weekDays.findIndex(d => isToday(d.date));
                  if (todayIdx === -1) return null;
                  const h = getHourInTz(currentTime);
                  const m = getMinutesInTz(currentTime);
                  if (!showFullDay && (h < workStart || h >= workEnd)) return null;
                  const topPx = ((h - visibleStartHour) + m / 60) * 48;
                  return (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${topPx}px` }}>
                      <div className="grid grid-cols-[64px_repeat(7,1fr)]">
                        <div className="flex justify-end pr-1">
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded-full border border-red-200">
                            {formatTime(currentTime, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        {weekDays.map((_, i) => (
                          <div key={i} className="relative">
                            {i === todayIdx && (
                              <div className="absolute inset-x-0 flex items-center">
                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                                <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-transparent" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {visibleHours.map(hour => {
                  const working = isWorkingHour(hour);
                  const isFirstWork = hour === workStart;
                  const isLastWork = hour === workEnd;
                  return (
                  <div key={hour} className="grid grid-cols-[64px_repeat(7,1fr)]">
                    <div className={`w-16 text-right pr-2 text-[11px] font-medium h-12 flex items-start pt-0 -mt-1.5 ${
                      working ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const dayWorking = isWorkingDay(day.date);
                      const slotWorking = working && dayWorking;
                      return (
                        <div
                          key={dayIdx}
                          onMouseDown={(e) => handleCellMouseDown(day.date, hour, e, 12)}
                          className={`h-12 border-t border-l ${dayIdx === 6 ? 'border-r' : ''} ${
                            slotWorking
                              ? isToday(day.date) ? 'bg-[var(--color-primary-50)]/20 border-slate-200' : 'bg-white border-slate-200'
                              : !dayWorking
                                ? 'border-slate-100'
                                : isToday(day.date) ? 'bg-slate-50/80 border-slate-100' : 'bg-slate-50/60 border-slate-100'
                          } ${isFirstWork || isLastWork ? 'border-t-[var(--color-primary)]/20' : ''} relative cursor-pointer transition-colors hover:bg-blue-50/40`}
                          style={!dayWorking ? { backgroundImage: 'url(#non-working-day-pattern)', backgroundColor: 'rgba(241,245,249,0.6)' } : undefined}
                        >
                          {/* Non-working day overlay with diagonal stripes */}
                          {!dayWorking && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                              <rect width="100%" height="100%" fill="url(#non-working-day-pattern)" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}

                {/* Continuous overlay for drag selection & events (not partitioned by hour rows) */}
                <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: `${visibleHours.length * 48}px` }}>
                  <div className="grid grid-cols-[64px_repeat(7,1fr)] h-full">
                    <div />
                    {weekDays.map((day, dayIdx) => (
                      <div key={dayIdx} className="relative h-full">
                        {/* Drag selection overlay */}
                        {dragSelection && getLocalDateString(dragSelection.dayDate) === getLocalDateString(day.date) && (() => {
                          const topPx = ((dragSelection.startMinutes / 60) - visibleStartHour) * 48;
                          const heightPx = ((dragSelection.endMinutes - dragSelection.startMinutes) / 60) * 48;
                          return (
                            <div
                              className="absolute left-0.5 right-0.5 bg-blue-200/70 border-2 border-blue-400/80 rounded-md z-20 flex items-start"
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            >
                              <div className="text-[10px] text-blue-700 font-semibold px-1 truncate leading-tight mt-0.5">
                                {formatTimeFromMinutes(dragSelection.startMinutes)} – {formatTimeFromMinutes(dragSelection.endMinutes)}
                              </div>
                            </div>
                          );
                        })()}
                        {/* Events */}
                        {day.events.map(event => {
                          const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                          const eStart = new Date(event.start_time);
                          const startH = getHourInTz(eStart);
                          const startM = getMinutesInTz(eStart);
                          const durationMin = Math.round((new Date(event.end_time).getTime() - eStart.getTime()) / 60000);
                          // Use resize preview if this event is being resized
                          const rp = resizePreview?.eventId === event.id ? resizePreview : null;
                          const eventStartMin = rp ? rp.startMinutes : startH * 60 + startM;
                          const eventEndMin = rp ? rp.endMinutes : eventStartMin + durationMin;
                          const visStartMin = visibleStartHour * 60;
                          const visEndMin = (visibleStartHour + visibleHours.length) * 60;
                          if (eventEndMin <= visStartMin || eventStartMin >= visEndMin) return null;
                          const clampedStart = Math.max(eventStartMin, visStartMin);
                          const clampedEnd = Math.min(eventEndMin, visEndMin);
                          const topPx = ((clampedStart / 60) - visibleStartHour) * 48;
                          const heightPx = Math.max(((clampedEnd - clampedStart) / 60) * 48, 18);
                          const actualStartMin = rp ? rp.startMinutes : startH * 60 + startM;
                          const actualEndMin = rp ? rp.endMinutes : actualStartMin + durationMin;
                          return (
                            <div
                              key={event.id}
                              className={`absolute left-0.5 right-0.5 ${style.bg} border ${style.text} rounded overflow-hidden cursor-pointer hover:shadow-md transition-shadow z-10 pointer-events-auto group/evt`}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              onMouseEnter={e => !isResizingRef.current && showCalTooltip(e, `${event.title}\n${rp ? formatTimeFromMinutes(rp.startMinutes) + ' – ' + formatTimeFromMinutes(rp.endMinutes) : formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' }) + ' - ' + durationMin + 'min'}`)}
                              onMouseLeave={hideCalTooltip}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={(e) => { if (!isResizingRef.current) { e.stopPropagation(); hideCalTooltip(); openEventPanel(event, e.clientX, e.clientY); } }}
                            >
                              {/* Top resize handle */}
                              <div
                                className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, event.id, 'top', actualStartMin, actualEndMin)}
                              >
                                <div className="w-6 h-[3px] rounded-full bg-current opacity-0 group-hover/evt:opacity-30 transition-opacity" />
                              </div>
                              <div className="px-1 py-0.5">
                                <div className="text-[10px] font-semibold truncate leading-tight">{event.contact_name || event.title}</div>
                                {heightPx >= 28 && (
                                  <div className="text-[9px] opacity-75 truncate">
                                    {rp ? `${formatTimeFromMinutes(rp.startMinutes)} – ${formatTimeFromMinutes(rp.endMinutes)}` : formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                              {/* Bottom resize handle */}
                              <div
                                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, event.id, 'bottom', actualStartMin, actualEndMin)}
                              >
                                <div className="w-6 h-[3px] rounded-full bg-current opacity-0 group-hover/evt:opacity-30 transition-opacity" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Day View */}
        {viewMode === 'day' && (
          <div className="p-4">
            {/* Non-working day banner */}
            {!isWorkingDay(currentDate) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">This day is outside your configured working days.</p>
                  <p className="text-xs text-amber-600 mt-0.5">Callengo agents will not operate on this day.</p>
                </div>
              </div>
            )}

            {/* Holiday banner */}
            {(() => {
              const holiday = holidayMap.get(getLocalDateString(currentDate));
              return holiday ? (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-800">{holiday}</p>
                    <p className="text-xs text-red-600 mt-0.5">US Federal Holiday</p>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Working hours legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-white border border-slate-200" />
                <span>Working hours ({calSettings.working_hours_start} - {calSettings.working_hours_end})</span>
              </div>
              {showFullDay && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-50 border border-slate-100" />
                  <span>Off hours</span>
                </div>
              )}
            </div>

            <div
              ref={dayGridRef}
              className="relative select-none"
              onMouseMove={(e) => handleGridMouseMove(e, 13)}
            >
              {/* Current time indicator */}
              {(() => {
                const isViewingToday = getLocalDateString(currentDate) === getDateStringInTz(currentTime);
                if (!isViewingToday) return null;
                const currentHour = getHourInTz(currentTime);
                const currentMinute = getMinutesInTz(currentTime);
                if (!showFullDay && (currentHour < workStart || currentHour >= workEnd)) return null;
                const topPosition = ((currentHour - visibleStartHour) + currentMinute / 60) * 52;
                return (
                  <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${topPosition}px` }}>
                    <div className="w-16 shrink-0 flex justify-end pr-2">
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                        {formatTime(currentTime, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500 shadow-md shadow-red-200 shrink-0 -ml-1.5" />
                      <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 via-rose-400 to-transparent" />
                    </div>
                  </div>
                );
              })()}

              <div>
                {visibleHours.map(hour => {
                  const working = isWorkingHour(hour);
                  const dayWorking = isWorkingDay(currentDate);
                  const slotWorking = working && dayWorking;
                  const isFirstWork = hour === workStart;
                  const isLastWork = hour === workEnd;

                  return (
                    <div key={hour} className="flex">
                      <div className={`w-16 text-right text-[11px] font-medium pr-3 shrink-0 h-[52px] flex items-start -mt-1.5 ${
                        working ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                      </div>
                      <div
                        onMouseDown={(e) => handleCellMouseDown(currentDate, hour, e, 13)}
                        className={`flex-1 min-h-[52px] border-t relative cursor-pointer transition-colors ${
                          slotWorking ? 'bg-white border-slate-200' : !dayWorking ? 'border-slate-100' : 'bg-slate-50/60 border-slate-100'
                        } ${isFirstWork ? 'border-t-[var(--color-primary)]/30 border-t-2' : ''} ${isLastWork ? 'border-t-[var(--color-primary)]/30 border-t-2' : ''} hover:bg-blue-50/40`}
                        style={!dayWorking ? { backgroundColor: 'rgba(241,245,249,0.6)' } : undefined}
                      >
                        {/* Non-working day stripe overlay */}
                        {!dayWorking && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                            <rect width="100%" height="100%" fill="url(#non-working-day-pattern)" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Continuous overlay for drag selection & events (not partitioned by hour rows) */}
              <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: `${visibleHours.length * 52}px` }}>
                <div className="flex h-full">
                  <div className="w-16 shrink-0" />
                  <div className="flex-1 relative">
                    {/* Drag selection overlay */}
                    {dragSelection && getLocalDateString(dragSelection.dayDate) === getLocalDateString(currentDate) && (() => {
                      const topPx = ((dragSelection.startMinutes / 60) - visibleStartHour) * 52;
                      const heightPx = ((dragSelection.endMinutes - dragSelection.startMinutes) / 60) * 52;
                      return (
                        <div
                          className="absolute left-0.5 right-0.5 bg-blue-200/70 border-2 border-blue-400/80 rounded-md z-20 flex items-start"
                          style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        >
                          <div className="text-[10px] text-blue-700 font-semibold px-1 truncate leading-tight mt-0.5">
                            {formatTimeFromMinutes(dragSelection.startMinutes)} – {formatTimeFromMinutes(dragSelection.endMinutes)}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Events */}
                    {filteredEvents
                      .filter(e => getDateStringInTz(new Date(e.start_time)) === getLocalDateString(currentDate))
                      .map(event => {
                        const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                        const eStart = new Date(event.start_time);
                        const startH = getHourInTz(eStart);
                        const startM = getMinutesInTz(eStart);
                        const durationMin = Math.round((new Date(event.end_time).getTime() - eStart.getTime()) / 60000);
                        // Use resize preview if this event is being resized
                        const rp = resizePreview?.eventId === event.id ? resizePreview : null;
                        const eventStartMin = rp ? rp.startMinutes : startH * 60 + startM;
                        const eventEndMin = rp ? rp.endMinutes : eventStartMin + durationMin;
                        const visStartMin = visibleStartHour * 60;
                        const visEndMin = (visibleStartHour + visibleHours.length) * 60;
                        if (eventEndMin <= visStartMin || eventStartMin >= visEndMin) return null;
                        const clampedStart = Math.max(eventStartMin, visStartMin);
                        const clampedEnd = Math.min(eventEndMin, visEndMin);
                        const topPx = ((clampedStart / 60) - visibleStartHour) * 52;
                        const heightPx = Math.max(((clampedEnd - clampedStart) / 60) * 52, 40);
                        const actualStartMin = rp ? rp.startMinutes : startH * 60 + startM;
                        const actualEndMin = rp ? rp.endMinutes : actualStartMin + durationMin;
                        return (
                          <div
                            key={event.id}
                            className={`absolute left-1 right-1 ${style.bg} border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow z-10 pointer-events-auto group/evt`}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={(e) => { if (!isResizingRef.current) { e.stopPropagation(); openEventPanel(event, e.clientX, e.clientY); } }}
                          >
                            {/* Top resize handle */}
                            <div
                              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(e, event.id, 'top', actualStartMin, actualEndMin)}
                            >
                              <div className="w-8 h-[3px] rounded-full bg-current opacity-0 group-hover/evt:opacity-30 transition-opacity" />
                            </div>
                            <div className="p-2.5 h-full flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`}></div>
                                <div className="min-w-0">
                                  <div className={`text-sm font-semibold ${style.text} truncate`}>{event.title}</div>
                                  <div className="text-xs text-slate-500">
                                    {rp ? `${formatTimeFromMinutes(rp.startMinutes)} – ${formatTimeFromMinutes(rp.endMinutes)}` : `${formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })} - ${durationMin}min`}
                                    {event.contact_phone && <span className="ml-2">{event.contact_phone}</span>}
                                  </div>
                                  {heightPx >= 60 && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <SourceBadge source={event.source} />
                                      {event.confirmation_status === 'confirmed' && (
                                        <span className="text-[10px] text-emerald-600 font-medium">Confirmed</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Bottom resize handle */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(e, event.id, 'bottom', actualStartMin, actualEndMin)}
                            >
                              <div className="w-8 h-[3px] rounded-full bg-current opacity-0 group-hover/evt:opacity-30 transition-opacity" />
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Agenda View */}
        {viewMode === 'agenda' && (
          <div className="p-4">
            <div className="space-y-4">
              {(() => {
                const grouped = new Map<string, CalendarEvent[]>();
                const upcoming = filteredEvents
                  .filter(e => e.status === 'scheduled' || e.status === 'confirmed' || e.status === 'pending_confirmation')
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                upcoming.forEach(e => {
                  const dateKey = getDateStringInTz(new Date(e.start_time));
                  if (!grouped.has(dateKey)) grouped.set(dateKey, []);
                  grouped.get(dateKey)!.push(e);
                });

                if (grouped.size === 0) {
                  return (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-semibold">No upcoming events</p>
                      <p className="text-sm text-slate-500 mt-1">Schedule a call or connect your calendar to get started</p>
                    </div>
                  );
                }

                return Array.from(grouped.entries()).map(([dateStr, dayEvents]) => (
                  <div key={dateStr}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        dateStr === getDateStringInTz(currentTime)
                          ? 'gradient-bg text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {formatDate(new Date(dayEvents[0].start_time), { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 h-px bg-slate-200"></div>
                      <span className="text-xs text-slate-400 font-medium">{dayEvents.length} events</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {dayEvents.map(event => {
                        const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                        const durationMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
                        const isLoading = actionLoading === event.id;
                        return (
                          <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group cursor-pointer" onClick={(e) => openEventPanel(event, e.clientX, e.clientY)}>
                            <div className={`w-1.5 h-10 rounded-full ${style.dot}`}></div>
                            <div className="text-sm text-slate-500 font-medium w-20 shrink-0">
                              {formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{event.title}</div>
                              <div className="text-xs text-slate-500">
                                {event.contact_phone && `${event.contact_phone} - `}{durationMin}min
                                {event.source !== 'manual' && (
                                  <span className="ml-2"><SourceBadge source={event.source} /></span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {(event.status === 'scheduled' || event.status === 'pending_confirmation') && !isLoading && (
                                <>
                                  {event.confirmation_status !== 'confirmed' && (
                                    <button
                                      onClick={() => handleConfirm(event.id)}
                                      className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleMarkNoShow(event.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    No-Show
                                  </button>
                                </>
                              )}
                              {isLoading && (
                                <svg className="animate-spin w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.text} border`}>
                              {event.event_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>


      {/* Inline Panel (Google Calendar style – floating card) */}
      {inlinePanel && (() => {
        const panelWidth = 380;
        const panelMaxHeight = 520;
        const margin = 16;
        let left = inlinePanel.x + 16;
        let top = inlinePanel.y - 80;
        if (typeof window !== 'undefined') {
          if (left + panelWidth > window.innerWidth - margin) left = inlinePanel.x - panelWidth - 16;
          if (left < margin) left = margin;
          if (top + panelMaxHeight > window.innerHeight - margin) top = window.innerHeight - panelMaxHeight - margin;
          if (top < margin) top = margin;
        }
        return (
          <div
            ref={inlinePanelRef}
            className="fixed z-[60] bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            style={{ left: `${left}px`, top: `${top}px`, width: `${panelWidth}px`, maxHeight: `${panelMaxHeight}px` }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* VIEW MODE – Event details */}
            {inlinePanel.mode === 'view' && selectedEvent && (() => {
              const ev = selectedEvent;
              const style = EVENT_TYPE_STYLES[ev.event_type] || EVENT_TYPE_STYLES.call;
              const statusStyle = STATUS_STYLES[ev.status] || STATUS_STYLES.scheduled;
              const durationMin = Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 60000);
              const isLoading = actionLoading === ev.id;
              return (
                <>
                  <div className={`p-4 border-b border-slate-100 rounded-t-2xl ${style.bg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-3 h-3 rounded-full ${style.dot} shrink-0`} />
                        <h4 className={`text-sm font-bold ${style.text} truncate`}>{ev.title}</h4>
                      </div>
                      <button onClick={closePanel} className="p-1 hover:bg-white/60 rounded-lg shrink-0 -mr-1 -mt-1">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.text}`}>
                      {ev.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: `${panelMaxHeight - 160}px` }}>
                    <div className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" /></svg>
                      <span className="font-medium">{formatDate(ev.start_time, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="font-medium">{formatTime(ev.start_time, { hour: 'numeric', minute: '2-digit' })} – {formatTime(ev.end_time, { hour: 'numeric', minute: '2-digit' })}</span>
                      <span className="text-xs text-slate-400">({durationMin}min)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                      <span className="font-medium capitalize">{ev.event_type.replace(/_/g, ' ')}</span>
                    </div>
                    {ev.contact_name && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-700">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        <span className="font-medium">{ev.contact_name}</span>
                      </div>
                    )}
                    {ev.contact_phone && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                        <span>{ev.contact_phone}</span>
                      </div>
                    )}
                    {ev.contact_email && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                        <span>{ev.contact_email}</span>
                      </div>
                    )}
                    {ev.video_link && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
                        <a href={ev.video_link} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] font-medium hover:underline truncate">Join video call</a>
                      </div>
                    )}
                    {(ev.notes || ev.ai_notes) && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.notes || ev.ai_notes}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                      <SourceBadge source={ev.source} />
                      {ev.confirmation_status === 'confirmed' && <span className="text-[10px] text-emerald-600 font-semibold">Confirmed</span>}
                      {ev.confirmation_status === 'unconfirmed' && <span className="text-[10px] text-yellow-600 font-semibold">Unconfirmed</span>}
                      {ev.rescheduled_count > 0 && <span className="text-[10px] text-amber-600 font-semibold">Rescheduled {ev.rescheduled_count}x</span>}
                    </div>
                  </div>
                  {(ev.status === 'scheduled' || ev.status === 'pending_confirmation') && (
                    <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                      {ev.confirmation_status !== 'confirmed' && (
                        <button onClick={() => { handleConfirm(ev.id); closePanel(); }} disabled={isLoading} className="flex-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50">Confirm</button>
                      )}
                      <button onClick={() => { handleMarkNoShow(ev.id); closePanel(); }} disabled={isLoading} className="flex-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50">No-Show</button>
                      <button onClick={() => { handleCancel(ev.id); closePanel(); }} disabled={isLoading} className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* CREATE MODE – Schedule new event */}
            {inlinePanel.mode === 'create' && (
              <>
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">New Event</h4>
                    <button onClick={closePanel} className="p-1 hover:bg-slate-100 rounded-lg -mr-1 -mt-1">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: `${panelMaxHeight - 130}px` }}>
                  {scheduleWarning && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="text-[11px] text-amber-700 font-medium leading-tight">{scheduleWarning}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                    <select
                      value={scheduleForm.event_type}
                      onChange={e => setScheduleForm(prev => ({ ...prev, event_type: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                    >
                      <option value="call">Call</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="meeting">Meeting</option>
                      <option value="appointment">Appointment</option>
                      <option value="callback">Callback</option>
                      <option value="no_show_retry">No-Show Retry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Contact</label>
                    <select
                      value={scheduleForm.contact_id}
                      onChange={e => setScheduleForm(prev => ({ ...prev, contact_id: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                    >
                      <option value="">Select a contact...</option>
                      {contacts.slice(0, 50).map(c => (
                        <option key={c.id} value={c.id}>{c.contact_name || 'Unknown'} - {c.phone_number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                      <input type="date" value={scheduleForm.date} onChange={e => setScheduleForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                      <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm(prev => ({ ...prev, time: e.target.value }))} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (min)</label>
                    <input type="number" value={scheduleForm.duration} onChange={e => setScheduleForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 15 }))} min={5} max={480} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none" />
                  </div>

                  {/* Video Call */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Video Call</label>
                    <div className="flex gap-1.5">
                      {[
                        { value: '', label: 'None', icon: null, disabled: false },
                        { value: 'google_meet', label: 'Meet', icon: <GoogleMeetIcon className="w-3.5 h-3.5" />, disabled: !googleIntegration?.connected },
                        { value: 'zoom', label: 'Zoom', icon: <BiLogoZoom className="w-3.5 h-3.5 text-[#2D8CFF]" />, disabled: !zoomConnected },
                        { value: 'microsoft_teams', label: 'Teams', icon: <TeamsIcon className="w-3.5 h-3.5" />, disabled: !microsoftIntegration?.connected },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => { if (!opt.disabled) setScheduleForm(prev => ({ ...prev, video_provider: opt.value })); }}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                            opt.disabled ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                              : scheduleForm.video_provider === opt.value ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)] shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {opt.icon}{opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                    <textarea rows={2} value={scheduleForm.notes} onChange={e => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Add notes..." className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none resize-none" />
                  </div>

                  {/* Sync toggles */}
                  <div className="flex items-center gap-3 text-xs">
                    {googleIntegration?.connected && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                        <input type="checkbox" checked={scheduleForm.sync_to_google} onChange={e => setScheduleForm(prev => ({ ...prev, sync_to_google: e.target.checked }))} className="w-3.5 h-3.5 rounded" />
                        <GoogleCalendarIcon className="w-3.5 h-3.5" /> Google
                      </label>
                    )}
                    {microsoftIntegration?.connected && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                        <input type="checkbox" checked={scheduleForm.sync_to_microsoft} onChange={e => setScheduleForm(prev => ({ ...prev, sync_to_microsoft: e.target.checked }))} className="w-3.5 h-3.5 rounded" />
                        <OutlookIcon className="w-3.5 h-3.5" /> Outlook
                      </label>
                    )}
                  </div>
                </div>
                <div className="p-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button onClick={closePanel} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" disabled={schedulingEvent}>Cancel</button>
                  <button onClick={handleScheduleSubmit} className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-600)] rounded-lg shadow-sm transition-colors disabled:opacity-50" disabled={schedulingEvent}>
                    {schedulingEvent ? 'Scheduling...' : 'Schedule'}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
