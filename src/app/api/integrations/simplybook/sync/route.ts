// app/api/integrations/simplybook/sync/route.ts
// Triggers sync operations for SimplyBook.me integration

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import {
  syncSimplyBookClientsToCallengo,
  syncSelectedSimplyBookClients,
} from '@/lib/simplybook';
import type { SimplyBookIntegration } from '@/types/simplybook';

export async function POST(request: NextRequest) {
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

    // Get active integration
    const { data: integration } = await supabaseAdminRaw
      .from('simplybook_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({ error: 'No active SimplyBook.me integration' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const syncType = body.sync_type || 'full';
    const selectedIds = body.client_ids as number[] | undefined;

    let result;

    if (syncType === 'selective' && selectedIds && selectedIds.length > 0) {
      result = await syncSelectedSimplyBookClients(
        integration as SimplyBookIntegration,
        selectedIds
      );
    } else {
      result = await syncSimplyBookClientsToCallengo(
        integration as SimplyBookIntegration
      );
    }

    return NextResponse.json({
      success: true,
      sync_type: syncType,
      result,
    });
  } catch (error) {
    console.error('Error syncing SimplyBook.me:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
