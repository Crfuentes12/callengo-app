// app/(app)/contacts/simplybook/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import SimplyBookContactsPage from '@/components/contacts/SimplyBookContactsPage';

export const dynamic = 'force-dynamic';

export default async function SimplyBookContacts() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Check plan (starter+ required)
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

  if (!['starter', 'business', 'teams', 'enterprise'].includes(planSlug)) {
    redirect('/contacts?upgrade=simplybook');
  }

  // Check SimplyBook connection
  const { data: sbIntegration } = await supabaseAdminRaw
    .from('simplybook_integrations')
    .select('id, sb_user_name, sb_user_email, sb_company_name, sb_company_login, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (
    <SimplyBookContactsPage
      companyId={companyId}
      planSlug={planSlug}
      sbConnected={!!sbIntegration}
      sbIntegration={sbIntegration ? {
        id: sbIntegration.id,
        displayName: sbIntegration.sb_user_name,
        email: sbIntegration.sb_user_email,
        companyName: sbIntegration.sb_company_name,
        companyLogin: sbIntegration.sb_company_login,
        lastSynced: sbIntegration.last_synced_at,
      } : null}
    />
  );
}
