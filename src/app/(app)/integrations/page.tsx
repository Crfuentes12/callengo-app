// app/(app)/integrations/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import IntegrationsPage from '@/components/integrations/IntegrationsPage';
import { PageTracker } from '@/components/analytics/PageTracker';
import { PostHogPageTracker } from '@/components/analytics/PostHogPageTracker';

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

  // Fetch Pipedrive integration
  const { data: pdIntegration } = await supabaseAdminRaw
    .from('pipedrive_integrations')
    .select('id, pd_user_email, pd_user_name, pd_company_name, pd_company_domain, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch Clio integration
  const { data: clioIntegration } = await supabaseAdminRaw
    .from('clio_integrations')
    .select('id, clio_user_email, clio_user_name, clio_firm_name, clio_firm_id, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch Zoho CRM integration
  const { data: zohoIntegration } = await supabaseAdminRaw
    .from('zoho_integrations')
    .select('id, zoho_user_email, zoho_user_name, zoho_org_name, zoho_org_id, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch Microsoft Dynamics integration
  const { data: dynamicsIntegration } = await supabaseAdminRaw
    .from('dynamics_integrations')
    .select('id, dynamics_user_email, dynamics_user_name, dynamics_org_name, dynamics_instance_url, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch SimplyBook.me integration
  const { data: sbIntegration } = await supabaseAdminRaw
    .from('simplybook_integrations')
    .select('id, sb_user_email, sb_user_name, sb_company_name, sb_company_login, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Fetch Google Sheets integration
  const { data: gsIntegration } = await supabaseAdminRaw
    .from('google_sheets_integrations')
    .select('id, google_email, google_user_name, last_used_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  // Determine Twilio connection status

  // Determine Slack connection status
  const slackConnected = !!settings.slack_connected;
  const slackTeamName = (settings.slack_team_name as string) || undefined;
  const slackChannelName = (settings.slack_channel_name as string) || undefined;

  // Zoom uses Server-to-Server OAuth — always available (env-based, no user auth needed)
  const zoomConnected = true;

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
    <>
    <PageTracker page="integrations" />
    <PostHogPageTracker page="integrations" />
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
        pipedrive: {
          connected: !!pdIntegration,
          email: pdIntegration?.pd_user_email || undefined,
          displayName: pdIntegration?.pd_user_name || undefined,
          companyName: pdIntegration?.pd_company_name || undefined,
          companyDomain: pdIntegration?.pd_company_domain || undefined,
          lastSynced: pdIntegration?.last_synced_at || undefined,
          integrationId: pdIntegration?.id || undefined,
        },
        clio: {
          connected: !!clioIntegration,
          email: clioIntegration?.clio_user_email || undefined,
          displayName: clioIntegration?.clio_user_name || undefined,
          firmName: clioIntegration?.clio_firm_name || undefined,
          firmId: clioIntegration?.clio_firm_id || undefined,
          lastSynced: clioIntegration?.last_synced_at || undefined,
          integrationId: clioIntegration?.id || undefined,
        },
        zoho: {
          connected: !!zohoIntegration,
          email: zohoIntegration?.zoho_user_email || undefined,
          displayName: zohoIntegration?.zoho_user_name || undefined,
          orgName: zohoIntegration?.zoho_org_name || undefined,
          orgId: zohoIntegration?.zoho_org_id || undefined,
          lastSynced: zohoIntegration?.last_synced_at || undefined,
          integrationId: zohoIntegration?.id || undefined,
        },
        dynamics: {
          connected: !!dynamicsIntegration,
          email: dynamicsIntegration?.dynamics_user_email || undefined,
          displayName: dynamicsIntegration?.dynamics_user_name || undefined,
          orgName: dynamicsIntegration?.dynamics_org_name || undefined,
          instanceUrl: dynamicsIntegration?.dynamics_instance_url || undefined,
          lastSynced: dynamicsIntegration?.last_synced_at || undefined,
          integrationId: dynamicsIntegration?.id || undefined,
        },
        simplybook: {
          connected: !!sbIntegration,
          email: sbIntegration?.sb_user_email || undefined,
          displayName: sbIntegration?.sb_user_name || undefined,
          companyName: sbIntegration?.sb_company_name || undefined,
          companyLogin: sbIntegration?.sb_company_login || undefined,
          lastSynced: sbIntegration?.last_synced_at || undefined,
          integrationId: sbIntegration?.id || undefined,
        },
        google_sheets: {
          connected: !!gsIntegration,
          email: gsIntegration?.google_email || undefined,
          displayName: gsIntegration?.google_user_name || undefined,
          lastUsed: gsIntegration?.last_used_at || undefined,
          integrationId: gsIntegration?.id || undefined,
        },
      }}
      planSlug={planSlug}
      companyId={companyId}
    />
    </>
  );
}
