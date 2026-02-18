// app/(app)/reports/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import ReportsPage from '@/components/reports/ReportsPage';

export default async function Reports() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  // Fetch campaigns for report generation
  const { data: campaigns } = await supabase
    .from('agent_runs')
    .select(`
      id, name, status, total_contacts, completed_calls, successful_calls, failed_calls,
      created_at, started_at, completed_at,
      agent_templates (name)
    `)
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  // Fetch call stats
  const { data: callStats } = await supabase
    .from('call_logs')
    .select('status, duration, created_at')
    .eq('company_id', userData!.company_id);

  // Fetch contact stats
  const { data: contacts } = await supabase
    .from('contacts')
    .select('status, list_id, created_at')
    .eq('company_id', userData!.company_id);

  return (
    <ReportsPage
      campaigns={campaigns || []}
      callStats={callStats || []}
      contacts={contacts || []}
      companyId={userData!.company_id}
    />
  );
}
