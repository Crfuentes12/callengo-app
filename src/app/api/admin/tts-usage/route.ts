// app/api/admin/tts-usage/route.ts
// Admin endpoint: aggregated TTS voice sample usage data for the Command Center.
// Auth: admin or owner role required.

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';

export async function GET(): Promise<NextResponse> {
  try {
    // ─── Auth: require admin or owner ──────────────────────────────────
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

    // ─── Time boundaries ───────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // ─── Parallel queries ──────────────────────────────────────────────
    const [
      total30dResult,
      totalTodayResult,
      byVoiceResult,
      recentLogsResult,
      cachedCountResult,
    ] = await Promise.all([
      // Total cost & generations in last 30 days
      supabaseAdminRaw
        .from('tts_usage_logs')
        .select('cost_usd, characters_count')
        .eq('cached', false)
        .gte('created_at', thirtyDaysAgo),

      // Today's totals
      supabaseAdminRaw
        .from('tts_usage_logs')
        .select('cost_usd, characters_count')
        .eq('cached', false)
        .gte('created_at', todayStart),

      // Breakdown by voice
      supabaseAdminRaw
        .from('tts_usage_logs')
        .select('voice_id, voice_name, cost_usd, characters_count')
        .eq('cached', false)
        .gte('created_at', thirtyDaysAgo),

      // Recent logs (last 20)
      supabaseAdminRaw
        .from('tts_usage_logs')
        .select('*')
        .eq('cached', false)
        .order('created_at', { ascending: false })
        .limit(20),

      // Total cached samples (voices that have been generated at least once)
      supabaseAdminRaw
        .from('tts_usage_logs')
        .select('voice_id')
        .eq('cached', false),
    ]);

    // ─── Aggregate 30-day totals ───────────────────────────────────────
    const rows30d = total30dResult.data || [];
    const totalCost30d = rows30d.reduce((sum: number, r: { cost_usd: number }) => sum + Number(r.cost_usd || 0), 0);
    const totalGenerations30d = rows30d.length;
    const totalChars30d = rows30d.reduce((sum: number, r: { characters_count: number }) => sum + (r.characters_count || 0), 0);

    // ─── Aggregate today's totals ──────────────────────────────────────
    const rowsToday = totalTodayResult.data || [];
    const totalCostToday = rowsToday.reduce((sum: number, r: { cost_usd: number }) => sum + Number(r.cost_usd || 0), 0);
    const totalGenerationsToday = rowsToday.length;

    // ─── By voice breakdown ────────────────────────────────────────────
    const voiceMap = new Map<string, { voiceName: string; cost: number; generations: number; characters: number }>();
    for (const row of (byVoiceResult.data || [])) {
      const existing = voiceMap.get(row.voice_id) || { voiceName: row.voice_name, cost: 0, generations: 0, characters: 0 };
      existing.cost += Number(row.cost_usd || 0);
      existing.generations += 1;
      existing.characters += row.characters_count || 0;
      voiceMap.set(row.voice_id, existing);
    }
    const byVoice = Array.from(voiceMap.entries())
      .map(([voiceId, data]) => ({ voiceId, ...data }))
      .sort((a, b) => b.cost - a.cost);

    // ─── Unique voices cached ──────────────────────────────────────────
    const uniqueVoicesCached = new Set((cachedCountResult.data || []).map((r: { voice_id: string }) => r.voice_id)).size;

    return NextResponse.json({
      totalCost30d: Math.round(totalCost30d * 1_000_000) / 1_000_000,
      totalGenerations30d,
      totalChars30d,
      totalCostToday: Math.round(totalCostToday * 1_000_000) / 1_000_000,
      totalGenerationsToday,
      uniqueVoicesCached,
      totalVoices: 51,
      byVoice,
      recentLogs: (recentLogsResult.data || []).map((log: Record<string, unknown>) => ({
        id: log.id,
        createdAt: log.created_at,
        voiceId: log.voice_id,
        voiceName: log.voice_name,
        characters: log.characters_count,
        cost: Number(log.cost_usd || 0),
        companyId: log.company_id,
      })),
    });
  } catch (error) {
    console.error('Error fetching TTS usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
