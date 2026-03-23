/**
 * Redis Concurrency Manager — Multi-Tenant Call Scheduling
 *
 * Manages global Bland API limits (daily, hourly, concurrent) across ALL companies
 * using a single master API key. Uses Upstash Redis for distributed state.
 *
 * Key features:
 * - Atomic concurrent call tracking (INCR/DECR)
 * - 5-minute minimum gap between calls to the same contact (anti-overlap)
 * - Global daily/hourly counters to stay within Bland plan limits
 * - Per-company concurrent tracking for plan-level enforcement
 * - Fair scheduling: interleaves calls across companies
 *
 * All keys use TTL to auto-expire — no manual cleanup needed.
 */

import { Redis } from '@upstash/redis';

// ================================================================
// Redis Client
// ================================================================

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const REDIS_AVAILABLE = !!redis;

// ================================================================
// Circuit Breaker — Prevents fail-open abuse during Redis outages
// After CIRCUIT_BREAKER_THRESHOLD consecutive failures, block calls
// instead of allowing them blindly.
// ================================================================

let consecutiveRedisFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 1 minute
let circuitBreakerTrippedAt: number | null = null;

function recordRedisSuccess() {
  consecutiveRedisFailures = 0;
  circuitBreakerTrippedAt = null;
}

function recordRedisFailure() {
  consecutiveRedisFailures++;
  if (consecutiveRedisFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuitBreakerTrippedAt) {
    circuitBreakerTrippedAt = Date.now();
    console.error(`[concurrency-manager] Circuit breaker TRIPPED after ${consecutiveRedisFailures} consecutive Redis failures`);
  }
}

function isCircuitBreakerOpen(): boolean {
  if (!circuitBreakerTrippedAt) return false;
  // Auto-reset after CIRCUIT_BREAKER_RESET_MS to allow retry
  if (Date.now() - circuitBreakerTrippedAt > CIRCUIT_BREAKER_RESET_MS) {
    consecutiveRedisFailures = 0;
    circuitBreakerTrippedAt = null;
    console.log('[concurrency-manager] Circuit breaker RESET — retrying Redis');
    return false;
  }
  return true;
}

if (!REDIS_AVAILABLE && process.env.NODE_ENV !== 'test') {
  console.warn('[concurrency-manager] UPSTASH_REDIS_REST_URL not configured — concurrency limits will use DB fallback');
}

// ================================================================
// Key Prefixes
// ================================================================
const KEYS = {
  /** Global concurrent calls counter */
  globalConcurrent: 'callengo:concurrent:global',
  /** Per-company concurrent calls: callengo:concurrent:company:{companyId} */
  companyConcurrent: (companyId: string) => `callengo:concurrent:company:${companyId}`,
  /** Global hourly counter: callengo:hourly:{hourBucket} */
  globalHourly: () => `callengo:hourly:${Math.floor(Date.now() / 3_600_000)}`,
  /** Global daily counter: callengo:daily:{dateBucket} */
  globalDaily: () => `callengo:daily:${new Date().toISOString().split('T')[0]}`,
  /** Per-company daily counter */
  companyDaily: (companyId: string) => `callengo:daily:${new Date().toISOString().split('T')[0]}:${companyId}`,
  /** Per-company hourly counter */
  companyHourly: (companyId: string) => `callengo:hourly:${Math.floor(Date.now() / 3_600_000)}:${companyId}`,
  /** Contact cooldown: callengo:contact_cooldown:{contactId} */
  contactCooldown: (contactId: string) => `callengo:contact_cooldown:${contactId}`,
  /** Bland plan info cache */
  blandPlanCache: 'callengo:bland_plan_info',
  /** Active call tracking: callengo:active_call:{callId} */
  activeCall: (callId: string) => `callengo:active_call:${callId}`,
} as const;

// ================================================================
// Bland Plan Limits (fetched/cached or defaults)
// ================================================================

export interface BlandLimits {
  dailyCap: number;
  hourlyCap: number;
  concurrentCap: number;
  plan: string;
}

/** Default limits (Start plan) — overridden by cached plan info */
const DEFAULT_LIMITS: BlandLimits = {
  dailyCap: Number(process.env.BLAND_DAILY_CAP || '100'),
  hourlyCap: Number(process.env.BLAND_HOURLY_CAP || '100'),
  concurrentCap: Number(process.env.BLAND_CONCURRENT_CAP || '10'),
  plan: 'start',
};

/**
 * Get the current Bland plan limits.
 * Uses cached value from Redis if available, otherwise env vars / defaults.
 */
export async function getBlandLimits(): Promise<BlandLimits> {
  if (!redis) return DEFAULT_LIMITS;

  try {
    const cached = await redis.get<BlandLimits>(KEYS.blandPlanCache);
    if (cached) return cached;
  } catch {
    // Fall through to defaults
  }

  return DEFAULT_LIMITS;
}

/**
 * Cache the Bland plan limits in Redis (called after fetching from /v1/me).
 */
export async function cacheBlandLimits(limits: BlandLimits): Promise<void> {
  if (!redis) return;
  try {
    // Cache for 1 hour
    await redis.set(KEYS.blandPlanCache, limits, { ex: 3600 });
  } catch (error) {
    console.error('[concurrency-manager] Failed to cache Bland limits:', error);
  }
}

// ================================================================
// Concurrency Control — Acquire / Release
// ================================================================

export interface ConcurrencyCheckResult {
  allowed: boolean;
  reason?: string;
  globalConcurrent: number;
  globalConcurrentCap: number;
  companyConcurrent: number;
  companyConcurrentCap: number;
  globalDaily: number;
  globalDailyCap: number;
  globalHourly: number;
  globalHourlyCap: number;
  companyDaily: number;
  companyHourly: number;
}

/**
 * Check if a new call can be dispatched, considering ALL limits.
 * Does NOT increment counters — use `acquireCallSlot()` for that.
 *
 * @param companyId - Company requesting the call
 * @param companyConcurrentCap - Plan-specific concurrent limit for this company
 * @param companyDailyCap - Plan-specific daily cap for this company
 * @param companyHourlyCap - Plan-specific hourly cap for this company
 * @param contactId - Optional: check contact cooldown (5-min gap)
 */
export async function checkCallCapacity(
  companyId: string,
  companyConcurrentCap: number,
  companyDailyCap: number,
  companyHourlyCap: number,
  contactId?: string
): Promise<ConcurrencyCheckResult> {
  if (!redis) {
    // Without Redis, allow all (DB-based fallback in call-throttle.ts handles it)
    return {
      allowed: true,
      globalConcurrent: 0,
      globalConcurrentCap: DEFAULT_LIMITS.concurrentCap,
      companyConcurrent: 0,
      companyConcurrentCap,
      globalDaily: 0,
      globalDailyCap: DEFAULT_LIMITS.dailyCap,
      globalHourly: 0,
      globalHourlyCap: DEFAULT_LIMITS.hourlyCap,
      companyDaily: 0,
      companyHourly: 0,
    };
  }

  const limits = await getBlandLimits();

  // Use pipeline for efficient multi-key reads
  const pipeline = redis.pipeline();
  pipeline.get(KEYS.globalConcurrent);
  pipeline.get(KEYS.companyConcurrent(companyId));
  pipeline.get(KEYS.globalDaily());
  pipeline.get(KEYS.globalHourly());
  pipeline.get(KEYS.companyDaily(companyId));
  pipeline.get(KEYS.companyHourly(companyId));

  if (contactId) {
    pipeline.exists(KEYS.contactCooldown(contactId));
  }

  const results = await pipeline.exec();

  const globalConcurrent = (results[0] as number) || 0;
  const companyConcurrent = (results[1] as number) || 0;
  const globalDaily = (results[2] as number) || 0;
  const globalHourly = (results[3] as number) || 0;
  const companyDaily = (results[4] as number) || 0;
  const companyHourly = (results[5] as number) || 0;
  const contactOnCooldown = contactId ? ((results[6] as number) || 0) > 0 : false;

  // Use 90% of Bland limits as safety margin
  const safeDailyCap = Math.floor(limits.dailyCap * 0.9);
  const safeHourlyCap = Math.floor(limits.hourlyCap * 0.9);
  const safeConcurrentCap = Math.floor(limits.concurrentCap * 0.9);

  const base = {
    globalConcurrent,
    globalConcurrentCap: safeConcurrentCap,
    companyConcurrent,
    companyConcurrentCap,
    globalDaily,
    globalDailyCap: safeDailyCap,
    globalHourly,
    globalHourlyCap: safeHourlyCap,
    companyDaily,
    companyHourly,
  };

  // Check contact cooldown (5-min gap between calls to same contact)
  if (contactOnCooldown) {
    return { ...base, allowed: false, reason: 'Contact was called recently (5-min cooldown)' };
  }

  // Check global concurrent
  if (globalConcurrent >= safeConcurrentCap) {
    return { ...base, allowed: false, reason: `Platform at max concurrent calls (${safeConcurrentCap})` };
  }

  // Check company concurrent
  if (companyConcurrentCap !== -1 && companyConcurrent >= companyConcurrentCap) {
    return { ...base, allowed: false, reason: `Company at max concurrent calls (${companyConcurrentCap})` };
  }

  // Check global daily
  if (globalDaily >= safeDailyCap) {
    return { ...base, allowed: false, reason: `Platform daily call limit reached (${safeDailyCap})` };
  }

  // Check global hourly
  if (globalHourly >= safeHourlyCap) {
    return { ...base, allowed: false, reason: `Platform hourly call limit reached (${safeHourlyCap})` };
  }

  // Check company daily
  if (companyDaily >= companyDailyCap) {
    return { ...base, allowed: false, reason: `Company daily call limit reached (${companyDailyCap})` };
  }

  // Check company hourly
  if (companyHourly >= companyHourlyCap) {
    return { ...base, allowed: false, reason: `Company hourly call limit reached (${companyHourlyCap})` };
  }

  return { ...base, allowed: true };
}

/**
 * Acquire a call slot — atomically increments all relevant counters.
 * Must call `releaseCallSlot()` when the call completes.
 *
 * @returns callSlotId - Unique ID to pass to releaseCallSlot
 */
export async function acquireCallSlot(
  companyId: string,
  callId: string,
  contactId?: string,
  limits?: { concurrentCap: number; dailyCap: number; hourlyCap: number }
): Promise<{ acquired: boolean; error?: string }> {
  if (!redis) {
    return { acquired: true }; // No Redis = no Redis-based limiting
  }

  try {
    // Atomic contact cooldown check-and-set using SET NX (prevents race condition
    // where two threads both see no cooldown and both acquire slots for same contact)
    if (contactId) {
      const cooldownSet = await redis.set(KEYS.contactCooldown(contactId), '1', { ex: 300, nx: true });
      if (!cooldownSet) {
        return { acquired: false, error: 'Contact was called recently (5-min cooldown)' };
      }
    }

    // Single pipeline: increment counters + set TTLs + track active call
    // This prevents counter drift if process crashes between two pipelines.
    const pipeline = redis.pipeline();

    // Increment all counters
    pipeline.incr(KEYS.globalConcurrent);          // [0]
    pipeline.incr(KEYS.companyConcurrent(companyId)); // [1]
    pipeline.incr(KEYS.globalDaily());              // [2]
    pipeline.incr(KEYS.globalHourly());             // [3]
    pipeline.incr(KEYS.companyDaily(companyId));     // [4]
    pipeline.incr(KEYS.companyHourly(companyId));    // [5]

    // Set TTLs in the SAME pipeline (prevents orphaned counters without expiry)
    pipeline.expire(KEYS.globalConcurrent, 1800);
    pipeline.expire(KEYS.companyConcurrent(companyId), 1800);
    pipeline.expire(KEYS.globalDaily(), 86400);
    pipeline.expire(KEYS.globalHourly(), 7200);
    pipeline.expire(KEYS.companyDaily(companyId), 86400);
    pipeline.expire(KEYS.companyHourly(companyId), 7200);

    // Track active call with 30-min TTL (auto-cleanup if webhook doesn't arrive)
    pipeline.set(KEYS.activeCall(callId), JSON.stringify({ companyId, contactId, ts: Date.now() }), { ex: 1800 });

    const results = await pipeline.exec();

    // Post-increment cap check: if we exceeded limits, roll back immediately.
    // This makes check+acquire effectively atomic — we increment first, then verify.
    if (limits) {
      const newGlobalConcurrent = (results[0] as number) || 0;
      const newCompanyConcurrent = (results[1] as number) || 0;
      const newGlobalDaily = (results[2] as number) || 0;
      const newGlobalHourly = (results[3] as number) || 0;
      const newCompanyDaily = (results[4] as number) || 0;
      const newCompanyHourly = (results[5] as number) || 0;

      const blandLimits = await getBlandLimits();
      const safeConcurrentCap = Math.floor(blandLimits.concurrentCap * 0.9);
      const safeDailyCap = Math.floor(blandLimits.dailyCap * 0.9);
      const safeHourlyCap = Math.floor(blandLimits.hourlyCap * 0.9);

      let overLimit = false;
      let reason = '';

      if (newGlobalConcurrent > safeConcurrentCap) {
        overLimit = true;
        reason = `Platform at max concurrent calls (${safeConcurrentCap})`;
      } else if (limits.concurrentCap !== -1 && newCompanyConcurrent > limits.concurrentCap) {
        overLimit = true;
        reason = `Company at max concurrent calls (${limits.concurrentCap})`;
      } else if (newGlobalDaily > safeDailyCap) {
        overLimit = true;
        reason = `Platform daily call limit reached (${safeDailyCap})`;
      } else if (newGlobalHourly > safeHourlyCap) {
        overLimit = true;
        reason = `Platform hourly call limit reached (${safeHourlyCap})`;
      } else if (newCompanyDaily > limits.dailyCap) {
        overLimit = true;
        reason = `Company daily call limit reached (${limits.dailyCap})`;
      } else if (newCompanyHourly > limits.hourlyCap) {
        overLimit = true;
        reason = `Company hourly call limit reached (${limits.hourlyCap})`;
      }

      if (overLimit) {
        // Roll back: decrement counters and remove active call
        await rollbackSlot(companyId, callId);
        // Also release contact cooldown so the contact can be retried
        if (contactId) {
          await redis.del(KEYS.contactCooldown(contactId)).catch(() => {});
        }
        return { acquired: false, error: reason };
      }
    }

    recordRedisSuccess();
    return { acquired: true };
  } catch (error) {
    console.error('[concurrency-manager] acquireCallSlot error:', error);
    recordRedisFailure();
    // Circuit breaker: if Redis has been down too long, BLOCK calls to prevent
    // exceeding Bland API limits and getting the master account suspended.
    if (isCircuitBreakerOpen()) {
      return { acquired: false, error: 'Redis unavailable — call scheduling paused for safety' };
    }
    // First 2 failures: fail open to avoid blocking business during brief blips
    // (reduced from 5 to limit exposure window)
    if (consecutiveRedisFailures <= 2) {
      return { acquired: true };
    }
    return { acquired: false, error: 'Redis temporarily unavailable' };
  }
}

/** Roll back counters after a failed post-increment cap check. */
async function rollbackSlot(companyId: string, callId: string): Promise<void> {
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.decr(KEYS.globalConcurrent);
    pipeline.decr(KEYS.companyConcurrent(companyId));
    pipeline.del(KEYS.activeCall(callId));
    // Note: daily/hourly counters are NOT decremented — they represent attempts, not active calls
    await pipeline.exec();
  } catch (err) {
    console.error('[concurrency-manager] rollbackSlot error:', err);
  }
}

/**
 * Release a call slot — decrements concurrent counters.
 * Called when a call completes (webhook received) or fails.
 */
export async function releaseCallSlot(
  companyId: string,
  callId: string
): Promise<void> {
  if (!redis) return;

  try {
    // First check if this call slot actually exists (prevent double-release)
    const callExists = await redis.exists(KEYS.activeCall(callId));

    if (!callExists) {
      // Slot was already released (e.g., TTL expired or duplicate webhook)
      // Don't decrement counters to avoid going negative
      console.warn(`[concurrency-manager] releaseCallSlot: call ${callId} not found (already released or expired)`);
      return;
    }

    const pipeline = redis.pipeline();

    // Decrement concurrent counters
    pipeline.decr(KEYS.globalConcurrent);
    pipeline.decr(KEYS.companyConcurrent(companyId));

    // Remove active call tracker
    pipeline.del(KEYS.activeCall(callId));

    const results = await pipeline.exec();

    // Fix negative counters atomically (can happen if TTL expired before release)
    const globalAfter = results[0] as number;
    const companyAfter = results[1] as number;

    if (globalAfter < 0) {
      await redis.set(KEYS.globalConcurrent, 0, { ex: 1800 });
    }
    if (companyAfter < 0) {
      await redis.set(KEYS.companyConcurrent(companyId), 0, { ex: 1800 });
    }
  } catch (error) {
    console.error('[concurrency-manager] releaseCallSlot error:', error);
  }
}

// ================================================================
// Monitoring — For Admin Command Center
// ================================================================

export interface ConcurrencySnapshot {
  globalConcurrent: number;
  globalDaily: number;
  globalHourly: number;
  blandLimits: BlandLimits;
  activeCallCount: number;
  topCompanies: { companyId: string; concurrent: number; daily: number }[];
}

/**
 * Get a snapshot of current concurrency state (for admin monitoring).
 */
export async function getConcurrencySnapshot(): Promise<ConcurrencySnapshot> {
  const limits = await getBlandLimits();

  if (!redis) {
    return {
      globalConcurrent: 0,
      globalDaily: 0,
      globalHourly: 0,
      blandLimits: limits,
      activeCallCount: 0,
      topCompanies: [],
    };
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.get(KEYS.globalConcurrent);
    pipeline.get(KEYS.globalDaily());
    pipeline.get(KEYS.globalHourly());

    const results = await pipeline.exec();

    const globalConcurrent = (results[0] as number) || 0;
    const globalDaily = (results[1] as number) || 0;
    const globalHourly = (results[2] as number) || 0;

    // Scan for active calls to get per-company breakdown
    let activeCallCount = 0;
    const companyStats: Record<string, { concurrent: number; daily: number }> = {};

    // Scan active call keys (max 10 iterations to prevent unbounded loops)
    let cursor = 0;
    let scanIterations = 0;
    const MAX_SCAN_ITERATIONS = 10;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'callengo:active_call:*',
        count: 100,
      });
      cursor = typeof nextCursor === 'number' ? nextCursor : parseInt(nextCursor as string, 10);
      activeCallCount += keys.length;
      scanIterations++;

      for (const key of keys) {
        try {
          const data = await redis.get<{ companyId: string }>(key);
          if (data?.companyId) {
            if (!companyStats[data.companyId]) {
              companyStats[data.companyId] = { concurrent: 0, daily: 0 };
            }
            companyStats[data.companyId].concurrent++;
          }
        } catch { /* skip individual key errors */ }
      }
    } while (cursor !== 0 && scanIterations < MAX_SCAN_ITERATIONS);

    // Get daily counts for companies with active calls
    for (const companyId of Object.keys(companyStats)) {
      const daily = await redis.get<number>(KEYS.companyDaily(companyId));
      companyStats[companyId].daily = daily || 0;
    }

    const topCompanies = Object.entries(companyStats)
      .map(([companyId, stats]) => ({ companyId, ...stats }))
      .sort((a, b) => b.concurrent - a.concurrent)
      .slice(0, 10);

    return {
      globalConcurrent,
      globalDaily,
      globalHourly,
      blandLimits: limits,
      activeCallCount,
      topCompanies,
    };
  } catch (error) {
    console.error('[concurrency-manager] getConcurrencySnapshot error:', error);
    return {
      globalConcurrent: 0,
      globalDaily: 0,
      globalHourly: 0,
      blandLimits: limits,
      activeCallCount: 0,
      topCompanies: [],
    };
  }
}

/**
 * Reset stale concurrent counters (safety valve).
 * Reconciles counters with actual active call slots to fix drift
 * from missed releaseCallSlot calls (crashes, timeouts, etc.).
 * Call periodically (e.g., every 5 minutes via cron) or when counters seem stuck.
 */
export async function resetStaleConcurrency(): Promise<void> {
  if (!redis) return;

  try {
    // Count actual active calls from Redis and build per-company breakdown
    const companyCallCounts: Record<string, number> = {};
    let actualActive = 0;
    let cursor = 0;
    let scanIterations = 0;
    const MAX_SCAN_ITERATIONS = 10;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'callengo:active_call:*',
        count: 100,
      });
      cursor = typeof nextCursor === 'number' ? nextCursor : parseInt(nextCursor as string, 10);
      actualActive += keys.length;
      scanIterations++;

      // Read each active call to determine company
      for (const key of keys) {
        try {
          const data = await redis.get<{ companyId: string }>(key);
          if (data?.companyId) {
            companyCallCounts[data.companyId] = (companyCallCounts[data.companyId] || 0) + 1;
          }
        } catch { /* skip individual key errors */ }
      }
    } while (cursor !== 0 && scanIterations < MAX_SCAN_ITERATIONS);

    // Reset global concurrent to actual count
    await redis.set(KEYS.globalConcurrent, actualActive, { ex: 1800 });

    // Reset per-company concurrent counters to actual counts
    const pipeline = redis.pipeline();
    for (const [companyId, count] of Object.entries(companyCallCounts)) {
      pipeline.set(KEYS.companyConcurrent(companyId), count, { ex: 1800 });
    }
    await pipeline.exec();

    // Also clean up company counters that have no active calls but may have stale values
    let companyCursor = 0;
    let compScanIter = 0;
    do {
      const [nextCursor, keys] = await redis.scan(companyCursor, {
        match: 'callengo:concurrent:company:*',
        count: 100,
      });
      companyCursor = typeof nextCursor === 'number' ? nextCursor : parseInt(nextCursor as string, 10);
      compScanIter++;

      for (const key of keys) {
        const companyId = key.replace('callengo:concurrent:company:', '');
        if (!companyCallCounts[companyId]) {
          // No active calls for this company — reset to 0
          await redis.set(key, 0, { ex: 1800 });
        }
      }
    } while (companyCursor !== 0 && compScanIter < MAX_SCAN_ITERATIONS);

    console.log(`[concurrency-manager] Reconciled: global=${actualActive}, companies=${Object.keys(companyCallCounts).length}`);
  } catch (error) {
    console.error('[concurrency-manager] resetStaleConcurrency error:', error);
  }
}

export { REDIS_AVAILABLE, KEYS };
