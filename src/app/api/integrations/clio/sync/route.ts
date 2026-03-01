// app/api/integrations/clio/sync/route.ts
// Triggers a Clio data sync (contacts)
// Supports both full sync and selective sync (by Clio IDs)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncClioContactsToCallengo,
  syncSelectedClioContacts,
} from '@/lib/clio';
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

    // Parse optional body for selective sync
    let ids: string[] | undefined;
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids;
      }
    } catch {
      // No body or invalid JSON = full sync
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

    let contactsResult;

    if (isSelectiveSync && ids) {
      contactsResult = await syncSelectedClioContacts(clioIntegration, ids);
    } else {
      contactsResult = await syncClioContactsToCallengo(clioIntegration);
    }

    const totalCreated = contactsResult.contacts_created;
    const totalUpdated = contactsResult.contacts_updated;
    const totalSkipped = contactsResult.contacts_skipped;
    const allErrors = [...contactsResult.errors];

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
      contacts: {
        created: contactsResult.contacts_created,
        updated: contactsResult.contacts_updated,
        skipped: contactsResult.contacts_skipped,
      },
      errors: allErrors,
    });
  } catch (error) {
    console.error('Error syncing Clio:', error);
    return NextResponse.json(
      { error: 'Failed to sync Clio data' },
      { status: 500 }
    );
  }
}
