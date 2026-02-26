// app/api/integrations/salesforce/users/route.ts
// Returns Salesforce org members for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchSalesforceUsers } from '@/lib/salesforce';
import type { SalesforceIntegration, SalesforceOrgMember } from '@/types/salesforce';

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

    // Get active Salesforce integration
    const { data: integration } = await supabaseAdmin
      .from('salesforce_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Salesforce integration found' },
        { status: 404 }
      );
    }

    const sfIntegration = integration as unknown as SalesforceIntegration;
    const sfUsers = await fetchSalesforceUsers(sfIntegration);

    // Fetch existing Callengo team members to check overlap
    const { data: callengoUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('company_id', userData.company_id);

    const callengoEmailMap = new Map(
      (callengoUsers || []).map((u: { id: string; email: string }) => [u.email.toLowerCase(), u.id])
    );

    // Map SF users to OrgMember format
    const orgMembers: SalesforceOrgMember[] = sfUsers.map((sfUser) => {
      const callengoUserId = callengoEmailMap.get(sfUser.Email.toLowerCase());
      return {
        sf_user_id: sfUser.Id,
        username: sfUser.Username,
        name: sfUser.Name,
        email: sfUser.Email,
        is_active: sfUser.IsActive,
        profile_name: sfUser.Profile?.Name || undefined,
        role_name: sfUser.UserRole?.Name || undefined,
        photo_url: sfUser.SmallPhotoUrl || undefined,
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
    console.error('Error fetching Salesforce users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Salesforce org members' },
      { status: 500 }
    );
  }
}
