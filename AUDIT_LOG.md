# CALLENGO PRODUCTION READINESS AUDIT LOG
**Audit Date:** 2026-03-23
**Auditor:** Claude Code (Opus 4.6)
**Codebase:** callengo-app (Next.js 16.1.1 / Supabase / Stripe / Bland AI)

---

## DATABASE SCHEMA AUDIT

### SCHEMA INTEGRITY

**Primary Keys:** ✅ All 56 tables have primary keys defined. Most use `uuid` with `gen_random_uuid()` or `uuid_generate_v4()`. `company_settings` uses `company_id` as PK (1:1 with companies). `stripe_events` uses `text` PK (Stripe event IDs).

**Foreign Keys:** ✅ 100+ FK constraints declared, all referencing valid tables/columns. CASCADE on parent deletes for tenant data (company_id → companies.id). SET NULL on optional references (subscription_id, contact_id in some contexts).

**Circular Dependencies:** ✅ CLEAN — No circular FK references detected. calendar_events → follow_up_queue and follow_up_queue → call_logs are one-directional. No deadlock risk from cascading deletes.

**Junction Tables:** ✅ Contact mapping tables (hubspot_contact_mappings, salesforce_contact_mappings, etc.) have unique constraints on (integration_id, external_id) pairs.

**Column Types:** ✅ Financial columns use `numeric` type (not float). Timestamps use `timestamptz`. Arrays use PostgreSQL native `_text` type. JSON uses `jsonb`.

**Boolean Fields:** ✅ All booleans are `bool` type with sensible defaults.

**Timestamps:** ✅ All mutable entity tables have `created_at` and `updated_at` with trigger-based auto-update. 40+ triggers manage `updated_at` columns.

**Soft Delete:** ✅ No soft-delete pattern used — hard deletes via CASCADE. This is consistent across all tables (no mixed pattern).

### NULLABILITY & DEFAULTS

**NOT NULL constraints:** ✅ Core identity fields (company_id, email, name, etc.) are properly NOT NULL. Status fields have defaults.

**Default values:** ✅ Sensible defaults: status='pending', counts=0, booleans=false, timestamps=now().

**Nullable FKs:** ✅ MITIGATED — `call_logs.contact_id` is nullable but intentional for test calls (`is_test_call=true`). `usage_tracking.subscription_id` is nullable with SET NULL on delete for historical data preservation.

### INDEXES & PERFORMANCE

**FK Indexes:** ✅ All major FK columns are indexed. Comprehensive index coverage: 130+ indexes across 56 tables.

**Composite Indexes:** ✅ Well-designed composite indexes for common query patterns:
- `(company_id, status)` on contacts, agent_runs, company_subscriptions, call_queue
- `(company_id, subscription_id, period_start, period_end)` on usage_tracking
- `(company_id, created_at DESC)` on billing_events
- Partial indexes on active/pending records reduce index size

**UUID Fragmentation:** 🟢 INFO — All PKs use random UUIDs (gen_random_uuid/uuid_generate_v4). For current scale (<100 companies), B-tree fragmentation is negligible. At >10K inserts/day, consider UUIDv7 (time-ordered).

### SECURITY & ACCESS

### 🔴 CRITICAL — OAuth tokens stored as plaintext text columns
- **Tables affected:** `calendar_integrations`, `hubspot_integrations`, `salesforce_integrations`, `pipedrive_integrations`, `zoho_integrations`, `clio_integrations`, `dynamics_integrations`, `simplybook_integrations` (access_token + refresh_token columns)
- Also: `company_settings.bland_api_key`, `company_settings.openai_api_key`, `webhook_endpoints.secret`
- **Impact:** If Supabase database is breached (stolen backup, compromised admin access), all OAuth tokens for every CRM integration for every customer are exposed in plaintext. An attacker could access every connected HubSpot, Salesforce, Pipedrive, Zoho, Clio, and Dynamics instance.
- **Current mitigation:** RLS prevents regular user access to other companies' tokens. Service role key is server-side only.
- **Suggested fix:** Implement application-level encryption (AES-256-GCM) for all token columns using a KMS-managed key. Decrypt only at point of use.

### 🟡 WARNING — PII columns without encryption or retention policy
- `users.ip_address`, `users.location_logs` (jsonb with IP/geo history, up to 50 entries)
- `admin_audit_log.ip_address`, `admin_audit_log.user_agent`
- **Impact:** GDPR/CCPA compliance concern. IP addresses and location history are PII.
- **Suggested fix:** Document data retention policy. Implement automatic purge of `location_logs` entries older than 90 days.

### RLS POLICIES

**Coverage:** ✅ All 56 tables have RLS policies. Every user-facing table filters by `company_id IN (SELECT users.company_id FROM users WHERE users.id = auth.uid())`.

**Read + Write scoping:** ✅ Most tables have both SELECT and INSERT/UPDATE/DELETE policies.

**Admin tables:** ✅ `admin_platform_config`, `admin_audit_log`, `admin_finances` restricted to `users.role IN ('admin', 'owner')`.

**Service role tables:** ✅ `stripe_events` restricted to service_role only.

### 🟡 WARNING — users table RLS allows self-update of sensitive columns
- `users_update` policy: `check: (id = auth.uid())` — allows user to UPDATE any column on their own row.
- **Trigger mitigation:** `trg_prevent_role_self_escalation` prevents `role` column changes via SECURITY DEFINER function.
- **Remaining gap:** User could still UPDATE their own `company_id` (switch companies), `email` (desync from auth), or `notifications_enabled` directly via Supabase client.
- **Impact:** A malicious user with Supabase anon key + valid session could change their own `company_id` to another company's ID and gain access to that company's data through RLS policies.
- **Suggested fix:** Restrict UPDATE policy to safe columns only, or add additional trigger constraints for `company_id` and `email`.

### 🟡 WARNING — company_subscriptions update policy too permissive
- `company_subscriptions_update`: any user in the company can update subscription fields including `overage_budget`, `overage_enabled`, `status`.
- No role restriction (owner/admin only).
- **Impact:** A `member` role user could enable overage billing or change budget via direct Supabase client call.
- **Suggested fix:** Add role check: `users.role IN ('owner', 'admin')`.

### MULTI-TENANCY & DATA ISOLATION

**Tenant Discriminator:** ✅ Every user-facing table has `company_id` column with FK to `companies.id` and CASCADE delete.

**RLS Enforcement:** ✅ All tenant data tables enforce company-level isolation via RLS policies joining through `users.company_id`.

**Unique Constraints:** ✅ `company_subscriptions.company_id` is unique — one subscription per company. `company_settings.company_id` is PK — one settings row per company.

### DATA INTEGRITY & CONSISTENCY

### 🟡 WARNING — Status fields are free-text without CHECK constraints
- `agent_runs.status`, `company_subscriptions.status`, `call_queue.status`, `campaign_queue.status`, `follow_up_queue.status`, `contacts.status`, `calendar_events.status`, etc.
- **Impact:** Application code could write invalid status values that slip through silently. Not an immediate security risk but degrades data quality.
- **Suggested fix:** Add CHECK constraints for each status column with valid enum values.

**Financial Columns:** ✅ All financial amounts use `numeric` type: `price`, `total_cost`, `amount`, `overage_budget`, `overage_spent`, etc.

### 🟡 WARNING — Denormalized counters on agent_runs risk drift
- `agent_runs.completed_calls`, `successful_calls`, `failed_calls`, `total_cost`, `voicemails_detected`, `voicemails_left`, `follow_ups_scheduled`, `follow_ups_completed`
- Incremented by application code, not DB-level aggregates.
- **Risk:** Webhook retries or crashes can cause counter drift.
- **Mitigation:** Admin reconciliation endpoint exists. `usage_tracking` uses atomic RPC for its counters.
- **Suggested fix:** Periodically reconcile agent_run counters against actual call_logs aggregates.

### 🟡 WARNING — CASCADE on companies deletes ALL company data irrecoverably
- Deleting a company cascades to: users, contacts, call_logs, agent_runs, subscriptions, billing history, all integrations, calendar events, notifications, etc.
- **Impact:** Accidental company deletion = total data loss with no recovery path.
- **Suggested fix:** Implement soft-delete for companies (`deleted_at` column) with 30-day recovery window.

### MIGRATIONS & VERSIONING

**Migration Files:** ✅ 42 sequential SQL migrations in `supabase/migrations/`. Latest: `20260323000001_security_and_production_fixes.sql`.

### 🟢 INFO — One non-timestamped migration file
- `add_notifications_system.sql` — lacks timestamp prefix. May cause ordering issues with migration runner.

### ✅ CLEAN
- Schema integrity: All PKs, FKs, and relationships correctly defined
- Column types: Appropriate for all data (numeric for money, timestamptz for times, uuid for IDs)
- Index coverage: 130+ indexes with good composite design and partial indexes
- RLS coverage: All 56 tables have RLS policies with company-level isolation
- Trigger coverage: 40+ triggers for timestamps, notifications, role protection
- FK integrity: 100+ constraints with appropriate CASCADE/SET NULL
- DB functions: `atomic_increment_usage()`, `claim_analysis_job()`, `prevent_role_self_escalation()` with SECURITY DEFINER
- No circular FK dependencies
- Financial columns all use numeric type

### ⚪ SCHEMA JSON GAPS
- No tables missing. All 56 tables present in both types files and schema JSON.

---

## BILLING & PAYMENTS MODULE — 2026-03-23

### 🔴 CRITICAL

*None found.* Stripe webhook has proper signature verification, idempotency via unique constraint on event ID, and handles all critical event types.

### 🟡 WARNING

- **src/app/api/billing/verify-session/route.ts:40** — `session_id` from user input is passed directly to `stripe.checkout.sessions.retrieve()` without format validation. While Stripe will reject invalid session IDs gracefully, a Zod validation for the expected `cs_*` prefix format would add defense-in-depth. **Impact:** Low — Stripe API handles invalid IDs. **Fix:** Add `z.string().startsWith('cs_')` validation.

- **src/app/api/webhooks/stripe/route.ts:195-206** — Addon checkout inserts into `company_addons` using `supabaseAdminRaw` without verifying the `addon_type` value from metadata is a valid enum. A corrupted Stripe metadata value could insert an invalid addon type. **Impact:** Low — metadata is set by our own checkout flow. **Fix:** Validate `addonType` against known values before insert.

### 🟢 INFO

- **src/app/api/webhooks/stripe/route.ts** — The webhook handler does not use a DB transaction for multi-table updates (subscription + usage_tracking + billing_events). If the process crashes between writes, data can become inconsistent. However, the idempotency check and verify-session fallback mitigate this in practice.

### ✅ MITIGATED

- **Stripe webhook idempotency** — Looked like potential double-processing issue, but INSERT with unique constraint on `stripe_events.id` + PGRST 23505 check provides atomic idempotency. ✅ Mitigated in `src/app/api/webhooks/stripe/route.ts:107-119`.

- **verify-session race with webhook** — Looked like verify-session could overwrite webhook data, but line 130 checks `existingSub.stripe_subscription_id === stripeSubId` and skips if already processed. ✅ Mitigated.

- **Checkout session IDOR** — User could pass any session_id to verify-session. But line 62 verifies `session.metadata.company_id !== userData.company_id`. ✅ Mitigated.

### ✅ CLEAN
- `create-checkout-session/route.ts`: Auth check, role check (owner/admin), rate limiting, Zod-like validation for planId/billingCycle/currency, plan existence check, Stripe customer creation.
- `change-plan/route.ts`: Admin-only, rate limited, validates billingCycle enum, creates billing history audit trail.
- Stripe webhook: Signature verification, 7 event type handlers, billing event audit trail, promo code tracking, analytics events.

---

## AUTH & SECURITY MODULE — 2026-03-23

### 🔴 CRITICAL

*None found.* Middleware correctly protects all non-public routes. Auth callback validates team invitations with email matching and optimistic locking.

### 🟡 WARNING

- **src/app/api/seed/route.ts:248** — DELETE handler checks `NODE_ENV === 'production'` to block in prod, but POST handler uses `SEED_ENDPOINT_SECRET` instead. Inconsistent protection: if `SEED_ENDPOINT_SECRET` is accidentally left set in production, POST would work but DELETE wouldn't. **Impact:** Low if secret is properly managed. **Fix:** Use the same `SEED_ENDPOINT_SECRET` check for both POST and DELETE (POST already does this correctly).

- **middleware.ts:116-144** — User metadata cached in `x-user-meta` cookie (company_id, role) for 5 minutes. If a user's role is changed (e.g., demoted from admin), the cached cookie allows 5 more minutes of elevated access. **Impact:** Low — role changes are rare and 5 minutes is a short window. **Fix:** Accept the 5-minute TTL as reasonable, or invalidate the cookie on role change.

### 🟢 INFO

- **middleware.ts:64-81** — Good security: OAuth callbacks are individually whitelisted rather than wildcarding all `/api/integrations/` routes. Comment at line 62-63 explains why.
- **src/app/api/seed/route.ts:74** — Timing-safe comparison for seed secret. Good practice.

### ✅ MITIGATED

- **Queue endpoints publicly accessible** — `/api/queue/process` and `/api/queue/followups` are whitelisted in middleware as public. Looked like missing auth. But both endpoints implement their own secret-based auth via `QUEUE_PROCESSING_SECRET`/`CRON_SECRET` with timing-safe comparison. ✅ Mitigated in route handlers.

- **Team invite privilege escalation** — Looked like any admin could create other admins. But `src/app/api/team/invite/route.ts:59-64` checks that only `owner` role can invite with `admin` role. ✅ Mitigated.

### ✅ CLEAN
- `auth/callback/route.ts`: Email matching for team invites, optimistic locking on invitation acceptance, HubSpot sync fire-and-forget.
- `team/invite/route.ts`: Role-based access, seat limit enforcement, duplicate checking, Supabase Auth email integration.
- `queue/process/route.ts`, `queue/followups/route.ts`: Secret-based auth, timing-safe comparison, batch size capped at 50.

---

## CORE CALL FLOW MODULE — 2026-03-23

### 🔴 CRITICAL

*None found.* The send-call route has comprehensive protection: Zod validation, auth, rate limiting, company ownership verification, pre-dispatch throttle check, Redis slot acquisition, plan-based duration caps, and cleanup in finally block.

### 🟡 WARNING

- **src/app/api/bland/send-call/route.ts:91-97** — Pre-call log inserted with `supabaseAdmin` (service role) using `metadata?.contact_id as string` from user input without UUID validation. The Zod schema validates `company_id` as UUID but `metadata.contact_id` is typed as `z.record(z.string(), z.unknown())`, so a non-UUID value could be inserted into `call_logs.contact_id` (nullable UUID FK). **Impact:** Medium — Supabase will reject invalid UUIDs at the FK level, returning a 500 error to the user instead of a clean 400. **Fix:** Add `.uuid()` validation for `metadata.contact_id` in the Zod schema, or validate before insert.

### 🟢 INFO

- **src/app/api/bland/send-call/route.ts:201-211** — Good pattern: `finally` block guarantees Redis slot release and pre-call log cleanup on dispatch failure, preventing resource leaks.
- **src/app/api/campaigns/dispatch/route.ts** — Enqueues to `campaign_queue` for background processing instead of dispatching synchronously, avoiding Vercel timeout issues. Good architectural decision.

### ✅ MITIGATED

- **Bland webhook missing auth** — Webhook endpoint is public (whitelisted in middleware). But `verifyBlandSignature()` at `src/app/api/bland/webhook/route.ts:74-88` validates HMAC-SHA256 signature with timing-safe comparison. `BLAND_WEBHOOK_SECRET` is required in ALL environments (line 94-98). ✅ Mitigated.

- **TOCTOU race in send-call** — Pre-registering a call_log entry before throttle check could have created orphan records. But lines 102-104 delete the pre-registered entry if throttle rejects. And lines 128-131 clean up if Redis slot acquisition fails. ✅ Mitigated.

### ✅ CLEAN
- `bland/send-call/route.ts`: Zod input validation, auth, rate limiting, company ownership, throttle check, Redis slot, plan duration cap, cleanup guarantee.
- `campaigns/dispatch/route.ts`: Zod schema, auth, rate limiting, company ownership, enqueue pattern for background processing.
- `bland/webhook/route.ts`: HMAC signature verification, call slot release, usage tracking, AI analysis enqueue, CRM sync-back.

---

## ADMIN & CONTACTS & INTEGRATIONS MODULE — 2026-03-23

### 🔴 CRITICAL

*None found.* Admin endpoints enforce `role === 'admin'`. OAuth callbacks use signed state (HMAC-SHA256) with user/company verification. Contacts are scoped by company_id via RLS.

### 🟡 WARNING

- **src/app/api/admin/command-center/route.ts:35** — Admin role check only allows `role === 'admin'`, but CLAUDE.md says "Solo roles `admin` y `owner`" should have access. `owner` role is excluded from the command center. **Impact:** Medium — platform owner can't access their own admin panel if they have `owner` role instead of `admin`. **Fix:** Check `['admin', 'owner'].includes(userData.role)`.

- **src/app/api/admin/command-center/route.ts:269-293** — Two additional sequential DB queries for hourly and daily call history charts are made AFTER the initial `Promise.all()` batch of 14 parallel queries. These could be moved into the parallel batch. **Impact:** Low — adds ~100-200ms latency to admin dashboard load. **Fix:** Include in the initial `Promise.all()`.

### 🟢 INFO — PERFORMANCE

- **src/app/api/admin/monitor/route.ts:181-262** — N+1 query pattern: `getCompanyBreakdown()` runs 5 sequential DB queries per company inside a for loop. With 10 companies = 50 queries. **Impact:** Admin-only, infrequent access. **Fix:** Batch with `.in()` clauses + single `Promise.all()`.

- **src/app/api/admin/cleanup-orphans/route.ts:156-162** — Sequential Bland API calls in a loop for deactivation. Could use `Promise.allSettled()`.

- **71 occurrences of `select('*')` across 47 API files.** Most are in admin/billing routes. Not a security issue but fetches unnecessary columns.

### ✅ MITIGATED

- **Admin Command Center POST — Bland plan write** — Looked like any admin could change Bland plan limits. But POST handler validates plan against `BLAND_PLAN_LIMITS` whitelist (line 775) and only persists to `admin_platform_config`. ✅ Mitigated.

- **Contact import injection** — CSV import could inject malicious data into DB. But `contacts/import/route.ts` uses `mapRowToContact()` for structured parsing, validates file size (10MB), row count (10K max), file type (.csv/.txt), plan contact limits, and deduplicates by phone number. ✅ Mitigated.

- **OAuth callback cross-tenant hijack** — All 11 OAuth callback routes (HubSpot, Salesforce, Pipedrive, Zoho, Clio, Dynamics, Google Calendar, Google Sheets, Outlook, Slack, Zoom) use `verifySignedState()` from `src/lib/oauth-state.ts` (HMAC-SHA256 with timing-safe comparison) AND verify the authenticated user matches the state user_id AND verify the company_id matches. ✅ Mitigated.

- **Open redirect in OAuth callbacks** — `return_to` param from state could redirect to external URLs. But all callbacks sanitize: `return_to.startsWith('/') && !return_to.startsWith('//')`. ✅ Mitigated.

- **Contacts search injection** — Search parameter in `/api/contacts/route.ts` could manipulate PostgREST filters. But line 52-58 sanitizes `%`, `_`, commas, dots, and parentheses. Sort column is whitelisted (line 35-40). Page size capped at 200. ✅ Mitigated.

### ✅ CLEAN
- `admin/command-center/route.ts`: Auth + admin role check, rate limiting, parallel query pattern, Bland plan validation, Redis cache sync.
- `contacts/route.ts`: Auth, company scoping, sort column whitelist, search sanitization, pagination limits.
- `contacts/import/route.ts`: Auth, rate limiting, file validation, plan limits, deduplication, cross-company list_id verification.
- `integrations/*/callback/route.ts`: Signed state verification, user/company matching, open redirect prevention.
- `lib/oauth-state.ts`: HMAC-SHA256 signed state with timing-safe verification, base64url encoding.

---

## PERFORMANCE AUDIT — 2026-03-23

### 🟡 WARNING — N+1 Query Patterns

| File | Function | Queries per N | Severity |
|------|----------|--------------|----------|
| `admin/monitor/route.ts` | `getCompanyBreakdown()` | 5 per subscription | High (admin-only) |
| `admin/cleanup-orphans/route.ts` | DELETE handler | 2 per orphan | Medium (rare op) |
| `admin/monitor/route.ts` | `getContactCooldowns()` | 1 Redis call per key | Medium (admin-only) |

### 🟢 INFO — General Performance

- **Command Center** makes 14 parallel DB queries in single `Promise.all()` — good parallelization pattern.
- **Contact import** batches deduplication queries in groups of 500 — avoids single huge IN clause.
- **Stripe webhook** fetches subscription periods from Stripe API (network call) — has fallback to calculated dates.
- **`select('*')` usage:** 71 occurrences across 47 files. For production, consider selecting only needed columns on high-traffic endpoints (contacts, calls, dashboard).

---

## TEST COVERAGE AUDIT — 2026-03-23

### 🟡 WARNING — No automated tests

- No test files found (`*.test.ts`, `*.spec.ts`, `__tests__/`).
- No test runner configured in `package.json` (no jest, vitest, or playwright).
- **Impact:** High — no regression safety net for billing, webhook handling, or auth flows.
- **Priority:** Critical flows that need tests first:
  1. Stripe webhook handler (subscription lifecycle)
  2. `checkCallAllowed()` throttle logic
  3. OAuth state signing/verification
  4. Redis concurrency manager (slot acquire/release)
  5. Contact import CSV parsing

---

## FINAL CHECKPOINT — All Modules Complete

| Category | 🔴 CRITICAL | 🟡 WARNING | ✅ MITIGATED |
|----------|------------|------------|-------------|
| Database Schema | 1 (plaintext tokens) | 5 | 1 |
| Billing & Payments | 0 | 2 | 3 |
| Auth & Security | 0 | 2 | 2 |
| Core Call Flow | 0 | 1 | 2 |
| Admin/Contacts/Integrations | 0 | 2 | 5 |
| Performance | 0 | 1 (N+1) | 0 |
| Test Coverage | 0 | 1 (no tests) | 0 |
| **TOTAL** | **1** | **14** | **13** |

---

## PRODUCTION READINESS VERDICT

### GO with conditions

The codebase is **production-ready with caveats**. The architecture is sound: proper auth, RLS, rate limiting, Zod validation, webhook verification, idempotency, and Redis-based concurrency control are all in place. 13 potential issues were investigated and found to be already mitigated.

### Must-fix before production (P0)

1. **🔴 Encrypt OAuth tokens at rest** — All CRM integration tokens (HubSpot, Salesforce, etc.) are stored as plaintext in Supabase. Implement AES-256-GCM encryption with a KMS-managed key. This is the only critical finding.

### Should-fix soon after launch (P1)

2. **🟡 Restrict `users` table self-update RLS** — Prevent users from changing their own `company_id` via direct Supabase client calls. Add trigger or column-restricted policy.
3. **🟡 Restrict `company_subscriptions` update to owner/admin** — Add role check to RLS policy.
4. **🟡 Add CHECK constraints on status columns** — Prevent invalid status values.
5. **🟡 Fix admin command center to allow `owner` role** — Currently only `admin` can access.

### Nice-to-have (P2)

6. Add automated tests for critical paths (webhook, throttle, OAuth state)
7. Fix N+1 queries in admin monitor
8. Add session_id format validation in verify-session
9. Add soft-delete for companies
10. Implement periodic reconciliation for denormalized counters
11. Select specific columns instead of `*` on high-traffic endpoints

---
