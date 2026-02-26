// app/(app)/team/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import TeamSettings from '@/components/settings/TeamSettings';
import SalesforceOrgMembers from '@/components/settings/SalesforceOrgMembers';

export default async function TeamPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, email')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Check plan for Salesforce access
  let planSlug = 'free';
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('subscription_plans ( slug )')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single();

  if (subscription?.subscription_plans) {
    planSlug = (subscription.subscription_plans as unknown as { slug: string }).slug || 'free';
  }

  // Check Salesforce connection
  let sfConnected = false;
  const hasSalesforceAccess = ['business', 'teams', 'enterprise'].includes(planSlug);
  if (hasSalesforceAccess) {
    const { data: sfIntegration } = await supabaseAdmin
      .from('salesforce_integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();
    sfConnected = !!sfIntegration;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-bg-subtle rounded-2xl p-8 shadow-md border border-slate-200">
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-md">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Team</h2>
              <p className="text-slate-500 font-medium">Manage your team members, roles, and invitations</p>
            </div>
          </div>
        </div>
      </div>

      <TeamSettings
        companyId={companyId}
        currentUser={{
          id: user!.id,
          email: user!.email!,
          full_name: userData!.full_name,
          role: userData!.role,
        }}
      />

      {/* Salesforce Org Members Preview */}
      <SalesforceOrgMembers
        companyId={companyId}
        planSlug={planSlug}
        sfConnected={sfConnected}
      />
    </div>
  );
}
