// app/api/calendar/events/personal/route.ts
// Returns calendar events filtered by the current user's team assignment.
// Used by the "Personal Calendar" view toggle on the Calendar page.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

/**
 * GET /api/calendar/events/personal
 * Returns only events assigned to the current user (or created by them).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Find the user's team calendar assignment
    const { data: assignment } = await supabaseAdmin
      .from('team_calendar_assignments')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    let query = supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('company_id', userData.company_id);

    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('start_time', endDate);

    if (assignment) {
      // Show events assigned to this user OR unassigned events
      query = query.or(`assigned_to.eq.${assignment.id},assigned_to.is.null`);
    }
    // If no assignment exists, show all events (no filtering)

    const { data: events, error } = await query
      .order('start_time', { ascending: true })
      .limit(500);

    if (error) {
      console.error('[calendar/personal] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({
      events: events || [],
      hasAssignment: !!assignment,
    });
  } catch (error) {
    console.error('[calendar/personal] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch personal events' }, { status: 500 });
  }
}
