// app/api/integrations/zoho/contacts/route.ts
// Returns Zoho CRM contacts and leads for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchZohoContacts, fetchZohoLeads } from '@/lib/zoho';
import type { ZohoIntegration } from '@/types/zoho';

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

    const typeParam = request.nextUrl.searchParams.get('type') || 'all';
    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 200;

    let contacts: unknown[] = [];
    let leads: unknown[] = [];
    const warnings: string[] = [];

    if (typeParam === 'all' || typeParam === 'contacts') {
      try {
        contacts = await fetchZohoContacts(zohoIntegration, { limit });
      } catch (err) {
        console.error('Error fetching Zoho contacts:', err);
        warnings.push('Could not fetch contacts from Zoho CRM');
      }
    }

    if (typeParam === 'all' || typeParam === 'leads') {
      try {
        leads = await fetchZohoLeads(zohoIntegration, { limit });
      } catch (err) {
        console.error('Error fetching Zoho leads:', err);
        warnings.push('Could not fetch leads from Zoho CRM');
      }
    }

    // Get mappings to show sync status
    let mappings: unknown[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('zoho_contact_mappings')
        .select('zoho_contact_id, zoho_object_type, callengo_contact_id, last_synced_at')
        .eq('integration_id', zohoIntegration.id);
      mappings = data || [];
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      contacts,
      leads,
      mappings,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error('Error fetching Zoho contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Zoho CRM contacts' },
      { status: 500 }
    );
  }
}
