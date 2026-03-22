// app/api/integrations/hubspot/sync/route.ts
// Triggers a HubSpot data sync (contacts)
// Supports both full sync and selective sync (by HubSpot IDs)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  syncHubSpotContactsToCallengo,
  syncSelectedHubSpotContacts,
} from '@/lib/hubspot';
import { isPlanAllowedForIntegration } from '@/config/plan-features';
import type { HubSpotIntegration } from '@/types/hubspot';

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

    // Get active HubSpot integration
    const { data: integration } = await supabaseAdmin
      .from('hubspot_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'No active HubSpot integration found' },
        { status: 404 }
      );
    }

    // Verify company plan still allows HubSpot integration
    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('subscription_plans(slug)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.subscription_plans as unknown as { slug: string })?.slug || 'free';
    if (!isPlanAllowedForIntegration(planSlug, 'hubspot')) {
      return NextResponse.json(
        { error: 'Your current plan does not include HubSpot integration. Please upgrade to Business or higher.' },
        { status: 403 }
      );
    }

    const hsIntegration = integration as unknown as HubSpotIntegration;
    const isSelectiveSync = ids && ids.length > 0;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from('hubspot_sync_logs')
      .insert({
        company_id: userData.company_id,
        integration_id: hsIntegration.id,
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
      syncResult = await syncSelectedHubSpotContacts(hsIntegration, ids);
    } else {
      syncResult = await syncHubSpotContactsToCallengo(hsIntegration);
    }

    const totalCreated = syncResult.contacts_created;
    const totalUpdated = syncResult.contacts_updated;
    const totalSkipped = syncResult.contacts_skipped;
    const allErrors = syncResult.errors;

    // Update sync log
    if (syncLog) {
      await supabaseAdmin
        .from('hubspot_sync_logs')
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
      .from('hubspot_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', hsIntegration.id);

    return NextResponse.json({
      success: true,
      contacts: {
        created: syncResult.contacts_created,
        updated: syncResult.contacts_updated,
        skipped: syncResult.contacts_skipped,
      },
      errors: allErrors,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing HubSpot:', errorMessage, error);

    // Update sync log to failed status so it doesn't stay stuck as 'running'
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData?.company_id) {
          // Find the most recent running sync log for this company
          const { data: runningSyncLog } = await supabaseAdmin
            .from('hubspot_sync_logs')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (runningSyncLog) {
            await supabaseAdmin
              .from('hubspot_sync_logs')
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
      { error: 'Failed to sync HubSpot data', details: errorMessage },
      { status: 500 }
    );
  }
}
