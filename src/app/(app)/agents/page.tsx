// app/(app)/agents/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import AgentsLibrary from '@/components/agents/AgentsLibrary';

export default async function AgentsPage() {
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

  // @ts-ignore - Supabase join typing
  const company = userData!.companies;

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
    .eq('company_id', userData!.company_id);

  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', userData!.company_id)
    .single();

  return (
    <AgentsLibrary
      agentTemplates={agentTemplates || []}
      companyAgents={companyAgents || []}
      companyId={userData!.company_id}
      company={company}
      companySettings={companySettings}
    />
  );
}
