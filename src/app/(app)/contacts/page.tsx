// app/(app)/contacts/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import ContactsManager from '@/components/contacts/ContactsManager';
import SalesforceContactsBanner from '@/components/contacts/SalesforceContactsBanner';

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

  const companyId = userData!.company_id;

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  const { data: contactLists } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  // Check plan for Salesforce access
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

  const hasSalesforceAccess = ['business', 'teams', 'enterprise'].includes(planSlug);

  // Check Salesforce connection
  let sfConnected = false;
  if (hasSalesforceAccess) {
    const { data: sfIntegration } = await supabaseAdminRaw
      .from('salesforce_integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();
    sfConnected = !!sfIntegration;
  }

  return (
    <>
      <SalesforceContactsBanner
        planSlug={planSlug}
        hasSalesforceAccess={hasSalesforceAccess}
        sfConnected={sfConnected}
      />
      <ContactsManager
        initialContacts={contacts || []}
        initialContactLists={contactLists || []}
        companyId={companyId}
      />
    </>
  );
}
