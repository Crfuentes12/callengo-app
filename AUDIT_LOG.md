# PRODUCTION READINESS AUDIT LOG

> Callengo App — Deep Codebase Audit
> Started: 2026-03-23

---

## DATABASE SCHEMA AUDIT — 2026-03-23

### Schema Overview
- **56 tables** analyzed
- **100+ foreign keys** with cascading behaviors
- **150+ indexes** defined
- **35+ RLS policies** across multi-tenant tables
- **27+ trigger functions** for automated behaviors

---

### 🔴 CRITICAL

- **[company_settings.bland_api_key, company_settings.openai_api_key — plaintext secrets]** API keys stored as plain `text` columns with no encryption at rest. If any RLS misconfiguration or query leak occurs, all customer API keys are exposed. Same issue affects OAuth tokens in **8 integration tables**: `calendar_integrations`, `hubspot_integrations`, `salesforce_integrations`, `pipedrive_integrations`, `clio_integrations`, `zoho_integrations`, `dynamics_integrations`, `simplybook_integrations`, `google_sheets_integrations`. All store `access_token` and `refresh_token` as plaintext. **Fix:** Encrypt sensitive columns using `pgcrypto` or application-level encryption before storage.

- **[usage_tracking.minutes_used — int4 truncation]** Minutes stored as `int4` (integer), but Bland AI bills per-second with fractional minutes. The `overage_minutes` column is also `int4`. This causes systematic under-counting of usage, directly losing revenue on overage billing. **Fix:** Change to `numeric(10,2)` to track fractional minutes.

- **[calendar_integrations — conflicting UNIQUE constraints]** Table has UNIQUE on `(company_id, provider)` AND a unique index on `(company_id, user_id, provider)`. The narrower constraint means only ONE user per company can connect a given calendar provider. In a Teams plan with 5 users, only one can connect Google Calendar. **Fix:** Drop the `(company_id, provider)` unique constraint, keep only the `(company_id, user_id, provider)` unique index.

- **[Multiple tables missing service_role RLS policies for background processing]** `call_queue`, `follow_up_queue`, `voicemail_logs` (INSERT only, no UPDATE), `calendar_sync_log` (SELECT only) — these tables are written to by background queue processors that likely use service_role. If any code path uses the anon/authenticated client for these operations, writes will silently fail. The `analysis_queue` only has SELECT for users, no INSERT/UPDATE for service_role — relies entirely on `claim_analysis_job` SECURITY DEFINER function. **Fix:** Add explicit service_role policies for tables accessed by background processors.

### 🟡 WARNING

- **[No CHECK constraints on status/enum columns]** Multiple status columns use `text` type without DB-level constraints: `company_subscriptions.status`, `company_subscriptions.billing_cycle`, `agent_runs.status`, `call_queue.status`, `follow_up_queue.status`, `calendar_events.status`, `calendar_events.confirmation_status`. Invalid values can be written by application bugs. **Fix:** Add CHECK constraints for valid enum values.

- **[UUID v4 fragmentation risk on high-write tables]** All 56 tables use random UUIDs (`gen_random_uuid()` / `uuid_generate_v4()`). High-write tables like `call_logs`, `call_queue`, `billing_events`, `notifications` will suffer B-tree index fragmentation at scale. **Fix:** Consider `uuid_generate_v7()` (time-ordered) for high-write tables.

- **[No soft-delete pattern anywhere]** All deletions are hard deletes via CASCADE. Deleting a `company` cascades to ~30 related tables, wiping ALL data with no recovery. No `deleted_at` column on any table. **Fix:** Add soft-delete (`deleted_at`) at minimum on `companies`, `contacts`, `company_subscriptions`.

- **[company_subscriptions — UNIQUE on `company_id`]** Only one subscription per company ever. Plan changes must UPDATE, not INSERT, losing historical subscription data. Race conditions during plan changes could cause constraint violations. **Fix:** Consider removing the unique constraint and using a `status = 'active'` partial unique index instead, allowing historical records.

- **[Duplicate update triggers on contacts and company_settings]** `contacts` has two BEFORE UPDATE triggers (`set_updated_at` calling `handle_updated_at()` and `update_contacts_updated_at` calling `update_updated_at_column()`). Same for `company_settings`. Redundant execution, potential for subtle ordering issues. **Fix:** Remove duplicate triggers.

- **[Cascading delete from companies — high blast radius]** A single DELETE on `companies` cascades to ~30 tables. No confirmation or soft-delete gate. Accidental deletion is catastrophic and unrecoverable. **Fix:** Replace CASCADE with RESTRICT on critical child tables, implement soft-delete.

- **[follow_up_queue, call_queue — contact_id ON DELETE SET NULL]** When a contact is deleted, queue entries lose their contact reference but remain active. Queue processors that assume `contact_id` is present will throw null errors. **Fix:** Either CASCADE delete queue entries or add null guards in queue processing code.

- **[users RLS — SELECT scoped to own row only]** `users_select` policy: `id = auth.uid()`. Team members cannot query other team members via client-side Supabase. All team-listing features must use service_role. This is a design choice but increases coupling to server-side endpoints for basic team display.

- **[Redundant indexes]** ~8 redundant indexes detected where composite indexes already cover single-column lookups (e.g., `contacts_company_id_idx` redundant with `idx_contacts_company_status`; `call_logs_company_id_idx` redundant with compound indexes starting with `company_id`; 3 overlapping indexes on `salesforce_integrations.company_id`). **Fix:** Drop redundant single-column indexes.

- **[admin_audit_log.user_id — no FK constraint]** No foreign key to `users.id`. Orphaned audit records possible. No referential integrity for audit trail. **Fix:** Add FK with ON DELETE SET NULL.

- **[call_logs.call_length — int4]** Call duration as integer loses sub-second precision. Bland AI reports decimal duration. Minor revenue impact on per-second billing. **Fix:** Change to `numeric(10,2)`.

### 🟢 INFO

- Financial columns (`billing_history.amount`, `admin_finances.*`, `usage_tracking.total_cost`, `subscription_plans.price_*`) all use `numeric` type correctly.
- RLS coverage is comprehensive — most multi-tenant tables use consistent `company_id IN (SELECT users.company_id FROM users WHERE users.id = auth.uid())` pattern.
- `stripe_events` properly restricted to service_role only.
- `admin_platform_config` uses singleton unique index on `(true)` — clean pattern.
- `claim_analysis_job` uses SECURITY DEFINER for atomic queue claiming — good.
- Trigger-based `updated_at` management covers all mutable tables.
- `ai_conversations` RLS scoped by `user_id` (not `company_id`) — likely intentional for privacy.
- No plaintext password storage (auth delegated to Supabase Auth).
- No circular CASCADE chains detected.

### ✅ CLEAN

- Primary keys: All 56 tables have defined PKs
- Foreign key referential integrity: All FKs reference valid tables/columns
- Financial column types: NUMERIC used consistently
- Timestamps: `created_at`/`updated_at` present on all mutable entities
- Trigger functions: Comprehensive coverage for `updated_at` management
- FK index coverage: Thorough — most FK columns are indexed
- Multi-tenancy discriminator: `company_id` present on all user-data tables
- RLS write policies: Most tables have INSERT/UPDATE/DELETE policies scoped to company
- No circular CASCADE dependencies

---

## AUTH & MIDDLEWARE — 2026-03-23

### 🔴 CRITICAL

- **[middleware.ts:148 — admin role check only blocks `/admin` prefix, not API admin endpoints]** The middleware checks `pathname.startsWith('/admin')` for role-based access, but admin API routes are under `/api/admin/` which is checked separately (line 83-93) — only for auth presence, NOT for admin role. Each admin API endpoint must self-enforce admin role checks. If any admin API endpoint forgets to check role, it's accessible to any authenticated user. **Fix:** Add admin role check in middleware for `/api/admin/` prefix, or verify every admin endpoint self-checks.

- **[middleware.ts:64-81 — `/api/queue/` is public with no auth]** Queue processing endpoints (`/api/queue/process`, `/api/queue/followups`) are whitelisted as public API routes. The comment says "has its own secret-based auth" but this must be verified in the queue endpoints. If the secret check is missing or bypassable, anyone can trigger queue processing. **Impact:** Unauthorized call dispatch, follow-up processing.

- **[~74 API endpoints have NO rate limiting]** Only 21 of ~95 API endpoints apply rate limiting. Unprotected endpoints include: `GET /api/contacts` (data exfiltration), `GET /api/billing/subscription` (info disclosure), `POST /api/contacts/ai-analyze` (OpenAI cost abuse), `POST /api/contacts/ai-segment` (OpenAI cost abuse), `POST /api/openai/context-suggestions` (OpenAI cost abuse), `POST /api/openai/recommend-agent` (OpenAI cost abuse), all CRM sync endpoints (`/api/integrations/*/sync`), `GET /api/billing/plans`, `POST /api/company/scrape` (web scraping abuse). **Fix:** Apply `apiLimiter` to all authenticated endpoints at minimum; apply `expensiveLimiter` to all endpoints that call external APIs (OpenAI, Bland, CRM APIs).

### 🟡 WARNING

- **[middleware.ts:116-122 — `x-user-meta` cookie for role caching is client-deletable]** The middleware caches `company_id` and `role` in an httpOnly cookie (`x-user-meta`) for 5 minutes. While httpOnly prevents JS access, the cookie can be deleted by the client (browser clears cookies). The fallback re-fetches from DB, so this is not a security bypass — but if the cookie is **tampered with** (replaced with a forged JSON), the `JSON.parse` at line 121 would succeed and the forged role could bypass admin checks for up to 5 minutes. **However:** httpOnly + secure + sameSite:lax means the cookie cannot be set by client JS — only cleared. Setting requires a same-site server response. Risk is LOW but the pattern is fragile. **Fix:** Sign the cookie value with HMAC or just always query the DB for admin routes.

- **[auth/callback/route.ts:167-175 — metadata-based invite acceptance lacks optimistic lock]** The first invite flow (lines 88-96) uses an optimistic lock (`eq('status', 'pending')` in the update). But the metadata-based flow (lines 167-175) does NOT use an optimistic lock — it updates the user first, then marks the invitation as accepted. A race condition could cause double-acceptance. **Fix:** Add optimistic lock pattern to the metadata flow.

- **[auth/callback/route.ts:14 — `_safeRedirectUrl` is defined but never used]** The function is prefixed with `_` suggesting it was intentionally disabled. The callback hardcodes redirect destinations (`/home`, `/onboarding`, `/admin/command-center`). Not a security issue currently but the unused function suggests an incomplete open-redirect fix.

- **[supabase/service.ts — `supabaseAdminRaw` untyped client]** An untyped admin client is exported alongside the typed one. This bypasses TypeScript's type safety for DB operations. Any code using `supabaseAdminRaw` can write arbitrary data without compile-time validation. **Fix:** Add missing types to `Database` type and remove `supabaseAdminRaw`.

- **[AuthContext.tsx:38 — `getSession()` used instead of `getUser()` for initial load]** Supabase docs recommend `getUser()` for security-critical checks as `getSession()` reads from local storage and doesn't verify with the server. The middleware correctly uses `getUser()`, but the client-side AuthContext uses `getSession()` for initial load. Not exploitable since middleware enforces auth server-side, but could show stale auth state to the UI.

### 🟢 INFO

- Middleware correctly uses `supabase.auth.getUser()` for server-side auth verification.
- Email verification enforced before accessing protected routes.
- OAuth callback validates invite tokens, checks email match, and handles expiration.
- reCAPTCHA verification applied to signup with proper score threshold.
- The `verify-recaptcha` endpoint correctly blocks in production if RECAPTCHA_SECRET_KEY is not configured.
- Rate limiting infrastructure is well-designed (Redis with in-memory fallback).
- Public API route whitelist is specific (individual OAuth callbacks, not wildcards).

### ✅ CLEAN

- `src/lib/supabase/client.ts` — clean browser client, uses anon key only
- `src/lib/supabase/server.ts` — clean server client, uses anon key + cookies
- `src/app/api/auth/check-admin/route.ts` — proper auth + role check
- `src/app/api/auth/verify-recaptcha/route.ts` — rate limited, proper validation
- `src/contexts/AuthContext.tsx` — correct auth state management, proper cleanup


## BILLING & STRIPE — 2026-03-23

### 🔴 CRITICAL

- **[usage-tracker.ts:97 — non-atomic usage increment]** The "optimistic locking" pattern uses `eq('updated_at', freshUsage.updated_at)` to detect concurrent updates, but `updated_at` has a BEFORE UPDATE trigger that sets it to `now()`. This means the optimistic lock compares against the OLD `updated_at` but the trigger changes it BEFORE the row is written, so the lock check may always succeed even with concurrent writes. The trigger fires before the update is applied, so the `eq` filter compares against the pre-trigger value — but two concurrent updates could both read the same `updated_at`, both pass the filter (since the trigger hasn't fired yet for either), and both succeed, causing a lost update. **Fix:** Use a version counter column instead of `updated_at` for optimistic locking, or use a Postgres advisory lock / `SELECT ... FOR UPDATE`.

- **[webhooks/stripe/route.ts:121-127 — webhook returns 500 on handler error]** If any handler function throws, the webhook returns HTTP 500. Stripe will retry 500 responses up to ~16 times over 3 days. For non-idempotent operations (e.g., seat increment, addon creation), retries could cause duplicate records. While the `stripe_events` idempotency check (line 62) prevents duplicate processing of the same event, if the handler partially succeeds then throws, the event is NOT marked as processed (line 115 is after the switch), so Stripe will retry. The retry will skip due to idempotency, but the partial state remains. **Fix:** Mark event as processed BEFORE handling (optimistic), then handle. Or wrap each handler in its own try-catch that doesn't propagate to the 500 response.

- **[verify-session/route.ts:129-142 — uses anon client to update subscription]** The `verify-session` endpoint updates `company_subscriptions` using the authenticated user's Supabase client (anon key). But the RLS policy on `company_subscriptions` only allows SELECT and UPDATE — no INSERT. The UPDATE succeeds due to RLS, but line 87 queries `subscription_plans` which requires `is_active = true` in the RLS SELECT policy. If a plan is deactivated, this query returns null and the endpoint returns 404 even though the plan exists. **Impact:** Plan deactivation breaks session verification for that plan.

### 🟡 WARNING

- **[usage-tracker.ts:97 — integer arithmetic on minutes]** `freshUsage.minutes_used + minutes` performs integer addition (DB column is int4). If `minutes` is a float (e.g., 1.7 minutes from Bland), it gets truncated. Combined with the DB schema issue (int4 instead of numeric), this systematically under-reports usage. **Fix:** Use `Math.ceil(minutes)` or change the column to numeric.

- **[call-throttle.ts:161-172 — DB fallback after Redis check]** The throttle does a Redis capacity check first, then does ANOTHER DB-based concurrent/daily/hourly check. This is defense-in-depth but means every call dispatch hits the DB 3-4 extra times even when Redis is healthy. At scale, this creates unnecessary load. **Fix:** Only fall back to DB checks when Redis is unavailable.

- **[overage-manager.ts:82-91 — subscription item modification not atomic]** The `enableOverage` function reads subscription items, adds a metered item, and updates the DB. If two requests call `enableOverage` simultaneously, both could add metered items to the Stripe subscription, creating duplicate line items. **Fix:** Add a mutex or check for existing metered items before adding.

- **[webhooks/stripe/route.ts:230-232 — creates new Stripe instance instead of using wrapper]** Line 230-232 imports Stripe and creates a new instance instead of using the already-imported `stripe` from `@/lib/stripe`. This creates an unnecessary second SDK instance.

- **[call-throttle.ts:204 — dead code]** Line 204: `...(blandLimits ? {} : {})` — this spread has no effect regardless of the condition. The `blandLimits` variable from line 175 is fetched but never used in the return value.

- **[usage-tracker.ts:264-274 — `supabaseAdminRaw` for company_addons]** Uses untyped raw client for `company_addons` queries. This is repeated in 3 places across the billing module. Type safety is lost.

### 🟢 INFO

- Stripe webhook signature verification is properly implemented.
- Idempotency check for Stripe events uses atomic INSERT with unique constraint — good pattern.
- `billing_cycle` is sanitized to 'monthly' or 'annual' in verify-session.
- Overage budget enforcement is correct — checks cost against budget before allowing calls.
- Free plan hard-blocks at minute limit with no overage — correct.
- Usage tracking has duplicate-period prevention in `resetUsageForNewPeriod`.
- Metered usage sync is paginated (PAGE_SIZE=50) to avoid timeouts.

### ✅ CLEAN

- `src/lib/stripe.ts` — clean Stripe wrapper with proper error handling
- `src/lib/billing/call-throttle.ts` — comprehensive pre-dispatch checks with Redis + DB fallback
- Webhook idempotency pattern is robust (atomic INSERT on `stripe_events`)
- Subscription expiration check is consistent across usage-tracker and call-throttle


## BLAND AI & REDIS CONCURRENCY — 2026-03-23

### 🔴 CRITICAL

- **[concurrency-manager.ts:304-317 — check + acquire is not atomic]** `checkCallCapacity()` reads all counters, then `acquireCallSlot()` increments them in a separate pipeline. Between check and acquire, another request could pass the check and both acquire slots, exceeding the concurrent limit. The check and acquire should be a single atomic operation (Lua script or `WATCH`/`MULTI`). **Impact:** Under load, concurrent call limits can be exceeded, burning through Bland API limits and budget. **Fix:** Combine check + acquire into a single Redis transaction or Lua script.

- **[concurrency-manager.ts:340 — fail-open on Redis errors]** When `acquireCallSlot` catches a Redis error and the circuit breaker is NOT tripped (first few failures), it returns `{ acquired: true }` — allowing the call without any concurrency tracking. This means during Redis flakiness, all limits are bypassed until 5 consecutive failures trip the circuit breaker. **Impact:** Transient Redis issues could cause burst of untracked calls exceeding Bland API limits. **Fix:** Consider fail-closed by default, with a very short grace window.

### 🟡 WARNING

- **[master-client.ts:12 — `BLAND_MASTER_KEY` accessed at module load with `!` assertion]** If `BLAND_API_KEY` is not set, the value is `undefined` (not an error), but the `!` assertion tells TypeScript it's defined. The `dispatchCall` function checks for it, but `getCallDetails` at line 274 silently returns null. Module-level code has no runtime error for a missing key. **Fix:** Add startup validation or throw on first use.

- **[master-client.ts:292-294 — `getMasterApiKey()` exports the raw API key]** A function that returns the master Bland API key is exported. If any API route accidentally includes this in a response, the key is leaked. **Fix:** Remove this export or restrict to admin-only server code.

- **[bland/webhook/route.ts:96-112 — signature verification skipped in non-production]** Without `BLAND_WEBHOOK_SECRET`, the webhook accepts any payload in dev/staging. If staging is internet-accessible, anyone can send fake webhooks. **Fix:** Always require webhook secret, even in staging.

- **[concurrency-manager.ts:321-327 — TTLs set after increment]** Counters are incremented in one pipeline, then TTLs are set in a second pipeline. If the process crashes between the two pipelines, counters exist without TTLs and never expire. This could cause permanent counter drift. **Fix:** Set TTLs in the same pipeline as the increments, or use `INCR` + `EXPIRE` atomically via Lua.

- **[concurrency-manager.ts:356-363 — TOCTOU in releaseCallSlot]** `exists()` check for the call key, then `decr()` in a separate pipeline. Between the two, the key could expire (TTL), causing the `exists` to return true but the `decr` to go below zero. The negative-counter fix at lines 380-385 mitigates this but adds extra Redis calls. **Fix:** Use Lua script: `if redis.call('exists', key) == 1 then redis.call('decr', counter) redis.call('del', key) end`.

- **[concurrency-manager.ts:452 — N+1 Redis calls in monitoring]** The `getConcurrencySnapshot` function scans active calls, then makes individual `GET` calls for each key's data (line 452), then another loop for daily counts (line 464-466). This can make 100+ Redis calls for monitoring. **Fix:** Use pipeline for batch reads.

### 🟢 INFO

- Circuit breaker pattern is well-implemented with auto-reset.
- Contact cooldown (5-min gap) uses `SET NX` for atomic check-and-set — good.
- Active call TTL (30 min) provides automatic cleanup for orphaned call slots.
- `resetStaleConcurrency` function reconciles counters against actual active calls — good safety valve.
- Bland API call dispatch has 15-second timeout — prevents hanging dispatch loops.
- Webhook signature verification uses timing-safe comparison — good.

### ✅ CLEAN

- `src/lib/bland/master-client.ts` — clean API wrapper with timeout and error handling
- Webhook idempotency check (existingLog.completed) prevents double-processing
- Redis key naming is well-organized with clear prefixes and TTLs
- 90% safety margin on Bland limits is conservative and appropriate

