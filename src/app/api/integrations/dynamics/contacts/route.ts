// app/api/integrations/dynamics/contacts/route.ts
// Returns Microsoft Dynamics contacts and leads for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchDynamicsContacts, fetchDynamicsLeads } from '@/lib/dynamics';
import type { DynamicsIntegration } from '@/types/dynamics';

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

    const typeParam = request.nextUrl.searchParams.get('type') || 'all';
    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 200;

    let contacts: unknown[] = [];
    let leads: unknown[] = [];
    const warnings: string[] = [];

    if (typeParam === 'all' || typeParam === 'contacts') {
      try {
        contacts = await fetchDynamicsContacts(dynamicsIntegration, { limit });
      } catch (err) {
        console.error('Error fetching Dynamics contacts:', err);
        warnings.push('Could not fetch contacts from Microsoft Dynamics');
      }
    }

    if (typeParam === 'all' || typeParam === 'leads') {
      try {
        leads = await fetchDynamicsLeads(dynamicsIntegration, { limit });
      } catch (err) {
        console.error('Error fetching Dynamics leads:', err);
        warnings.push('Could not fetch leads from Microsoft Dynamics');
      }
    }

    // Get mappings to show sync status
    let mappings: unknown[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('dynamics_contact_mappings')
        .select('dynamics_contact_id, dynamics_entity_type, callengo_contact_id, last_synced_at')
        .eq('integration_id', dynamicsIntegration.id);
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
    console.error('Error fetching Dynamics contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Microsoft Dynamics contacts' },
      { status: 500 }
    );
  }
}
