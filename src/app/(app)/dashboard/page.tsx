// app/(app)/dashboard/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user data
  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role')
    .eq('id', user!.id)
    .single();

  // Fetch company data
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', userData!.company_id)
    .single();

  // Fetch contact stats via aggregation queries (avoids 1000 row cap)
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', userData!.company_id);

  // Fetch status counts in parallel
  const statusValues = ['Pending', 'Calling', 'Fully Verified', 'No Answer', 'Voicemail Left', 'For Callback', 'Research Needed', 'Wrong Number', 'Number Disconnected'];
  const statusCountResults = await Promise.all(
    statusValues.map(s =>
      supabase.from('contacts').select('*', { count: 'exact', head: true })
        .eq('company_id', userData!.company_id).eq('status', s)
    )
  );
  const statusCounts: Record<string, number> = {};
  statusValues.forEach((s, i) => { statusCounts[s] = statusCountResults[i].count || 0; });

  // Fetch called contacts count and avg duration
  const { count: calledCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', userData!.company_id)
    .gt('call_attempts', 0);

  // Fetch sample contacts for recent display (latest 50 only)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch recent calls
  const { data: recentCalls } = await supabase
    .from('call_logs')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch agent templates
  const { data: agentTemplates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true);

  // Fetch company agents
  const { data: companyAgents } = await supabase
    .from('company_agents')
    .select(`
      *,
      agent_templates (*)
    `)
    .eq('company_id', userData!.company_id)
    .eq('is_active', true);

  // Fetch agent runs (campaigns)
  const { data: agentRuns } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch contact lists
  const { data: contactLists } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('company_id', userData!.company_id);

  // Fetch usage tracking
  const { data: usageTracking } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('company_id', userData!.company_id)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  // Fetch company subscription
  let { data: subscription } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      subscription_plans (*)
    `)
    .eq('company_id', userData!.company_id)
    .eq('status', 'active')
    .single();

  // Fallback: if no subscription exists, auto-assign the Free plan using admin client (bypasses RLS)
  if (!subscription) {
    const { data: freePlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, minutes_included')
      .eq('slug', 'free')
      .single();

    if (freePlan) {
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 10);

      const { data: newSub } = await supabaseAdmin
        .from('company_subscriptions')
        .insert({
          company_id: userData!.company_id,
          plan_id: freePlan.id,
          billing_cycle: 'monthly',
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select(`
          *,
          subscription_plans (*)
        `)
        .single();

      if (newSub) {
        subscription = newSub;

        // Also create usage tracking using admin client
        await supabaseAdmin.from('usage_tracking').insert({
          company_id: userData!.company_id,
          subscription_id: newSub.id,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          minutes_used: 0,
          minutes_included: freePlan.minutes_included,
        });
      }
    }
  }

  // Ensure usage minutes_included matches the current plan (may be stale after plan upgrade)
  const correctedUsage = usageTracking && subscription?.subscription_plans
    ? { ...usageTracking, minutes_included: (subscription.subscription_plans as any).minutes_included ?? usageTracking.minutes_included }
    : usageTracking;

  return (
    <DashboardOverview
      contacts={contacts || []}
      recentCalls={recentCalls || []}
      company={company!}
      agentTemplates={agentTemplates || []}
      companyAgents={companyAgents || []}
      agentRuns={agentRuns || []}
      contactLists={contactLists || []}
      usageTracking={correctedUsage}
      subscription={subscription}
      contactStats={{
        total: totalContacts || 0,
        pending: statusCounts['Pending'] || 0,
        calling: statusCounts['Calling'] || 0,
        verified: statusCounts['Fully Verified'] || 0,
        noAnswer: statusCounts['No Answer'] || 0,
        voicemail: statusCounts['Voicemail Left'] || 0,
        callback: statusCounts['For Callback'] || 0,
        calledCount: calledCount || 0,
      }}
    />
  );
}