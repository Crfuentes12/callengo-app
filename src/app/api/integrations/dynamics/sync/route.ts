// app/api/integrations/dynamics/sync/route.ts
// Triggers a Microsoft Dynamics data sync (inbound, outbound, or bidirectional)
// Supports full sync, selective sync (by Dynamics IDs), and outbound push
// IMPORTANT: Outbound sync only UPDATES/adds notes — NEVER deletes from Dynamics

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncDynamicsContactsToCallengo,
  syncDynamicsLeadsToCallengo,
  syncSelectedDynamicsContacts,
  syncSelectedDynamicsLeads,
  pushContactUpdatesToDynamics,
} from '@/lib/dynamics';
import { isPlanAllowedForIntegration } from '@/config/plan-features';
import type { DynamicsIntegration } from '@/types/dynamics';

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
    let type: 'contacts' | 'leads' | 'all' = 'all';
    let direction: 'inbound' | 'outbound' | 'bidirectional' = 'inbound';
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids;
      }
      if (body.type === 'contacts' || body.type === 'leads') {
        type = body.type;
      }
      if (body.direction === 'outbound' || body.direction === 'bidirectional') {
        direction = body.direction;
      }
    } catch {
      // No body or invalid JSON = full inbound sync
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
    const isSelectiveSync = ids && ids.length > 0;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('dynamics_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: dynamicsIntegration.id,
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

    // INBOUND SYNC (Dynamics → Callengo)
    let contactResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] as string[] };
    let leadResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] as string[] };

    if (direction === 'inbound' || direction === 'bidirectional') {
      if (isSelectiveSync && ids) {
        if (type === 'leads') {
          leadResult = await syncSelectedDynamicsLeads(dynamicsIntegration, ids);
        } else {
          contactResult = await syncSelectedDynamicsContacts(dynamicsIntegration, ids);
        }
      } else {
        if (type === 'all' || type === 'contacts') {
          contactResult = await syncDynamicsContactsToCallengo(dynamicsIntegration);
        }
        if (type === 'all' || type === 'leads') {
          leadResult = await syncDynamicsLeadsToCallengo(dynamicsIntegration);
        }
      }
    }

    // OUTBOUND SYNC (Callengo → Dynamics: Notes only, NEVER deletes)
    let outboundResult = { contacts_updated: 0, notes_created: 0, errors: [] as string[] };
    if (direction === 'outbound' || direction === 'bidirectional') {
      outboundResult = await pushContactUpdatesToDynamics(dynamicsIntegration);
    }

    const totalCreated = contactResult.contacts_created + leadResult.leads_created;
    const totalUpdated = contactResult.contacts_updated + leadResult.leads_updated + outboundResult.contacts_updated;
    const totalSkipped = contactResult.contacts_skipped + leadResult.leads_skipped;
    const allErrors = [...contactResult.errors, ...leadResult.errors, ...outboundResult.errors];

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('dynamics_sync_logs')
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
      .from('dynamics_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', dynamicsIntegration.id);

    return NextResponse.json({
      success: true,
      direction,
      contacts: {
        created: contactResult.contacts_created,
        updated: contactResult.contacts_updated,
        skipped: contactResult.contacts_skipped,
      },
      leads: {
        created: leadResult.leads_created,
        updated: leadResult.leads_updated,
        skipped: leadResult.leads_skipped,
      },
      outbound: {
        notes_created: outboundResult.notes_created,
      },
      errors: allErrors,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing Dynamics:', errorMessage, error);

    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData?.company_id) {
          const { data: runningSyncLog } = await supabaseAdmin
            .from('dynamics_sync_logs')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (runningSyncLog) {
            await supabaseAdmin
              .from('dynamics_sync_logs')
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
      { error: 'Failed to sync Dynamics 365 data', details: errorMessage },
      { status: 500 }
    );
  }
}
