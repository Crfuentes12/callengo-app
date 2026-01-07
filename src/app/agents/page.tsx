// app/agents/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import AgentsLibrary from '@/components/agents/AgentsLibrary';
import AgentsSkeleton from '@/components/skeletons/AgentsSkeleton';

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

  // @ts-ignore - Supabase join typing
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

  // Get company settings for test phone number
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', userData.company_id)
    .single();

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
      <Suspense fallback={<AgentsSkeleton />}>
        <AgentsLibrary
          agentTemplates={agentTemplates || []}
          companyAgents={companyAgents || []}
          companyId={userData.company_id}
          company={company}
          companySettings={companySettings}
        />
      </Suspense>
    </Layout>
  );
}
