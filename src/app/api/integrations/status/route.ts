// app/api/integrations/status/route.ts
// Returns the connection status of all integrations for a company

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

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

    // Get calendar integrations (Google, Microsoft)
    const { data: calendarIntegrations } = await supabaseAdmin
      .from('calendar_integrations')
      .select('provider, provider_email, provider_user_name, last_synced_at, id, is_active')
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    // Get company settings for Slack, Zoom, Twilio
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const settings = (companySettings?.settings ?? {}) as Record<string, unknown>;

    // Build calendar integration statuses
    const integrations = {
      google_calendar: {
        connected: false as boolean,
        email: undefined as string | undefined,
        lastSynced: undefined as string | undefined,
        integrationId: undefined as string | undefined,
      },
      microsoft_outlook: {
        connected: false as boolean,
        email: undefined as string | undefined,
        lastSynced: undefined as string | undefined,
        integrationId: undefined as string | undefined,
      },
      zoom: {
        connected: !!settings.zoom_connected,
        email: (settings.zoom_user_email as string) || undefined,
      },
      slack: {
        connected: !!settings.slack_connected,
        teamName: (settings.slack_team_name as string) || undefined,
        channelName: (settings.slack_channel_name as string) || undefined,
      },
      twilio: {
        connected: !!(settings.twilio_account_sid || settings.phone_numbers),
      },
    };

    if (calendarIntegrations) {
      for (const integration of calendarIntegrations) {
        if (integration.provider === 'google_calendar') {
          integrations.google_calendar = {
            connected: true,
            email: integration.provider_email || undefined,
            lastSynced: integration.last_synced_at || undefined,
            integrationId: integration.id,
          };
        } else if (integration.provider === 'microsoft_outlook') {
          integrations.microsoft_outlook = {
            connected: true,
            email: integration.provider_email || undefined,
            lastSynced: integration.last_synced_at || undefined,
            integrationId: integration.id,
          };
        }
      }
    }

    // Also return as array format for backward compatibility with CalendarPage
    const integrationsArray = [
      {
        provider: 'google_calendar' as const,
        connected: integrations.google_calendar.connected,
        email: integrations.google_calendar.email,
        last_synced: integrations.google_calendar.lastSynced,
        integration_id: integrations.google_calendar.integrationId,
      },
      {
        provider: 'microsoft_outlook' as const,
        connected: integrations.microsoft_outlook.connected,
        email: integrations.microsoft_outlook.email,
        last_synced: integrations.microsoft_outlook.lastSynced,
        integration_id: integrations.microsoft_outlook.integrationId,
      },
    ];

    return NextResponse.json({
      integrations: integrationsArray,
      all: integrations,
    });
  } catch (error) {
    console.error('Error fetching integration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
