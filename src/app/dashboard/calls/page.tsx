// app/dashboard/calls/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import CallsHistory from '@/components/calls/CallsHistory';
import CallsSkeleton from '@/components/skeletons/CallsSkeleton';

export default async function CallsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select(`
      company_id,
      full_name,
      companies (*)
    `)
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) redirect('/signup');

  // @ts-ignore - Supabase join typing
  const company = userData.companies;
  if (!company) redirect('/signup');

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
    .eq('company_id', userData.company_id)
    .order('created_at', { ascending: false });

  // Fetch agent templates for filtering
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('id, name')
    .eq('is_active', true);

  return (
    <Layout
      user={{
        id: user.id,
        email: user.email!,
        full_name: userData.full_name
      }}
      company={company}
      headerTitle="Call History"
      headerSubtitle="Complete record of all AI calling activity"
    >
      <Suspense fallback={<CallsSkeleton />}>
        <CallsHistory
          callLogs={callLogs || []}
          agentTemplates={agentTemplates || []}
        />
      </Suspense>
    </Layout>
  );
}
