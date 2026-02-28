// app/api/integrations/pipedrive/contacts/route.ts
// Returns Pipedrive persons (contacts) for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchPipedrivePersons } from '@/lib/pipedrive';
import type { PipedriveIntegration } from '@/types/pipedrive';

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

    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 200;

    let persons: unknown[] = [];
    const warnings: string[] = [];

    try {
      persons = await fetchPipedrivePersons(pdIntegration, { limit });
    } catch (err) {
      console.error('Error fetching Pipedrive persons:', err);
      warnings.push('Could not fetch persons from Pipedrive');
    }

    // Get mappings to show sync status
    let mappings: unknown[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('pipedrive_contact_mappings')
        .select('pd_person_id, callengo_contact_id, last_synced_at')
        .eq('integration_id', pdIntegration.id);
      mappings = data || [];
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      persons,
      mappings,
      api_domain: pdIntegration.api_domain,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error('Error fetching Pipedrive contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Pipedrive contacts' },
      { status: 500 }
    );
  }
}
