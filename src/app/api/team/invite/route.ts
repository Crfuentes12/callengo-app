import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';

/**
 * POST /api/team/invite
 * Send a team invitation. Requires owner or admin role.
 * Only available on Business plan and above.
 * Sends an actual invitation email via Supabase Auth.
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
      .select('company_id, role, full_name')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User not in a company' }, { status: 404 });
    }

    // Only owners and admins can invite
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can invite team members' }, { status: 403 });
    }

    // Get company name for the invitation email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', userData.company_id)
      .single();

    const companyName = company?.name || 'your team';

    // Check subscription plan supports team members
    // Use untyped client because max_seats/extra_seat_price are new columns not yet in Database type
    const { data: subscription } = await supabaseAdminRaw
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
      const { count: memberCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', userData.company_id);

      const { count: inviteCount } = await supabaseAdmin
        .from('team_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', userData.company_id)
        .eq('status', 'pending');

      const totalSeats = (memberCount || 0) + (inviteCount || 0);

      if (totalSeats >= plan.max_seats) {
        if (plan.extra_seat_price) {
          // Teams plan allows extra seats for a fee - let it through
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
    const { data: existingInvite } = await supabaseAdminRaw
      .from('team_invitations')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 });
    }

    // Create the invitation record
    const { data: invitation, error: inviteError } = await supabaseAdminRaw
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

    // Send the actual invitation email via Supabase Auth
    // This uses Supabase's built-in email system to invite the user.
    // When the user clicks the link, they'll be redirected to the app's
    // auth callback which will handle accepting the team invitation.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectTo = `${appUrl}/auth/callback?invite_token=${invitation.token}&type=team_invite`;

    const { data: inviteData, error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo,
        data: {
          invited_to_company: userData.company_id,
          invited_role: role,
          invite_token: invitation.token,
          company_name: companyName,
          invited_by_name: userData.full_name || user.email,
        },
      }
    );

    if (emailError) {
      // If the user already has an account, the invite will fail.
      // In that case, we still have the DB record - we need to notify them differently.
      if (emailError.message?.includes('already been registered') ||
          emailError.message?.includes('already exists')) {
        // User already has a Supabase Auth account - they just need to accept the invite
        // The invitation is in the DB with a token they can use
        console.log(`User ${email} already exists in auth, invitation saved in DB for manual acceptance`);

        return NextResponse.json({
          success: true,
          existing_user: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
          },
          message: `Invitation created for existing user. They can accept it from their Team page.`,
        });
      }

      // For other errors, log but don't fail - the DB record exists
      console.error('Error sending invitation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
      },
      email_sent: !emailError,
    });
  } catch (error) {
    console.error('Error in team invite:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
