// app/(app)/calendar/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import CalendarPage from '@/components/calendar/CalendarPage';

export default async function Calendar() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  // Fetch call logs for building calendar events (join contacts for name/phone)
  const { data: rawCallLogs } = await supabase
    .from('call_logs')
    .select(`
      id, status, completed, created_at, call_length, agent_template_id,
      contacts (
        contact_name,
        phone_number
      )
    `)
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false })
    .limit(500);

  // Flatten joined contact data into the shape CalendarPage expects
  const callLogs = (rawCallLogs || []).map((log: any) => ({
    id: log.id,
    contact_name: log.contacts?.contact_name ?? null,
    contact_phone: log.contacts?.phone_number ?? '',
    status: log.status,
    completed: log.completed,
    created_at: log.created_at,
    call_length: log.call_length,
    agent_template_id: log.agent_template_id,
  }));

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, contact_name, phone_number, email, status, company_id')
    .eq('company_id', userData!.company_id);

  return (
    <CalendarPage
      callLogs={callLogs || []}
      contacts={contacts || []}
      companyId={userData!.company_id}
    />
  );
}
