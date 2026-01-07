// app/dashboard/contacts/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import ContactsManager from '@/components/contacts/ContactsManager';
import ContactsSkeleton from '@/components/skeletons/ContactsSkeleton';

export default async function ContactsPage() {
  const supabase = await createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select(`
      company_id,
      full_name,
      companies (*)
    `)
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) redirect('/signup');

  // @ts-ignore - Supabase join typing
  const company = userData.companies;
  if (!company) redirect('/signup');

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
      <Suspense fallback={<ContactsSkeleton />}>
        <ContactsManager
          initialContacts={contacts || []}
          companyId={userData.company_id}
        />
      </Suspense>
    </Layout>
  );
}