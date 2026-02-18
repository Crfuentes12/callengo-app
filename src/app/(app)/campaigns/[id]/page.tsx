// app/(app)/campaigns/[id]/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import CampaignDetail from '@/components/campaigns/CampaignDetail';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  // Fetch the campaign (agent_run) with its agent template
  const { data: campaign } = await supabase
    .from('agent_runs')
    .select(`
      *,
      agent_templates (
        id,
        name,
        slug,
        description,
        icon,
        category
      )
    `)
    .eq('id', id)
    .eq('company_id', userData!.company_id)
    .single();

  if (!campaign) {
    notFound();
  }

  // Fetch call logs for this campaign with contact info
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select(`
      id,
      status,
      call_length,
      answered_by,
      recording_url,
      created_at,
      completed,
      voicemail_detected,
      voicemail_left,
      contacts (
        id,
        contact_name,
        company_name,
        phone_number
      )
    `)
    .eq('agent_run_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch follow-up queue for this campaign
  const { data: followUps } = await supabase
    .from('follow_up_queue')
    .select('id, status, contact_id, attempt_number, max_attempts, next_attempt_at, created_at')
    .eq('agent_run_id', id)
    .order('created_at', { ascending: false });

  // Fetch voicemail logs for this campaign
  const { data: voicemailLogs } = await supabase
    .from('voicemail_logs')
    .select('id, message_left, message_duration, detected_at, contact_id')
    .eq('agent_run_id', id)
    .order('created_at', { ascending: false });

  return (
    <CampaignDetail
      campaign={campaign}
      callLogs={callLogs || []}
      followUps={followUps || []}
      voicemailLogs={voicemailLogs || []}
    />
  );
}
