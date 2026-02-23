// components/calendar/CalendarPage.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiGooglecalendar, SiCalendly } from 'react-icons/si';
import type { CalendarEvent, CalendarIntegrationStatus } from '@/types/calendar';

// ============================================================================
// TYPES
// ============================================================================

interface CalendarPageProps {
  events: CalendarEvent[];
  integrations: CalendarIntegrationStatus[];
  companyId: string;
  contacts: {
    id: string;
    contact_name: string | null;
    phone_number: string;
    email: string | null;
  }[];
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';
type FilterType = 'all' | 'call' | 'follow_up' | 'no_show_retry' | 'meeting' | 'appointment' | 'callback';

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
  calendly: 'Calendly',
  ai_agent: 'AI Agent',
  follow_up_queue: 'Follow-up Queue',
  webhook: 'Webhook',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarPage({ events: initialEvents, integrations: initialIntegrations, companyId, contacts }: CalendarPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    event_type: 'call' as string,
    contact_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 15,
    notes: '',
    sync_to_google: true,
  });

  // Show toast if redirected from OAuth callback
  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');
    if (integration && status === 'connected') {
      showToast(`${integration === 'google_calendar' ? 'Google Calendar' : 'Calendly'} connected successfully!`, 'success');
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

  const handleConnectCalendly = useCallback(() => {
    window.location.href = '/api/integrations/calendly/connect?return_to=/calendar';
  }, []);

  const handleDisconnect = useCallback(async (provider: string) => {
    const endpoint = provider === 'google_calendar'
      ? '/api/integrations/google-calendar/disconnect'
      : '/api/integrations/calendly/disconnect';

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        showToast(`${provider === 'google_calendar' ? 'Google Calendar' : 'Calendly'} disconnected`, 'success');
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
        : '/api/integrations/calendly/sync';

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        showToast(`Synced ${data.created + data.updated} events from ${provider === 'google_calendar' ? 'Google Calendar' : 'Calendly'}`, 'success');
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
        }),
      });

      if (res.ok) {
        showToast('Event scheduled successfully', 'success');
        setShowScheduleModal(false);
        await refreshEvents();
      } else {
        showToast('Failed to schedule event', 'error');
      }
    } catch {
      showToast('Failed to schedule event', 'error');
    }
  }, [scheduleForm, contacts, refreshEvents, showToast]);

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
    const daysInMonth = getDaysInMonth(currentDate);
    const prevMonthDays = getDaysInMonth(new Date(year, month - 1));

    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredEvents.filter(e => {
          const eDate = new Date(e.start_time);
          return eDate.toDateString() === date.toDateString();
        }),
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        events: filteredEvents.filter(e => {
          const eDate = new Date(e.start_time);
          return eDate.toDateString() === date.toDateString();
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
          const eDate = new Date(e.start_time);
          return eDate.toDateString() === date.toDateString();
        }),
      });
    }

    return days;
  }, [currentDate, filteredEvents]);

  // Week view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days: { date: Date; events: CalendarEvent[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        events: filteredEvents.filter(e => {
          const eDate = new Date(e.start_time);
          return eDate.toDateString() === date.toDateString();
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
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const monthYearLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekLabel = viewMode === 'week' ? (() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })() : '';

  const googleIntegration = integrations.find(i => i.provider === 'google_calendar');
  const calendlyIntegration = integrations.find(i => i.provider === 'calendly');

  // ============================================================================
  // HELPER: Source badge
  // ============================================================================
  const SourceBadge = ({ source }: { source: string }) => {
    if (source === 'google_calendar') {
      return <span className="inline-flex items-center gap-1 text-[10px] text-[#4285F4] font-medium"><SiGooglecalendar className="w-3 h-3" /> Google</span>;
    }
    if (source === 'calendly') {
      return <span className="inline-flex items-center gap-1 text-[10px] text-[#006BFF] font-medium"><SiCalendly className="w-3 h-3" /> Calendly</span>;
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
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Google Calendar badge */}
              {googleIntegration?.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-emerald-200 rounded-lg">
                  <SiGooglecalendar className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
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
                  <SiGooglecalendar className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
                  <span className="whitespace-nowrap">Google Calendar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              {/* Calendly badge */}
              {calendlyIntegration?.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-emerald-200 rounded-lg">
                  <SiCalendly className="w-3.5 h-3.5 text-[#006BFF] shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Calendly</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <button
                    onClick={() => handleSync('calendly')}
                    disabled={syncing.calendly}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    title="Sync Calendly"
                  >
                    <svg className={`w-3 h-3 text-slate-400 ${syncing.calendly ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectCalendly}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all text-[11px] font-semibold text-slate-500"
                >
                  <SiCalendly className="w-3.5 h-3.5 text-[#006BFF] shrink-0" />
                  <span className="whitespace-nowrap">Calendly</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                </button>
              )}

              <button
                onClick={() => setShowScheduleModal(true)}
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
              {viewMode === 'week' ? weekLabel : viewMode === 'day' ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : monthYearLabel}
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
          </div>
        </div>

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
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
                          {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {(event.contact_name || event.title).split(' ')[0]}
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
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`text-center py-3 border-b border-l ${
                      isToday(day.date) ? 'bg-[var(--color-primary-50)]/40 border-b-[var(--color-primary)]/30' : 'border-slate-200'
                    } ${idx === 6 ? 'border-r border-slate-200' : ''}`}
                  >
                    <div className="text-xs text-slate-500 font-medium">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className={`text-lg font-bold ${isToday(day.date) ? 'text-[var(--color-primary)]' : 'text-slate-900'}`}>
                      {day.date.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="relative">
                {/* Current time indicator */}
                {(() => {
                  const todayIdx = weekDays.findIndex(d => isToday(d.date));
                  if (todayIdx === -1) return null;
                  const h = currentTime.getHours();
                  const m = currentTime.getMinutes();
                  if (h < 8 || h >= 20) return null;
                  const topPx = (h - 8 + m / 60) * 48;
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${topPx}px` }}>
                      <div className="grid grid-cols-[64px_repeat(7,1fr)]">
                        <div className="flex justify-end pr-1">
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded-full border border-red-200">
                            {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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

                {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                  <div key={hour} className="grid grid-cols-[64px_repeat(7,1fr)]">
                    <div className="w-16 text-right pr-2 text-[11px] text-slate-400 font-medium h-12 flex items-start pt-0 -mt-1.5">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const hourEvents = day.events.filter(e => new Date(e.start_time).getHours() === hour);
                      return (
                        <div
                          key={dayIdx}
                          className={`h-12 border-t border-l ${dayIdx === 6 ? 'border-r' : ''} ${
                            isToday(day.date) ? 'bg-[var(--color-primary-50)]/20 border-slate-200/80' : 'border-slate-100'
                          } relative`}
                        >
                          {hourEvents.map(event => {
                            const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                            const startMin = new Date(event.start_time).getMinutes();
                            const durationMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
                            const topOffset = (startMin / 60) * 48;
                            const height = Math.max((durationMin / 60) * 48, 18);
                            return (
                              <div
                                key={event.id}
                                className={`absolute left-0.5 right-0.5 ${style.bg} border ${style.text} rounded px-1 py-0.5 overflow-hidden cursor-pointer hover:shadow-sm transition-shadow z-10`}
                                style={{ top: `${topOffset}px`, height: `${height}px` }}
                                title={`${event.title}\n${new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${durationMin}min`}
                              >
                                <div className="text-[10px] font-semibold truncate leading-tight">{event.contact_name || event.title}</div>
                                {height >= 28 && (
                                  <div className="text-[9px] opacity-75 truncate">
                                    {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="p-4">
            <div className="relative">
              {/* Current time indicator */}
              {(() => {
                const isViewingToday = currentDate.toDateString() === currentTime.toDateString();
                if (!isViewingToday) return null;
                const currentHour = currentTime.getHours();
                const currentMinute = currentTime.getMinutes();
                if (currentHour < 8 || currentHour >= 20) return null;
                const hourOffset = currentHour - 8;
                const minuteOffset = currentMinute / 60;
                const topPosition = (hourOffset + minuteOffset) * 68;
                return (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${topPosition}px` }}>
                    <div className="w-16 shrink-0 flex justify-end pr-2">
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                        {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500 shadow-md shadow-red-200 shrink-0 -ml-1.5" />
                      <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 via-rose-400 to-transparent" />
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                  const hourEvents = filteredEvents.filter(e => {
                    const eDate = new Date(e.start_time);
                    return eDate.toDateString() === currentDate.toDateString() && eDate.getHours() === hour;
                  });

                  return (
                    <div key={hour} className="flex gap-4">
                      <div className="w-16 text-right text-xs text-slate-400 font-medium py-3 shrink-0">
                        {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                      </div>
                      <div className="flex-1 min-h-[60px] border-t border-slate-100 py-2">
                        {hourEvents.length > 0 ? (
                          <div className="space-y-2">
                            {hourEvents.map(event => {
                              const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.call;
                              const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.scheduled;
                              const durationMin = Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000);
                              const isLoading = actionLoading === event.id;
                              return (
                                <div key={event.id} className={`p-3 rounded-xl ${style.bg} border flex items-center justify-between group`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`}></div>
                                    <div className="min-w-0">
                                      <div className={`text-sm font-semibold ${style.text} truncate`}>{event.title}</div>
                                      <div className="text-xs text-slate-500">
                                        {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {durationMin}min
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
                        ) : (
                          <div className="h-full"></div>
                        )}
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
                        {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
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
                              {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Schedule Event</h3>
                <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
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
              {googleIntegration?.connected && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.sync_to_google}
                      onChange={e => setScheduleForm(prev => ({ ...prev, sync_to_google: e.target.checked }))}
                      className="w-4 h-4 rounded text-[var(--color-primary)]"
                    />
                    <SiGooglecalendar className="w-4 h-4 text-[#4285F4]" />
                    Sync to Google Calendar
                  </label>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleScheduleSubmit} className="btn-primary">Schedule Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
