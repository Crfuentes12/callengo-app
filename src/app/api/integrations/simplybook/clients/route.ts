// app/api/integrations/simplybook/clients/route.ts
// Returns SimplyBook.me clients with their Callengo mapping status

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import { fetchSimplyBookClients } from '@/lib/simplybook';
import type { SimplyBookIntegration } from '@/types/simplybook';

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

    const { data: integration } = await supabaseAdminRaw
      .from('simplybook_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({ error: 'No active SimplyBook.me integration' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || undefined;

    // Fetch clients from SimplyBook
    const clientsResponse = await fetchSimplyBookClients(
      integration as SimplyBookIntegration,
      { page, limit, search }
    );

    // Fetch existing mappings to show sync status
    const clientIds = clientsResponse.data.map(c => String(c.id));
    const { data: mappings } = await supabaseAdminRaw
      .from('simplybook_contact_mappings')
      .select('sb_client_id, callengo_contact_id')
      .eq('integration_id', integration.id)
      .in('sb_client_id', clientIds.length > 0 ? clientIds : ['__none__']);

    const mappingMap = new Map<string, string>();
    if (mappings) {
      for (const m of mappings) {
        mappingMap.set(m.sb_client_id, m.callengo_contact_id);
      }
    }

    const enrichedClients = clientsResponse.data.map(client => ({
      ...client,
      already_synced: mappingMap.has(String(client.id)),
      callengo_contact_id: mappingMap.get(String(client.id)) || null,
    }));

    return NextResponse.json({
      clients: enrichedClients,
      metadata: clientsResponse.metadata,
    });
  } catch (error) {
    console.error('Error fetching SimplyBook.me clients:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
