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

  // Cache Ratelimit instances per limit value to avoid creating new ones on every call
  const limiterCache = new Map<number, Ratelimit>();

  function getLimiter(limit: number): Ratelimit {
    let instance = limiterCache.get(limit);
    if (!instance) {
      instance = new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
        analytics: false,
        prefix: `callengo_rl_${limit}`,
      });
      limiterCache.set(limit, instance);
    }
    return instance;
  }

  // Pre-create the default limiter
  getLimiter(defaultLimit);

  return {
    async check(limit: number, token: string): Promise<RateLimitResult> {
      const effectiveLimit = limit || defaultLimit;
      const limiter = getLimiter(effectiveLimit);
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
// Global Hourly Cap — Now delegated to Redis Concurrency Manager
// These exports remain for backward compatibility.
// The real global tracking is in lib/redis/concurrency-manager.ts
// ============================================================

/**
 * @deprecated Use checkCallCapacity() from lib/redis/concurrency-manager.ts instead.
 * Kept for backward compatibility — always returns allowed: true.
 * Global cap enforcement is now handled by the Redis concurrency manager.
 */
export async function checkGlobalHourlyCap(): Promise<{ allowed: boolean; current: number; cap: number }> {
  return { allowed: true, current: 0, cap: 999 };
}

/**
 * @deprecated Use getConcurrencySnapshot() from lib/redis/concurrency-manager.ts instead.
 */
export async function getGlobalHourlyUsage(): Promise<number> {
  return 0;
}
