// app/(app)/dashboard/contacts/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import ContactsManager from '@/components/contacts/ContactsManager';

export default async function ContactsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select(`
      company_id,
      full_name,
      companies (*)
    `)
    .eq('id', user!.id)
    .single();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  return (
    <ContactsManager
      initialContacts={contacts || []}
      companyId={userData!.company_id}
    />
  );
}
