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

    // Get last sign-in from auth.users for each member
    const membersWithActivity = await Promise.all(
      (members || []).map(async (member) => {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.id);
        return {
          ...member,
          last_sign_in_at: authUser?.user?.last_sign_in_at || null,
        };
      })
    );

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
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
