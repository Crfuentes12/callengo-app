// app/api/calendar/team/route.ts
// Team calendar member management + personal vs company calendar views

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  getTeamMembers,
  upsertTeamMember,
  getTeamCalendarView,
} from '@/lib/calendar/resource-routing';

/**
 * GET /api/calendar/team
 * Returns team members and optionally their event counts.
 * Query params:
 *   - view=summary : includes event counts for date range
 *   - start_date, end_date : date range for summary
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view');

    if (view === 'summary') {
      const startDate = searchParams.get('start_date') || new Date().toISOString();
      const endDate = searchParams.get('end_date') || new Date(Date.now() + 30 * 86400000).toISOString();
      const summary = await getTeamCalendarView(userData.company_id, startDate, endDate);
      return NextResponse.json({ team: summary });
    }

    const members = await getTeamMembers(userData.company_id);
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[calendar/team] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

/**
 * POST /api/calendar/team
 * Create or update a team calendar assignment.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    // Only owner/admin can manage team assignments
    if (!['owner', 'admin'].includes(userData.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const member = await upsertTeamMember(userData.company_id, body);

    if (!member) {
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('[calendar/team] POST error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar/team
 * Deactivate a team calendar assignment.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    if (!['owner', 'admin'].includes(userData.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const memberId = request.nextUrl.searchParams.get('member_id');
    if (!memberId) {
      return NextResponse.json({ error: 'Missing member_id' }, { status: 400 });
    }

    await supabaseAdmin
      .from('team_calendar_assignments')
      .update({ is_active: false })
      .eq('id', memberId)
      .eq('company_id', userData.company_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[calendar/team] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
  }
}
