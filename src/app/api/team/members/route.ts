import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';

/**
 * GET /api/team/members
 * Returns team members and pending invitations for the current user's company
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User not in a company' }, { status: 404 });
    }

    // Fetch all team members in the company
    const { data: members, error: membersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // FIX #9: Batch fetch last_sign_in instead of N+1 getUserById calls.
    // Use listUsers with filter to get all team members in one API call.
    const memberIds = new Set((members || []).map(m => m.id));
    const authUsersMap = new Map<string, string | null>();

    // Supabase admin.listUsers returns paginated results; fetch enough for the team
    try {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
        perPage: Math.max(50, memberIds.size),
      });
      if (authList?.users) {
        for (const authUser of authList.users) {
          if (memberIds.has(authUser.id)) {
            authUsersMap.set(authUser.id, authUser.last_sign_in_at || null);
          }
        }
      }
    } catch (authErr) {
      console.error('Failed to batch-fetch auth users:', authErr);
      // Gracefully degrade — last_sign_in_at will be null
    }

    const membersWithActivity = (members || []).map((member) => ({
      ...member,
      last_sign_in_at: authUsersMap.get(member.id) || null,
    }));

    // Fetch pending invitations
    const { data: invites, error: invitesError } = await supabaseAdminRaw
      .from('team_invitations')
      .select('id, email, role, created_at, status')
      .eq('company_id', userData.company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invitesError) {
      console.error('Error fetching invites:', invitesError);
      // Don't fail the whole request if invites table doesn't exist yet
    }

    return NextResponse.json({
      members: membersWithActivity,
      invites: invites || [],
    });
  } catch (error) {
    console.error('Error in team members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
