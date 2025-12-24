// app/settings/billing/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import BillingManager from '@/components/billing/BillingManager';

export default async function BillingPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, companies(*)')
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) redirect('/onboarding');

  const company = userData.companies;
  if (!company) redirect('/onboarding');

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="Billing & Plans"
      headerSubtitle="Manage your subscription and billing"
    >
      <div className="max-w-7xl mx-auto">
        <BillingManager companyId={userData.company_id} />
      </div>
    </Layout>
  );
}
