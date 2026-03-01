// app/(app)/contacts/clio/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import ClioContactsPage from '@/components/contacts/ClioContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ClioContacts() {
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

  const hasClioAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check Clio connection
  const { data: clioIntegration } = await supabaseAdminRaw
    .from('clio_integrations')
    .select('id, clio_user_name, clio_user_email, clio_firm_name, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasClioAccess) {
    // Redirect to contacts page - the UI will show upgrade CTA
    redirect('/contacts?upgrade=clio');
  }

  return (
    <ClioContactsPage
      companyId={companyId}
      planSlug={planSlug}
      clioConnected={!!clioIntegration}
      clioIntegration={clioIntegration ? {
        id: clioIntegration.id,
        displayName: clioIntegration.clio_user_name,
        email: clioIntegration.clio_user_email,
        firmName: clioIntegration.clio_firm_name,
        lastSynced: clioIntegration.last_synced_at,
      } : null}
    />
  );
}
