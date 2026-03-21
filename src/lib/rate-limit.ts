// lib/rate-limit.ts — Distributed rate limiter using Upstash Redis
//
// Uses @upstash/ratelimit for distributed, serverless-safe rate limiting.
// Falls back to in-memory LRU cache if UPSTASH_REDIS_REST_URL is not configured.
//
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

// ============================================================
// Upstash Redis instance (shared across all limiters)
// ============================================================
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

const useRedis = !!redis;

if (!useRedis && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.warn('[rate-limit] UPSTASH_REDIS_REST_URL not configured — using in-memory fallback (dev only)');
}

// ============================================================
// Unified interface
// ============================================================
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
}

interface Limiter {
  check(limit: number, token: string): RateLimitResult | Promise<RateLimitResult>;
}

// ============================================================
// In-memory fallback (for local dev without Redis)
// ============================================================
function createInMemoryLimiter(defaultLimit: number, intervalMs: number): Limiter {
  const tokenCache = new LRUCache<string, number[]>({
    max: 500,
    ttl: intervalMs,
  });

  return {
    check(limit: number, token: string): RateLimitResult {
      const effectiveLimit = limit || defaultLimit;
      const tokenCount = tokenCache.get(token) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }
      tokenCount[0] += 1;
      const currentUsage = tokenCount[0];
      return {
        success: currentUsage <= effectiveLimit,
        remaining: Math.max(0, effectiveLimit - currentUsage),
        limit: effectiveLimit,
      };
    },
  };
}

// ============================================================
// Upstash Redis limiter
// ============================================================
function createRedisLimiter(defaultLimit: number, windowMs: number): Limiter {
  const windowSec = Math.ceil(windowMs / 1000);
  const limiter = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(defaultLimit, `${windowSec} s`),
    analytics: false,
    prefix: 'callengo_rl',
  });

  return {
    // Returns a Promise<RateLimitResult>. All callers are in async functions
    // so they can await this (or it auto-resolves).
    async check(_limit: number, token: string): Promise<RateLimitResult> {
      const result = await limiter.limit(token);
      return {
        success: result.success,
        remaining: result.remaining,
        limit: result.limit,
      };
    },
  };
}

// ============================================================
// Pre-configured limiters
// Callers: `const result = await limiter.check(limit, token)` or
//          `const result = limiter.check(limit, token)` (auto-awaited in async ctx)
// ============================================================

/** General API limiter: 30 req/min per token */
export const apiLimiter = useRedis
  ? createRedisLimiter(30, 60_000)
  : createInMemoryLimiter(30, 60_000);

/** Expensive operations limiter: 5 req/min per token */
export const expensiveLimiter = useRedis
  ? createRedisLimiter(5, 60_000)
  : createInMemoryLimiter(5, 60_000);

/** Auth operations limiter: 10 req/min per token */
export const authLimiter = useRedis
  ? createRedisLimiter(10, 60_000)
  : createInMemoryLimiter(10, 60_000);

/** Send-call limiter: 10 req/min per user */
export const callLimiter = useRedis
  ? createRedisLimiter(10, 60_000)
  : createInMemoryLimiter(10, 60_000);

// ============================================================
// Global Hourly Cap — Protects Bland Master Account
// ============================================================

const BLAND_GLOBAL_HOURLY_CAP = 900; // Stay under Bland Scale's 1000/hr limit
const GLOBAL_CAP_KEY = 'callengo:global_hourly_calls';

/**
 * Check and increment the global hourly call counter.
 * Returns whether the call is allowed under the global Bland cap.
 */
export async function checkGlobalHourlyCap(): Promise<{ allowed: boolean; current: number; cap: number }> {
  if (!redis) {
    return { allowed: true, current: 0, cap: BLAND_GLOBAL_HOURLY_CAP };
  }

  try {
    const hourBucket = `${GLOBAL_CAP_KEY}:${Math.floor(Date.now() / 3_600_000)}`;
    const current = await redis.incr(hourBucket);

    if (current === 1) {
      await redis.expire(hourBucket, 7200); // 2-hour TTL for safety
    }

    return {
      allowed: current <= BLAND_GLOBAL_HOURLY_CAP,
      current,
      cap: BLAND_GLOBAL_HOURLY_CAP,
    };
  } catch (error) {
    console.error('[rate-limit] Global hourly cap check failed:', error);
    // Fail open — don't block calls if Redis is temporarily down
    return { allowed: true, current: 0, cap: BLAND_GLOBAL_HOURLY_CAP };
  }
}

/**
 * Get the current global hourly usage (read-only, no increment).
 */
export async function getGlobalHourlyUsage(): Promise<number> {
  if (!redis) return 0;
  try {
    const hourBucket = `${GLOBAL_CAP_KEY}:${Math.floor(Date.now() / 3_600_000)}`;
    return (await redis.get<number>(hourBucket)) || 0;
  } catch {
    return 0;
  }
}
