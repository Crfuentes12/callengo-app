---
tags: [integration, infrastructure, concurrency, caching]
aliases: [Redis, Upstash, Concurrency Manager, Rate Limiter]
---

# Upstash Redis

Upstash provides serverless Redis for [[Callengo]]'s distributed concurrency control, rate limiting, and caching. It is the coordination layer that prevents the platform from exceeding [[Bland AI]] API limits and ensures fair call scheduling across all tenants. The serverless model means there is no persistent connection pool -- each request is an HTTP call to Upstash's REST API, which is compatible with Vercel's edge and serverless runtime.

## Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash REST API endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Authentication token |

If neither variable is set, the concurrency manager falls back to a permissive mode (allows all calls) and logs a warning. The rate limiter falls back to an in-memory LRU cache suitable only for local development.

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/redis/concurrency-manager.ts` | 664 | Call slot tracking, capacity checks, monitoring |
| `src/lib/rate-limit.ts` | 153 | API rate limiting (defined but NOT globally applied) |

## Key Patterns

All Redis keys use the prefix `callengo:` for namespace isolation. Keys are grouped by function:

### Global Concurrency Counters

| Key Pattern | TTL | Description |
|------------|-----|-------------|
| `callengo:concurrent:global` | 1800s (30 min) | Current number of active concurrent calls across all companies |
| `callengo:daily:{YYYY-MM-DD}` | 86400s (24 h) | Total calls dispatched today (date bucket, e.g. `callengo:daily:2026-03-23`) |
| `callengo:hourly:{hourBucket}` | 7200s (2 h) | Total calls dispatched this hour (hourBucket = `Math.floor(Date.now() / 3_600_000)`) |

### Per-Company Counters

| Key Pattern | TTL | Description |
|------------|-----|-------------|
| `callengo:concurrent:company:{companyId}` | 1800s | Active concurrent calls for a specific company |
| `callengo:daily:{YYYY-MM-DD}:{companyId}` | 86400s | Daily call count for a specific company |
| `callengo:hourly:{hourBucket}:{companyId}` | 7200s | Hourly call count for a specific company |

### Call Tracking

| Key Pattern | TTL | Description |
|------------|-----|-------------|
| `callengo:active_call:{callId}` | 1800s (30 min) | Active call slot. Value is JSON: `{ companyId, contactId, ts }`. Auto-expires if webhook never arrives |
| `callengo:contact_cooldown:{contactId}` | 300s (5 min) | Prevents calling the same contact within 5 minutes |

### Cache

| Key Pattern | TTL | Description |
|------------|-----|-------------|
| `callengo:bland_plan_info` | 3600s (1 h) | Cached [[Bland AI]] plan limits (BlandLimits object) |

## Concurrency Manager Functions

### getBlandLimits()

Retrieves the current Bland plan limits from Redis cache. Falls back to `DEFAULT_LIMITS` (Start plan values or env var overrides via `BLAND_DAILY_CAP`, `BLAND_HOURLY_CAP`, `BLAND_CONCURRENT_CAP`).

### cacheBlandLimits(limits)

Stores Bland plan limits in Redis with 1-hour TTL. Called after the [[Command Center]] fetches plan info from Bland's `/v1/me` endpoint.

### checkCallCapacity(companyId, companyConcurrentCap, companyDailyCap, companyHourlyCap, contactId?)

**Pre-flight capacity check.** Reads all relevant counters in a single Redis pipeline (6--7 GET commands) without incrementing any values. Returns a `ConcurrencyCheckResult` with:

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | Whether a new call can be dispatched |
| `reason` | string (optional) | Human-readable denial reason |
| `globalConcurrent` | number | Current global concurrent count |
| `globalConcurrentCap` | number | Effective global cap (90% of Bland limit) |
| `companyConcurrent` | number | Current company concurrent count |
| `companyConcurrentCap` | number | Plan-specific concurrent limit |
| `globalDaily` / `globalDailyCap` | number | Daily counts and caps |
| `globalHourly` / `globalHourlyCap` | number | Hourly counts and caps |
| `companyDaily` / `companyHourly` | number | Per-company daily/hourly counts |

**Checks performed in order:**
1. Contact cooldown (5-minute gap)
2. Global concurrent vs. Bland cap (90% margin)
3. Company concurrent vs. plan cap (value of `-1` means unlimited)
4. Global daily vs. Bland daily cap (90% margin)
5. Global hourly vs. Bland hourly cap (90% margin)
6. Company daily vs. plan daily cap
7. Company hourly vs. plan hourly cap

### acquireCallSlot(companyId, callId, contactId?, limits?)

**Atomic slot reservation.** This is the core function that makes call dispatch safe under concurrency.

**Step 1 -- Contact cooldown:** Uses `SET NX` (set-if-not-exists) with 300-second TTL on the contact cooldown key. This is atomic: if two threads race to call the same contact, only one will succeed.

**Step 2 -- Counter increment:** A single Redis pipeline atomically:
- Increments 6 counters (global concurrent, company concurrent, global daily, global hourly, company daily, company hourly)
- Sets TTLs on all 6 counters (prevents orphaned keys)
- Creates the active call tracker key with 30-minute TTL and JSON payload

**Step 3 -- Post-increment cap check:** If `limits` are provided, the function reads the post-increment values and verifies they don't exceed caps. This makes the check-and-acquire effectively atomic -- increment first, then verify, and roll back if over limit.

**Rollback on over-limit:** Calls `rollbackSlot()` which decrements global and company concurrent counters and deletes the active call key. Daily/hourly counters are NOT decremented because they represent attempt counts, not active calls. Contact cooldown is also released so the contact can be retried.

### releaseCallSlot(companyId, callId)

**Slot release on call completion.** Called when the Bland webhook fires or when a call fails.

1. First checks if the active call key exists (`EXISTS`). If not, the slot was already released (TTL expired or duplicate webhook) and the function returns without decrementing to avoid negative counters.
2. Decrements global and company concurrent counters and deletes the active call key in a single pipeline.
3. If either counter goes negative after decrement (possible if TTL expired before release), clamps it to 0.

### transferCallSlot(companyId, oldCallId, newCallId)

Renames an active call slot from a pre-assigned UUID to the real Bland call ID. This is necessary because the call slot is acquired before `dispatchCall()` returns the Bland-assigned call ID. The function reads the old key's data, writes a new key with the same data and TTL, and deletes the old key -- all in a single pipeline.

### getConcurrencySnapshot()

**Admin monitoring function.** Returns a `ConcurrencySnapshot` for the [[Command Center]] Health tab:

| Field | Type | Description |
|-------|------|-------------|
| `globalConcurrent` | number | Current global concurrent calls |
| `globalDaily` | number | Today's total dispatched calls |
| `globalHourly` | number | This hour's dispatched calls |
| `blandLimits` | BlandLimits | Current cached plan limits |
| `activeCallCount` | number | Number of active call slot keys |
| `topCompanies` | array | Top 10 companies by concurrent calls (companyId, concurrent, daily) |

The function uses `SCAN` to iterate active call keys (max 10 iterations to prevent unbounded loops, with `COUNT 100` per iteration). For each active call, it reads the JSON payload to determine the company and builds a per-company breakdown.

### resetStaleConcurrency()

**Reconciliation function.** Corrects counter drift caused by missed `releaseCallSlot()` calls (process crashes, timeouts, lost webhooks).

1. Scans all `callengo:active_call:*` keys to count actual active calls per company.
2. Resets `callengo:concurrent:global` to the actual active count.
3. Resets each company's concurrent counter to their actual active call count.
4. Resets company concurrent counters with no active calls to 0.

Should be called periodically (e.g., every 5 minutes via cron) or when counters appear stuck.

## Circuit Breaker

The concurrency manager implements a circuit breaker pattern to handle Redis outages:

| Parameter | Value |
|-----------|-------|
| Failure threshold | 5 consecutive failures |
| Reset timeout | 60 seconds |
| First 2 failures | Fail open (allow calls to prevent business disruption) |
| 3--4 failures | Fail open with warnings |
| 5+ failures | Circuit breaker trips, **all calls blocked** |
| After 60 seconds | Circuit breaker auto-resets, retries Redis |

When the circuit breaker is open, `acquireCallSlot()` returns `{ acquired: false, error: 'Redis unavailable - call scheduling paused for safety' }`. This is the safe default: blocking calls prevents exceeding Bland API limits and risking master account suspension.

The `recordRedisSuccess()` and `recordRedisFailure()` functions manage the consecutive failure counter and trip timestamp.

## Rate Limiters

Four pre-configured rate limiters are defined in `src/lib/rate-limit.ts` using the `@upstash/ratelimit` library with sliding window algorithm:

| Limiter | Limit | Window | Intended Use |
|---------|-------|--------|-------------|
| `apiLimiter` | 30 req/min | 60s | General API endpoints |
| `expensiveLimiter` | 5 req/min | 60s | Resource-intensive operations |
| `authLimiter` | 10 req/min | 60s | Authentication endpoints |
| `callLimiter` | 10 req/min | 60s | Call dispatch endpoints |

**Important:** These limiters are defined but **NOT globally applied** to API routes. This is a known security gap documented in the [[CLAUDE.md]] bugs section. Each limiter exports a `check(limit, token)` method that returns `{ success, remaining, limit }`.

When Redis is unavailable, each limiter falls back to an in-memory `LRUCache` (max 500 tokens per limiter) suitable only for development.

### Legacy Exports

Two deprecated functions remain for backward compatibility:
- `checkGlobalHourlyCap()` -- always returns `{ allowed: true }` (real enforcement moved to concurrency manager)
- `getGlobalHourlyUsage()` -- always returns `0`

## Redis Key Lifecycle

All keys use TTL-based expiration to prevent unbounded growth:

```
Call dispatched:
  1. SET callengo:contact_cooldown:{contactId}    TTL=5min
  2. INCR callengo:concurrent:global               TTL=30min
  3. INCR callengo:concurrent:company:{id}          TTL=30min
  4. INCR callengo:daily:{date}                     TTL=24h
  5. INCR callengo:hourly:{bucket}                  TTL=2h
  6. INCR callengo:daily:{date}:{id}                TTL=24h
  7. INCR callengo:hourly:{bucket}:{id}             TTL=2h
  8. SET callengo:active_call:{callId}              TTL=30min

Call completed (webhook):
  1. DECR callengo:concurrent:global
  2. DECR callengo:concurrent:company:{id}
  3. DEL  callengo:active_call:{callId}
```

The 30-minute TTL on active call keys and concurrent counters acts as a safety net: if a call completes but the webhook is lost or the release function crashes, the counters will self-correct within 30 minutes.

## Command Center Integration

The [[Command Center]] Health tab displays real-time Redis data:

- **Global gauges:** Visual gauges showing concurrent, daily, and hourly counts vs. Bland caps
- **Active calls list:** Table of currently active call slots with company attribution
- **Per-company breakdown:** Top 10 companies by concurrent call count
- **Bland plan info:** Current cached plan selection and limits

Data is fetched via `GET /api/admin/command-center` which calls `getConcurrencySnapshot()`.

## Related Notes

- [[Bland AI]] -- the API whose limits Redis enforces
- [[Call Processing Flow]] -- slot acquire/release lifecycle
- [[Campaign Dispatch Flow]] -- pre-flight capacity checks
- [[Command Center]] -- admin monitoring UI
- [[Call]] -- call log records tracked by active call keys
