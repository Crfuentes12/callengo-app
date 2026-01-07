// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('company_id, full_name, role')
    .eq('id', user.id)
    .single();

  // If user doesn't have a company_id, redirect to onboarding
  if (!userData?.company_id) {
    redirect('/onboarding');
  }

  // Fetch company data
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', userData.company_id)
    .single();
  
  if (!company) {
    redirect('/onboarding');
  }

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData.company_id);

  // Fetch recent calls
  const { data: recentCalls } = await supabase
    .from('call_logs')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch agent templates
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true);

  // Fetch company agents
  const { data: companyAgents } = await supabase
    .from('company_agents')
    .select(`
      *,
      agent_templates (*)
    `)
    .eq('company_id', userData.company_id)
    .eq('is_active', true);

  // Fetch agent runs (campaigns)
  const { data: agentRuns } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch contact lists
  const { data: contactLists } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('company_id', userData.company_id);

  // Fetch usage tracking
  const { data: usageTracking } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  // Fetch company subscription
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      subscription_plans (*)
    `)
    .eq('company_id', userData.company_id)
    .eq('status', 'active')
    .single();

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="Dashboard"
      headerSubtitle="Overview of your calling operations"
    >
      <DashboardOverview
        contacts={contacts || []}
        recentCalls={recentCalls || []}
        company={company}
        agentTemplates={agentTemplates || []}
        companyAgents={companyAgents || []}
        agentRuns={agentRuns || []}
        contactLists={contactLists || []}
        usageTracking={usageTracking}
        subscription={subscription}
      />
    </Layout>
  );
}