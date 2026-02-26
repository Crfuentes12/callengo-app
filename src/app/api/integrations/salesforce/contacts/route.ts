// app/api/integrations/salesforce/contacts/route.ts
// Returns Salesforce contacts and leads for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchSalesforceContacts, fetchSalesforceLeads } from '@/lib/salesforce';
import type { SalesforceIntegration } from '@/types/salesforce';

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

    const type = request.nextUrl.searchParams.get('type') || 'all';
    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    let contacts: unknown[] = [];
    let leads: unknown[] = [];

    if (type === 'all' || type === 'contacts') {
      contacts = await fetchSalesforceContacts(sfIntegration, { limit });
    }

    if (type === 'all' || type === 'leads') {
      leads = await fetchSalesforceLeads(sfIntegration, { limit });
    }

    // Get mappings to show sync status
    const { data: mappings } = await supabaseAdmin
      .from('salesforce_contact_mappings')
      .select('sf_contact_id, sf_lead_id, callengo_contact_id, last_synced_at')
      .eq('integration_id', sfIntegration.id);

    return NextResponse.json({
      contacts,
      leads,
      mappings: mappings || [],
      instance_url: sfIntegration.instance_url,
    });
  } catch (error) {
    console.error('Error fetching Salesforce contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Salesforce contacts' },
      { status: 500 }
    );
  }
}
