// app/api/integrations/zoho/sync/route.ts
// Triggers a Zoho CRM data sync (inbound, outbound, or bidirectional)
// Supports full sync, selective sync (by Zoho IDs), and outbound push
// IMPORTANT: Outbound sync only UPDATES/adds notes — NEVER deletes from Zoho

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncZohoContactsToCallengo,
  syncZohoLeadsToCallengo,
  syncSelectedZohoContacts,
  syncSelectedZohoLeads,
  pushContactUpdatesToZoho,
} from '@/lib/zoho';
import { isPlanAllowedForIntegration } from '@/config/plan-features';
import type { ZohoIntegration } from '@/types/zoho';

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
    const isSelectiveSync = ids && ids.length > 0;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('zoho_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: zohoIntegration.id,
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

    // INBOUND SYNC (Zoho → Callengo)
    let contactResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] as string[] };
    let leadResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] as string[] };

    if (direction === 'inbound' || direction === 'bidirectional') {
      if (isSelectiveSync && ids) {
        if (type === 'leads') {
          leadResult = await syncSelectedZohoLeads(zohoIntegration, ids);
        } else {
          contactResult = await syncSelectedZohoContacts(zohoIntegration, ids);
        }
      } else {
        if (type === 'all' || type === 'contacts') {
          contactResult = await syncZohoContactsToCallengo(zohoIntegration);
        }
        if (type === 'all' || type === 'leads') {
          leadResult = await syncZohoLeadsToCallengo(zohoIntegration);
        }
      }
    }

    // OUTBOUND SYNC (Callengo → Zoho: Updates and notes only, NEVER deletes)
    let outboundResult = { contacts_updated: 0, notes_created: 0, errors: [] as string[] };
    if (direction === 'outbound' || direction === 'bidirectional') {
      outboundResult = await pushContactUpdatesToZoho(zohoIntegration);
    }

    const totalCreated = contactResult.contacts_created + leadResult.leads_created;
    const totalUpdated = contactResult.contacts_updated + leadResult.leads_updated + outboundResult.contacts_updated;
    const totalSkipped = contactResult.contacts_skipped + leadResult.leads_skipped;
    const allErrors = [...contactResult.errors, ...leadResult.errors, ...outboundResult.errors];

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('zoho_sync_logs')
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
      .from('zoho_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', zohoIntegration.id);

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
    console.error('Error syncing Zoho:', errorMessage, error);

    // Update sync log to failed status so it doesn't stay stuck as 'running'
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData?.company_id) {
          const { data: runningSyncLog } = await supabaseAdmin
            .from('zoho_sync_logs')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (runningSyncLog) {
            await supabaseAdmin
              .from('zoho_sync_logs')
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
      { error: 'Failed to sync Zoho CRM data', details: errorMessage },
      { status: 500 }
    );
  }
}
