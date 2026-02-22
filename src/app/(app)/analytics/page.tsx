// app/(app)/analytics/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
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

  // Fetch all call logs for the company
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false});

  // Fetch all contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData!.company_id);

  // Fetch agent templates
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true);

  // Fetch agent runs
  const { data: agentRuns } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  // Fetch campaigns with agent template names for reports/exports
  const { data: campaigns } = await supabase
    .from('agent_runs')
    .select(`
      id, name, status, total_contacts, completed_calls, successful_calls, failed_calls,
      created_at, started_at, completed_at,
      agent_templates (name)
    `)
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  return (
    <AnalyticsDashboard
      callLogs={callLogs || []}
      contacts={contacts || []}
      agentTemplates={agentTemplates || []}
      agentRuns={agentRuns || []}
      campaigns={campaigns || []}
    />
  );
}
