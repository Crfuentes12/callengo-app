import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { validateBody } from '@/lib/validation';
import { apiLimiter, applyRateLimit } from '@/lib/rate-limit';

const cancelInviteSchema = z.object({
  inviteId: z.string().uuid('Invalid invite ID'),
});

/**
 * POST /api/team/cancel-invite
 * Cancel a pending team invitation. Requires owner or admin role.
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
    const validation = validateBody(cancelInviteSchema, rawBody);
    if (!validation.success) return validation.response;
    const { inviteId } = validation.data;

    // Get current user data
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User not in a company' }, { status: 404 });
    }

    // Only owners and admins can cancel invitations
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can cancel invitations' }, { status: 403 });
    }

    // Verify the invitation belongs to this company and is pending
    const { data: invitation } = await supabaseAdminRaw
      .from('team_invitations')
      .select('id, company_id, status')
      .eq('id', inviteId)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Invitation does not belong to your company' }, { status: 403 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is not pending' }, { status: 400 });
    }

    // Cancel the invitation
    const { error: updateError } = await supabaseAdminRaw
      .from('team_invitations')
      .update({ status: 'cancelled' })
      .eq('id', inviteId);

    if (updateError) {
      console.error('Error cancelling invitation:', updateError);
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in cancel invite:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
