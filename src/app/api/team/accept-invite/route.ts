import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { apiLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateBody } from '@/lib/validation';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

/**
 * POST /api/team/accept-invite
 * Accept a team invitation. The authenticated user must match the invitation email.
 * This endpoint is called during onboarding or when a user clicks the invite link.
 */
export async function POST(req: NextRequest) {
  const rateLimitResult = applyRateLimit(req, apiLimiter, 30);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json();
    const validation = validateBody(acceptInviteSchema, rawBody);
    if (!validation.success) return validation.response;
    const { token } = validation.data;

    // Find the invitation by token
    const { data: invitation } = await supabaseAdminRaw
      .from('team_invitations')
      .select('*, companies(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdminRaw
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Verify the email matches
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if user is already in another company
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, company_id')
      .eq('id', user.id)
      .single();

    if (existingUser?.company_id && existingUser.company_id !== invitation.company_id) {
      return NextResponse.json(
        { error: 'You are already a member of another company. Please leave your current company first.' },
        { status: 409 }
      );
    }

    // Accept the invitation: update user's company and role
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        company_id: invitation.company_id,
        role: invitation.role,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error accepting invitation:', updateError);
      return NextResponse.json({ error: 'Failed to join team' }, { status: 500 });
    }

    // Mark invitation as accepted
    await supabaseAdminRaw
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      company_id: invitation.company_id,
      company_name: (invitation.companies as { name: string } | null)?.name,
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
