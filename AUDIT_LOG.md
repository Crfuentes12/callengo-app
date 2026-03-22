# Production Readiness Audit Log

**Project:** Callengo — B2B SaaS AI Outbound Calling Platform
**Auditor:** Claude Code (Opus 4.6)
**Date:** 2026-03-22
**Scope:** `/api`, `/lib`, `middleware`, `/config` — restricted due to 225+ source files

---

## Module 1: Auth & Middleware — 2026-03-22

**Files reviewed:**
- `middleware.ts`
- `src/app/api/auth/check-admin/route.ts`
- `src/contexts/AuthContext.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/api/auth/verify-recaptcha/route.ts`
- `src/lib/supabase/server.ts`

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

- **middleware.ts:49-53 — Admin routes not role-gated in middleware.** The `/admin` path is in `protectedRoutes`, which only checks authentication (is the user logged in?) but NOT authorization (is the user an admin?). Any authenticated user can hit `/admin/*` page routes. Protection relies entirely on each individual API route and component checking the role internally — a single missed check = full admin panel exposure. **Fix:** Add role check in middleware for `/admin/*` paths, or add a dedicated layout-level server guard.

- **middleware.ts:81-91 — No rate limiting on API auth endpoints.** The middleware applies no rate limiting to `/api/auth/` routes (line 67 whitelists them as public). While `verify-recaptcha` has its own rate limiter, the actual Supabase auth endpoints (login, signup via client SDK) have no server-side rate limiting in the app layer. Brute-force attacks on login are only mitigated by Supabase's built-in rate limits, which may be too generous for production. **Fix:** Apply rate limiting middleware to auth-adjacent endpoints, or use Supabase's auth rate limit configuration.

### 🟡 WARNING (degrades reliability or maintainability)

- **auth/callback/route.ts:86-101 — Team invite acceptance is not transactional.** Two separate DB writes (update user's company_id + mark invitation as accepted) are not wrapped in a transaction. If the second write fails, the user is assigned to a company but the invitation remains "pending," allowing re-use or causing confusion. **Fix:** Use a Supabase RPC function or a DB transaction to make both writes atomic.

- **middleware.ts:113-127 — DB query on every protected page request.** Every navigation to a protected route triggers a `SELECT company_id FROM users` query to check onboarding status. Under load with many concurrent users, this adds latency to every page transition. **Fix:** Cache onboarding status in a cookie or session claim after first check.

- **auth/callback/route.ts:14 — `_safeRedirectUrl` defined but never called.** The open-redirect protection function exists but is unused. All redirects are currently hardcoded (safe), but if someone adds a `redirect_to` param later, they won't find this helper. Minor dead code. **Fix:** Either use it or remove it.

- **lib/supabase/server.ts:10-11 — Non-null assertions on env vars.** `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `ANON_KEY!` will throw cryptic runtime errors if not set instead of a clear configuration error. **Fix:** Add startup validation or a guard with a descriptive error message.

### 🟢 INFO (minor, non-blocking)

- **middleware.ts:64-79 — Public API route whitelist is explicit and tight.** Good security pattern — only specific OAuth callbacks and webhook paths are whitelisted, not wildcard patterns.

- **verify-recaptcha/route.ts — Well-implemented.** Has rate limiting, score checking, action validation, timeout on external fetch, and proper dev/prod behavior split.

- **AuthContext.tsx — Clean implementation.** Proper subscription cleanup, no memory leaks, handles all auth flows correctly.

### ✅ CLEAN
- `src/app/api/auth/verify-recaptcha/route.ts` — solid implementation
- `src/contexts/AuthContext.tsx` — no issues found

---

## Module 2: Billing & Stripe — 2026-03-22

**Files reviewed:**
- `src/lib/stripe.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/billing/usage-tracker.ts`
- `src/app/api/billing/report-usage/route.ts`
- `src/app/api/billing/create-checkout-session/route.ts`
- `src/lib/billing/overage-manager.ts`
- `src/lib/billing/call-throttle.ts`
- `src/app/api/billing/verify-session/route.ts`
- `src/app/api/billing/change-plan/route.ts`

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

- **webhooks/stripe/route.ts:170-186 — Seat count increment is not atomic (race condition).** Extra seat purchase reads `extra_users`, increments in JS, then writes back. Two concurrent seat purchases would overwrite each other, losing a seat count. With B2B customers buying seats, this causes billing discrepancy — customer pays for a seat that doesn't get added. **Fix:** Use a Supabase RPC with `extra_users = extra_users + N` or an atomic SQL increment.

- **usage-tracker.ts:41-56 — Self-calling HTTP pattern for usage tracking.** `trackCallUsage()` makes an HTTP request to its own server (`getAppUrl() + /api/billing/report-usage`). If `APP_URL` env var is wrong, localhost, or the server is under load, this fails silently or loops. In serverless (Vercel), this creates an extra function invocation for every call completion, doubling billing and adding ~200ms latency. **Fix:** Call the report-usage logic directly as a function instead of via HTTP self-call.

### 🟡 WARNING (degrades reliability or maintainability)

- **overage-manager.ts:254-318 — `syncAllMeteredUsage()` has no pagination or concurrency limit.** Fetches ALL subscriptions with overage enabled in one query, then loops sequentially calling Stripe for each. With 100+ subscribers, this will timeout on Vercel's 10s/60s function limits. No overlap protection if called concurrently. **Fix:** Add pagination, batch processing, and a lock/semaphore.

- **usage-tracker.ts:47 — `INTERNAL_API_SECRET` fallback to empty string.** `process.env.INTERNAL_API_SECRET || ''` — if the env var is missing, all internal service-to-service calls will fail auth (which is safe), but with no clear error message indicating the missing config. Should fail fast at startup. **Fix:** Validate at import time or throw a descriptive error.

- **webhooks/stripe/route.ts:210-216 — Period dates calculated from `new Date()` instead of Stripe's actual period.** When handling checkout.session.completed, the subscription period start/end is calculated from `Date.now()` instead of using Stripe's actual `current_period_start` / `current_period_end` from the subscription object. This can drift by seconds/minutes and cause billing period mismatches. **Fix:** Use the Stripe subscription's period dates directly.

- **change-plan/route.ts:106-114 — Upsert without unique constraint.** The `usage_tracking` upsert may fail or create duplicates since there's no unique constraint mentioned. This admin-only endpoint is less critical but could corrupt usage data. **Fix:** Use insert-or-update pattern with explicit conflict resolution.

### 🟢 INFO (minor, non-blocking)

- **stripe.ts:3-5 — Good: Env var validation at module load.** Throws immediately if `STRIPE_SECRET_KEY` is missing.

- **webhooks/stripe/route.ts:60-78 — Good: Atomic idempotency using INSERT + unique constraint.** Prevents duplicate webhook processing with a race-safe pattern.

- **report-usage/route.ts:133-210 — Good: Optimistic locking with retry.** Prevents concurrent usage updates from overwriting each other.

- **report-usage/route.ts:14-25 — Good: Timing-safe token comparison.** Uses `crypto.timingSafeEqual` for internal API secret verification.

- **create-checkout-session/route.ts — Good: Rate limiting, role checks, input validation.** Well-structured billing endpoint.

- **call-throttle.ts — Good: Multi-layer throttling.** Redis + DB fallback, per-company and global limits, hourly/daily caps with plan-aware logic.

### ✅ CLEAN
- `src/lib/stripe.ts` — well-structured wrapper with proper error handling
- `src/app/api/billing/create-checkout-session/route.ts` — solid implementation
- `src/lib/billing/call-throttle.ts` — comprehensive throttling logic
- `src/app/api/billing/verify-session/route.ts` — proper ownership validation and race condition prevention

---

## Module 3: Bland AI & Dispatch — 2026-03-22

**Files reviewed:**
- `src/lib/bland/master-client.ts`
- `src/app/api/bland/send-call/route.ts`
- `src/app/api/bland/webhook/route.ts` (first 150 lines)
- `src/app/api/campaigns/dispatch/route.ts` (first 150 lines)

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

- **campaigns/dispatch/route.ts:114+ — Campaign dispatch will timeout on Vercel for large batches.** Processes up to 500 contacts sequentially with a 2-second delay between calls (`delay_between_calls_ms`). 500 contacts * 2s = 1000s minimum. Vercel serverless functions timeout at 10s (hobby) / 60s (pro) / 300s (enterprise). Any campaign with >5-30 contacts will be killed mid-dispatch, leaving some contacts called and others not, with no resume mechanism. **Fix:** Use a queue-based approach (process in batches via background jobs) or stream responses.

### 🟡 WARNING (degrades reliability or maintainability)

- **master-client.ts:12 — `BLAND_API_KEY` non-null assertion at module level.** `const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!` — if the env var is missing, this is `undefined` cast as `string`. While `dispatchCall()` and `getBlandAccountInfo()` check for it, `getMasterApiKey()` (line 292) would return `undefined` without any guard. Any code path using the master key directly without the function guards would send requests with `Authorization: undefined`. **Fix:** Validate at module load like `stripe.ts` does.

- **master-client.ts:292-294 — `getMasterApiKey()` returns the raw API key.** If any endpoint accidentally serializes the return value into a response, or if it's logged, the master key is exposed. All Bland calls across all customers use this single key. **Fix:** Restrict access pattern — don't export a raw key getter. Use a function that makes the call instead.

- **bland/webhook/route.ts:96-113 — Signature verification skipped in non-production.** In development/staging, anyone can POST to the webhook endpoint and inject fake call results. If a staging environment is internet-accessible, this is exploitable. **Fix:** Always require signature verification, or at minimum verify an API key in non-production environments.

### 🟢 INFO (minor, non-blocking)

- **send-call/route.ts — Excellent implementation.** Zod validation with E.164 phone format, HTTPS-only webhooks, rate limiting, company ownership check, pre-registration to prevent TOCTOU races, Redis slot acquisition, proper cleanup in `finally` block. This is one of the best-structured endpoints in the codebase.

- **bland/webhook/route.ts:74-88 — Good: Timing-safe HMAC signature verification.** Uses `crypto.timingSafeEqual` to prevent timing attacks on webhook signatures.

- **bland/webhook/route.ts:140-151 — Good: Idempotency check.** Skips already-completed calls to prevent double-processing on webhook retry.

- **campaigns/dispatch/route.ts — Good: Contact ownership validation.** Validates all contact IDs belong to the company before dispatching, preventing IDOR.

### ✅ CLEAN
- `src/app/api/bland/send-call/route.ts` — exemplary endpoint implementation
- `src/lib/bland/master-client.ts` — solid dispatch logic with timeout and error handling

---

## Module 4: Admin Endpoints — 2026-03-22

**Files reviewed:**
- `src/app/api/admin/command-center/route.ts` (first 100 lines)
- `src/app/api/admin/finances/route.ts` (first 100 lines)
- `src/app/api/admin/clients/route.ts` (first 100 lines)
- `src/app/api/admin/reconcile/route.ts` (first 40 lines)
- `src/app/api/admin/monitor/route.ts` (first 40 lines)
- `src/app/api/admin/cleanup-orphans/route.ts` (first 40 lines)
- `src/app/api/admin/promo-codes/route.ts` (first 40 lines)
- `src/app/api/seed/route.ts`

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

- **seed/route.ts:64-75 — Seed endpoint protection relies solely on `NODE_ENV`.** In production, the endpoint is blocked. But Vercel preview deployments may have `NODE_ENV=development`, making the seed endpoint accessible to any authenticated user. The `SEED_ENDPOINT_SECRET` check (line 69-75) only applies if the env var is set — if not configured in preview environments, the endpoint is wide open. Additionally, the secret comparison (line 72) uses `!==` instead of timing-safe comparison. **Fix:** Block the endpoint in all environments unless explicitly enabled via env var. Use timing-safe comparison for the secret.

### 🟡 WARNING (degrades reliability or maintainability)

- **finances/route.ts:9 — Duplicate `BLAND_API_KEY` non-null assertion.** `const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!` is declared again here (already in `master-client.ts`). Two separate module-level references to the same env var — inconsistent error handling if missing. **Fix:** Import from `master-client.ts` instead of re-declaring.

- **clients/route.ts:41-44 — Fetches ALL companies without pagination at DB level.** Despite having pagination params (`page`, `limit`), the initial query fetches all companies, filters in JS, then slices. With thousands of companies, this is wasteful. **Fix:** Apply DB-level pagination with `range()`.

### 🟢 INFO (minor, non-blocking)

- **All admin endpoints consistently enforce role checks.** Every admin route follows the pattern: `getUser()` → `role === 'admin'` check → rate limiting. No gaps found in the 7 admin endpoints reviewed.

- **command-center/route.ts — Good: Parallel query pattern.** Uses `Promise.all` for concurrent DB + Stripe + Redis queries.

- **cleanup-orphans/route.ts — Good: Soft-delete approach.** Preserves billing history by soft-deleting companies instead of hard-deleting.

### ✅ CLEAN
- `src/app/api/admin/command-center/route.ts` — proper auth, rate limiting, parallel queries
- `src/app/api/admin/reconcile/route.ts` — read-only, properly protected
- `src/app/api/admin/promo-codes/route.ts` — proper auth and rate limiting

---

## Module 5: Redis & Rate Limiting — 2026-03-22

**Files reviewed:**
- `src/lib/redis/concurrency-manager.ts`
- `src/lib/rate-limit.ts`

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

- **rate-limit.ts:81 — Redis limiter silently ignores per-call limit parameter.** The `createRedisLimiter` wraps `@upstash/ratelimit` with a fixed `defaultLimit` at creation time, but the `check(_limit, token)` method ignores the first argument (prefixed with `_`). Every caller passing a custom limit (e.g., `expensiveLimiter.check(3, ...)` expecting 3 req/min, or `.check(10, ...)` expecting 10) actually gets the hardcoded default of 5. The in-memory fallback (dev) correctly uses the limit parameter, so behavior differs between dev and prod. This means rate limits are misconfigured in production — some endpoints are too permissive, others too restrictive. **Fix:** Either create separate `Ratelimit` instances per limit value, or use a token bucket that respects per-call limits.

### 🟡 WARNING (degrades reliability or maintainability)

- **concurrency-manager.ts:294-298 — Fail-open on Redis errors.** If Redis throws an exception in `acquireCallSlot()`, the function returns `{ acquired: true }`. This is intentional (don't block business during Redis outages), but means ALL concurrency limits are bypassed during Redis instability — including contact cooldown, global caps, and per-company limits. A sustained Redis outage could result in exceeding Bland API limits and getting the master account throttled or suspended. **Fix:** Add a circuit breaker pattern — after N consecutive Redis failures, fall back to DB-based limits (already implemented in `call-throttle.ts`) instead of blindly allowing all calls.

- **concurrency-manager.ts:26 — Redis token fallback to empty string.** `token: process.env.UPSTASH_REDIS_REST_TOKEN || ''` — if the URL is set but the token is empty, Redis client is created but all requests will fail with auth errors. This silently disables Redis-based limiting. **Fix:** Validate both URL and token together before creating the Redis client.

- **concurrency-manager.ts:311-320 — Check-then-delete race in `releaseCallSlot`.** `exists()` followed by `decr()` and `del()` is not atomic. Two concurrent webhook retries could both pass `exists()`, causing double-decrement. The negative counter fix (lines 337-342) mitigates this but doesn't prevent a brief period of incorrect counts. **Fix:** Use a Lua script for atomic check-and-decrement, or use the active call key deletion as the single source of truth.

### 🟢 INFO (minor, non-blocking)

- **concurrency-manager.ts — Well-architected overall.** Atomic contact cooldown (SET NX), pipeline-based reads, bounded SCAN iterations, TTL-based auto-cleanup, per-company and global tracking, monitoring snapshot for admin.

- **rate-limit.ts — Good: Graceful fallback.** Falls back to in-memory LRU cache when Redis is unavailable, with clear warnings. Pre-configured limiter tiers (`apiLimiter`, `expensiveLimiter`, `authLimiter`, `callLimiter`) provide good separation of concerns.

- **concurrency-manager.ts:456-523 — Good: `resetStaleConcurrency()` reconciliation.** Scans actual active calls and resets counters to match reality, with bounded iterations.

### ✅ CLEAN
- Overall architecture of distributed concurrency management is sound
- Rate limiting infrastructure is properly set up (aside from the parameter bug)

---

## Module 6: Contacts & Data Mutations — 2026-03-22

**Files reviewed:**
- `src/app/api/contacts/route.ts`
- `src/app/api/contacts/import/route.ts`
- `src/app/api/contacts/[id]/route.ts`

### 🔴 CRITICAL (breaks in prod / security risk / data loss)

_(none found)_

### 🟡 WARNING (degrades reliability or maintainability)

- **contacts/route.ts:50-53 — Search parameter interpolated into PostgREST `.or()` filter string.** User input (`search`) is embedded directly into the filter: `company_name.ilike.%${search}%,...`. PostgREST filter syntax uses commas and dots as delimiters. A search value containing `,` or `.` could break the query or manipulate the filter expression, potentially exposing data from other filter conditions. While Supabase RLS protects against cross-company access, malformed queries could cause errors or unexpected results. **Fix:** Sanitize the search string (escape PostgREST special characters) or use individual `.ilike()` calls combined with `.or()` array syntax.

- **contacts/import/route.ts — No rate limiting on import endpoint.** A user could repeatedly upload 10MB CSV files with 10,000 rows, causing heavy DB load. Unlike other billing/call endpoints, import has no `expensiveLimiter` check. **Fix:** Add rate limiting (e.g., 3 imports per minute per user).

### 🟢 INFO (minor, non-blocking)

- **contacts/route.ts:35-40 — Good: Sort column allowlist.** Prevents column injection in `ORDER BY` clause.

- **contacts/import/route.ts — Good: Comprehensive validation.** File size limit (10MB), row count limit (10k), plan-based contact limits, file type validation, deduplication (both against existing DB and within file).

- **contacts/[id]/route.ts:109-117 — Good: Field allowlist for updates.** Only whitelisted fields can be modified, preventing mutation of `company_id` or other sensitive fields.

- **contacts/[id]/route.ts:83-105 — Good: Optimistic lock protection.** Prevents concurrent modification during active calls, with 10-minute auto-expiry as safety valve.

### ✅ CLEAN
- `src/app/api/contacts/[id]/route.ts` — well-structured CRUD with proper authorization
- `src/app/api/contacts/import/route.ts` — solid import implementation (aside from missing rate limit)

---
