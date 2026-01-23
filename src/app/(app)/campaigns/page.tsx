// app/(app)/campaigns/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import CampaignsOverview from '@/components/campaigns/CampaignsOverview';

export default async function CampaignsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role')
    .eq('id', user!.id)
    .single();

  // Get all campaigns (agent_runs) for the company
  const { data: campaigns } = await supabase
    .from('agent_runs')
    .select(`
      *,
      agent_templates (
        id,
        name,
        slug,
        description,
        icon
      )
    `)
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false });

  // Get follow-up stats
  const { data: followUpStats } = await supabase
    .from('follow_up_queue')
    .select('status, agent_run_id')
    .eq('company_id', userData!.company_id);

  // Get voicemail stats
  const { data: voicemailStats } = await supabase
    .from('voicemail_logs')
    .select('message_left, agent_run_id')
    .eq('company_id', userData!.company_id);

  // Get agent templates for campaign creation
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  // Get company data
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', userData!.company_id)
    .single();

  return (
    <CampaignsOverview
      campaigns={campaigns || []}
      companyId={userData!.company_id}
      followUpStats={followUpStats || []}
      voicemailStats={voicemailStats || []}
      agentTemplates={agentTemplates || []}
      company={company!}
    />
  );
}
