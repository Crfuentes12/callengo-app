// app/(app)/contacts/salesforce/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import SalesforceContactsPage from '@/components/contacts/SalesforceContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SalesforceContacts() {
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

  const hasSalesforceAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check Salesforce connection
  const { data: sfIntegration } = await supabaseAdmin
    .from('salesforce_integrations')
    .select('id, sf_username, sf_display_name, sf_email, sf_org_id, instance_url, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasSalesforceAccess) {
    // Redirect to contacts page - the UI will show upgrade CTA
    redirect('/contacts?upgrade=salesforce');
  }

  return (
    <SalesforceContactsPage
      companyId={companyId}
      planSlug={planSlug}
      sfConnected={!!sfIntegration}
      sfIntegration={sfIntegration ? {
        id: sfIntegration.id,
        username: sfIntegration.sf_username,
        displayName: sfIntegration.sf_display_name,
        email: sfIntegration.sf_email,
        instanceUrl: sfIntegration.instance_url,
        lastSynced: sfIntegration.last_synced_at,
      } : null}
    />
  );
}
