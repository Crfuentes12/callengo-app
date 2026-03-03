// app/(app)/contacts/microsoft-dynamics/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import DynamicsContactsPage from '@/components/contacts/DynamicsContactsPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DynamicsContacts() {
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

  const hasDynamicsAccess = ['teams', 'enterprise'].includes(planSlug);

  // Check Dynamics connection
  const { data: dynamicsIntegration } = await supabaseAdminRaw
    .from('dynamics_integrations')
    .select('id, dynamics_user_name, dynamics_user_email, dynamics_org_name, dynamics_instance_url, last_synced_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (!hasDynamicsAccess) {
    redirect('/contacts?upgrade=dynamics');
  }

  return (
    <DynamicsContactsPage
      companyId={companyId}
      planSlug={planSlug}
      dynamicsConnected={!!dynamicsIntegration}
      dynamicsIntegration={dynamicsIntegration ? {
        id: dynamicsIntegration.id,
        displayName: dynamicsIntegration.dynamics_user_name,
        email: dynamicsIntegration.dynamics_user_email,
        orgName: dynamicsIntegration.dynamics_org_name,
        lastSynced: dynamicsIntegration.last_synced_at,
      } : null}
    />
  );
}
