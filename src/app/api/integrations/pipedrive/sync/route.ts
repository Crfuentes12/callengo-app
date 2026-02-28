// app/api/integrations/pipedrive/sync/route.ts
// Triggers a Pipedrive data sync (persons)
// Supports both full sync and selective sync (by Pipedrive IDs)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncPipedrivePersonsToCallengo,
  syncSelectedPipedrivePersons,
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

    // Parse optional body for selective sync
    let ids: number[] | undefined;
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids.map((id: unknown) => Number(id));
      }
    } catch {
      // No body or invalid JSON = full sync
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

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('pipedrive_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: pdIntegration.id,
        sync_type: isSelectiveSync ? 'selective' : 'full',
        sync_direction: 'inbound',
        records_created: 0,
        records_updated: 0,
        records_skipped: 0,
        errors: [],
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single();

    let syncResult;

    if (isSelectiveSync && ids) {
      syncResult = await syncSelectedPipedrivePersons(pdIntegration, ids);
    } else {
      syncResult = await syncPipedrivePersonsToCallengo(pdIntegration);
    }

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('pipedrive_sync_logs')
        .update({
          records_created: syncResult.persons_created,
          records_updated: syncResult.persons_updated,
          records_skipped: syncResult.persons_skipped,
          errors: syncResult.errors,
          completed_at: new Date().toISOString(),
          status: syncResult.errors.length > 0 ? 'completed_with_errors' : 'completed',
          error_message: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null,
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
      persons: {
        created: syncResult.persons_created,
        updated: syncResult.persons_updated,
        skipped: syncResult.persons_skipped,
      },
      errors: syncResult.errors,
    });
  } catch (error) {
    console.error('Error syncing Pipedrive:', error);
    return NextResponse.json(
      { error: 'Failed to sync Pipedrive data' },
      { status: 500 }
    );
  }
}
