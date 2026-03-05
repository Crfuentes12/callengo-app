// lib/rate-limit.ts — In-memory rate limiter using LRU cache
import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';

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

export const webhookLimiter = createRateLimiter({
  interval: 60_000, // 1 minute
  uniqueTokenPerInterval: 1000,
});

/**
 * Apply rate limiting to an API route handler.
 * Returns a 429 NextResponse if the rate limit is exceeded, or null if the request is allowed.
 */
export function applyRateLimit(
  request: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>,
  limit: number,
  identifier?: string
): NextResponse | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? '127.0.0.1';
  const key = identifier || ip;

  const result = limiter.check(limit, key);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null;
}
