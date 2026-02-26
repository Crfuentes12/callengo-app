// app/api/integrations/slack/channels/route.ts
// Returns list of Slack channels using the Slack access token from company_settings JSONB

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import axios from 'axios';

export async function GET() {
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

    // Read Slack token from company_settings JSONB (the only place Slack data is stored)
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const settings = (companySettings?.settings ?? {}) as Record<string, unknown>;
    const accessToken = settings.slack_access_token as string | undefined;

    if (!accessToken) {
      return NextResponse.json({ channels: [] });
    }

    // Fetch channels using the Slack API
    const channels: { id: string; name: string }[] = [];
    let cursor: string | undefined;

    do {
      const response = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          types: 'public_channel',
          exclude_archived: true,
          limit: 200,
          ...(cursor && { cursor }),
        },
      });

      if (!response.data.ok) {
        console.error('Slack API error:', response.data.error);
        break;
      }

      for (const ch of response.data.channels || []) {
        channels.push({ id: ch.id, name: ch.name });
      }

      cursor = response.data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
