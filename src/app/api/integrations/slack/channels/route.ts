// app/api/integrations/slack/channels/route.ts
// Returns list of Slack channels for the company's active Slack integration

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getActiveSlackIntegration, listSlackChannels } from '@/lib/calendar/slack';

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

    const integration = await getActiveSlackIntegration(userData.company_id);

    if (!integration) {
      return NextResponse.json({ channels: [] });
    }

    const channels = await listSlackChannels(integration);

    return NextResponse.json({
      channels: channels.map(ch => ({
        id: ch.id,
        name: ch.name,
      })),
    });
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
