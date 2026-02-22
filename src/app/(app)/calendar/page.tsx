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

  // Fetch call logs for building calendar events
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false })
    .limit(500);

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, status, company_id')
    .eq('company_id', userData!.company_id);

  return (
    <CalendarPage
      callLogs={callLogs || []}
      contacts={contacts || []}
      companyId={userData!.company_id}
    />
  );
}
