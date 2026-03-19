// app/api/calendar/contact-sync/route.ts
// API for bidirectional contact-calendar synchronization
// - GET: Returns calendar event counts per contact (for the calendar indicator)
// - POST: Cross-references contacts with calendar events and optionally imports contacts from calendar

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';

// GET: Fetch calendar event data for contacts
// Returns a map of contact_id -> { upcoming_events, total_events, next_event_date, next_event_type }
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const companyId = userData.company_id;
    const searchParams = request.nextUrl.searchParams;
    const contactIds = searchParams.get('contact_ids'); // comma-separated list, optional

    const now = new Date().toISOString();

    // Fetch all calendar events linked to contacts for this company
    let query = supabaseAdminRaw
      .from('calendar_events')
      .select('id, contact_id, start_time, end_time, event_type, status, title, contact_name, contact_phone, contact_email')
      .eq('company_id', companyId)
      .not('contact_id', 'is', null)
      .neq('status', 'cancelled');

    if (contactIds) {
      const ids = contactIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        query = query.in('contact_id', ids);
      }
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error('Error fetching calendar events for contacts:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Build per-contact calendar summary
    const contactCalendarMap: Record<string, {
      upcoming_events: number;
      total_events: number;
      next_event_date: string | null;
      next_event_type: string | null;
      next_event_title: string | null;
      has_calendar_events: boolean;
    }> = {};

    for (const event of events || []) {
      if (!event.contact_id) continue;

      if (!contactCalendarMap[event.contact_id]) {
        contactCalendarMap[event.contact_id] = {
          upcoming_events: 0,
          total_events: 0,
          next_event_date: null,
          next_event_type: null,
          next_event_title: null,
          has_calendar_events: true,
        };
      }

      const entry = contactCalendarMap[event.contact_id];
      entry.total_events++;

      const isUpcoming = new Date(event.start_time) >= new Date(now) &&
        event.status !== 'completed' && event.status !== 'no_show';

      if (isUpcoming) {
        entry.upcoming_events++;
        // Track the earliest upcoming event
        if (!entry.next_event_date || new Date(event.start_time) < new Date(entry.next_event_date)) {
          entry.next_event_date = event.start_time;
          entry.next_event_type = event.event_type;
          entry.next_event_title = event.title;
        }
      }
    }

    return NextResponse.json({
      contact_calendar_map: contactCalendarMap,
      total_linked_contacts: Object.keys(contactCalendarMap).length,
    });
  } catch (error) {
    console.error('Error in contact-calendar sync GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Cross-reference and sync contacts with calendar events
// Actions:
//   - "cross_reference": Match existing contacts with calendar events by email/phone/name
//   - "import_from_calendar": Create contacts from calendar events that have attendee info but no matching contact
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const companyId = userData.company_id;
    const body = await request.json();
    const { action } = body;

    if (action === 'cross_reference') {
      return await handleCrossReference(companyId);
    } else if (action === 'import_from_calendar') {
      return await handleImportFromCalendar(companyId);
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "cross_reference" or "import_from_calendar"' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in contact-calendar sync POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Cross-reference existing contacts with calendar events
// Matches by: email, phone number, or contact name
async function handleCrossReference(companyId: string) {
  // Fetch all contacts
  const { data: contacts, error: contactsError } = await supabaseAdminRaw
    .from('contacts')
    .select('id, email, phone_number, contact_name, company_name')
    .eq('company_id', companyId);

  if (contactsError) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }

  // Fetch unlinked calendar events (no contact_id) that have contact info
  const { data: unlinkedEvents, error: eventsError } = await supabaseAdminRaw
    .from('calendar_events')
    .select('id, contact_email, contact_phone, contact_name, attendees, title')
    .eq('company_id', companyId)
    .is('contact_id', null)
    .neq('status', 'cancelled');

  if (eventsError) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }

  // Build lookup maps for contacts
  const emailMap = new Map<string, string>();
  const phoneMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  for (const contact of contacts || []) {
    if (contact.email) emailMap.set(contact.email.toLowerCase().trim(), contact.id);
    if (contact.phone_number) {
      const cleanPhone = contact.phone_number.replace(/\D/g, '');
      if (cleanPhone.length >= 7) phoneMap.set(cleanPhone.slice(-10), contact.id);
    }
    if (contact.contact_name) {
      nameMap.set(contact.contact_name.toLowerCase().trim(), contact.id);
    }
  }

  let linkedCount = 0;
  const updates: { eventId: string; contactId: string }[] = [];

  for (const event of unlinkedEvents || []) {
    let matchedContactId: string | null = null;

    // 1. Match by email (highest priority)
    if (event.contact_email) {
      matchedContactId = emailMap.get(event.contact_email.toLowerCase().trim()) || null;
    }

    // 2. Match by phone
    if (!matchedContactId && event.contact_phone) {
      const cleanPhone = event.contact_phone.replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        matchedContactId = phoneMap.get(cleanPhone.slice(-10)) || null;
      }
    }

    // 3. Match by name
    if (!matchedContactId && event.contact_name) {
      matchedContactId = nameMap.get(event.contact_name.toLowerCase().trim()) || null;
    }

    // 4. Check attendees
    if (!matchedContactId && event.attendees) {
      const attendees = event.attendees as Array<{ email?: string; name?: string }>;
      for (const att of attendees) {
        if (att.email) {
          matchedContactId = emailMap.get(att.email.toLowerCase().trim()) || null;
          if (matchedContactId) break;
        }
        if (!matchedContactId && att.name) {
          matchedContactId = nameMap.get(att.name.toLowerCase().trim()) || null;
          if (matchedContactId) break;
        }
      }
    }

    if (matchedContactId) {
      updates.push({ eventId: event.id, contactId: matchedContactId });
    }
  }

  // Batch update events with matched contact IDs
  for (const update of updates) {
    const { error } = await supabaseAdminRaw
      .from('calendar_events')
      .update({ contact_id: update.contactId })
      .eq('id', update.eventId);

    if (!error) linkedCount++;
  }

  return NextResponse.json({
    success: true,
    linked_count: linkedCount,
    total_unlinked_events: (unlinkedEvents || []).length,
    total_contacts: (contacts || []).length,
  });
}

// Import contacts from calendar events that don't have matching contacts
async function handleImportFromCalendar(companyId: string) {
  // Fetch calendar events with contact info but no contact_id link
  const { data: events, error: eventsError } = await supabaseAdminRaw
    .from('calendar_events')
    .select('id, contact_email, contact_phone, contact_name, attendees, title, source')
    .eq('company_id', companyId)
    .is('contact_id', null)
    .neq('status', 'cancelled');

  if (eventsError) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }

  // Fetch existing contacts to avoid duplicates
  const { data: existingContacts } = await supabaseAdminRaw
    .from('contacts')
    .select('email, phone_number')
    .eq('company_id', companyId);

  const existingEmails = new Set(
    (existingContacts || [])
      .filter(c => c.email)
      .map(c => c.email!.toLowerCase().trim())
  );
  const existingPhones = new Set(
    (existingContacts || [])
      .filter(c => c.phone_number)
      .map(c => c.phone_number!.replace(/\D/g, '').slice(-10))
  );

  // Deduplicate potential imports
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const contactsToCreate: Array<{
    company_id: string;
    contact_name: string | null;
    email: string | null;
    phone_number: string;
    company_name: string;
    source: string;
    status: string;
    custom_fields: Record<string, unknown>;
  }> = [];
  const eventIdsToUpdate: Array<{ eventId: string; identifier: string }> = [];

  for (const event of events || []) {
    // Collect unique identifiable contacts from event data
    const candidates: Array<{ name: string | null; email: string | null; phone: string | null }> = [];

    // From event's direct contact fields
    if (event.contact_email || event.contact_phone || event.contact_name) {
      candidates.push({
        name: event.contact_name,
        email: event.contact_email,
        phone: event.contact_phone,
      });
    }

    // From attendees
    if (event.attendees) {
      const attendees = event.attendees as Array<{ email?: string; name?: string; organizer?: boolean }>;
      for (const att of attendees) {
        // Skip organizer (that's the company user)
        if (att.organizer) continue;
        if (att.email || att.name) {
          candidates.push({ name: att.name || null, email: att.email || null, phone: null });
        }
      }
    }

    for (const candidate of candidates) {
      // Need at least an email or name to create a contact
      if (!candidate.email && !candidate.name) continue;

      // Check for duplicates
      const emailKey = candidate.email?.toLowerCase().trim();
      const phoneKey = candidate.phone?.replace(/\D/g, '').slice(-10);

      if (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) continue;
      if (phoneKey && phoneKey.length >= 7 && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey))) continue;

      if (emailKey) seenEmails.add(emailKey);
      if (phoneKey && phoneKey.length >= 7) seenPhones.add(phoneKey);

      const calendarSource = event.source === 'google_calendar' ? 'Google Calendar'
        : event.source === 'microsoft_outlook' ? 'Outlook Calendar'
        : 'Calendar';

      contactsToCreate.push({
        company_id: companyId,
        contact_name: candidate.name,
        email: candidate.email,
        phone_number: candidate.phone || '',
        company_name: '',
        source: calendarSource,
        status: 'Pending',
        custom_fields: { _imported_from_calendar: true, _calendar_event_title: event.title },
      });

      eventIdsToUpdate.push({
        eventId: event.id,
        identifier: emailKey || candidate.name?.toLowerCase().trim() || '',
      });
    }
  }

  // Insert contacts in batches
  let importedCount = 0;
  const batchSize = 50;
  const createdContactMap = new Map<string, string>(); // identifier -> contact_id

  for (let i = 0; i < contactsToCreate.length; i += batchSize) {
    const batch = contactsToCreate.slice(i, i + batchSize);
    const { data: created, error } = await supabaseAdminRaw
      .from('contacts')
      .insert(batch)
      .select('id, email, contact_name');

    if (!error && created) {
      importedCount += created.length;
      for (const c of created) {
        const key = c.email?.toLowerCase().trim() || c.contact_name?.toLowerCase().trim() || '';
        if (key) createdContactMap.set(key, c.id);
      }
    }
  }

  // Link events to newly created contacts
  let linkedCount = 0;
  for (const { eventId, identifier } of eventIdsToUpdate) {
    const contactId = createdContactMap.get(identifier);
    if (contactId) {
      const { error } = await supabaseAdminRaw
        .from('calendar_events')
        .update({ contact_id: contactId })
        .eq('id', eventId);
      if (!error) linkedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    imported_count: importedCount,
    linked_count: linkedCount,
    total_calendar_events_processed: (events || []).length,
  });
}
