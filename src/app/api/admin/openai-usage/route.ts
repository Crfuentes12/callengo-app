// app/api/admin/openai-usage/route.ts
// Admin endpoint: aggregated OpenAI usage data for the AI Costs tab.
// Auth: admin or owner role required (same pattern as command-center).

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';

// Feature key → human-readable label mapping (mirrors tracker.ts)
const FEATURE_LABELS: Record<string, string> = {
  call_analysis:    'Call Analysis',
  demo_analysis:    'Demo Analysis',
  contact_analysis: 'Contact Analysis',
  onboarding:       'Onboarding',
  cali_ai:          'Cali AI',
};

// Use supabaseAdminRaw because openai_usage_logs is not in the generated DB types yet

export async function GET(): Promise<NextResponse> {
  try {
    // ─── Auth: require admin or owner ──────────────────────────────────────────
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ─── Time boundaries ────────────────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // ─── Run queries in parallel ────────────────────────────────────────────────
    const [
      total30dResult,
      totalTodayResult,
      byFeatureResult,
      byModelResult,
      dailyResult,
      recentLogsResult,
    ] = await Promise.all([

      // 1. Rolling 30-day totals
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('cost_usd, total_tokens', { count: 'exact' })
        .gte('created_at', thirtyDaysAgo),

      // 2. Today totals
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('cost_usd, total_tokens', { count: 'exact' })
        .gte('created_at', todayStart),

      // 3. By feature (30d)
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('feature_key, api_key_label, input_tokens, output_tokens, total_tokens, cost_usd')
        .gte('created_at', thirtyDaysAgo),

      // 4. By model (30d)
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('model, total_tokens, cost_usd')
        .gte('created_at', thirtyDaysAgo),

      // 5. Daily cost for chart (last 30 days)
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('created_at, cost_usd, total_tokens')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true }),

      // 6. Recent 50 log entries
      supabaseAdminRaw
        .from('openai_usage_logs')
        .select('id, created_at, feature_key, api_key_label, model, input_tokens, output_tokens, total_tokens, cost_usd, company_id')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // ─── Aggregate 30-day totals ────────────────────────────────────────────────
    type UsageSummaryRow = { cost_usd: number; total_tokens: number };
    const rows30d = (total30dResult.data as UsageSummaryRow[] | null) ?? [];
    const totalCost30d = rows30d.reduce((s, r) => s + Number(r.cost_usd), 0);
    const totalTokens30d = rows30d.reduce((s, r) => s + (r.total_tokens || 0), 0);
    const totalRequests30d = total30dResult.count ?? rows30d.length;

    // ─── Aggregate today totals ─────────────────────────────────────────────────
    const rowsToday = (totalTodayResult.data as UsageSummaryRow[] | null) ?? [];
    const totalCostToday = rowsToday.reduce((s, r) => s + Number(r.cost_usd), 0);
    const totalTokensToday = rowsToday.reduce((s, r) => s + (r.total_tokens || 0), 0);
    const totalRequestsToday = totalTodayResult.count ?? rowsToday.length;

    // ─── By feature ────────────────────────────────────────────────────────────
    type FeatureRow = {
      feature_key: string;
      api_key_label: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost_usd: number;
    };

    const featureMap: Record<string, {
      featureKey: string;
      label: string;
      requests: number;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }> = {};

    for (const row of (byFeatureResult.data as FeatureRow[] | null) ?? []) {
      const key = row.feature_key;
      if (!featureMap[key]) {
        featureMap[key] = {
          featureKey: key,
          label: FEATURE_LABELS[key] ?? key,
          requests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      featureMap[key].requests += 1;
      featureMap[key].totalTokens += row.total_tokens || 0;
      featureMap[key].inputTokens += row.input_tokens || 0;
      featureMap[key].outputTokens += row.output_tokens || 0;
      featureMap[key].cost += Number(row.cost_usd);
    }

    const byFeature = Object.values(featureMap).sort((a, b) => b.cost - a.cost);

    // ─── By model ───────────────────────────────────────────────────────────────
    type ModelRow = { model: string; total_tokens: number; cost_usd: number };

    const modelMap: Record<string, { model: string; requests: number; totalTokens: number; cost: number }> = {};

    for (const row of (byModelResult.data as ModelRow[] | null) ?? []) {
      const key = row.model;
      if (!modelMap[key]) {
        modelMap[key] = { model: key, requests: 0, totalTokens: 0, cost: 0 };
      }
      modelMap[key].requests += 1;
      modelMap[key].totalTokens += row.total_tokens || 0;
      modelMap[key].cost += Number(row.cost_usd);
    }

    const byModel = Object.values(modelMap).sort((a, b) => b.cost - a.cost);

    // ─── Daily cost chart (bucket by date) ─────────────────────────────────────
    type DailyRow = { created_at: string; cost_usd: number; total_tokens: number };

    const dailyMap: Record<string, { cost: number; tokens: number; requests: number }> = {};

    // Pre-fill all 30 days with zeros
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap[dateStr] = { cost: 0, tokens: 0, requests: 0 };
    }

    for (const row of (dailyResult.data as DailyRow[] | null) ?? []) {
      const dateStr = row.created_at.split('T')[0];
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].cost += Number(row.cost_usd);
        dailyMap[dateStr].tokens += row.total_tokens || 0;
        dailyMap[dateStr].requests += 1;
      }
    }

    const dailyCosts = Object.entries(dailyMap).map(([date, v]) => ({
      date,
      cost: Math.round(v.cost * 1_000_000) / 1_000_000,
      tokens: v.tokens,
      requests: v.requests,
    }));

    // ─── Recent logs ────────────────────────────────────────────────────────────
    type LogRow = {
      id: string;
      created_at: string;
      feature_key: string;
      api_key_label: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost_usd: number;
      company_id: string | null;
    };

    const recentLogs = ((recentLogsResult.data as LogRow[] | null) ?? []).map(row => ({
      id: row.id,
      createdAt: row.created_at,
      featureKey: row.feature_key,
      apiKeyLabel: row.api_key_label,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      costUsd: Number(row.cost_usd),
      companyId: row.company_id,
    }));

    return NextResponse.json({
      totalCost30d:       Math.round(totalCost30d * 1_000_000) / 1_000_000,
      totalTokens30d,
      totalRequests30d,
      totalCostToday:     Math.round(totalCostToday * 1_000_000) / 1_000_000,
      totalTokensToday,
      totalRequestsToday,
      byFeature,
      byModel,
      dailyCosts,
      recentLogs,
    });

  } catch (error) {
    console.error('[admin/openai-usage] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
