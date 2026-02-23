// app/api/integrations/google-calendar/disconnect/route.ts
// Disconnects a Google Calendar integration

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

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

    // Deactivate the integration (soft delete - keep data for reference)
    const { error } = await supabaseAdmin
      .from('calendar_integrations')
      .update({
        is_active: false,
        access_token: 'revoked',
        refresh_token: null,
      })
      .eq('company_id', userData.company_id)
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar');

    if (error) {
      console.error('Error disconnecting Google Calendar:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
