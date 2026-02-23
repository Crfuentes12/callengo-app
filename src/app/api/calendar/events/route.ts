// app/api/calendar/events/route.ts
// CRUD API for calendar events

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  markEventNoShow,
  confirmAppointment,
  rescheduleAppointment,
  getCalendarEvents,
} from '@/lib/calendar/sync';

// GET: Fetch calendar events
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

    const searchParams = request.nextUrl.searchParams;

    const events = await getCalendarEvents(userData.company_id, {
      startDate: searchParams.get('start_date') || undefined,
      endDate: searchParams.get('end_date') || undefined,
      eventType: searchParams.get('event_type') || undefined,
      status: searchParams.get('status') || undefined,
      source: searchParams.get('source') || undefined,
      contactId: searchParams.get('contact_id') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 500,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST: Create a new calendar event
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

    const body = await request.json();
    const {
      title,
      description,
      location,
      start_time,
      end_time,
      timezone,
      all_day,
      event_type,
      contact_id,
      contact_name,
      contact_phone,
      contact_email,
      notes,
      sync_to_google,
      sync_to_calendly,
    } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing required fields: title, start_time, end_time' },
        { status: 400 }
      );
    }

    const event = await createCalendarEvent(
      userData.company_id,
      {
        title,
        description,
        location,
        start_time,
        end_time,
        timezone: timezone || 'UTC',
        all_day: all_day || false,
        event_type: event_type || 'meeting',
        contact_id,
        contact_name,
        contact_phone,
        contact_email,
        notes,
        source: 'manual',
      },
      {
        syncToGoogle: sync_to_google || false,
        syncToCalendly: sync_to_calendly || false,
      }
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

// PUT: Update a calendar event (supports multiple actions)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, action, ...updateData } = body;

    if (!event_id) {
      return NextResponse.json(
        { error: 'Missing event_id' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'confirm':
        result = await confirmAppointment(event_id);
        break;

      case 'cancel':
        const cancelled = await cancelCalendarEvent(event_id, updateData.reason);
        result = cancelled ? { id: event_id, status: 'cancelled' } : null;
        break;

      case 'no_show':
        result = await markEventNoShow(event_id, {
          scheduleRetry: updateData.schedule_retry || false,
          retryDate: updateData.retry_date,
          retryNotes: updateData.retry_notes,
        });
        break;

      case 'reschedule':
        if (!updateData.new_start_time || !updateData.new_end_time) {
          return NextResponse.json(
            { error: 'Missing new_start_time and new_end_time for reschedule' },
            { status: 400 }
          );
        }
        result = await rescheduleAppointment(
          event_id,
          updateData.new_start_time,
          updateData.new_end_time,
          updateData.reason
        );
        break;

      case 'update':
      default:
        result = await updateCalendarEvent(event_id, updateData);
        break;
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ event: result });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE: Cancel/delete a calendar event
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = request.nextUrl.searchParams.get('event_id');
    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing event_id' },
        { status: 400 }
      );
    }

    const cancelled = await cancelCalendarEvent(eventId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel event' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Event cancelled',
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
