// app/(app)/dashboard/calls/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import CallsHistory from '@/components/calls/CallsHistory';

export default async function CallsPage() {
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

  // Fetch all call logs
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select(`
      *,
      contacts (
        company_name,
        contact_name,
        phone_number
      )
    `)
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  // Fetch agent templates for filtering
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('id, name')
    .eq('is_active', true);

  return (
    <CallsHistory
      callLogs={callLogs || []}
      agentTemplates={agentTemplates || []}
    />
  );
}
