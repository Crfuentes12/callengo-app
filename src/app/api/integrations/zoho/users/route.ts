// app/api/integrations/zoho/users/route.ts
// Returns Zoho CRM org members for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchZohoUsers } from '@/lib/zoho';
import type { ZohoIntegration, ZohoOrgMember, ZohoUser } from '@/types/zoho';

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

    // Get active Zoho integration
    const { data: integration } = await supabaseAdmin
      .from('zoho_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Zoho CRM integration found' },
        { status: 404 }
      );
    }

    const zohoIntegration = integration as unknown as ZohoIntegration;

    let zohoUsers: ZohoUser[] = [];
    try {
      zohoUsers = await fetchZohoUsers(zohoIntegration);
    } catch (err) {
      console.error('Error fetching Zoho users:', err);
      return NextResponse.json({
        members: [],
        total: 0,
        already_connected: 0,
        warning: 'Could not fetch users from Zoho CRM. The connection may need to be refreshed.',
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

    // Map Zoho users to OrgMember format
    const orgMembers: ZohoOrgMember[] = zohoUsers
      .filter((zohoUser) => zohoUser.email)
      .map((zohoUser) => {
        const callengoUserId = callengoEmailMap.get(zohoUser.email.toLowerCase());
        return {
          zoho_user_id: String(zohoUser.id),
          name: zohoUser.full_name || `${zohoUser.first_name} ${zohoUser.last_name}`.trim(),
          email: zohoUser.email,
          is_active: zohoUser.status === 'active',
          role: zohoUser.role?.name || undefined,
          profile: zohoUser.profile?.name || undefined,
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
    console.error('Error fetching Zoho users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Zoho CRM org members' },
      { status: 500 }
    );
  }
}
