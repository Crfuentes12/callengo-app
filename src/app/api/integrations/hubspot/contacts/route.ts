// app/api/integrations/hubspot/contacts/route.ts
// Returns HubSpot contacts for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchHubSpotContacts } from '@/lib/hubspot';
import type { HubSpotIntegration } from '@/types/hubspot';

export async function GET(request: NextRequest) {
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

    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 200;

    let contacts: unknown[] = [];
    const warnings: string[] = [];

    try {
      contacts = await fetchHubSpotContacts(hsIntegration, { limit });
    } catch (err) {
      console.error('Error fetching HubSpot contacts:', err);
      warnings.push('Could not fetch contacts from HubSpot');
    }

    // Get mappings to show sync status
    let mappings: unknown[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('hubspot_contact_mappings')
        .select('hs_contact_id, callengo_contact_id, last_synced_at')
        .eq('integration_id', hsIntegration.id);
      mappings = data || [];
    } catch {
      // Table may not exist yet, that's fine
    }

    return NextResponse.json({
      contacts,
      mappings,
      hub_domain: hsIntegration.hub_domain,
      hub_id: hsIntegration.hub_id,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error('Error fetching HubSpot contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HubSpot contacts' },
      { status: 500 }
    );
  }
}
