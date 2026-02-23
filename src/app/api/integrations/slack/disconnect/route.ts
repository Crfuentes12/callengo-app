// app/api/integrations/slack/disconnect/route.ts
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

    // Remove Slack config from company settings
    const { data: currentSettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    // Remove all Slack keys
    const slackKeys = [
      'slack_access_token', 'slack_bot_user_id', 'slack_team_id',
      'slack_team_name', 'slack_channel_id', 'slack_channel_name',
      'slack_webhook_url', 'slack_scopes', 'slack_connected',
      'slack_connected_at', 'slack_authed_user_id',
    ];

    const cleanedSettings = { ...existingSettings };
    for (const key of slackKeys) {
      delete cleanedSettings[key];
    }

    await supabaseAdmin
      .from('company_settings')
      .update({ settings: cleanedSettings })
      .eq('company_id', userData.company_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slack disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
