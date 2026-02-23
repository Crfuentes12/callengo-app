// app/api/integrations/calendly/sync/route.ts
// Triggers a sync of Calendly events

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    // Get active Calendly integration
    const integrations = await getActiveIntegrations(
      userData.company_id,
      'calendly'
    );

    if (integrations.length === 0) {
      return NextResponse.json(
        { error: 'No active Calendly integration found' },
        { status: 404 }
      );
    }

    // Run sync
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
    console.error('Error syncing Calendly:', error);
    return NextResponse.json(
      { error: 'Failed to sync' },
      { status: 500 }
    );
  }
}
