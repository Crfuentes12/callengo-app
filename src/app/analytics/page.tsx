// app/analytics/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
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

  // Fetch all call logs for this company
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false });

  // Fetch all contacts for this company
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData.company_id);

  // Fetch agent runs for campaign analytics
  const { data: agentRuns } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false });

  // Fetch agent templates to analyze which agents are most used
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*');

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="Analytics"
      headerSubtitle="Comprehensive insights into your calling operations"
    >
      <AnalyticsDashboard
        callLogs={callLogs || []}
        contacts={contacts || []}
        agentRuns={agentRuns || []}
        agentTemplates={agentTemplates || []}
        companyId={userData.company_id}
      />
    </Layout>
  );
}
