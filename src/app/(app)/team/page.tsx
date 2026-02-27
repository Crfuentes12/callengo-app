// app/(app)/team/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import TeamSettings from '@/components/settings/TeamSettings';
import SalesforceOrgMembers from '@/components/settings/SalesforceOrgMembers';
import HubSpotOrgMembers from '@/components/settings/HubSpotOrgMembers';
import Link from 'next/link';

function TeamUpgradeCTA() {
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
              <p className="text-slate-500 font-medium">Collaborate with your team to scale your outreach</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-8 text-center max-w-xl mx-auto">
          <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-5 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Unlock Team Collaboration</h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Upgrade to Business or higher to access powerful team features and work together on campaigns.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Invite team members</p>
                <p className="text-xs text-slate-500 mt-0.5">Add colleagues to your organization and assign roles</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                  <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
                  <path d="M8 6v8" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Coordinate campaigns</p>
                <p className="text-xs text-slate-500 mt-0.5">Run parallel campaigns and share results across the team</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Share insights</p>
                <p className="text-xs text-slate-500 mt-0.5">Analytics and call data visible to your entire organization</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Import from CRM</p>
                <p className="text-xs text-slate-500 mt-0.5">Bring people from Salesforce, HubSpot, or any CRM into your org</p>
              </div>
            </div>
          </div>

          <Link
            href="/settings?section=billing"
            className="inline-flex items-center gap-2 px-6 py-3 gradient-bg text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Upgrade to Business
          </Link>
          <p className="text-[11px] text-slate-400 mt-3">Business plan includes 3 seats. Teams plan includes 5+ seats.</p>
        </div>
      </div>
    </div>
  );
}

export default async function TeamPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, email')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Check plan
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

  // Show upgrade CTA for free and starter plans
  const hasTeamAccess = ['business', 'teams', 'enterprise'].includes(planSlug);
  if (!hasTeamAccess) {
    return <TeamUpgradeCTA />;
  }

  // Check Salesforce connection
  let sfConnected = false;
  const { data: sfIntegration } = await supabaseAdminRaw
    .from('salesforce_integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();
  sfConnected = !!sfIntegration;

  // Check HubSpot connection
  let hsConnected = false;
  const { data: hsIntegration } = await supabaseAdminRaw
    .from('hubspot_integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();
  hsConnected = !!hsIntegration;

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

      {/* HubSpot Org Members Preview */}
      <HubSpotOrgMembers
        companyId={companyId}
        planSlug={planSlug}
        hsConnected={hsConnected}
      />
    </div>
  );
}
