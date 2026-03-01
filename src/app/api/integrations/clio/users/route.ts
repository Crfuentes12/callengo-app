// app/api/integrations/clio/users/route.ts
// Returns Clio firm members for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchClioUsers } from '@/lib/clio';
import type { ClioIntegration, ClioOrgMember, ClioUser } from '@/types/clio';

export async function GET() {
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

    // Get active Clio integration
    const { data: integration } = await supabaseAdmin
      .from('clio_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Clio integration found' },
        { status: 404 }
      );
    }

    const clioIntegration = integration as unknown as ClioIntegration;

    let clioUsers: ClioUser[] = [];
    try {
      clioUsers = await fetchClioUsers(clioIntegration);
    } catch (err) {
      console.error('Error fetching Clio users:', err);
      return NextResponse.json({
        members: [],
        total: 0,
        already_connected: 0,
        warning: 'Could not fetch users from Clio. The connection may need to be refreshed.',
      });
    }

    // Fetch existing Callengo team members to check overlap
    const { data: callengoUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('company_id', userData.company_id);

    const callengoEmailMap = new Map(
      (callengoUsers || []).map((u: { id: string; email: string }) => [u.email?.toLowerCase(), u.id])
    );

    // Map Clio users to OrgMember format
    const orgMembers: ClioOrgMember[] = clioUsers
      .filter((clioUser) => clioUser.email)
      .map((clioUser) => {
        const callengoUserId = callengoEmailMap.get(clioUser.email.toLowerCase());
        return {
          clio_user_id: String(clioUser.id),
          name: clioUser.name,
          email: clioUser.email,
          is_active: clioUser.enabled,
          subscription_type: clioUser.subscription_type || undefined,
          account_owner: clioUser.account_owner,
          already_in_callengo: !!callengoUserId,
          callengo_user_id: callengoUserId || undefined,
        };
      });

    return NextResponse.json({
      members: orgMembers,
      total: orgMembers.length,
      already_connected: orgMembers.filter((m) => m.already_in_callengo).length,
    });
  } catch (error) {
    console.error('Error fetching Clio users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Clio firm members' },
      { status: 500 }
    );
  }
}
