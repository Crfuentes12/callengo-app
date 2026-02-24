// app/api/integrations/zoom/connect/route.ts
// Server-to-Server OAuth — no redirect, just verify credentials and mark as connected
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { verifyZoomCredentials } from '@/lib/calendar/zoom';

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

    // Verify Zoom Server-to-Server credentials
    const zoomUser = await verifyZoomCredentials();
    if (!zoomUser) {
      return NextResponse.json(
        { error: 'Failed to connect to Zoom. Check ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID environment variables.' },
        { status: 400 }
      );
    }

    // Mark Zoom as connected in company settings
    const { data: currentSettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    await supabaseAdmin
      .from('company_settings')
      .update({
        settings: {
          ...existingSettings,
          zoom_connected: true,
          zoom_connected_at: new Date().toISOString(),
          zoom_user_email: zoomUser.email,
          zoom_user_id: zoomUser.id,
        },
      })
      .eq('company_id', userData.company_id);

    return NextResponse.json({
      success: true,
      email: zoomUser.email,
    });
  } catch (error) {
    console.error('Zoom connect error:', error);
    return NextResponse.json({ error: 'Failed to connect Zoom' }, { status: 500 });
  }
}

// Keep GET for backwards compatibility — redirect to integrations page
export async function GET() {
  // Server-to-Server OAuth doesn't need a redirect flow
  // The frontend should call POST instead
  return NextResponse.json(
    { error: 'Use POST to connect Zoom (Server-to-Server OAuth)' },
    { status: 405 }
  );
}
