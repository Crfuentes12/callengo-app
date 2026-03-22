// app/api/integrations/clio/sync/route.ts
// Triggers a Clio data sync (inbound, outbound, or bidirectional)
// Supports full sync, selective sync (by Clio IDs), and outbound push

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncClioContactsToCallengo,
  syncSelectedClioContacts,
  pushContactUpdatesToClio,
} from '@/lib/clio';
import { isPlanAllowedForIntegration } from '@/config/plan-features';
import type { ClioIntegration } from '@/types/clio';

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

    // Parse optional body for selective sync and direction
    let ids: string[] | undefined;
    let direction: 'inbound' | 'outbound' | 'bidirectional' = 'inbound';
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids;
      }
      if (body.direction === 'outbound' || body.direction === 'bidirectional') {
        direction = body.direction;
      }
    } catch {
      // No body or invalid JSON = full inbound sync
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
    const isSelectiveSync = ids && ids.length > 0;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('clio_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: clioIntegration.id,
        sync_type: isSelectiveSync ? 'selective' : 'full',
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

    // INBOUND SYNC (Clio → Callengo)
    let inboundResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, errors: [] as string[] };
    if (direction === 'inbound' || direction === 'bidirectional') {
      if (isSelectiveSync && ids) {
        inboundResult = await syncSelectedClioContacts(clioIntegration, ids);
      } else {
        inboundResult = await syncClioContactsToCallengo(clioIntegration);
      }
    }

    // OUTBOUND SYNC (Callengo → Clio: Contact Notes only, Contacts Write unavailable)
    let outboundResult = { notes_created: 0, errors: [] as string[] };
    if (direction === 'outbound' || direction === 'bidirectional') {
      outboundResult = await pushContactUpdatesToClio(clioIntegration);
    }

    const totalCreated = inboundResult.contacts_created + outboundResult.notes_created;
    const totalUpdated = inboundResult.contacts_updated;
    const totalSkipped = inboundResult.contacts_skipped;
    const allErrors = [...inboundResult.errors, ...outboundResult.errors];

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('clio_sync_logs')
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
      .from('clio_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', clioIntegration.id);

    return NextResponse.json({
      success: true,
      direction,
      inbound: {
        contacts_created: inboundResult.contacts_created,
        contacts_updated: inboundResult.contacts_updated,
        contacts_skipped: inboundResult.contacts_skipped,
      },
      outbound: {
        notes_created: outboundResult.notes_created,
      },
      errors: allErrors,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing Clio:', errorMessage, error);

    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData?.company_id) {
          const { data: runningSyncLog } = await supabaseAdmin
            .from('clio_sync_logs')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (runningSyncLog) {
            await supabaseAdmin
              .from('clio_sync_logs')
              .update({
                status: 'failed',
                error_message: errorMessage,
                completed_at: new Date().toISOString(),
              })
              .eq('id', runningSyncLog.id);
          }
        }
      }
    } catch (logError) {
      console.error('Failed to update sync log on error:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to sync Clio data', details: errorMessage },
      { status: 500 }
    );
  }
}
