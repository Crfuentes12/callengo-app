// app/(app)/home/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import HomePage from '@/components/home/HomePage';
import { PageTracker } from '@/components/analytics/PageTracker';
import { PostHogPageTracker } from '@/components/analytics/PostHogPageTracker';

export default async function HomePageRoute() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Fetch data in parallel
  const [
    companyRes,
    subscriptionRes,
    contactsCountRes,
    campaignsCountRes,
    callsCountRes,
    agentsRes,
    integrationsRes,
     
    _calendarEventsRes,
    usageRes,
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('company_subscriptions').select('*, subscription_plans(*)').eq('company_id', companyId).eq('status', 'active').maybeSingle(),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('call_logs').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('company_agents').select('*').eq('company_id', companyId).eq('is_active', true),
    supabase.from('company_settings').select('settings').eq('company_id', companyId).maybeSingle(),
    supabase.from('call_logs').select('id').eq('company_id', companyId).not('calendar_event_id', 'is', null).limit(1),
    supabase.from('usage_tracking').select('*').eq('company_id', companyId).lte('period_start', new Date().toISOString()).gte('period_end', new Date().toISOString()).limit(1).maybeSingle(),
  ]);

  // Determine onboarding wizard completion status
  const allSettings = (integrationsRes.data?.settings as Record<string, unknown>) || {};
  const onboardingWizardCompleted = !!allSettings.onboarding_wizard_completed;

  // Determine completed tasks based on actual data
  const settings = (integrationsRes.data?.settings as Record<string, unknown>) || {};

  // Get progress from company_settings JSONB
  const getStartedProgress: Record<string, boolean> =
    (settings.get_started_progress as Record<string, boolean>) || {};
  const hasGoogleCalendar = !!(settings.google_calendar_connected || settings.google_calendar_token);
  const hasListenedCall = getStartedProgress.listened_call || false;
  const hasViewedTranscript = getStartedProgress.viewed_transcript || false;
  const hasViewedAnalytics = getStartedProgress.viewed_analytics || false;
  const hasUpdatedContact = getStartedProgress.updated_contact || false;
  const hasTestedAgent = getStartedProgress.tested_agent || false;

  const completedTasks = {
    added_contacts: (contactsCountRes.count || 0) > 0,
    configured_agent: (agentsRes.data?.length || 0) > 0,
    launched_campaign: (campaignsCountRes.count || 0) > 0,
    tested_agent: hasTestedAgent,
    connected_google: hasGoogleCalendar,
    synced_calendar_contacts: getStartedProgress.synced_calendar_contacts || false,
    viewed_analytics: hasViewedAnalytics,
    listened_call: hasListenedCall,
    viewed_transcript: hasViewedTranscript,
    updated_contact: hasUpdatedContact,
    explored_integrations: getStartedProgress.explored_integrations || false,
  };

  const planData = subscriptionRes.data?.subscription_plans as Record<string, unknown> | null;

  return (
    <>
      <PageTracker page="home" />
      <PostHogPageTracker page="home" />
      <HomePage
        userName={userData!.full_name || user!.email || ''}
        companyId={companyId}
        companyName={(companyRes.data?.name as string) || ''}
        completedTasks={completedTasks}
        onboardingWizardCompleted={onboardingWizardCompleted}
        stats={{
          contacts: contactsCountRes.count || 0,
          campaigns: campaignsCountRes.count || 0,
          calls: callsCountRes.count || 0,
        }}
        plan={{
          name: (planData?.name as string) || 'Free Trial',
          slug: (planData?.slug as string) || 'free',
          minutesUsed: usageRes.data?.minutes_used || 0,
          minutesIncluded: (planData?.minutes_included as number) || usageRes.data?.minutes_included || 15,
        }}
      />
    </>
  );
}
