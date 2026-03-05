// app/api/integrations/google-calendar/sync/route.ts
// Triggers a sync of Google Calendar events

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getActiveIntegrations, runSync } from '@/lib/calendar/sync';

export async function POST() {
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

    // Get active Google Calendar integration
    const integrations = await getActiveIntegrations(
      userData.company_id,
      'google_calendar'
    );

    if (integrations.length === 0) {
      return NextResponse.json(
        { error: 'No active Google Calendar integration found' },
        { status: 404 }
      );
    }

    // Run sync for the first (primary) integration
    const result = await runSync(integrations[0].id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      message: `Synced ${result.created + result.updated} events`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing Google Calendar:', errorMessage, error);

    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData?.company_id) {
          const { data: runningSyncLog } = await supabaseAdmin
            .from('google_calendar_sync_logs')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (runningSyncLog) {
            await supabaseAdmin
              .from('google_calendar_sync_logs')
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
      { error: 'Failed to sync Google Calendar data', details: errorMessage },
      { status: 500 }
    );
  }
}
