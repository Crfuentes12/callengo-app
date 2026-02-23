// app/api/integrations/zoom/disconnect/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

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

    // Remove Zoom config from company settings
    const { data: currentSettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    const zoomKeys = [
      'zoom_access_token', 'zoom_refresh_token', 'zoom_token_expires_at',
      'zoom_user_email', 'zoom_user_id', 'zoom_connected', 'zoom_connected_at',
    ];

    const cleanedSettings = { ...existingSettings };
    for (const key of zoomKeys) {
      delete cleanedSettings[key];
    }

    await supabaseAdmin
      .from('company_settings')
      .update({ settings: cleanedSettings })
      .eq('company_id', userData.company_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Zoom disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
