// app/(app)/contacts/hubspot/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import HubSpotContactsPage from '@/components/contacts/HubSpotContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HubSpotContacts() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Check plan access
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

  const hasHubSpotAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check HubSpot connection
  const { data: hsIntegration } = await supabaseAdminRaw
    .from('hubspot_integrations')
    .select('id, hs_user_email, hs_display_name, hub_domain, hub_id, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasHubSpotAccess) {
    redirect('/contacts?upgrade=hubspot');
  }

  return (
    <HubSpotContactsPage
      companyId={companyId}
      planSlug={planSlug}
      hsConnected={!!hsIntegration}
      hsIntegration={hsIntegration ? {
        id: hsIntegration.id,
        email: hsIntegration.hs_user_email,
        displayName: hsIntegration.hs_display_name,
        hubDomain: hsIntegration.hub_domain,
        hubId: hsIntegration.hub_id,
        lastSynced: hsIntegration.last_synced_at,
      } : null}
    />
  );
}
