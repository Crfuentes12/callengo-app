// app/(app)/contacts/pipedrive/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import PipedriveContactsPage from '@/components/contacts/PipedriveContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PipedriveContacts() {
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

  const hasPipedriveAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check Pipedrive connection
  const { data: pdIntegration } = await supabaseAdminRaw
    .from('pipedrive_integrations')
    .select('id, pd_user_name, pd_user_email, pd_company_name, pd_company_domain, api_domain, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasPipedriveAccess) {
    // Redirect to contacts page - the UI will show upgrade CTA
    redirect('/contacts?upgrade=pipedrive');
  }

  return (
    <PipedriveContactsPage
      companyId={companyId}
      planSlug={planSlug}
      pdConnected={!!pdIntegration}
      pdIntegration={pdIntegration ? {
        id: pdIntegration.id,
        userName: pdIntegration.pd_user_name,
        userEmail: pdIntegration.pd_user_email,
        companyName: pdIntegration.pd_company_name,
        companyDomain: pdIntegration.pd_company_domain,
        lastSynced: pdIntegration.last_synced_at,
      } : null}
    />
  );
}
