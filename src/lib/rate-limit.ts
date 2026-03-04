// lib/rate-limit.ts — In-memory rate limiter using LRU cache
import { LRUCache } from 'lru-cache';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  interval: number;
  /** Maximum unique tokens tracked in the window */
  uniqueTokenPerInterval: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval,
    ttl: options.interval,
  });

  return {
    check(limit: number, token: string): RateLimitResult {
      const tokenCount = tokenCache.get(token) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }
      tokenCount[0] += 1;
      const currentUsage = tokenCount[0];
      return {
        success: currentUsage <= limit,
        remaining: Math.max(0, limit - currentUsage),
        limit,
      };
    },
  };
}

// Pre-configured limiters for different endpoint categories
export const apiLimiter = createRateLimiter({
  interval: 60_000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const expensiveLimiter = createRateLimiter({
  interval: 60_000, // 1 minute
  uniqueTokenPerInterval: 200,
});

export const authLimiter = createRateLimiter({
  interval: 60_000, // 1 minute
  uniqueTokenPerInterval: 300,
});
