// app/api/integrations/pipedrive/sync/route.ts
// Triggers a Pipedrive data sync (inbound, outbound, or bidirectional)
// Supports full sync, selective sync (by Pipedrive IDs), and outbound push

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncPipedrivePersonsToCallengo,
  syncSelectedPipedrivePersons,
  pushContactUpdatesToPipedrive,
} from '@/lib/pipedrive';
import type { PipedriveIntegration } from '@/types/pipedrive';

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

    // Parse body for sync options
    let ids: number[] | undefined;
    let direction: 'inbound' | 'outbound' | 'bidirectional' = 'inbound';
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids.map((id: unknown) => Number(id));
      }
      if (body.direction === 'outbound' || body.direction === 'bidirectional') {
        direction = body.direction;
      }
    } catch {
      // No body or invalid JSON = full inbound sync
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
    const isSelectiveSync = ids && ids.length > 0;
    const syncType = isSelectiveSync ? 'selective' : 'full';

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('pipedrive_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: pdIntegration.id,
        sync_type: syncType,
        sync_direction: direction,
        records_created: 0,
        records_updated: 0,
        records_skipped: 0,
        errors: [],
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single();

    const allErrors: string[] = [];
    let inboundResult = { persons_created: 0, persons_updated: 0, persons_skipped: 0, errors: [] as string[] };
    let outboundResult = { persons_pushed: 0, activities_created: 0, notes_created: 0, errors: [] as string[] };

    // ---- INBOUND: Pipedrive → Callengo ----
    if (direction === 'inbound' || direction === 'bidirectional') {
      if (isSelectiveSync && ids) {
        inboundResult = await syncSelectedPipedrivePersons(pdIntegration, ids);
      } else {
        inboundResult = await syncPipedrivePersonsToCallengo(pdIntegration);
      }
      allErrors.push(...inboundResult.errors);
    }

    // ---- OUTBOUND: Callengo → Pipedrive ----
    if (direction === 'outbound' || direction === 'bidirectional') {
      outboundResult = await pushContactUpdatesToPipedrive(pdIntegration);
      allErrors.push(...outboundResult.errors);
    }

    // Update sync log
    const totalCreated = inboundResult.persons_created;
    const totalUpdated = inboundResult.persons_updated + outboundResult.persons_pushed;
    const totalSkipped = inboundResult.persons_skipped;

    if (syncLog) {
      await supabaseAdmin
        .from('pipedrive_sync_logs')
        .update({
          records_created: totalCreated,
          records_updated: totalUpdated,
          records_skipped: totalSkipped,
          errors: allErrors,
          completed_at: new Date().toISOString(),
          status: allErrors.length > 0 ? 'completed_with_errors' : 'completed',
          error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
        })
        .eq('id', syncLog.id);
    }

    // Update last_synced_at on integration
    await supabaseAdmin
      .from('pipedrive_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', pdIntegration.id);

    return NextResponse.json({
      success: true,
      direction,
      inbound: {
        created: inboundResult.persons_created,
        updated: inboundResult.persons_updated,
        skipped: inboundResult.persons_skipped,
      },
      outbound: {
        persons_pushed: outboundResult.persons_pushed,
        activities_created: outboundResult.activities_created,
        notes_created: outboundResult.notes_created,
      },
      errors: allErrors,
    });
  } catch (error) {
    console.error('Error syncing Pipedrive:', error);
    return NextResponse.json(
      { error: 'Failed to sync Pipedrive data' },
      { status: 500 }
    );
  }
}
