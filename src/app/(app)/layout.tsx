// app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';

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

  // @ts-ignore - Supabase join typing
  const company = userData.companies;
  if (!company) {
    redirect('/onboarding');
  }

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
      {children}
    </Layout>
  );
}
