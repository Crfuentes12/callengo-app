// app/(app)/voicemails/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import VoicemailsPage from '@/components/voicemails/VoicemailsPage';

export default async function Voicemails() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const { data: voicemails } = await supabase
    .from('voicemail_logs')
    .select(`
      *,
      contacts (
        company_name,
        contact_name,
        phone_number
      ),
      agent_runs (
        name
      )
    `)
    .eq('company_id', userData!.company_id)
    .order('detected_at', { ascending: false });

  return (
    <VoicemailsPage voicemails={voicemails || []} />
  );
}
