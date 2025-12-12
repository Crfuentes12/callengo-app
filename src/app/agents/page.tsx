// app/agents/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import AgentsLibrary from '@/components/agents/AgentsLibrary';

export default async function AgentsPage() {
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

  // @ts-expect-error - Supabase join typing
  const company = userData.companies;
  if (!company) redirect('/onboarding');

  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  const { data: companyAgents } = await supabase
    .from('company_agents')
    .select(`
      *,
      agent_templates (*)
    `)
    .eq('company_id', userData.company_id);

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="AI Agents"
      headerSubtitle="Pre-built agents ready to use"
    >
      <AgentsLibrary
        agentTemplates={agentTemplates || []}
        companyAgents={companyAgents || []}
        companyId={userData.company_id}
        company={company}
      />
    </Layout>
  );
}
