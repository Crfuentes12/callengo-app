// app/contacts/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import ContactsManager from '@/components/contacts/ContactsManager';

export default async function ContactsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: userData } = await supabase
    .from('users')
    .select(`
      company_id,
      full_name,
      companies (*)
    `)
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) redirect('/onboarding');

  const company = userData.companies as any;
  if (!company) redirect('/onboarding');

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false });

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="Contacts"
      headerSubtitle="Manage your contact database"
    >
      <ContactsManager
        initialContacts={contacts || []}
        companyId={userData.company_id}
      />
    </Layout>
  );
}
