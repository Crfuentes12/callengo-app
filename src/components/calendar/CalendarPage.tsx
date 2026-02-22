// components/calendar/CalendarPage.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SiGooglecalendar, SiCalendly } from 'react-icons/si';

interface Appointment {
  id: string;
  title: string;
  contact_name: string;
  contact_phone: string;
  scheduled_at: string;
  duration_minutes: number;
  type: 'call' | 'follow_up' | 'no_show_retry' | 'meeting';
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
  agent_name?: string;
  notes?: string;
  source: 'manual' | 'campaign' | 'google_calendar' | 'calendly';
}

interface CalendarIntegration {
  provider: 'google_calendar' | 'calendly';
  connected: boolean;
  email?: string;
  last_synced?: string;
}

interface CallLog {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  completed: boolean;
  created_at: string;
  call_length: number | null;
  agent_template_id: string | null;
}

interface Contact {
  id: string;
  contact_name: string | null;
  phone_number: string;
  email: string | null;
  status: string;
  company_id: string;
}

interface CalendarPageProps {
  callLogs: CallLog[];
  contacts: Contact[];
  companyId: string;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

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

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  call: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  follow_up: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  no_show_retry: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  meeting: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  no_show: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  cancelled: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500' },
  rescheduled: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
};

export default function CalendarPage({ callLogs, contacts, companyId }: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showIntegrationPanel, setShowIntegrationPanel] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'call' | 'follow_up' | 'no_show_retry' | 'meeting'>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Calendar integrations state
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([
    { provider: 'google_calendar', connected: false },
    { provider: 'calendly', connected: false },
  ]);

  // Build appointments from call logs (simulated - in production, you'd have an appointments table)
  const appointments = useMemo((): Appointment[] => {
    const items: Appointment[] = [];

    // Convert follow-up calls to scheduled events
    callLogs.forEach(log => {
      if (log.status === 'no_answer' || log.status === 'voicemail') {
        const scheduledDate = new Date(log.created_at);
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        scheduledDate.setHours(10, 0, 0, 0);

        const contact = contacts.find(c => c.phone_number === log.contact_phone);
        items.push({
          id: `retry-${log.id}`,
          title: `No-Show Retry: ${contact ? (contact.contact_name || 'Unknown') : log.contact_phone}`,
          contact_name: contact ? (contact.contact_name || 'Unknown') : 'Unknown',
          contact_phone: log.contact_phone,
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: 5,
          type: 'no_show_retry',
          status: scheduledDate < new Date() ? 'completed' : 'scheduled',
          notes: 'Auto-scheduled retry for no-show',
          source: 'campaign',
        });
      }

      // Add completed calls
      if (log.completed) {
        const contact = contacts.find(c => c.phone_number === log.contact_phone);
        items.push({
          id: `call-${log.id}`,
          title: `Call: ${contact ? (contact.contact_name || 'Unknown') : log.contact_phone}`,
          contact_name: contact ? (contact.contact_name || 'Unknown') : 'Unknown',
          contact_phone: log.contact_phone,
          scheduled_at: log.created_at,
          duration_minutes: Math.round((log.call_length || 0) / 60),
          type: 'call',
          status: log.status === 'completed' ? 'completed' : 'no_show',
          source: 'campaign',
        });
      }
    });

    // Add some follow-ups based on contacts that need callbacks
    contacts
      .filter(c => c.status === 'For Callback' || c.status === 'No Answer')
      .slice(0, 10)
      .forEach((contact, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        date.setHours(9 + (i % 8), (i % 4) * 15, 0, 0);
        items.push({
          id: `followup-${contact.id}`,
          title: `Follow-up: ${contact.contact_name || 'Unknown'}`,
          contact_name: (contact.contact_name || 'Unknown'),
          contact_phone: contact.phone_number,
          scheduled_at: date.toISOString(),
          duration_minutes: 10,
          type: 'follow_up',
          status: 'scheduled',
          source: 'campaign',
        });
      });

    return items;
  }, [callLogs, contacts]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    if (filterType === 'all') return appointments;
    return appointments.filter(a => a.type === filterType);
  }, [appointments, filterType]);

  // Calendar grid helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean; events: Appointment[] }[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const prevMonthDays = getDaysInMonth(new Date(year, month - 1));

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredAppointments.filter(a => {
          const aDate = new Date(a.scheduled_at);
          return aDate.toDateString() === date.toDateString();
        }),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        events: filteredAppointments.filter(a => {
          const aDate = new Date(a.scheduled_at);
          return aDate.toDateString() === date.toDateString();
        }),
      });
    }

    // Next month days to fill grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        events: filteredAppointments.filter(a => {
          const aDate = new Date(a.scheduled_at);
          return aDate.toDateString() === date.toDateString();
        }),
      });
    }

    return days;
  }, [currentDate, filteredAppointments]);

  // Week view data
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days: { date: Date; events: Appointment[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        events: filteredAppointments.filter(a => {
          const aDate = new Date(a.scheduled_at);
          return aDate.toDateString() === date.toDateString();
        }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
      });
    }
    return days;
  }, [currentDate, filteredAppointments]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    const todayEvents = appointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);
    const scheduled = appointments.filter(a => a.status === 'scheduled');
    const noShows = appointments.filter(a => a.type === 'no_show_retry' && a.status === 'scheduled');
    const upcoming = appointments.filter(a => new Date(a.scheduled_at) > today && a.status === 'scheduled');

    return {
      todayCount: todayEvents.length,
      scheduledCount: scheduled.length,
      noShowRetries: noShows.length,
      upcomingCount: upcoming.length,
    };
  }, [appointments]);

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

  const handleConnectGoogle = () => {
    // In production: redirect to Google OAuth flow
    // window.location.href = '/api/integrations/google-calendar/connect';
    setIntegrations(prev => prev.map(i =>
      i.provider === 'google_calendar'
        ? { ...i, connected: true, email: 'user@gmail.com', last_synced: new Date().toISOString() }
        : i
    ));
  };

  const handleConnectCalendly = () => {
    // In production: redirect to Calendly OAuth flow
    // window.location.href = '/api/integrations/calendly/connect';
    setIntegrations(prev => prev.map(i =>
      i.provider === 'calendly'
        ? { ...i, connected: true, email: 'user@calendly.com', last_synced: new Date().toISOString() }
        : i
    ));
  };

  const handleDisconnect = (provider: string) => {
    setIntegrations(prev => prev.map(i =>
      i.provider === provider ? { ...i, connected: false, email: undefined, last_synced: undefined } : i
    ));
  };

  const handleMarkNoShow = (appointmentId: string) => {
    // In production: update appointment status in DB
    console.log('Marking as no-show:', appointmentId);
  };

  const handleReschedule = (appointmentId: string) => {
    // In production: open reschedule modal
    console.log('Rescheduling:', appointmentId);
    setShowScheduleModal(true);
  };

  const monthYearLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekLabel = viewMode === 'week' ? (() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })() : '';

  const googleIntegration = integrations.find(i => i.provider === 'google_calendar')!;
  const calendlyIntegration = integrations.find(i => i.provider === 'calendly')!;

  return (
    <div className="space-y-6">
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
                <p className="text-slate-500 font-medium">Manage appointments, no-shows, and scheduling</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowIntegrationPanel(!showIntegrationPanel)}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Integrations
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Schedule Event
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Today</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.todayCount}</span>
              <p className="text-xs text-slate-500 mt-1">events scheduled</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Upcoming</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.upcomingCount}</span>
              <p className="text-xs text-slate-500 mt-1">future appointments</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">No-Show Retries</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.noShowRetries}</span>
              <p className="text-xs text-slate-500 mt-1">auto-scheduled</p>
            </div>
            <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500 font-semibold">Total Scheduled</span>
              </div>
              <span className="text-3xl text-slate-900 font-bold">{stats.scheduledCount}</span>
              <p className="text-xs text-slate-500 mt-1">all pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Panel */}
      {showIntegrationPanel && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-slideDown">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Calendar Integrations</h3>
            <button onClick={() => setShowIntegrationPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Google Calendar */}
            <div className={`rounded-xl border p-6 ${googleIntegration.connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#4285F4] flex items-center justify-center">
                  <SiGooglecalendar className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">Google Calendar</h4>
                  <p className="text-xs text-slate-500">
                    {googleIntegration.connected
                      ? `Connected: ${googleIntegration.email}`
                      : 'Sync appointments & schedules'}
                  </p>
                </div>
                {googleIntegration.connected && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Sync your call schedules, appointments, and no-show retries directly with Google Calendar. Get reminders and keep your team informed.
              </p>
              {googleIntegration.connected ? (
                <div className="flex items-center gap-3">
                  <button className="btn-secondary flex-1 justify-center text-sm py-2">
                    Sync Now
                  </button>
                  <button
                    onClick={() => handleDisconnect('google_calendar')}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button onClick={handleConnectGoogle} className="btn-primary w-full justify-center py-2.5">
                  Connect Google Calendar
                </button>
              )}
              {googleIntegration.last_synced && (
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Last synced: {new Date(googleIntegration.last_synced).toLocaleString()}
                </p>
              )}
            </div>

            {/* Calendly */}
            <div className={`rounded-xl border p-6 ${calendlyIntegration.connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#006BFF] flex items-center justify-center">
                  <SiCalendly className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">Calendly</h4>
                  <p className="text-xs text-slate-500">
                    {calendlyIntegration.connected
                      ? `Connected: ${calendlyIntegration.email}`
                      : 'Auto-schedule follow-ups'}
                  </p>
                </div>
                {calendlyIntegration.connected && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Automatically schedule follow-up meetings based on call outcomes. Let prospects book directly from call results.
              </p>
              {calendlyIntegration.connected ? (
                <div className="flex items-center gap-3">
                  <button className="btn-secondary flex-1 justify-center text-sm py-2">
                    Sync Now
                  </button>
                  <button
                    onClick={() => handleDisconnect('calendly')}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button onClick={handleConnectCalendly} className="btn-primary w-full justify-center py-2.5">
                  Connect Calendly
                </button>
              )}
              {calendlyIntegration.last_synced && (
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Last synced: {new Date(calendlyIntegration.last_synced).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            {/* Filter */}
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'call', label: 'Calls' },
                { id: 'follow_up', label: 'Follow-ups' },
                { id: 'no_show_retry', label: 'No-Shows' },
                { id: 'meeting', label: 'Meetings' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as typeof filterType)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    filterType === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* View Mode */}
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
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
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">{day}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-t border-l border-slate-200">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  onClick={() => { setSelectedDate(day.date); setViewMode('day'); setCurrentDate(day.date); }}
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
                      const style = EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.call;
                      return (
                        <div key={event.id} className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} truncate border font-medium`}>
                          {new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {event.contact_name.split(' ')[0]}
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
          <div className="p-4">
            <div className="grid grid-cols-7 gap-3">
              {weekDays.map((day, idx) => (
                <div key={idx} className={`rounded-xl border ${isToday(day.date) ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/30' : 'border-slate-200'}`}>
                  <div className={`text-center py-3 border-b ${isToday(day.date) ? 'border-[var(--color-primary)]/20' : 'border-slate-100'}`}>
                    <div className="text-xs text-slate-500 font-medium">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className={`text-lg font-bold ${isToday(day.date) ? 'text-[var(--color-primary)]' : 'text-slate-900'}`}>{day.date.getDate()}</div>
                  </div>
                  <div className="p-2 space-y-1.5 min-h-[200px]">
                    {day.events.map(event => {
                      const style = EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.call;
                      return (
                        <div key={event.id} className={`text-[11px] p-2 rounded-lg ${style.bg} border ${style.text}`}>
                          <div className="font-semibold truncate">{event.contact_name}</div>
                          <div className="text-[10px] opacity-75">
                            {new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="p-4">
            <div className="space-y-2">
              {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                const hourEvents = filteredAppointments.filter(a => {
                  const aDate = new Date(a.scheduled_at);
                  return aDate.toDateString() === currentDate.toDateString() && aDate.getHours() === hour;
                });

                return (
                  <div key={hour} className="flex gap-4">
                    <div className="w-16 text-right text-xs text-slate-400 font-medium py-3 shrink-0">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    <div className={`flex-1 min-h-[60px] border-t border-slate-100 py-2 ${hourEvents.length > 0 ? '' : ''}`}>
                      {hourEvents.length > 0 ? (
                        <div className="space-y-2">
                          {hourEvents.map(event => {
                            const style = EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.call;
                            const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.scheduled;
                            return (
                              <div key={event.id} className={`p-3 rounded-xl ${style.bg} border flex items-center justify-between group`}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`}></div>
                                  <div className="min-w-0">
                                    <div className={`text-sm font-semibold ${style.text} truncate`}>{event.title}</div>
                                    <div className="text-xs text-slate-500">
                                      {new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {event.duration_minutes}min
                                      {event.source !== 'manual' && <span className="ml-2 opacity-60">via {event.source.replace('_', ' ')}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  {event.status === 'scheduled' && (
                                    <>
                                      <button
                                        onClick={() => handleMarkNoShow(event.id)}
                                        className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                      >
                                        No-Show
                                      </button>
                                      <button
                                        onClick={() => handleReschedule(event.id)}
                                        className="px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] rounded-lg transition-colors"
                                      >
                                        Reschedule
                                      </button>
                                    </>
                                  )}
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.text}`}>
                                    {event.status.replace('_', ' ')}
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
        )}

        {/* Agenda View */}
        {viewMode === 'agenda' && (
          <div className="p-4">
            <div className="space-y-4">
              {(() => {
                const grouped = new Map<string, Appointment[]>();
                const upcoming = filteredAppointments
                  .filter(a => a.status === 'scheduled')
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

                upcoming.forEach(a => {
                  const dateKey = new Date(a.scheduled_at).toDateString();
                  if (!grouped.has(dateKey)) grouped.set(dateKey, []);
                  grouped.get(dateKey)!.push(a);
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

                return Array.from(grouped.entries()).map(([dateStr, events]) => (
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
                      <span className="text-xs text-slate-400 font-medium">{events.length} events</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {events.map(event => {
                        const style = EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.call;
                        return (
                          <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
                            <div className={`w-1.5 h-10 rounded-full ${style.dot}`}></div>
                            <div className="text-sm text-slate-500 font-medium w-20 shrink-0">
                              {new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{event.title}</div>
                              <div className="text-xs text-slate-500">{event.contact_phone} - {event.duration_minutes}min</div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => handleMarkNoShow(event.id)}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                No-Show
                              </button>
                              <button
                                onClick={() => handleReschedule(event.id)}
                                className="px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] rounded-lg transition-colors"
                              >
                                Reschedule
                              </button>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.text} border`}>
                              {event.type.replace('_', ' ')}
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
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none">
                  <option value="call">Call</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="meeting">Meeting</option>
                  <option value="no_show_retry">No-Show Retry</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none">
                  <option value="">Select a contact...</option>
                  {contacts.slice(0, 20).map(c => (
                    <option key={c.id} value={c.id}>{c.contact_name || 'Unknown'} - {c.phone_number}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                  <input
                    type="time"
                    defaultValue="10:00"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  defaultValue={15}
                  min={5}
                  max={120}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add notes about this event..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none resize-none"
                />
              </div>
              {/* Sync options */}
              {(googleIntegration.connected || calendlyIntegration.connected) && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Sync to:</p>
                  <div className="space-y-2">
                    {googleIntegration.connected && (
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[var(--color-primary)]" />
                        <SiGooglecalendar className="w-4 h-4 text-[#4285F4]" />
                        Google Calendar
                      </label>
                    )}
                    {calendlyIntegration.connected && (
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[var(--color-primary)]" />
                        <SiCalendly className="w-4 h-4 text-[#006BFF]" />
                        Calendly
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowScheduleModal(false)} className="btn-primary">Schedule Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
