// app/(app)/agents/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import AgentsLibrary from '@/components/agents/AgentsLibrary';
import { PageTracker } from '@/components/analytics/PageTracker';

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

  const company = (userData as Record<string, unknown>).companies as unknown as import('@/types/supabase').Company;

  // Get active agents (the migration ensures only the 3 core agents are active)
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

  // Fetch subscription plan slug
  let planSlug = 'free';
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('subscription_plans ( slug )')
    .eq('company_id', userData!.company_id)
    .eq('status', 'active')
    .single();

  if (subscription?.subscription_plans) {
    planSlug = (subscription.subscription_plans as unknown as { slug: string }).slug || 'free';
  }

  return (
    <>
    <PageTracker page="agents" />
    <AgentsLibrary
      agentTemplates={agentTemplates || []}
      companyAgents={(companyAgents || []) as unknown as Parameters<typeof AgentsLibrary>[0]['companyAgents']}
      companyId={userData!.company_id}
      company={company}
      companySettings={{ ...companySettings, plan_slug: planSlug }}
    />
    </>
  );
}
