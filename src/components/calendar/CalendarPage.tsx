// components/calendar/CalendarPage.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CalendarEvent, CalendarIntegrationStatus } from '@/types/calendar';
import { GoogleCalendarLogo, MicrosoftLogo, GoogleMeetLogo, MicrosoftTeamsLogo, ZoomLogo } from '@/components/icons/IntegrationIcons';

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
  const getMinuteInTz = (date: Date): number => {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, minute: 'numeric' }).format(date), 10);
  };
  const getDateStringInTz = (date: Date): string => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date); // returns YYYY-MM-DD
  };

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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsForm, setSettingsForm] = useState<CalendarSettings>({ ...calSettings });
  const [savingSettings, setSavingSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag-to-create state
  const [dragCreate, setDragCreate] = useState<{
    active: boolean;
    dayIndex: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    date: Date;
  } | null>(null);

  // Drag-to-move state
  const [dragMove, setDragMove] = useState<{
    active: boolean;
    eventId: string;
    event: CalendarEvent;
    offsetMinutes: number;
    currentDayIndex: number;
    currentHour: number;
    currentMinute: number;
  } | null>(null);

  // Drag-to-resize state
  const [dragResize, setDragResize] = useState<{
    active: boolean;
    eventId: string;
    event: CalendarEvent;
    endHour: number;
    endMinute: number;
  } | null>(null);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    event_type: 'call' as string,
    contact_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 15,
    notes: '',
    sync_to_google: true,
    sync_to_microsoft: false,
    video_provider: '' as string,
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
    const contact = contacts.find(c => c.id === scheduleForm.contact_id);
    const startTime = new Date(`${scheduleForm.date}T${scheduleForm.time}:00`);
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
        setShowScheduleModal(false);
        setScheduleWarning(null);
        await refreshEvents();
      } else {
        showToast('Failed to schedule event', 'error');
      }
    } catch {
      showToast('Failed to schedule event', 'error');
    }
  }, [scheduleForm, contacts, refreshEvents, showToast]);

  // Snap to 30-minute intervals
  const snapTo30 = (minute: number): number => minute < 15 ? 0 : minute < 45 ? 30 : 60;

  // Get time from mouse position on grid (48px per hour in week view)
  const getTimeFromMouseY = useCallback((y: number, cellHeight: number): { hour: number; minute: number } => {
    const totalMinutes = Math.max(0, Math.min(1439, (y / cellHeight) * 60));
    const hour = Math.floor(totalMinutes / 60);
    const minute = snapTo30(totalMinutes % 60);
    return { hour: Math.min(23, hour + (minute === 60 ? 1 : 0)), minute: minute === 60 ? 0 : minute };
  }, []);

  // Handle drag-to-create start (mousedown on empty slot)
  const handleDragCreateStart = useCallback((e: React.MouseEvent, dayIndex: number, date: Date, hour: number, cellHeight: number) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const minuteInCell = snapTo30(Math.floor((relY / cellHeight) * 60));
    const startMinute = minuteInCell === 60 ? 0 : minuteInCell;
    const startHour = minuteInCell === 60 ? hour + 1 : hour;
    const endMinute = startMinute + 30 >= 60 ? (startMinute + 30 - 60) : (startMinute + 30);
    const endHour = startMinute + 30 >= 60 ? startHour + 1 : startHour;
    setDragCreate({
      active: true,
      dayIndex,
      startHour: Math.min(23, startHour),
      startMinute,
      endHour: Math.min(24, endHour),
      endMinute: endHour >= 24 ? 0 : endMinute,
      date,
    });
  }, []);

  // Handle drag-to-create move
  const handleDragCreateMove = useCallback((e: React.MouseEvent) => {
    if (!dragCreate?.active || !gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relY = e.clientY - gridRect.top;
    const cellHeight = viewMode === 'week' ? 48 : 52;
    const { hour, minute } = getTimeFromMouseY(relY, cellHeight);
    if (hour > dragCreate.startHour || (hour === dragCreate.startHour && minute > dragCreate.startMinute)) {
      setDragCreate(prev => prev ? { ...prev, endHour: Math.min(24, hour), endMinute: hour >= 24 ? 0 : minute } : null);
    }
  }, [dragCreate, viewMode, getTimeFromMouseY]);

  // Handle drag-to-create end
  const handleDragCreateEnd = useCallback(() => {
    if (!dragCreate?.active) return;
    const { date, startHour, startMinute, endHour, endMinute } = dragCreate;
    setDragCreate(null);
    const totalMinutes = (endHour - startHour) * 60 + (endMinute - startMinute);
    if (totalMinutes < 15) return; // Ignore tiny drags
    const dayName = ALL_DAYS[date.getDay()];
    const working = isWorkingHour(startHour) && calSettings.working_days.includes(dayName);
    const warning = working ? null : 'This time slot is outside your working hours. Callengo agents will not operate during this time.';
    setScheduleWarning(warning);
    setScheduleForm(prev => ({
      ...prev,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
      duration: totalMinutes,
    }));
    setShowScheduleModal(true);
  }, [dragCreate, calSettings.working_days, isWorkingHour]);

  // Handle event drag-to-move start
  const handleEventDragStart = useCallback((e: React.MouseEvent, event: CalendarEvent, dayIndex: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const eventStartHour = getHourInTz(new Date(event.start_time));
    const eventStartMin = getMinuteInTz(new Date(event.start_time));
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const cellHeight = viewMode === 'week' ? 48 : 52;
    const offsetMinutes = Math.floor((relY / rect.height) * ((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000));
    setDragMove({
      active: true,
      eventId: event.id,
      event,
      offsetMinutes,
      currentDayIndex: dayIndex,
      currentHour: eventStartHour,
      currentMinute: eventStartMin,
    });
  }, [viewMode, getHourInTz, getMinuteInTz]);

  // Handle event drag-to-move
  const handleEventDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragMove?.active || !gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relY = e.clientY - gridRect.top;
    const cellHeight = viewMode === 'week' ? 48 : 52;
    const { hour, minute } = getTimeFromMouseY(relY - (dragMove.offsetMinutes / 60) * cellHeight, cellHeight);
    // Detect day column
    if (viewMode === 'week') {
      const gridWidth = gridRect.width - 64; // subtract time label width
      const relX = e.clientX - gridRect.left - 64;
      const colWidth = gridWidth / 7;
      const newDayIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)));
      setDragMove(prev => prev ? { ...prev, currentHour: hour, currentMinute: minute, currentDayIndex: newDayIndex } : null);
    } else {
      setDragMove(prev => prev ? { ...prev, currentHour: hour, currentMinute: minute } : null);
    }
  }, [dragMove, viewMode, getTimeFromMouseY]);

  // Handle event drag-to-move end
  const handleEventDragEnd = useCallback(async () => {
    if (!dragMove?.active) return;
    const { event, currentHour, currentMinute, currentDayIndex } = dragMove;
    setDragMove(null);
    const duration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
    let newDate: Date;
    if (viewMode === 'week') {
      newDate = new Date(weekDays[currentDayIndex]?.date || new Date());
    } else {
      newDate = new Date(currentDate);
    }
    const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    const newStart = new Date(`${dateStr}T${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`);
    const newEnd = new Date(newStart.getTime() + duration);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          action: 'update',
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        }),
      });
      if (res.ok) {
        showToast('Event moved', 'success');
        await refreshEvents();
      } else {
        showToast('Failed to move event', 'error');
      }
    } catch {
      showToast('Failed to move event', 'error');
    }
  }, [dragMove, viewMode, weekDays, currentDate, refreshEvents, showToast]);

  // Handle event drag-to-resize start
  const handleEventResizeStart = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const endHour = getHourInTz(new Date(event.end_time));
    const endMinute = getMinuteInTz(new Date(event.end_time));
    setDragResize({
      active: true,
      eventId: event.id,
      event,
      endHour,
      endMinute,
    });
  }, [getHourInTz, getMinuteInTz]);

  // Handle event drag-to-resize move
  const handleEventResizeMove = useCallback((e: React.MouseEvent) => {
    if (!dragResize?.active || !gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relY = e.clientY - gridRect.top;
    const cellHeight = viewMode === 'week' ? 48 : 52;
    const { hour, minute } = getTimeFromMouseY(relY, cellHeight);
    const startHour = getHourInTz(new Date(dragResize.event.start_time));
    const startMinute = getMinuteInTz(new Date(dragResize.event.start_time));
    if (hour > startHour || (hour === startHour && minute > startMinute + 15)) {
      setDragResize(prev => prev ? { ...prev, endHour: hour, endMinute: minute } : null);
    }
  }, [dragResize, viewMode, getTimeFromMouseY, getHourInTz, getMinuteInTz]);

  // Handle event drag-to-resize end
  const handleEventResizeEnd = useCallback(async () => {
    if (!dragResize?.active) return;
    const { event, endHour, endMinute } = dragResize;
    setDragResize(null);
    const startDate = new Date(event.start_time);
    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const newEnd = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          action: 'update',
          end_time: newEnd.toISOString(),
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
  }, [dragResize, refreshEvents, showToast]);

  // Global mouse up handler to end any drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragCreate?.active) handleDragCreateEnd();
      if (dragMove?.active) handleEventDragEnd();
      if (dragResize?.active) handleEventResizeEnd();
    };
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragCreate?.active || dragMove?.active || dragResize?.active) {
        e.preventDefault();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [dragCreate, dragMove, dragResize, handleDragCreateEnd, handleEventDragEnd, handleEventResizeEnd]);

  // Open schedule modal pre-filled from a time slot click
  const openScheduleFromSlot = useCallback((date: Date, hour: number) => {
    const dayName = ALL_DAYS[date.getDay()];
    const working = isWorkingHour(hour) && calSettings.working_days.includes(dayName);
    const warning = working ? null : 'This time slot is outside your working hours. Callengo agents will not operate during this time.';
    setScheduleWarning(warning);
    setScheduleForm(prev => ({
      ...prev,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(hour).padStart(2, '0')}:00`,
    }));
    setShowScheduleModal(true);
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
      const dateStr = getDateStringInTz(date);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => getDateStringInTz(new Date(e.start_time)) === dateStr),
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = getDateStringInTz(date);
      days.push({
        date,
        isCurrentMonth: true,
        events: filteredEvents.filter(e => getDateStringInTz(new Date(e.start_time)) === dateStr),
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = getDateStringInTz(date);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => getDateStringInTz(new Date(e.start_time)) === dateStr),
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
      const dateStr = getDateStringInTz(date);
      days.push({
        date,
        events: filteredEvents.filter(e => {
          const eDate = new Date(e.start_time);
          return getDateStringInTz(eDate) === dateStr;
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      });
    }
    return days;
  }, [currentDate, filteredEvents]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    const todayEvents = events.filter(e => new Date(e.start_time).toDateString() === todayStr && e.status !== 'cancelled');
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

  const goToToday = () => setCurrentDate(new Date());
  const isToday = (date: Date) => getDateStringInTz(date) === getDateStringInTz(new Date());

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
      return <span className="inline-flex items-center gap-1 text-[10px] text-[#4285F4] font-medium"><GoogleCalendarLogo className="w-3 h-3" /> Google</span>;
    }
    if (source === 'microsoft_outlook') {
      return <span className="inline-flex items-center gap-1 text-[10px] text-[#0078D4] font-medium"><MicrosoftLogo className="w-3 h-3" /> Outlook</span>;
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
                  <GoogleCalendarLogo className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Google Calendar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <button
                    onClick={() => handleSync('google_calendar')}
                    disabled={syncing.google_calendar}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    title="Sync Google Calendar"
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
                  <GoogleCalendarLogo className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Google Calendar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              {/* Microsoft Outlook badge */}
              {microsoftIntegration?.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-emerald-200 rounded-lg">
                  <MicrosoftLogo className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Outlook</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <button
                    onClick={() => handleSync('microsoft_outlook')}
                    disabled={syncing.microsoft_outlook}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    title="Sync Microsoft Outlook"
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
                  <MicrosoftLogo className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Outlook</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              <button
                onClick={() => { setScheduleWarning(null); setShowScheduleModal(true); }}
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
                title="Calendar Settings"
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
                      <div className="flex flex-wrap gap-1.5">
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
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  onClick={() => { setCurrentDate(day.date); setViewMode('day'); }}
                  className={`min-h-[100px] p-1.5 border-r border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                  } ${isToday(day.date) ? 'bg-blue-50/50' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday(day.date) ? 'gradient-bg text-white' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {day.events.slice(0, 3).map(event => {
                      const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                      return (
                        <div key={event.id} className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} truncate border font-medium`}>
                          {formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })} {(event.contact_name || event.title).split(' ')[0]}
                        </div>
                      );
                    })}
                    {day.events.length > 3 && (
                      <div className="text-[10px] text-slate-500 font-medium px-1.5">+{day.events.length - 3} more</div>
                    )}
                  </div>
                </div>
              ))}
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
                  return (
                    <div
                      key={idx}
                      className={`text-center py-3 border-b border-l ${
                        isToday(day.date) ? 'bg-[var(--color-primary-50)]/40 border-b-[var(--color-primary)]/30' : 'border-slate-200'
                      } ${!dayWorking ? 'bg-slate-100/60' : ''} ${idx === 6 ? 'border-r border-slate-200' : ''}`}
                    >
                      <div className={`text-xs font-medium ${!dayWorking ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(day.date, { weekday: 'short' })}</div>
                      <div className={`text-lg font-bold ${isToday(day.date) ? 'text-[var(--color-primary)]' : !dayWorking ? 'text-slate-400' : 'text-slate-900'}`}>
                        {day.date.getDate()}
                      </div>
                      {!dayWorking && <div className="text-[9px] text-slate-400 font-medium">Off</div>}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div
                className="relative"
                ref={gridRef}
                onMouseMove={(e) => { handleDragCreateMove(e); handleEventDragMove(e); handleEventResizeMove(e); }}
                style={{ userSelect: (dragCreate?.active || dragMove?.active || dragResize?.active) ? 'none' : undefined, cursor: dragCreate?.active ? 'row-resize' : dragMove?.active ? 'grabbing' : undefined }}
              >
                {/* Current time indicator */}
                {(() => {
                  const todayIdx = weekDays.findIndex(d => isToday(d.date));
                  if (todayIdx === -1) return null;
                  const h = getHourInTz(currentTime);
                  const m = getMinuteInTz(currentTime);
                  const topPx = (h + m / 60) * 48;
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${topPx}px` }}>
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

                {Array.from({ length: 24 }, (_, i) => i).map(hour => {
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
                      const hourEvents = day.events.filter(e => getHourInTz(new Date(e.start_time)) === hour);
                      const dayWorking = isWorkingDay(day.date);
                      const slotWorking = working && dayWorking;
                      const isEmpty = hourEvents.length === 0;
                      return (
                        <div
                          key={dayIdx}
                          onMouseDown={(e) => { if (isEmpty) handleDragCreateStart(e, dayIdx, day.date, hour, 48); }}
                          onClick={() => { if (isEmpty && !dragCreate) openScheduleFromSlot(day.date, hour); }}
                          className={`h-12 border-t border-l ${dayIdx === 6 ? 'border-r' : ''} ${
                            slotWorking
                              ? isToday(day.date) ? 'bg-[var(--color-primary-50)]/20 border-slate-200' : 'bg-white border-slate-200'
                              : !dayWorking
                                ? 'border-slate-100'
                                : isToday(day.date) ? 'bg-slate-50/80 border-slate-100' : 'bg-slate-50/60 border-slate-100'
                          } ${isFirstWork || isLastWork ? 'border-t-[var(--color-primary)]/20' : ''} relative ${
                            isEmpty ? 'cursor-crosshair hover:bg-blue-50/40 transition-colors' : ''
                          }`}
                          style={!dayWorking ? { backgroundImage: 'url(#non-working-day-pattern)', backgroundColor: 'rgba(241,245,249,0.6)' } : undefined}
                        >
                          {/* Non-working day overlay with diagonal stripes */}
                          {!dayWorking && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                              <rect width="100%" height="100%" fill="url(#non-working-day-pattern)" />
                            </svg>
                          )}
                          {/* Drag-to-create overlay for this cell */}
                          {dragCreate?.active && dragCreate.dayIndex === dayIdx && (() => {
                            const cellStartMin = hour * 60;
                            const selStartMin = dragCreate.startHour * 60 + dragCreate.startMinute;
                            const selEndMin = dragCreate.endHour * 60 + dragCreate.endMinute;
                            if (selEndMin <= cellStartMin || selStartMin >= cellStartMin + 60) return null;
                            const topMin = Math.max(0, selStartMin - cellStartMin);
                            const botMin = Math.min(60, selEndMin - cellStartMin);
                            return (
                              <div
                                className="absolute left-0.5 right-0.5 bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/50 rounded z-30 pointer-events-none"
                                style={{ top: `${(topMin / 60) * 48}px`, height: `${((botMin - topMin) / 60) * 48}px` }}
                              >
                                <div className="text-[9px] font-bold text-[var(--color-primary)] px-1 pt-0.5 truncate">
                                  {String(dragCreate.startHour).padStart(2, '0')}:{String(dragCreate.startMinute).padStart(2, '0')} - {String(dragCreate.endHour).padStart(2, '0')}:{String(dragCreate.endMinute).padStart(2, '0')}
                                </div>
                              </div>
                            );
                          })()}
                          {hourEvents.map(event => {
                            const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                            const startMin = getMinuteInTz(new Date(event.start_time));
                            const durationMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
                            const isBeingMoved = dragMove?.active && dragMove.eventId === event.id;
                            const isBeingResized = dragResize?.active && dragResize.eventId === event.id;
                            let topOffset = (startMin / 60) * 48;
                            let height = Math.max((durationMin / 60) * 48, 18);
                            if (isBeingResized) {
                              const newDurationMin = (dragResize.endHour - getHourInTz(new Date(event.start_time))) * 60 + (dragResize.endMinute - getMinuteInTz(new Date(event.start_time)));
                              height = Math.max((newDurationMin / 60) * 48, 18);
                            }
                            if (isBeingMoved) return null; // Hide from original position when being moved
                            return (
                              <div
                                key={event.id}
                                className={`absolute left-0.5 right-0.5 ${style.bg} border ${style.text} rounded px-1 py-0.5 overflow-hidden cursor-grab hover:shadow-md transition-shadow z-10 group/event ${isBeingResized ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
                                style={{ top: `${topOffset}px`, height: `${height}px` }}
                                title={`${event.title}\n${formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })} - ${durationMin}min\nDrag to move, drag bottom to resize`}
                                onMouseDown={(e) => handleEventDragStart(e, event, dayIdx)}
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="text-[10px] font-semibold truncate leading-tight">{event.contact_name || event.title}</div>
                                {height >= 28 && (
                                  <div className="text-[9px] opacity-75 truncate">
                                    {formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })}
                                  </div>
                                )}
                                {/* Resize handle */}
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize opacity-0 group-hover/event:opacity-100 bg-gradient-to-t from-current/20 to-transparent rounded-b"
                                  onMouseDown={(e) => { e.stopPropagation(); handleEventResizeStart(e, event); }}
                                />
                              </div>
                            );
                          })}
                          {/* Ghost of event being moved into this cell */}
                          {dragMove?.active && dragMove.currentDayIndex === dayIdx && (() => {
                            const ghostStartMin = dragMove.currentHour * 60 + dragMove.currentMinute;
                            const cellStartMin = hour * 60;
                            const durationMin = Math.round((new Date(dragMove.event.end_time).getTime() - new Date(dragMove.event.start_time).getTime()) / 60000);
                            const ghostEndMin = ghostStartMin + durationMin;
                            if (ghostEndMin <= cellStartMin || ghostStartMin >= cellStartMin + 60) return null;
                            const topMin = Math.max(0, ghostStartMin - cellStartMin);
                            const botMin = Math.min(60, ghostEndMin - cellStartMin);
                            const style = EVENT_TYPE_STYLES[dragMove.event.event_type] || EVENT_TYPE_STYLES.call;
                            return (
                              <div
                                className={`absolute left-0.5 right-0.5 ${style.bg} border-2 border-dashed ${style.text} rounded px-1 py-0.5 opacity-70 z-20 pointer-events-none`}
                                style={{ top: `${(topMin / 60) * 48}px`, height: `${((botMin - topMin) / 60) * 48}px` }}
                              >
                                <div className="text-[10px] font-semibold truncate leading-tight">{dragMove.event.contact_name || dragMove.event.title}</div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
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

            {/* Working hours legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-white border border-slate-200" />
                <span>Working hours ({calSettings.working_hours_start} - {calSettings.working_hours_end})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-50 border border-slate-100" />
                <span>Off hours</span>
              </div>
            </div>

            <div className="relative" onMouseMove={(e) => { handleDragCreateMove(e); handleEventDragMove(e); handleEventResizeMove(e); }} style={{ userSelect: (dragCreate?.active || dragMove?.active || dragResize?.active) ? 'none' : undefined }}>
              {/* Current time indicator */}
              {(() => {
                const isViewingToday = getDateStringInTz(currentDate) === getDateStringInTz(currentTime);
                if (!isViewingToday) return null;
                const currentHour = getHourInTz(currentTime);
                const currentMinute = getMinuteInTz(currentTime);
                const topPosition = (currentHour + currentMinute / 60) * 52;
                return (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${topPosition}px` }}>
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
                {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                  const hourEvents = filteredEvents.filter(e => {
                    const eDate = new Date(e.start_time);
                    return getDateStringInTz(eDate) === getDateStringInTz(currentDate) && getHourInTz(eDate) === hour;
                  });
                  const working = isWorkingHour(hour);
                  const dayWorking = isWorkingDay(currentDate);
                  const slotWorking = working && dayWorking;
                  const isFirstWork = hour === workStart;
                  const isLastWork = hour === workEnd;
                  const isEmpty = hourEvents.length === 0;

                  return (
                    <div key={hour} className="flex">
                      <div className={`w-16 text-right text-[11px] font-medium pr-3 shrink-0 h-[52px] flex items-start -mt-1.5 ${
                        working ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                      </div>
                      <div
                        onMouseDown={(e) => { if (isEmpty) handleDragCreateStart(e, 0, currentDate, hour, 52); }}
                        onClick={() => { if (isEmpty && !dragCreate) openScheduleFromSlot(currentDate, hour); }}
                        className={`flex-1 min-h-[52px] border-t relative ${
                          slotWorking ? 'bg-white border-slate-200' : !dayWorking ? 'border-slate-100' : 'bg-slate-50/60 border-slate-100'
                        } ${isFirstWork ? 'border-t-[var(--color-primary)]/30 border-t-2' : ''} ${isLastWork ? 'border-t-[var(--color-primary)]/30 border-t-2' : ''} ${
                          isEmpty ? 'cursor-crosshair hover:bg-blue-50/40 transition-colors' : ''
                        }`}
                        style={!dayWorking ? { backgroundColor: 'rgba(241,245,249,0.6)' } : undefined}
                      >
                        {/* Non-working day stripe overlay */}
                        {!dayWorking && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                            <rect width="100%" height="100%" fill="url(#non-working-day-pattern)" />
                          </svg>
                        )}
                        {/* Drag-to-create overlay for day view */}
                        {dragCreate?.active && dragCreate.dayIndex === 0 && (() => {
                          const cellStartMin = hour * 60;
                          const selStartMin = dragCreate.startHour * 60 + dragCreate.startMinute;
                          const selEndMin = dragCreate.endHour * 60 + dragCreate.endMinute;
                          if (selEndMin <= cellStartMin || selStartMin >= cellStartMin + 60) return null;
                          const topMin = Math.max(0, selStartMin - cellStartMin);
                          const botMin = Math.min(60, selEndMin - cellStartMin);
                          return (
                            <div
                              className="absolute left-0.5 right-0.5 bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/50 rounded z-30 pointer-events-none"
                              style={{ top: `${(topMin / 60) * 52}px`, height: `${((botMin - topMin) / 60) * 52}px` }}
                            >
                              <div className="text-[9px] font-bold text-[var(--color-primary)] px-1 pt-0.5 truncate">
                                {String(dragCreate.startHour).padStart(2, '0')}:{String(dragCreate.startMinute).padStart(2, '0')} - {String(dragCreate.endHour).padStart(2, '0')}:{String(dragCreate.endMinute).padStart(2, '0')}
                              </div>
                            </div>
                          );
                        })()}
                        {hourEvents.map(event => {
                          const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                          const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.scheduled;
                          const durationMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
                          const isLoading = actionLoading === event.id;
                          const isBeingMoved = dragMove?.active && dragMove.eventId === event.id;
                          if (isBeingMoved) return null;
                          return (
                            <div
                              key={event.id}
                              className={`p-3 rounded-xl ${style.bg} border flex items-center justify-between group my-1 mx-1 cursor-grab group/event`}
                              onMouseDown={(e) => handleEventDragStart(e, event, 0)}
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`}></div>
                                <div className="min-w-0">
                                  <div className={`text-sm font-semibold ${style.text} truncate`}>{event.title}</div>
                                  <div className="text-xs text-slate-500">
                                    {formatTime(event.start_time, { hour: 'numeric', minute: '2-digit' })} - {durationMin}min
                                    {event.contact_phone && <span className="ml-2">{event.contact_phone}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <SourceBadge source={event.source} />
                                    {event.confirmation_status === 'confirmed' && (
                                      <span className="text-[10px] text-emerald-600 font-medium">Confirmed</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {(event.status === 'scheduled' || event.status === 'pending_confirmation') && !isLoading && (
                                  <>
                                    {event.confirmation_status !== 'confirmed' && (
                                      <button
                                        onClick={() => handleConfirm(event.id)}
                                        className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                      >
                                        Confirm
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleMarkNoShow(event.id)}
                                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      No-Show
                                    </button>
                                    <button
                                      onClick={() => handleCancel(event.id)}
                                      className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {isLoading && (
                                  <svg className="animate-spin w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.text}`}>
                                  {event.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
                  const dateKey = new Date(e.start_time).toDateString();
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
                        new Date(dateStr).toDateString() === new Date().toDateString()
                          ? 'gradient-bg text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {formatDate(new Date(dateStr), { weekday: 'short', month: 'short', day: 'numeric' })}
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
                          <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
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


      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowScheduleModal(false); setScheduleWarning(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Schedule Event</h3>
                <button onClick={() => { setShowScheduleModal(false); setScheduleWarning(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Warning for off-hours scheduling */}
              {scheduleWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs text-amber-700 font-medium">{scheduleWarning}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Type</label>
                <select
                  value={scheduleForm.event_type}
                  onChange={e => setScheduleForm(prev => ({ ...prev, event_type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
                <select
                  value={scheduleForm.contact_id}
                  onChange={e => setScheduleForm(prev => ({ ...prev, contact_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                >
                  <option value="">Select a contact...</option>
                  {contacts.slice(0, 50).map(c => (
                    <option key={c.id} value={c.id}>{c.contact_name || 'Unknown'} - {c.phone_number}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  value={scheduleForm.duration}
                  onChange={e => setScheduleForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 15 }))}
                  min={5}
                  max={120}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                />
              </div>

              {/* Video Call Provider */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Video Call (optional)</label>
                <div className="flex gap-2">
                  {[
                    { value: '', label: 'None', icon: null, disabled: false },
                    { value: 'google_meet', label: 'Meet', icon: <GoogleMeetLogo className="w-4 h-4" />, disabled: !googleIntegration?.connected },
                    { value: 'zoom', label: 'Zoom', icon: <ZoomLogo className="w-4 h-4" />, disabled: !initialZoomConnected },
                    { value: 'microsoft_teams', label: 'Teams', icon: <MicrosoftTeamsLogo className="w-4 h-4" />, disabled: !microsoftIntegration?.connected },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => { if (!opt.disabled) setScheduleForm(prev => ({ ...prev, video_provider: opt.value })); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        opt.disabled
                          ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                          : scheduleForm.video_provider === opt.value
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)] shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      title={opt.disabled ? `Connect ${opt.label} integration first` : ''}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes about this event..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none resize-none"
                />
              </div>

              {/* Sync options */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                {googleIntegration?.connected && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.sync_to_google}
                      onChange={e => setScheduleForm(prev => ({ ...prev, sync_to_google: e.target.checked }))}
                      className="w-4 h-4 rounded text-[var(--color-primary)]"
                    />
                    <GoogleCalendarLogo className="w-4 h-4" />
                    Sync to Google Calendar
                  </label>
                )}
                {microsoftIntegration?.connected && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.sync_to_microsoft}
                      onChange={e => setScheduleForm(prev => ({ ...prev, sync_to_microsoft: e.target.checked }))}
                      className="w-4 h-4 rounded text-[var(--color-primary)]"
                    />
                    <MicrosoftLogo className="w-4 h-4" />
                    Sync to Microsoft Outlook
                  </label>
                )}
                {!googleIntegration?.connected && !microsoftIntegration?.connected && (
                  <p className="text-xs text-slate-400">Connect a calendar integration to sync events automatically.</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => { setShowScheduleModal(false); setScheduleWarning(null); }} className="btn-secondary">Cancel</button>
              <button onClick={handleScheduleSubmit} className="btn-primary">Schedule Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
