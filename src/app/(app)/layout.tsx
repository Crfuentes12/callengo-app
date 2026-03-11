// app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import type { Database } from '@/types/supabase';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, companies(*)')
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) {
    redirect('/onboarding');
  }

  const company = (userData as Record<string, unknown>).companies as Database['public']['Tables']['companies']['Row'];
  if (!company) {
    redirect('/onboarding');
  }

  // Fetch subscription data for analytics user properties
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('billing_cycle, subscription_plans(slug)')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single();

  // Fetch team size for analytics
  const { count: teamSize } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id);

  const planSlug = subscription?.subscription_plans
    ? (subscription.subscription_plans as { slug: string }).slug
    : 'free';

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle=""
      headerSubtitle=""
    >
      <AnalyticsProvider
        userId={user.id}
        planSlug={planSlug}
        billingCycle={subscription?.billing_cycle ?? 'monthly'}
        companyIndustry={company.industry ?? undefined}
        teamSize={teamSize ?? 1}
        countryCode={(userData as Record<string, unknown>).country_code as string | undefined}
        currency={(userData as Record<string, unknown>).currency as string | undefined}
      />
      {children}
    </Layout>
  );
}
