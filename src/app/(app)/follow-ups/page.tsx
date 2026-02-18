// app/(app)/follow-ups/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import FollowUpsPage from '@/components/followups/FollowUpsPage';

export default async function FollowUps() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const { data: followUps } = await supabase
    .from('follow_up_queue')
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
    .order('next_attempt_at', { ascending: true });

  return (
    <FollowUpsPage followUps={followUps || []} />
  );
}
