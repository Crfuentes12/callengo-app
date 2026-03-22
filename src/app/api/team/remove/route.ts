import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

/**
 * POST /api/team/remove
 * Remove a team member. Requires owner or admin role.
 * Owners cannot be removed. Admins cannot remove other admins.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Cannot remove yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from the team' }, { status: 400 });
    }

    // Get current user data
    const { data: currentUserData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!currentUserData?.company_id) {
      return NextResponse.json({ error: 'User not in a company' }, { status: 404 });
    }

    // Only owners and admins can remove members
    if (currentUserData.role !== 'owner' && currentUserData.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can remove team members' }, { status: 403 });
    }

    // Get target user data
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id, role, company_id')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify same company
    if (targetUser.company_id !== currentUserData.company_id) {
      return NextResponse.json({ error: 'User is not in your company' }, { status: 403 });
    }

    // Cannot remove owner
    if (targetUser.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the company owner' }, { status: 403 });
    }

    // Admins cannot remove other admins (only owner can)
    if (targetUser.role === 'admin' && currentUserData.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can remove admin members' }, { status: 403 });
    }

    // Guard: don't allow removal if it would leave the company with 0 members
    // (Owner can never be removed, but this protects against edge cases)
    const { count: memberCount } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', currentUserData.company_id);

    if ((memberCount || 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last member of the company' },
        { status: 400 }
      );
    }

    // Delete the user record from the users table.
    // company_id has a NOT NULL constraint, so we can't set it to null.
    // The user keeps their Supabase Auth account and can re-onboard or accept a new invite.
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in team remove:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
