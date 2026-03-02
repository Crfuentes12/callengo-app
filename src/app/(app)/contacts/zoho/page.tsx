// app/(app)/contacts/zoho/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import ZohoContactsPage from '@/components/contacts/ZohoContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ZohoContacts() {
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

  const hasZohoAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check Zoho connection
  const { data: zohoIntegration } = await supabaseAdminRaw
    .from('zoho_integrations')
    .select('id, zoho_user_name, zoho_user_email, zoho_org_name, zoho_domain, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasZohoAccess) {
    redirect('/contacts?upgrade=zoho');
  }

  return (
    <ZohoContactsPage
      companyId={companyId}
      planSlug={planSlug}
      zohoConnected={!!zohoIntegration}
      zohoIntegration={zohoIntegration ? {
        id: zohoIntegration.id,
        displayName: zohoIntegration.zoho_user_name,
        email: zohoIntegration.zoho_user_email,
        orgName: zohoIntegration.zoho_org_name,
        lastSynced: zohoIntegration.last_synced_at,
      } : null}
    />
  );
}
