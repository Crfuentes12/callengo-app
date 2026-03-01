// app/api/integrations/clio/contacts/route.ts
// Returns Clio contacts for the contacts sub-page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { fetchClioContacts } from '@/lib/clio';
import type { ClioIntegration } from '@/types/clio';

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

    // Get active Clio integration
    const { data: integration } = await supabaseAdmin
      .from('clio_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Clio integration found' },
        { status: 404 }
      );
    }

    const clioIntegration = integration as unknown as ClioIntegration;

    const limitStr = request.nextUrl.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 200;

    let contacts: unknown[] = [];
    const warnings: string[] = [];

    try {
      contacts = await fetchClioContacts(clioIntegration, { limit });
    } catch (err) {
      console.error('Error fetching Clio contacts:', err);
      warnings.push('Could not fetch contacts from Clio');
    }

    // Get mappings to show sync status
    let mappings: unknown[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('clio_contact_mappings')
        .select('clio_contact_id, callengo_contact_id, last_synced_at')
        .eq('integration_id', clioIntegration.id);
      mappings = data || [];
    } catch {
      // Table may not exist yet, that's fine
    }

    return NextResponse.json({
      contacts,
      mappings,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error('Error fetching Clio contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Clio contacts' },
      { status: 500 }
    );
  }
}
