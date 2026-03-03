// app/api/integrations/dynamics/users/route.ts
// Returns Microsoft Dynamics org members for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchDynamicsUsers } from '@/lib/dynamics';
import type { DynamicsIntegration, DynamicsOrgMember, DynamicsUser } from '@/types/dynamics';

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

    // Get active Dynamics integration
    const { data: integration } = await supabaseAdmin
      .from('dynamics_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Microsoft Dynamics integration found' },
        { status: 404 }
      );
    }

    const dynamicsIntegration = integration as unknown as DynamicsIntegration;

    let dynamicsUsers: DynamicsUser[] = [];
    try {
      dynamicsUsers = await fetchDynamicsUsers(dynamicsIntegration);
    } catch (err) {
      console.error('Error fetching Dynamics users:', err);
      return NextResponse.json({
        members: [],
        total: 0,
        already_connected: 0,
        warning: 'Could not fetch users from Microsoft Dynamics. The connection may need to be refreshed.',
      });
    }

    // Fetch existing Callengo team members to check overlap
    const { data: callengoUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('company_id', userData.company_id);

    const callengoEmailMap = new Map<string, string>(
      (callengoUsers || []).map((u: { id: string; email: string }) => [u.email?.toLowerCase(), u.id])
    );

    // Map Dynamics users to OrgMember format
    const orgMembers: DynamicsOrgMember[] = dynamicsUsers
      .filter((du) => du.internalemailaddress)
      .map((du) => {
        const callengoUserId = callengoEmailMap.get(du.internalemailaddress.toLowerCase());
        return {
          dynamics_user_id: String(du.systemuserid),
          name: du.fullname || '',
          email: du.internalemailaddress,
          is_active: !du.isdisabled,
          title: du.jobtitle || du.title || undefined,
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
    console.error('Error fetching Dynamics users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Microsoft Dynamics org members' },
      { status: 500 }
    );
  }
}
