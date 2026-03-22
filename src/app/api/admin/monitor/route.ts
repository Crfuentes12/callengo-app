// app/api/admin/monitor/route.ts
// Admin Real-Time Monitor — Redis events, per-company caps, atomization, call scheduling
// Provides detailed breakdown of concurrency state, contact cooldowns, and Bland API usage
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { Redis } from '@upstash/redis';
import { CAMPAIGN_FEATURE_ACCESS } from '@/config/plan-features';
import { getBlandAccountInfo } from '@/lib/bland/master-client';
import { getConcurrencySnapshot, getBlandLimits, REDIS_AVAILABLE } from '@/lib/redis/concurrency-manager';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

export async function GET(req: NextRequest) {
  try {
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

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const section = req.nextUrl.searchParams.get('section') || 'all';
    const now = new Date();

    const response: Record<string, unknown> = {
      timestamp: now.toISOString(),
      redisConnected: REDIS_AVAILABLE,
    };

    // === SECTION: Redis State ===
    if (section === 'all' || section === 'redis') {
      response.redis = await getRedisState();
    }

    // === SECTION: Per-Company Breakdown ===
    if (section === 'all' || section === 'companies') {
      response.companies = await getCompanyBreakdown();
    }

    // === SECTION: Active Calls Detail ===
    if (section === 'all' || section === 'active_calls') {
      response.activeCalls = await getActiveCallsDetail();
    }

    // === SECTION: Contact Cooldowns ===
    if (section === 'all' || section === 'cooldowns') {
      response.cooldowns = await getContactCooldowns();
    }

    // === SECTION: Bland API Status ===
    if (section === 'all' || section === 'bland') {
      response.bland = await getBlandStatus();
    }

    // === SECTION: Recent Events (billing + architecture) ===
    if (section === 'all' || section === 'events') {
      response.events = await getRecentEvents();
    }

    // === SECTION: Atomization Schedule ===
    if (section === 'all' || section === 'atomization') {
      response.atomization = await getAtomizationStatus();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[admin/monitor] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ================================================================
// Redis State — All keys, counters, TTLs
// ================================================================
async function getRedisState() {
  if (!redis) {
    return { connected: false, message: 'Redis not configured (UPSTASH_REDIS_REST_URL missing)' };
  }

  try {
    const limits = await getBlandLimits();
    const snapshot = await getConcurrencySnapshot();

    // Scan all callengo keys (limit iterations to prevent timeouts on large keyspaces)
    const allKeys: { key: string; value: unknown; ttl: number }[] = [];
    let cursor = 0;
    let iterations = 0;
    const MAX_SCAN_ITERATIONS = 5;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'callengo:*',
        count: 200,
      });
      cursor = typeof nextCursor === 'number' ? nextCursor : parseInt(nextCursor as string, 10);
      iterations++;

      for (const key of keys.slice(0, 50)) { // Limit to 50 keys per batch
        try {
          const [value, ttl] = await Promise.all([
            redis.get(key),
            redis.ttl(key),
          ]);
          allKeys.push({ key, value, ttl });
        } catch { /* skip */ }
      }
    } while (cursor !== 0 && allKeys.length < 50 && iterations < MAX_SCAN_ITERATIONS);

    // Categorize keys
    const concurrent = allKeys.filter(k => k.key.includes('concurrent'));
    const daily = allKeys.filter(k => k.key.includes('daily'));
    const hourly = allKeys.filter(k => k.key.includes('hourly'));
    const cooldowns = allKeys.filter(k => k.key.includes('cooldown'));
    const activeCalls = allKeys.filter(k => k.key.includes('active_call'));
    const other = allKeys.filter(k =>
      !k.key.includes('concurrent') &&
      !k.key.includes('daily') &&
      !k.key.includes('hourly') &&
      !k.key.includes('cooldown') &&
      !k.key.includes('active_call')
    );

    return {
      connected: true,
      cachedLimits: limits,
      snapshot,
      keys: {
        total: allKeys.length,
        concurrent,
        daily,
        hourly,
        cooldowns,
        activeCalls,
        other,
      },
    };
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

// ================================================================
// Per-Company Breakdown — caps, usage, status
// ================================================================
async function getCompanyBreakdown() {
  // Use supabaseAdminRaw to avoid type issues with addon columns
  const { data: subscriptions } = await supabaseAdminRaw
    .from('company_subscriptions')
    .select(`
      id, company_id, status, overage_enabled, overage_budget, overage_spent,
      addon_dedicated_number, addon_calls_booster, addon_calls_booster_count,
      subscription_plans(slug, name, minutes_included, max_concurrent_calls)
    `)
    .in('status', ['active', 'trialing'])
    .order('company_id');

  if (!subscriptions) return [];

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const companies = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sub of subscriptions as any[]) {
    const plan = sub.subscription_plans as Record<string, unknown>;
    const planSlug = (plan?.slug as string) || 'free';
    const features = CAMPAIGN_FEATURE_ACCESS[planSlug] || CAMPAIGN_FEATURE_ACCESS.free;

    // Get current usage
    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('minutes_used, minutes_included')
      .eq('company_id', sub.company_id)
      .eq('subscription_id', sub.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Active calls count
    const { count: activeCalls } = await supabaseAdmin
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', sub.company_id)
      .in('status', ['in_progress', 'ringing', 'queued'])
      .gte('created_at', fifteenMinAgo);

    // Today's calls count
    const { count: todayCalls } = await supabaseAdmin
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', sub.company_id)
      .not('status', 'in', '("failed","error")')
      .gte('created_at', todayStart.toISOString());

    // Get company name
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', sub.company_id)
      .single();

    // Dedicated numbers (use raw to avoid type error)
    const { count: numNumbers } = await supabaseAdminRaw
      .from('company_addons')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', sub.company_id)
      .eq('addon_type', 'dedicated_number')
      .eq('status', 'active');

    // Booster minutes
    const boosterMinutes = (sub.addon_calls_booster_count || 0) * 225;

    companies.push({
      companyId: sub.company_id,
      companyName: company?.name || 'Unknown',
      plan: planSlug,
      status: sub.status,
      caps: {
        maxConcurrent: features.maxConcurrentCalls === -1 ? 'unlimited' : features.maxConcurrentCalls,
        maxCallDuration: features.maxCallDurationMinutes === -1 ? 'unlimited' : `${features.maxCallDurationMinutes} min`,
        maxFollowUpAttempts: features.maxFollowUpAttempts === -1 ? 'unlimited' : features.maxFollowUpAttempts,
      },
      usage: {
        minutesUsed: usage?.minutes_used || 0,
        minutesIncluded: (usage?.minutes_included || 0) + boosterMinutes,
        percentUsed: usage?.minutes_included
          ? Math.round(((usage.minutes_used || 0) / ((usage.minutes_included || 0) + boosterMinutes)) * 100)
          : 0,
      },
      realtime: {
        activeCalls: activeCalls || 0,
        todayCalls: todayCalls || 0,
      },
      overage: {
        enabled: sub.overage_enabled,
        budget: sub.overage_budget,
        spent: sub.overage_spent,
      },
      addons: {
        dedicatedNumbers: numNumbers || 0,
        callsBoosters: sub.addon_calls_booster_count || 0,
        boosterMinutes,
      },
    });
  }

  return companies;
}

// ================================================================
// Active Calls Detail — what's currently in flight
// ================================================================
async function getActiveCallsDetail() {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: calls } = await supabaseAdmin
    .from('call_logs')
    .select(`
      id, call_id, company_id, contact_id, status, created_at,
      metadata
    `)
    .in('status', ['in_progress', 'ringing', 'queued'])
    .gte('created_at', fifteenMinAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!calls) return [];

  return calls.map(call => {
    const meta = call.metadata as Record<string, unknown> | null;
    const elapsedSeconds = Math.round((Date.now() - new Date(call.created_at).getTime()) / 1000);

    return {
      callId: call.call_id,
      companyId: call.company_id,
      contactId: call.contact_id,
      status: call.status,
      startedAt: call.created_at,
      elapsedSeconds,
      elapsedFormatted: `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
      agentName: meta?.agent_name || 'Unknown',
      campaignId: meta?.campaign_id || null,
      isStale: elapsedSeconds > 600, // Flag calls running > 10 min
    };
  });
}

// ================================================================
// Contact Cooldowns — currently locked contacts (5-min gap)
// ================================================================
async function getContactCooldowns() {
  if (!redis) {
    return { available: false, message: 'Redis not configured' };
  }

  try {
    const cooldowns: { contactId: string; ttlSeconds: number }[] = [];
    let cursor = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'callengo:contact_cooldown:*',
        count: 100,
      });
      cursor = typeof nextCursor === 'number' ? nextCursor : parseInt(nextCursor as string, 10);

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        const contactId = key.replace('callengo:contact_cooldown:', '');
        cooldowns.push({ contactId, ttlSeconds: ttl });
      }
    } while (cursor !== 0 && cooldowns.length < 100);

    return {
      available: true,
      count: cooldowns.length,
      cooldowns: cooldowns.sort((a, b) => b.ttlSeconds - a.ttlSeconds),
    };
  } catch (error) {
    return { available: false, error: String(error) };
  }
}

// ================================================================
// Bland API Status — account info, plan, remaining capacity
// ================================================================
async function getBlandStatus() {
  try {
    const account = await getBlandAccountInfo();
    const limits = await getBlandLimits();

    return {
      account: {
        plan: account.plan,
        balance: account.balance,
        totalCalls: account.totalCalls,
        costPerMinute: account.costPerMinute,
        transferRate: account.transferRate,
        status: account.status,
      },
      limits: {
        dailyCap: account.dailyCap,
        hourlyCap: account.hourlyCap,
        concurrentCap: account.concurrentCap,
        voiceClones: account.voiceClones,
      },
      cachedLimits: limits,
      estimatedMinutesRemaining: account.balance > 0
        ? Math.floor(account.balance / account.costPerMinute)
        : 0,
      estimatedCallsRemaining: account.balance > 0
        ? Math.floor(account.balance / (account.costPerMinute * 1.5))
        : 0,
    };
  } catch (error) {
    return { error: String(error) };
  }
}

// ================================================================
// Recent Events — billing, architecture, Redis events
// ================================================================
async function getRecentEvents() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [billingEvents, stripeEvents] = await Promise.all([
    supabaseAdmin
      .from('billing_events')
      .select('id, company_id, event_type, event_data, minutes_consumed, cost_usd, created_at')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(30),

    supabaseAdmin
      .from('stripe_events')
      .select('id, type, processed, created_at, processed_at')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    billing: billingEvents.data || [],
    stripe: stripeEvents.data || [],
    summary: {
      totalBillingEvents: billingEvents.data?.length || 0,
      totalStripeEvents: stripeEvents.data?.length || 0,
      eventTypes: countEventTypes(billingEvents.data || []),
    },
  };
}

function countEventTypes(events: { event_type: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.event_type] = (counts[e.event_type] || 0) + 1;
  });
  return counts;
}

// ================================================================
// Atomization Status — call scheduling and interleaving
// ================================================================
async function getAtomizationStatus() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Get calls from the last 5 minutes to analyze scheduling pattern
  const { data: recentCalls } = await supabaseAdmin
    .from('call_logs')
    .select('company_id, contact_id, created_at, status')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: true });

  if (!recentCalls || recentCalls.length === 0) {
    return { message: 'No calls in the last 5 minutes', callsAnalyzed: 0 };
  }

  // Analyze inter-call gaps
  const gaps: { companyId: string; gapMs: number; contactId: string | null }[] = [];
  const companyLastCall: Record<string, { time: number; contactId: string | null }> = {};

  for (const call of recentCalls) {
    const callTime = new Date(call.created_at).getTime();

    if (companyLastCall[call.company_id]) {
      const gap = callTime - companyLastCall[call.company_id].time;
      gaps.push({
        companyId: call.company_id,
        gapMs: gap,
        contactId: call.contact_id,
      });
    }

    companyLastCall[call.company_id] = { time: callTime, contactId: call.contact_id };
  }

  // Check for same-contact violations (calls to same contact within 5 min)
  const contactCalls: Record<string, number[]> = {};
  for (const call of recentCalls) {
    if (call.contact_id) {
      if (!contactCalls[call.contact_id]) contactCalls[call.contact_id] = [];
      contactCalls[call.contact_id].push(new Date(call.created_at).getTime());
    }
  }

  const violations: { contactId: string; gapSeconds: number }[] = [];
  for (const [contactId, times] of Object.entries(contactCalls)) {
    for (let i = 1; i < times.length; i++) {
      const gapSeconds = (times[i] - times[i - 1]) / 1000;
      if (gapSeconds < 300) { // Less than 5 minutes
        violations.push({ contactId, gapSeconds: Math.round(gapSeconds) });
      }
    }
  }

  // Company interleaving analysis
  const companyOrder = recentCalls.map(c => c.company_id);
  const uniqueCompanies = [...new Set(companyOrder)];
  const isInterleaved = uniqueCompanies.length > 1 &&
    companyOrder.some((c, i) => i > 0 && c !== companyOrder[i - 1]);

  return {
    callsAnalyzed: recentCalls.length,
    companiesActive: uniqueCompanies.length,
    interleaving: {
      isInterleaved,
      pattern: companyOrder.slice(0, 20), // First 20 calls
    },
    gaps: {
      count: gaps.length,
      avgGapMs: gaps.length > 0
        ? Math.round(gaps.reduce((s, g) => s + g.gapMs, 0) / gaps.length)
        : 0,
      minGapMs: gaps.length > 0 ? Math.min(...gaps.map(g => g.gapMs)) : 0,
      maxGapMs: gaps.length > 0 ? Math.max(...gaps.map(g => g.gapMs)) : 0,
    },
    cooldownViolations: {
      count: violations.length,
      violations,
    },
    contactCooldownMinSeconds: 300, // 5 minutes
  };
}
