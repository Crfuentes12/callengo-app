// app/api/admin/test-call-stats/route.ts
// Admin endpoint: test call usage analytics for the Usage tab.
// Auth: admin or owner role required.

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';

const AGENT_LABELS: Record<string, string> = {
  'lead-qualification':      'Lead Qualification',
  'appointment-confirmation': 'Appointment Confirmation',
  'data-validation':          'Data Validation',
};

export async function GET(): Promise<NextResponse> {
  try {
    // ─── Auth ───────────────────────────────────────────────────────────────────
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users').select('role').eq('id', user.id).single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ─── Time boundaries ────────────────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // ─── Queries in parallel ────────────────────────────────────────────────────
    const [
      totals30dRes,
      totalsTodayRes,
      byAgentRes,
      byDayRes,
      byStatusRes,
      topCompaniesRes,
      recentCallsRes,
      onboardingVsPostRes,
      avgDurationByAgentRes,
      regularCallsRes,
    ] = await Promise.all([

      // 1. Totals 30d
      supabaseAdminRaw
        .from('test_call_logs')
        .select('id, duration_seconds, bland_cost, status', { count: 'exact' })
        .gte('created_at', thirtyDaysAgo),

      // 2. Totals today
      supabaseAdminRaw
        .from('test_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // 3. By agent slug (30d)
      supabaseAdminRaw
        .from('test_call_logs')
        .select('agent_slug, duration_seconds, status')
        .gte('created_at', thirtyDaysAgo),

      // 4. By day (30d) — raw rows for aggregation
      supabaseAdminRaw
        .from('test_call_logs')
        .select('created_at, duration_seconds, status, agent_slug')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true }),

      // 5. By status (30d)
      supabaseAdminRaw
        .from('test_call_logs')
        .select('status')
        .gte('created_at', thirtyDaysAgo),

      // 6. Top companies by test count (30d) — join with companies
      supabaseAdminRaw
        .from('test_call_logs')
        .select('company_id, duration_seconds, status, is_onboarding, created_at')
        .gte('created_at', thirtyDaysAgo),

      // 7. Recent test calls with user + company info
      supabaseAdminRaw
        .from('test_call_logs')
        .select(`
          id, bland_call_id, agent_slug, agent_name, phone_number_masked,
          status, duration_seconds, is_onboarding, bland_cost,
          answered_by, created_at, completed_at, company_id, user_id
        `)
        .order('created_at', { ascending: false })
        .limit(100),

      // 8. Onboarding vs post-onboarding (30d)
      supabaseAdminRaw
        .from('test_call_logs')
        .select('is_onboarding')
        .gte('created_at', thirtyDaysAgo),

      // 9. Avg duration by agent (30d) — only completed calls
      supabaseAdminRaw
        .from('test_call_logs')
        .select('agent_slug, duration_seconds')
        .gte('created_at', thirtyDaysAgo)
        .eq('status', 'completed')
        .gt('duration_seconds', 0),

      // 10. Regular (non-test) call counts by day (30d) for comparison
      supabaseAdminRaw
        .from('call_logs')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true }),
    ]);

    // ─── Aggregation ───────────────────────────────────────────────────────────

    // Totals 30d
    const rows30d = (totals30dRes.data || []) as {
      duration_seconds: number; bland_cost: number; status: string;
    }[];
    const total30d = totals30dRes.count || 0;
    const totalDurationSec30d = rows30d.reduce((s, r) => s + (r.duration_seconds || 0), 0);
    const totalCost30d = rows30d.reduce((s, r) => s + (Number(r.bland_cost) || 0), 0);
    const completedCount30d = rows30d.filter(r => r.status === 'completed').length;
    const completionRate30d = total30d > 0 ? Math.round((completedCount30d / total30d) * 100) : 0;

    // By agent
    const agentMap: Record<string, { count: number; totalDuration: number; completed: number }> = {};
    for (const r of (byAgentRes.data || []) as { agent_slug: string; duration_seconds: number; status: string }[]) {
      const slug = r.agent_slug || 'unknown';
      if (!agentMap[slug]) agentMap[slug] = { count: 0, totalDuration: 0, completed: 0 };
      agentMap[slug].count++;
      agentMap[slug].totalDuration += r.duration_seconds || 0;
      if (r.status === 'completed') agentMap[slug].completed++;
    }
    const byAgent = Object.entries(agentMap).map(([slug, data]) => ({
      slug,
      label: AGENT_LABELS[slug] || slug,
      count: data.count,
      avgDurationSec: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      completionRate: data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // By day (for chart)
    const dayMap: Record<string, { testCalls: number; durationSec: number; regularCalls: number }> = {};
    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { testCalls: 0, durationSec: 0, regularCalls: 0 };
    }
    for (const r of (byDayRes.data || []) as { created_at: string; duration_seconds: number }[]) {
      const key = r.created_at.slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].testCalls++;
        dayMap[key].durationSec += r.duration_seconds || 0;
      }
    }
    for (const r of (regularCallsRes.data || []) as { created_at: string }[]) {
      const key = r.created_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].regularCalls++;
    }
    const chartByDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: date.slice(5), // MM-DD
        testCalls: d.testCalls,
        regularCalls: d.regularCalls,
        avgDurationMin: d.testCalls > 0 ? Math.round((d.durationSec / d.testCalls) / 6) / 10 : 0,
      }));

    // By status
    const statusMap: Record<string, number> = {};
    for (const r of (byStatusRes.data || []) as { status: string }[]) {
      const s = r.status || 'unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;
    }
    const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // Onboarding vs post
    const onboardingRows = (onboardingVsPostRes.data || []) as { is_onboarding: boolean }[];
    const onboardingCount = onboardingRows.filter(r => r.is_onboarding).length;
    const postOnboardingCount = onboardingRows.length - onboardingCount;

    // Top companies
    const companyMap: Record<string, { count: number; totalDuration: number; onboardingCount: number; lastTest: string }> = {};
    for (const r of (topCompaniesRes.data || []) as {
      company_id: string; duration_seconds: number; is_onboarding: boolean; created_at: string;
    }[]) {
      const cid = r.company_id;
      if (!companyMap[cid]) companyMap[cid] = { count: 0, totalDuration: 0, onboardingCount: 0, lastTest: r.created_at };
      companyMap[cid].count++;
      companyMap[cid].totalDuration += r.duration_seconds || 0;
      if (r.is_onboarding) companyMap[cid].onboardingCount++;
      if (r.created_at > companyMap[cid].lastTest) companyMap[cid].lastTest = r.created_at;
    }

    // Enrich company IDs with names
    const companyIds = Object.keys(companyMap);
    let companyNames: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabaseAdminRaw
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      for (const c of (companies || []) as { id: string; name: string }[]) {
        companyNames[c.id] = c.name;
      }
    }

    const topCompanies = Object.entries(companyMap)
      .map(([companyId, d]) => ({
        companyId,
        companyName: companyNames[companyId] || 'Unknown',
        testCount: d.count,
        avgDurationSec: d.count > 0 ? Math.round(d.totalDuration / d.count) : 0,
        onboardingTests: d.onboardingCount,
        postOnboardingTests: d.count - d.onboardingCount,
        lastTestAt: d.lastTest,
      }))
      .sort((a, b) => b.testCount - a.testCount)
      .slice(0, 20);

    // Recent calls — enrich with company names
    const recentCalls = ((recentCallsRes.data || []) as {
      id: string; bland_call_id: string; agent_slug: string; agent_name: string;
      phone_number_masked: string; status: string; duration_seconds: number;
      is_onboarding: boolean; bland_cost: number; answered_by: string;
      created_at: string; completed_at: string; company_id: string; user_id: string;
    }[]).map(r => ({
      ...r,
      agent_label: AGENT_LABELS[r.agent_slug] || r.agent_slug,
      company_name: companyNames[r.company_id] || 'Unknown',
    }));

    // Avg duration by agent (completed calls only)
    const avgDurMap: Record<string, number[]> = {};
    for (const r of (avgDurationByAgentRes.data || []) as { agent_slug: string; duration_seconds: number }[]) {
      if (!avgDurMap[r.agent_slug]) avgDurMap[r.agent_slug] = [];
      avgDurMap[r.agent_slug].push(r.duration_seconds);
    }
    const avgDurationByAgent = Object.entries(avgDurMap).map(([slug, durations]) => ({
      slug,
      label: AGENT_LABELS[slug] || slug,
      avgDurationSec: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    }));

    // ─── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      summary: {
        total30d,
        totalToday: totalsTodayRes.count || 0,
        totalDurationSec30d,
        avgDurationSec30d: total30d > 0 ? Math.round(totalDurationSec30d / total30d) : 0,
        totalCost30d: Math.round(totalCost30d * 10000) / 10000,
        completionRate30d,
        onboardingCount,
        postOnboardingCount,
      },
      byAgent,
      byStatus,
      chartByDay,
      avgDurationByAgent,
      topCompanies,
      recentCalls,
      sevenDayCount: ((byDayRes.data || []) as { created_at: string }[])
        .filter(r => r.created_at >= sevenDaysAgo).length,
    });

  } catch (error) {
    console.error('[test-call-stats] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
