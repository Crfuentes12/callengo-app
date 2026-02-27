// app/api/integrations/salesforce/sync/route.ts
// Triggers a Salesforce data sync (contacts + leads)
// Supports both full sync and selective sync (by Salesforce IDs)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncSalesforceContactsToCallengo,
  syncSalesforceLeadsToCallengo,
  syncSelectedSalesforceContacts,
  syncSelectedSalesforceLeads,
} from '@/lib/salesforce';
import type { SalesforceIntegration } from '@/types/salesforce';

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
    let type: 'contacts' | 'leads' | undefined;
    try {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        ids = body.ids;
        type = body.type === 'leads' ? 'leads' : 'contacts';
      }
    } catch {
      // No body or invalid JSON = full sync
    }

    // Get active Salesforce integration
    const { data: integration } = await supabaseAdmin
      .from('salesforce_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active Salesforce integration found' },
        { status: 404 }
      );
    }

    const sfIntegration = integration as unknown as SalesforceIntegration;
    const isSelectiveSync = ids && ids.length > 0;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('salesforce_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: sfIntegration.id,
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

    let contactsResult, leadsResult;

    if (isSelectiveSync && ids) {
      // Selective sync: only sync the specific IDs
      if (type === 'contacts') {
        contactsResult = await syncSelectedSalesforceContacts(sfIntegration, ids);
        leadsResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] };
      } else {
        contactsResult = { contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, leads_created: 0, leads_updated: 0, leads_skipped: 0, errors: [] };
        leadsResult = await syncSelectedSalesforceLeads(sfIntegration, ids);
      }
    } else {
      // Full sync: sync all contacts and leads
      [contactsResult, leadsResult] = await Promise.all([
        syncSalesforceContactsToCallengo(sfIntegration),
        syncSalesforceLeadsToCallengo(sfIntegration),
      ]);
    }

    const totalCreated = contactsResult.contacts_created + leadsResult.leads_created;
    const totalUpdated = contactsResult.contacts_updated + leadsResult.leads_updated;
    const totalSkipped = contactsResult.contacts_skipped + leadsResult.leads_skipped;
    const allErrors = [...contactsResult.errors, ...leadsResult.errors];

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('salesforce_sync_logs')
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
      .from('salesforce_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', sfIntegration.id);

    return NextResponse.json({
      success: true,
      contacts: {
        created: contactsResult.contacts_created,
        updated: contactsResult.contacts_updated,
        skipped: contactsResult.contacts_skipped,
      },
      leads: {
        created: leadsResult.leads_created,
        updated: leadsResult.leads_updated,
        skipped: leadsResult.leads_skipped,
      },
      errors: allErrors,
    });
  } catch (error) {
    console.error('Error syncing Salesforce:', error);
    return NextResponse.json(
      { error: 'Failed to sync Salesforce data' },
      { status: 500 }
    );
  }
}
