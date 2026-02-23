// app/api/integrations/microsoft-outlook/sync/route.ts
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

    const integrations = await getActiveIntegrations(userData.company_id, 'microsoft_outlook');
    if (integrations.length === 0) {
      return NextResponse.json({ error: 'Microsoft Outlook not connected' }, { status: 400 });
    }

    const result = await runSync(integrations[0].id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('Microsoft sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
