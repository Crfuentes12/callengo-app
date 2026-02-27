// app/api/integrations/hubspot/users/route.ts
// Returns HubSpot org members (owners) for the Team page preview

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchHubSpotOwners } from '@/lib/hubspot';
import type { HubSpotIntegration, HubSpotOrgMember, HubSpotOwner } from '@/types/hubspot';

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

    // Get active HubSpot integration
    const { data: integration } = await supabaseAdmin
      .from('hubspot_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active HubSpot integration found' },
        { status: 404 }
      );
    }

    const hsIntegration = integration as unknown as HubSpotIntegration;

    let hsOwners: HubSpotOwner[] = [];
    try {
      hsOwners = await fetchHubSpotOwners(hsIntegration);
    } catch (err) {
      console.error('Error fetching HubSpot owners:', err);
      return NextResponse.json({
        members: [],
        total: 0,
        already_connected: 0,
        warning: 'Could not fetch users from HubSpot. The connection may need to be refreshed.',
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

    // Map HS owners to OrgMember format
    const orgMembers: HubSpotOrgMember[] = hsOwners
      .filter((owner) => owner.email && !owner.archived)
      .map((owner) => {
        const callengoUserId = callengoEmailMap.get(owner.email.toLowerCase());
        return {
          hs_owner_id: owner.id,
          user_id: owner.userId,
          name: `${owner.firstName} ${owner.lastName}`.trim() || owner.email,
          email: owner.email,
          is_active: !owner.archived,
          teams: owner.teams?.map((t) => t.name) || [],
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
    console.error('Error fetching HubSpot users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HubSpot org members' },
      { status: 500 }
    );
  }
}
