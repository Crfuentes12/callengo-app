// app/api/integrations/pipedrive/users/route.ts
// Returns Pipedrive org members for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchPipedriveUsers } from '@/lib/pipedrive';
import type { PipedriveIntegration, PipedriveOrgMember, PipedriveUser } from '@/types/pipedrive';

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

    // Get active Pipedrive integration
    const { data: integration } = await supabaseAdmin
      .from('pipedrive_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Pipedrive integration found' },
        { status: 404 }
      );
    }

    const pdIntegration = integration as unknown as PipedriveIntegration;

    let pdUsers: PipedriveUser[] = [];
    try {
      pdUsers = await fetchPipedriveUsers(pdIntegration);
    } catch (err) {
      console.error('Error fetching Pipedrive users:', err);
      return NextResponse.json({
        members: [],
        total: 0,
        already_connected: 0,
        warning: 'Could not fetch users from Pipedrive. The connection may need to be refreshed.',
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

    // Map PD users to OrgMember format
    const orgMembers: PipedriveOrgMember[] = pdUsers
      .filter((pdUser) => pdUser.email)
      .map((pdUser) => {
        const callengoUserId = callengoEmailMap.get(pdUser.email.toLowerCase()) as string | undefined;
        return {
          pd_user_id: pdUser.id,
          name: pdUser.name,
          email: pdUser.email,
          is_active: pdUser.active_flag,
          is_admin: pdUser.is_admin === 1,
          phone: pdUser.phone || undefined,
          icon_url: pdUser.icon_url || undefined,
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
    console.error('Error fetching Pipedrive users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Pipedrive org members' },
      { status: 500 }
    );
  }
}
