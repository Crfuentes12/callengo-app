// app/(app)/contacts/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
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

  const companyId = userData!.company_id;

  // Fetch initial page of contacts with count (server-side for fast first paint)
  const { data: initialContacts, count: totalCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(0, 49);

  const { data: contactLists } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  // Check plan for CRM access
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

  const hasCrmAccess = ['business', 'teams', 'enterprise'].includes(planSlug);
  const hasSalesforceAccess = hasCrmAccess;
  const hasHubSpotAccess = hasCrmAccess;
  const hasPipedriveAccess = hasCrmAccess;

  // Check CRM connections in parallel
  const [sfResult, hsResult, pdResult, gsResult] = await Promise.all([
    hasSalesforceAccess
      ? supabaseAdminRaw.from('salesforce_integrations').select('id').eq('company_id', companyId).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null }),
    hasHubSpotAccess
      ? supabaseAdminRaw.from('hubspot_integrations').select('id').eq('company_id', companyId).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null }),
    hasPipedriveAccess
      ? supabaseAdminRaw.from('pipedrive_integrations').select('id').eq('company_id', companyId).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdminRaw.from('google_sheets_integrations').select('id').eq('company_id', companyId).eq('is_active', true).maybeSingle(),
  ]);

  return (
    <ContactsManager
      initialContacts={initialContacts || []}
      initialTotalCount={totalCount || 0}
      initialContactLists={contactLists || []}
      companyId={companyId}
      hasSalesforceAccess={hasSalesforceAccess}
      sfConnected={!!sfResult.data}
      hasHubSpotAccess={hasHubSpotAccess}
      hsConnected={!!hsResult.data}
      hasPipedriveAccess={hasPipedriveAccess}
      pdConnected={!!pdResult.data}
      gsConnected={!!gsResult.data}
    />
  );
}
