// app/(app)/integrations/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import IntegrationsPage from '@/components/integrations/IntegrationsPage';

export const dynamic = 'force-dynamic';

export default async function Integrations() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Fetch calendar integrations (Google Calendar & Microsoft Outlook)
  const { data: calendarIntegrations } = await supabaseAdmin
    .from('calendar_integrations')
    .select('provider, provider_email, last_synced_at, id, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true);

  const googleCal = calendarIntegrations?.find((i: { provider: string }) => i.provider === 'google_calendar');
  const msOutlook = calendarIntegrations?.find((i: { provider: string }) => i.provider === 'microsoft_outlook');

  // Fetch company settings for Twilio, Slack, Zoom status
  const { data: companySettings } = await supabaseAdmin
    .from('company_settings')
    .select('settings')
    .eq('company_id', companyId)
    .single();

  const settings = (companySettings?.settings ?? {}) as Record<string, unknown>;

  // Fetch Salesforce integration
  const { data: sfIntegration } = await supabaseAdminRaw
    .from('salesforce_integrations')
    .select('id, sf_username, sf_display_name, sf_email, instance_url, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch HubSpot integration
  const { data: hsIntegration } = await supabaseAdminRaw
    .from('hubspot_integrations')
    .select('id, hs_user_email, hs_display_name, hub_domain, hub_id, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Determine Twilio connection status
  const twilioConnected = !!settings.twilio_encrypted_key;

  // Determine Slack connection status
  const slackConnected = !!settings.slack_connected;
  const slackTeamName = (settings.slack_team_name as string) || undefined;
  const slackChannelName = (settings.slack_channel_name as string) || undefined;

  // Determine Zoom connection status
  const zoomConnected = !!settings.zoom_connected;

  // Fetch subscription plan slug
  let planSlug = 'free';
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('subscription_plans ( slug )')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single();

  if (subscription?.subscription_plans) {
    planSlug = (subscription.subscription_plans as unknown as { slug: string }).slug || 'free';
  }

  return (
    <IntegrationsPage
      integrations={{
        google_calendar: {
          connected: !!googleCal,
          email: googleCal?.provider_email || undefined,
          lastSynced: googleCal?.last_synced_at || undefined,
          integrationId: googleCal?.id || undefined,
        },
        microsoft_outlook: {
          connected: !!msOutlook,
          email: msOutlook?.provider_email || undefined,
          lastSynced: msOutlook?.last_synced_at || undefined,
          integrationId: msOutlook?.id || undefined,
        },
        zoom: {
          connected: zoomConnected,
        },
        slack: {
          connected: slackConnected,
          teamName: slackTeamName,
          channelName: slackChannelName,
        },
        twilio: {
          connected: twilioConnected,
        },
        salesforce: {
          connected: !!sfIntegration,
          email: sfIntegration?.sf_email || undefined,
          username: sfIntegration?.sf_username || undefined,
          displayName: sfIntegration?.sf_display_name || undefined,
          lastSynced: sfIntegration?.last_synced_at || undefined,
          integrationId: sfIntegration?.id || undefined,
        },
        hubspot: {
          connected: !!hsIntegration,
          email: hsIntegration?.hs_user_email || undefined,
          displayName: hsIntegration?.hs_display_name || undefined,
          hubDomain: hsIntegration?.hub_domain || undefined,
          lastSynced: hsIntegration?.last_synced_at || undefined,
          integrationId: hsIntegration?.id || undefined,
        },
      }}
      planSlug={planSlug}
      companyId={companyId}
    />
  );
}
