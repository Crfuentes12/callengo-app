import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

/**
 * POST /api/team/invite
 * Send a team invitation. Requires owner or admin role.
 * Only available on Business plan and above.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role = 'member' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be member or admin.' }, { status: 400 });
    }

    // Get user data with company info
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User not in a company' }, { status: 404 });
    }

    // Only owners and admins can invite
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can invite team members' }, { status: 403 });
    }

    // Check subscription plan supports team members
    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('*, subscription_plans(slug, max_seats, extra_seat_price)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    if (!subscription?.subscription_plans) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const plan = subscription.subscription_plans as {
      slug: string;
      max_seats: number;
      extra_seat_price: number | null;
    };

    // Free and Starter plans don't support team members
    if (plan.slug === 'free' || plan.slug === 'starter') {
      return NextResponse.json(
        { error: 'Team invitations require Business plan or higher. Please upgrade your plan.' },
        { status: 403 }
      );
    }

    // Check seat limits (max_seats: -1 means unlimited)
    if (plan.max_seats !== -1) {
      // Count current members
      const { count: memberCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', userData.company_id);

      // Count pending invitations
      const { count: inviteCount } = await supabaseAdmin
        .from('team_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', userData.company_id)
        .eq('status', 'pending');

      const totalSeats = (memberCount || 0) + (inviteCount || 0);

      if (totalSeats >= plan.max_seats) {
        if (plan.extra_seat_price) {
          // Teams plan allows extra seats for a fee - let it through
          // The billing will be handled separately
        } else {
          return NextResponse.json(
            { error: `All ${plan.max_seats} seats are used. Upgrade your plan to add more team members.` },
            { status: 403 }
          );
        }
      }
    }

    // Check if email is already a member of this company
    const { data: existingMember } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('company_id', userData.company_id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'This user is already a member of your team' }, { status: 409 });
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from('team_invitations')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 });
    }

    // Create the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .insert({
        company_id: userData.company_id,
        invited_by: user.id,
        email: email.toLowerCase(),
        role,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // TODO: Send invitation email via Supabase Auth or email service
    // For now, the invitation is created in the database and can be
    // accepted when the user signs up with this email

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error('Error in team invite:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
