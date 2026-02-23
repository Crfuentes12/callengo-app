// lib/calendar/availability.ts
// Availability checking and overbooking prevention for Callengo.
// Handles busy slot aggregation, available time computation,
// conflict detection, and US Federal Holiday awareness.

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { listGoogleEvents } from './google';
import type {
  CalendarEvent,
  TimeSlot,
  AvailabilityResult,
  CalendarIntegration,
} from '@/types/calendar';

// ============================================================================
// DEFAULT CONSTANTS
// ============================================================================

const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_WORKING_HOURS_START = '09:00';
const DEFAULT_WORKING_HOURS_END = '18:00';
const DEFAULT_WORKING_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const DEFAULT_MAX_DAYS_TO_SEARCH = 14;

// ============================================================================
// US FEDERAL HOLIDAYS
// ============================================================================

/**
 * Get the Nth occurrence of a given weekday in a specific month/year.
 * weekday: 0 = Sunday, 1 = Monday, ... 6 = Saturday
 * n: 1-based (1st, 2nd, 3rd, 4th, 5th)
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const date = new Date(year, month, 1);
  let count = 0;

  while (date.getMonth() === month) {
    if (date.getDay() === weekday) {
      count++;
      if (count === n) {
        return new Date(year, month, date.getDate());
      }
    }
    date.setDate(date.getDate() + 1);
  }

  throw new Error(
    `Could not find ${n}th weekday ${weekday} in month ${month} of ${year}`
  );
}

/**
 * Get the last occurrence of a given weekday in a specific month/year.
 */
function getLastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number
): Date {
  const date = new Date(year, month + 1, 0); // last day of month
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  return new Date(year, month, date.getDate());
}

/**
 * Compute all US Federal Holidays for a given year.
 *
 * Includes:
 * - New Year's Day (Jan 1)
 * - Martin Luther King Jr. Day (3rd Monday of January)
 * - Presidents' Day (3rd Monday of February)
 * - Memorial Day (last Monday of May)
 * - Juneteenth National Independence Day (Jun 19)
 * - Independence Day (Jul 4)
 * - Labor Day (1st Monday of September)
 * - Columbus Day (2nd Monday of October)
 * - Veterans Day (Nov 11)
 * - Thanksgiving Day (4th Thursday of November)
 * - Christmas Day (Dec 25)
 *
 * Note: If a fixed-date holiday falls on Saturday, it is observed on
 * the preceding Friday. If it falls on Sunday, it is observed on the
 * following Monday.
 */
export function getUSFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Helper: adjust fixed-date holidays for weekends (observed rules)
  function addFixedHoliday(month: number, day: number): void {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    if (dow === 6) {
      // Saturday -> observed Friday
      holidays.push(new Date(year, month, day - 1));
    } else if (dow === 0) {
      // Sunday -> observed Monday
      holidays.push(new Date(year, month, day + 1));
    } else {
      holidays.push(date);
    }
  }

  // New Year's Day - January 1
  addFixedHoliday(0, 1);

  // Martin Luther King Jr. Day - 3rd Monday of January
  holidays.push(getNthWeekdayOfMonth(year, 0, 1, 3));

  // Presidents' Day - 3rd Monday of February
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 3));

  // Memorial Day - Last Monday of May
  holidays.push(getLastWeekdayOfMonth(year, 4, 1));

  // Juneteenth National Independence Day - June 19
  addFixedHoliday(5, 19);

  // Independence Day - July 4
  addFixedHoliday(6, 4);

  // Labor Day - 1st Monday of September
  holidays.push(getNthWeekdayOfMonth(year, 8, 1, 1));

  // Columbus Day - 2nd Monday of October
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 2));

  // Veterans Day - November 11
  addFixedHoliday(10, 11);

  // Thanksgiving Day - 4th Thursday of November
  holidays.push(getNthWeekdayOfMonth(year, 10, 4, 4));

  // Christmas Day - December 25
  addFixedHoliday(11, 25);

  return holidays;
}

/**
 * Check if a specific date falls on a US Federal Holiday (observed date).
 * Checks the current year and next year to handle edge cases around Dec/Jan.
 */
export function isUSHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = [
    ...getUSFederalHolidays(year),
    ...getUSFederalHolidays(year + 1),
  ];

  return holidays.some(
    (h) =>
      h.getFullYear() === date.getFullYear() &&
      h.getMonth() === date.getMonth() &&
      h.getDate() === date.getDate()
  );
}

// ============================================================================
// COMPANY SETTINGS HELPERS
// ============================================================================

interface CompanyScheduleSettings {
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: string[];
  excludeHolidays: boolean;
  timezone: string;
}

/**
 * Fetch the company's working-hours / schedule settings from the database.
 * Falls back to sensible defaults when settings are missing.
 */
async function getCompanyScheduleSettings(
  companyId: string
): Promise<CompanyScheduleSettings> {
  const { data: companySettings } = await supabaseAdmin
    .from('company_settings')
    .select('settings')
    .eq('company_id', companyId)
    .single();

  const settings = (companySettings?.settings ?? {}) as Record<string, unknown>;

  return {
    workingHoursStart:
      (settings.working_hours_start as string) || DEFAULT_WORKING_HOURS_START,
    workingHoursEnd:
      (settings.working_hours_end as string) || DEFAULT_WORKING_HOURS_END,
    workingDays:
      (settings.working_days as string[]) || DEFAULT_WORKING_DAYS,
    excludeHolidays: (settings.exclude_holidays as boolean) ?? false,
    timezone: (settings.timezone as string) || 'America/New_York',
  };
}

// ============================================================================
// BUSY SLOT AGGREGATION
// ============================================================================

/**
 * Fetch all active calendar integrations for a company.
 * Queries Supabase directly (instead of importing from ./sync) to
 * avoid circular dependency issues.
 */
async function fetchActiveIntegrations(
  companyId: string
): Promise<CalendarIntegration[]> {
  const { data, error } = await supabaseAdmin
    .from('calendar_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('[availability] Error fetching integrations:', error);
    return [];
  }

  return (data || []) as unknown as CalendarIntegration[];
}

/**
 * Fetch busy slots from Google Calendar for a given integration and date range.
 */
async function getGoogleBusySlots(
  integration: CalendarIntegration,
  startDate: string,
  endDate: string
): Promise<TimeSlot[]> {
  try {
    const { events } = await listGoogleEvents(integration, {
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
    });

    return events
      .filter((e) => e.status !== 'cancelled')
      .map((e) => ({
        start:
          e.start?.dateTime ||
          (e.start?.date ? new Date(e.start.date).toISOString() : startDate),
        end:
          e.end?.dateTime ||
          (e.end?.date ? new Date(e.end.date).toISOString() : endDate),
      }));
  } catch (error) {
    console.error(
      `[availability] Error fetching Google events for integration ${integration.id}:`,
      error
    );
    return [];
  }
}

/**
 * Fetch busy slots from Microsoft Graph Calendar for a given integration and date range.
 * Uses the Microsoft Graph API's /calendarView endpoint.
 */
async function getMicrosoftBusySlots(
  integration: CalendarIntegration,
  startDate: string,
  endDate: string
): Promise<TimeSlot[]> {
  try {
    const calendarId = integration.microsoft_calendar_id || 'me';
    const baseUrl =
      calendarId === 'me'
        ? 'https://graph.microsoft.com/v1.0/me/calendarView'
        : `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView`;

    const params = new URLSearchParams({
      startDateTime: new Date(startDate).toISOString(),
      endDateTime: new Date(endDate).toISOString(),
      $select: 'subject,start,end,isCancelled,isAllDay',
      $top: '250',
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `[availability] Microsoft Graph API error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();
    const events = data.value || [];

    return events
      .filter((e: { isCancelled?: boolean }) => !e.isCancelled)
      .map(
        (e: {
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
        }) => ({
          start: e.start.dateTime.endsWith('Z')
            ? e.start.dateTime
            : `${e.start.dateTime}Z`,
          end: e.end.dateTime.endsWith('Z')
            ? e.end.dateTime
            : `${e.end.dateTime}Z`,
        })
      );
  } catch (error) {
    console.error(
      `[availability] Error fetching Microsoft events for integration ${integration.id}:`,
      error
    );
    return [];
  }
}

/**
 * Get all busy slots for a company across a date range.
 *
 * Aggregates events from three sources:
 * 1. Callengo's local calendar_events table
 * 2. Google Calendar (for each active Google integration)
 * 3. Microsoft Outlook (for each active Microsoft integration)
 *
 * Results are merged and sorted chronologically.
 */
export async function getBusySlots(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<TimeSlot[]> {
  // 1. Query local calendar_events
  const { data: localEvents, error } = await supabaseAdmin
    .from('calendar_events')
    .select('start_time, end_time, status')
    .eq('company_id', companyId)
    .gte('start_time', new Date(startDate).toISOString())
    .lte('end_time', new Date(endDate).toISOString())
    .in('status', ['scheduled', 'confirmed', 'rescheduled', 'pending_confirmation'])
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[availability] Error fetching local events:', error);
  }

  const localSlots: TimeSlot[] = (localEvents || []).map(
    (e: { start_time: string; end_time: string }) => ({
      start: e.start_time,
      end: e.end_time,
    })
  );

  // 2. Query external calendars in parallel
  const integrations = await fetchActiveIntegrations(companyId);

  const externalFetches: Promise<TimeSlot[]>[] = integrations.map(
    (integration) => {
      switch (integration.provider) {
        case 'google_calendar':
          return getGoogleBusySlots(integration, startDate, endDate);
        case 'microsoft_outlook':
          return getMicrosoftBusySlots(integration, startDate, endDate);
        default:
          return Promise.resolve([]);
      }
    }
  );

  const externalResults = await Promise.all(externalFetches);
  const externalSlots = externalResults.flat();

  // 3. Merge, de-duplicate (by start+end), and sort
  const allSlots = [...localSlots, ...externalSlots];
  const uniqueMap = new Map<string, TimeSlot>();
  for (const slot of allSlots) {
    const key = `${slot.start}|${slot.end}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, slot);
    }
  }

  const merged = Array.from(uniqueMap.values());
  merged.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return merged;
}

// ============================================================================
// AVAILABILITY COMPUTATION
// ============================================================================

/**
 * Parse a "HH:mm" time string and apply it to a given Date to produce an
 * absolute Date instance (in UTC terms, matching the date's calendar day).
 */
function applyTimeToDate(dateStr: string, time: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Get the day-of-week name (lowercase) for a date string "YYYY-MM-DD".
 */
function getDayName(dateStr: string): string {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return days[date.getDay()];
}

/**
 * Subtract busy intervals from a single working window and split the
 * remaining free time into fixed-duration chunks.
 *
 * Returns an array of TimeSlot representing available bookable slots.
 */
function computeFreeSlots(
  workStart: Date,
  workEnd: Date,
  busySlots: TimeSlot[],
  slotDurationMs: number
): TimeSlot[] {
  // Build a list of free intervals by subtracting busy from [workStart, workEnd]
  const freeIntervals: { start: Date; end: Date }[] = [];

  let cursor = workStart.getTime();
  const endMs = workEnd.getTime();

  // Sort busy slots by start time
  const sorted = [...busySlots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  for (const busy of sorted) {
    const busyStart = new Date(busy.start).getTime();
    const busyEnd = new Date(busy.end).getTime();

    // Skip busy slots that are entirely outside the working window
    if (busyEnd <= workStart.getTime() || busyStart >= endMs) {
      continue;
    }

    // If there is a gap before this busy slot, record it as free
    if (busyStart > cursor) {
      freeIntervals.push({
        start: new Date(cursor),
        end: new Date(Math.min(busyStart, endMs)),
      });
    }

    // Move cursor past the busy slot
    cursor = Math.max(cursor, busyEnd);
  }

  // Remaining time after last busy slot
  if (cursor < endMs) {
    freeIntervals.push({
      start: new Date(cursor),
      end: new Date(endMs),
    });
  }

  // Split free intervals into fixed-duration slots
  const slots: TimeSlot[] = [];
  for (const interval of freeIntervals) {
    let slotStart = interval.start.getTime();
    while (slotStart + slotDurationMs <= interval.end.getTime()) {
      const slotEnd = slotStart + slotDurationMs;
      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
      });
      slotStart = slotEnd;
    }
  }

  return slots;
}

/**
 * Get available time slots for a specific date.
 *
 * Steps:
 * 1. Fetch company settings (working hours, working days, holiday preference)
 * 2. Check if the date is a working day
 * 3. Check if the date is a US Federal Holiday (if configured)
 * 4. Aggregate busy slots from all calendars
 * 5. Compute available slots by subtracting busy from working hours
 * 6. Split into chunks of slotDurationMinutes
 */
export async function getAvailability(
  companyId: string,
  date: string,
  options?: {
    slotDurationMinutes?: number;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    workingDays?: string[];
    excludeHolidays?: boolean;
  }
): Promise<AvailabilityResult> {
  // 1. Fetch company settings
  const companyDefaults = await getCompanyScheduleSettings(companyId);

  const slotDuration =
    options?.slotDurationMinutes ?? DEFAULT_SLOT_DURATION_MINUTES;
  const workingHoursStart =
    options?.workingHoursStart ?? companyDefaults.workingHoursStart;
  const workingHoursEnd =
    options?.workingHoursEnd ?? companyDefaults.workingHoursEnd;
  const workingDays =
    options?.workingDays ?? companyDefaults.workingDays;
  const excludeHolidays =
    options?.excludeHolidays ?? companyDefaults.excludeHolidays;

  // 2. Check if the date is a working day
  const dayName = getDayName(date);
  const isWorkingDay = workingDays.includes(dayName);

  // 3. Check if the date is a US Federal Holiday
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const holiday = excludeHolidays ? isUSHoliday(dateObj) : false;

  // If not a working day or is a holiday, return early with no available slots
  if (!isWorkingDay || holiday) {
    return {
      date,
      available_slots: [],
      busy_slots: [],
      is_working_day: isWorkingDay,
      is_holiday: holiday,
    };
  }

  // 4. Get busy slots for the date
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  const busySlots = await getBusySlots(companyId, dayStart, dayEnd);

  // 5. Compute working window boundaries
  const workStart = applyTimeToDate(date, workingHoursStart);
  const workEnd = applyTimeToDate(date, workingHoursEnd);

  // 6. Calculate available slots
  const slotDurationMs = slotDuration * 60 * 1000;
  const availableSlots = computeFreeSlots(
    workStart,
    workEnd,
    busySlots,
    slotDurationMs
  );

  return {
    date,
    available_slots: availableSlots,
    busy_slots: busySlots,
    is_working_day: isWorkingDay,
    is_holiday: holiday,
  };
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Check if a specific time slot is available (no conflicts).
 *
 * Queries both local calendar_events and external calendars, then
 * checks for any overlap with the proposed time range.
 *
 * Returns whether the slot is available and any conflicting events.
 */
export async function isSlotAvailable(
  companyId: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; conflicts: CalendarEvent[] }> {
  // Query local events that overlap with the requested time range.
  // An event overlaps if its start < requested end AND its end > requested start.
  const { data: overlapping, error } = await supabaseAdmin
    .from('calendar_events')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['scheduled', 'confirmed', 'rescheduled', 'pending_confirmation'])
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[availability] Error checking slot conflicts:', error);
  }

  const conflicts = (overlapping || []) as unknown as CalendarEvent[];

  // Also check external calendars for busy slots in the window
  const externalBusy = await getBusyExternalOnly(companyId, startTime, endTime);

  // External busy slots don't produce full CalendarEvent objects, but if any
  // overlap exists the slot is unavailable.  We still only return local
  // CalendarEvent objects as "conflicts" since external ones lack full data.
  const hasExternalConflict = externalBusy.length > 0;

  return {
    available: conflicts.length === 0 && !hasExternalConflict,
    conflicts,
  };
}

/**
 * Helper: fetch busy slots from external calendars only (Google + Microsoft).
 * Used by isSlotAvailable to avoid double-counting local events.
 */
async function getBusyExternalOnly(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<TimeSlot[]> {
  const integrations = await fetchActiveIntegrations(companyId);

  const fetches: Promise<TimeSlot[]>[] = integrations.map((integration) => {
    switch (integration.provider) {
      case 'google_calendar':
        return getGoogleBusySlots(integration, startDate, endDate);
      case 'microsoft_outlook':
        return getMicrosoftBusySlots(integration, startDate, endDate);
      default:
        return Promise.resolve([]);
    }
  });

  const results = await Promise.all(fetches);
  return results.flat();
}

// ============================================================================
// NEXT AVAILABLE SLOT FINDER
// ============================================================================

/**
 * Find the next available time slot of the requested duration starting
 * from a given time.
 *
 * Iterates day-by-day (up to maxDaysToSearch) through the company's
 * working schedule, skipping non-working days and holidays, until a
 * free slot of the required duration is found.
 *
 * Returns null if no slot is found within the search window.
 */
export async function getNextAvailableSlot(
  companyId: string,
  afterTime: string,
  durationMinutes: number,
  options?: {
    maxDaysToSearch?: number;
  }
): Promise<TimeSlot | null> {
  const maxDays = options?.maxDaysToSearch ?? DEFAULT_MAX_DAYS_TO_SEARCH;
  const startMoment = new Date(afterTime);

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const searchDate = new Date(startMoment);
    searchDate.setDate(searchDate.getDate() + dayOffset);

    const dateStr = [
      searchDate.getFullYear(),
      String(searchDate.getMonth() + 1).padStart(2, '0'),
      String(searchDate.getDate()).padStart(2, '0'),
    ].join('-');

    const availability = await getAvailability(companyId, dateStr, {
      slotDurationMinutes: durationMinutes,
    });

    // Skip non-working days and holidays
    if (!availability.is_working_day || availability.is_holiday) {
      continue;
    }

    // Find the first available slot that starts at or after the requested time
    for (const slot of availability.available_slots) {
      if (new Date(slot.start).getTime() >= startMoment.getTime()) {
        return slot;
      }
    }
  }

  return null;
}
