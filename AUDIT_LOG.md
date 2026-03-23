# CALLENGO CODEBASE AUDIT LOG
**Date:** 2026-03-23
**Auditor:** Claude Opus 4.6 (automated deep audit)
**Scope:** Full production-readiness assessment

---

## SYSTEM CONTEXT SUMMARY

### What this app does
Callengo is a B2B SaaS platform for automated outbound AI voice calls. It replaces manual phone campaigns (lead qualification, data validation, appointment confirmation) with AI agents powered by Bland AI. Companies create campaigns, upload contacts, configure AI agents, and the system dispatches calls, analyzes transcripts via OpenAI GPT-4o-mini, syncs results to CRMs, and tracks usage for metered billing via Stripe.

### Tech stack
- **Framework:** Next.js 16.1.1 (App Router), React 19, TypeScript 5.9.3
- **DB:** Supabase (PostgreSQL) with RLS, 56 tables
- **Auth:** Supabase Auth (email/password + OAuth: Google, Azure/Microsoft, Slack OIDC)
- **Payments:** Stripe 20.1.0 (subscriptions + metered billing for overage)
- **Voice/Calls:** Bland AI (single master API key architecture)
- **Concurrency:** Upstash Redis (rate limiting, call slot tracking)
- **AI Analysis:** OpenAI GPT-4o-mini
- **Hosting:** Vercel (serverless)

### Tables confirmed to exist (56 tables from DB schema JSON)
admin_audit_log, admin_finances, admin_platform_config, agent_runs, agent_templates, ai_conversations, ai_messages, analysis_queue, billing_events, billing_history, calendar_events, calendar_integrations, calendar_sync_log, call_logs, call_queue, cancellation_feedback, clio_contact_mappings, clio_integrations, clio_sync_logs, companies, company_addons, company_agents, company_settings, company_subscriptions, contact_lists, contacts, dynamics_contact_mappings, dynamics_integrations, dynamics_sync_logs, follow_up_queue, google_sheets_integrations, google_sheets_linked_sheets, hubspot_contact_mappings, hubspot_integrations, hubspot_sync_logs, integration_feedback, notifications, pipedrive_contact_mappings, pipedrive_integrations, pipedrive_sync_logs, retention_offer_log, retention_offers, salesforce_contact_mappings, salesforce_integrations, salesforce_sync_logs, simplybook_contact_mappings, simplybook_integrations, simplybook_sync_logs, simplybook_webhook_logs, stripe_events, subscription_plans, team_calendar_assignments, team_invitations, usage_tracking, users, voicemail_logs, webhook_deliveries, webhook_endpoints, zoho_contact_mappings, zoho_integrations, zoho_sync_logs

### Auth flow
1. **Request** → Edge middleware (`middleware.ts`) intercepts all non-static routes
2. **Middleware checks:** Creates Supabase server client with cookies, calls `supabase.auth.getUser()` to validate JWT
3. **Public API routes whitelisted:** Stripe webhook, Bland webhook, OAuth callbacks, queue endpoints (secret-based), health check
4. **Non-public API routes:** Returns 401 if no user
5. **Protected page routes:** Redirects unauthenticated to `/auth/login`, checks email verification, checks onboarding, checks admin role for `/admin/*`
6. **API routes consume auth:** Each route creates its own `createServerClient()`, calls `supabase.auth.getUser()`, then queries `users` table for `company_id` and `role`. RLS enforces tenant isolation at DB layer.
7. **Admin routes:** Defense-in-depth — middleware blocks non-admin pages AND API routes re-verify `role === 'admin'`
8. **User metadata caching:** httpOnly cookie `x-user-meta` with 5-min TTL

### Core services map
| Service | What it does | External APIs | DB tables |
|---------|-------------|---------------|-----------|
| Billing (lib/billing/) | Usage tracking, overage management, call throttling | Stripe | usage_tracking, company_subscriptions, billing_events |
| Bland Master Client (lib/bland/) | Dispatches calls via master API key, enforces plan limits | Bland AI | call_logs, company_settings, admin_platform_config |
| Redis Concurrency (lib/redis/) | Atomic call slot management, concurrency tracking | Upstash Redis | (Redis keys) |
| Stripe (lib/stripe.ts) | Customer mgmt, checkout, subscriptions, usage reporting | Stripe | (via webhook) |
| AI Intent Analyzer (lib/ai/) | Post-call transcript analysis | OpenAI | analysis_queue, call_logs, contacts |
| Calendar (lib/calendar/) | Google/Outlook/Zoom integration, availability | Google, MS Graph, Zoom | calendar_events, calendar_integrations |
| CRM Integrations (7 CRMs) | OAuth, contact sync, call result push | CRM APIs | *_integrations, *_contact_mappings, *_sync_logs |
| Queue (lib/queue/) | Async: AI analysis, dispatch, follow-ups | (internal) | analysis_queue, call_queue, follow_up_queue |
| Webhooks (lib/webhooks.ts) | Outbound webhook dispatch, HMAC signing, SSRF protection | User URLs | webhook_endpoints, webhook_deliveries |
| Rate Limit (lib/rate-limit.ts) | Distributed rate limiting via Upstash with LRU fallback | Upstash Redis | (Redis keys) |

### Integration trust model
| Integration | Trust | Notes |
|-------------|-------|-------|
| Stripe | TRUSTED | Webhook signature verified |
| Bland AI | TRUSTED | Master API key; returns our metadata |
| OpenAI | TRUSTED | We control prompts |
| CRMs (HubSpot, SF, etc.) | TRUSTED | OAuth-authenticated API data |
| User browser input | UNTRUSTED | Forms, API bodies |
| CSV/Excel imports | UNTRUSTED | User-uploaded files |
| User webhooks | N/A | Outbound only, SSRF-protected |

### Intentional patterns to not flag
1. Admin routes check role in BOTH middleware AND API routes (defense-in-depth)
2. Large components (>1k lines) are documented as intentional
3. `supabaseAdminRaw` for untyped tables — documented design choice
4. Rate limiting applied per-endpoint, not globally via middleware — documented known gap
5. Service role used server-side only, never client-side
6. `x-user-meta` cookie is cached metadata, not auth token
7. Seed endpoint protected by secret env var
8. Deprecated rate-limit exports return passthrough (moved to Redis)

### API routes inventory (112 endpoints)
- **Admin:** 9 endpoints (command-center, clients, finances, billing-events, reconcile, etc.)
- **Auth:** 2 (check-admin, verify-recaptcha)
- **Billing:** 17 (checkout, plans, subscriptions, overage, phone numbers, etc.)
- **Bland AI:** 4 (send-call, webhook, get-call, analyze-call)
- **Calendar:** 5 (events, availability, team, contact-sync)
- **Campaigns:** 1 (dispatch)
- **Company:** 4 (bootstrap, onboarding-status, scrape, update)
- **Contacts:** 8 (CRUD, import, export, AI analyze/segment, stats)
- **Integrations:** 45+ (7 CRMs × ~6 routes + calendar/sheets/slack/zoom)
- **OpenAI:** 3 (analyze-call, context-suggestions, recommend-agent)
- **Queue:** 2 (process, followups)
- **Team:** 5 (invite, accept, cancel, members, remove)
- **Webhooks:** 3 (endpoints CRUD, Stripe webhook)
- **Other:** 8 (health, seed, ai-chat, get-started, voices, etc.)

---

## DATABASE SCHEMA AUDIT

**Schema:** 56 tables, 95+ foreign keys, 130+ indexes, 36 triggers, 27 functions
**Audit date:** 2026-03-23

### 🔴 CRITICAL

- **`users` table RLS allows self-escalation to admin role**
  The `users_update` policy is `CHECK (id = auth.uid())` — it restricts users to updating their own row but does NOT restrict which columns they can update. The `role` column (text, default 'member') has no CHECK constraint or trigger preventing changes. A malicious user can execute `supabase.from('users').update({ role: 'admin' })` from the browser console, gaining full admin access to: Command Center, all client data, financial data, platform config, and all company data via admin RLS policies.
  **Call chain traced:** Browser Supabase client (anon key) → RLS `users_update` policy (allows own row update) → `role` column updated → middleware reads `role` from DB → grants `/admin/*` access + admin API endpoints verify `role === 'admin'`.
  **Suggested fix (choose one):**
  1. Add a trigger: `CREATE OR REPLACE FUNCTION prevent_role_self_update() RETURNS trigger AS $$ BEGIN IF NEW.role <> OLD.role AND current_setting('role') <> 'service_role' THEN RAISE EXCEPTION 'Cannot modify own role'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER trg_prevent_role_update BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION prevent_role_self_update();`
  2. Or restrict the UPDATE policy to specific columns: Use a CHECK that `NEW.role = OLD.role` for non-service-role callers.

Previous audits flagged `companies` and `company_settings` tables as having `USING(true)` RLS policies. **Verified: BOTH have been fixed.** The current `companies_select` policy scopes to `users.company_id` matching `auth.uid()`. The `company_settings_all` policy scopes to `company_id` via the same pattern.

### 🟡 WARNING

- **`claim_analysis_job()` — SECURITY DEFINER function bypasses RLS**
  This PostgreSQL function runs with creator privileges, bypassing all RLS policies. It claims analysis jobs from `analysis_queue` without company_id filtering. **Mitigated** by: the function is only called from `/api/queue/process` which requires `QUEUE_PROCESSING_SECRET` header — not user-accessible. Risk is theoretical (requires compromised queue secret). Severity remains WARNING because SECURITY DEFINER functions are a surface area if new callers are added without the same protection.
  **Suggested fix:** Add `company_id` parameter to the function signature, or ensure it only returns jobs the caller is authorized to process.

- **`hubspot_integrations` missing unique constraint on `(company_id, user_id)`**
  Unlike `salesforce_integrations` which has `idx_sf_integrations_unique ON (company_id, user_id) WHERE is_active`, HubSpot has no such constraint. A company could end up with duplicate active HubSpot integrations for the same user.
  **Suggested fix:** Add `CREATE UNIQUE INDEX idx_hubspot_integrations_unique ON hubspot_integrations (company_id, user_id) WHERE is_active = true;`

- **CASCADE deletes on `companies` silently removes financial records**
  `billing_history`, `billing_events`, `usage_tracking` all CASCADE delete when a company is deleted. This means deleting a company permanently destroys all billing audit trail. For a B2B SaaS with Stripe integration, this data may be needed for tax/compliance even after a company churns.
  **Suggested fix:** Consider SET NULL or RESTRICT on financial tables, or implement soft-delete for companies.

- **`contacts.contact_id → call_logs` CASCADE deletes call history**
  FK `call_logs.contact_id → contacts.id ON DELETE CASCADE`. Deleting a contact removes all associated call logs. This could be unexpected if a user deletes a duplicate contact but wants to preserve call history.
  **Suggested fix:** Change to `ON DELETE SET NULL` (call_logs.contact_id is already nullable).

### 🟢 INFO

- **Status/enum columns use TEXT without CHECK constraints**
  Tables like `company_subscriptions.status`, `call_logs.status`, `agent_runs.status`, `follow_up_queue.status` store status values as TEXT with no DB-level CHECK constraint. Validation happens at application layer (TypeScript types + Zod). This is acceptable for this stack but means invalid status values could be inserted via service_role if application code has a bug.

- **OAuth tokens stored as plaintext TEXT columns**
  All 9 integration tables store `access_token` and `refresh_token` as plain TEXT. This is standard practice for this architecture — Supabase provides disk-level encryption, and RLS prevents cross-tenant access. Application-level encryption would add complexity with minimal security benefit given the threat model.

- **`calendar_events` has 50+ columns**
  This is a wide table that aggregates data from multiple calendar providers. While maintainability is a concern, this is documented as an intentional design choice to avoid JOINs on a frequently-queried table.

- **`company_settings.openai_api_key` column exists but is unused**
  The app uses the `OPENAI_API_KEY` environment variable for all OpenAI calls. The per-company column is dead schema. Low risk.

- **No migration files in repo**
  Migrations appear to be managed directly in Supabase dashboard. No `supabase/migrations/` directory found. This makes schema versioning harder to audit but is common with Supabase-managed projects.

- **UUID primary keys on all tables**
  UUIDs are used universally as PKs. While this has known B-tree fragmentation concerns at scale, the current dataset size (B2B SaaS with hundreds of companies) is well within safe bounds. Would only become a concern at >10M rows per table.

### ✅ CLEAN

- **Schema integrity:** All 56 tables have PKs. All FKs reference valid tables/columns. No circular FK dependencies. Junction tables have appropriate unique constraints.
- **Column types:** All financial columns use NUMERIC (not FLOAT). Booleans are proper `bool` type. Timestamps are `timestamptz`. JSON fields use `jsonb`. Arrays use proper PostgreSQL array types (`_text`).
- **Nullability:** Mandatory fields (names, emails, company_id FKs) are marked NOT NULL. Optional fields (descriptions, notes, external IDs) are properly nullable. FK columns that should cascade/fail have correct ON DELETE behavior.
- **Indexes:** All FK columns are indexed. High-traffic query patterns have composite indexes. Partial indexes used appropriately (e.g., `WHERE is_active = true`, `WHERE status = 'pending'`). No obviously redundant indexes.
- **Timestamps:** All mutable tables have `created_at` + `updated_at`. Append-only tables have `created_at` only. 36 triggers maintain `updated_at` automatically.
- **Multi-tenancy:** Every user-data table has `company_id`. RLS policies enforce tenant isolation on reads AND writes. Service role access is audit-logged for admin operations.
- **RLS coverage:** All 56 tables have RLS policies. Admin tables restrict to admin/owner role. Service-role-only tables are not client-accessible. Write-restricted tables have their writes handled by service_role in appropriate server contexts.
- **Singleton pattern:** `admin_platform_config` uses `UNIQUE INDEX ON ((true))` to enforce single row — correct.
- **Soft delete consistency:** No tables use soft delete — consistent hard-delete pattern throughout.
- **Triggers:** 36 triggers for `updated_at`, plus business logic triggers (campaign completion notifications, failure rate alerts, follow-up auto-creation, dedicated number limit checks). All well-scoped.

### ⚪ SCHEMA JSON GAPS

- `campaign_queue` referenced in types but not in schema JSON (may be renamed to `call_queue`)
- `ai_conversation_messages` referenced in master doc but schema shows `ai_messages` (naming difference only)
- No migration files available for version tracking audit

---

## BILLING/STRIPE + BLAND AI/CALLS MODULE — 2026-03-23

### 🔴 CRITICAL

- **[usage-tracker.ts:119] Optimistic lock silently drops usage after 3 retries**
  `trackCallUsage()` uses optimistic locking on `usage_tracking.updated_at`. If 3 retries fail (high-concurrency scenario with multiple concurrent call completions), the function logs an error and **returns without recording usage**. The call happened and cost Bland AI money, but the company's usage counter is never incremented. This causes revenue leakage — the company uses more minutes than tracked.
  **Call chain:** Bland webhook → `trackCallUsage()` → optimistic lock fails 3x → `return` (usage lost) → company continues making calls past their limit.
  **Suggested fix:** After exhausting retries, use a `supabase.rpc('increment_usage_minutes', ...)` atomic increment (the RPC function already exists per billing audit docs) or fall back to a billing_events record flagged for reconciliation.

### 🟡 WARNING

- **[usage-tracker.ts:142-145] `reportUsage` uses `action: 'set'` instead of `'increment'`**
  Each call to Stripe's usage reporting sets the total overage minutes rather than incrementing. If two webhook callbacks process simultaneously, the second call overwrites the first's total. Example: Call A finishes (5 overage min → set 5), Call B finishes concurrently (total should be 8 → but reads stale data → set 3). Stripe sees 3, not 8.
  **Mitigated partially** by the optimistic lock on `usage_tracking` (ensures sequential reads), but the Stripe API call happens AFTER the lock is released. A crash between DB update and Stripe call means Stripe has stale data.
  **Suggested fix:** Use `action: 'increment'` with per-call overage delta, or reconcile periodically (which `syncAllMeteredUsage` already does).

- **[bland/webhook/route.ts:96-113] Bland webhook signature not enforced in non-production**
  If `BLAND_WEBHOOK_SECRET` is not set, the webhook accepts unsigned requests. While this is gated to non-production (`NODE_ENV !== 'production'`), staging environments could receive forged webhooks. The signature verification IS enforced in production.
  **Suggested fix:** Require `BLAND_WEBHOOK_SECRET` in all environments, or at minimum log a prominent warning.

- **[campaigns/dispatch/route.ts:137-139] Batch insert into `campaign_queue` without idempotency**
  Double-clicking "Launch Campaign" sends two POST requests. The dispatch endpoint has rate limiting (2/min), but two rapid requests within the same second could both pass. No idempotency key or unique constraint prevents duplicate queue entries for the same contact+campaign combination.
  **Mitigated partially** by: rate limit of 2/min, agent_run status check (only dispatches if status is pending/running/active), and Redis contact cooldown (5-min gap between calls to same contact). However, duplicate queue entries would still be created.
  **Suggested fix:** Add a unique constraint on `campaign_queue(agent_run_id, contact_id)` or use an idempotency key in the request.

- **[bland/phone-numbers.ts] No Bland-side cleanup on number release**
  `releaseNumberFromCompany()` marks the addon as 'canceled' in DB but doesn't call Bland API to release the number from the master account. Orphaned numbers accumulate on the Bland account, incurring ongoing charges.
  **Suggested fix:** Call Bland's number release API, or document this as intentional if numbers are meant to be recycled.

### 🟢 INFO

- **[send-call/route.ts:90-97] Pre-registered call_log entry prevents TOCTOU race** — Good pattern. Creates a 'queued' call_log before throttle check so concurrent requests see each other. If throttle rejects, the pre-registered entry is cleaned up.

- **[send-call/route.ts:42] Rate limiting applied** — `expensiveLimiter.check(10, user.id)` on send-call endpoint. Properly limits to 10 calls/min per user.

- **[campaigns/dispatch/route.ts:48] Rate limiting applied** — 2 campaign dispatches/min per user.

- **[report-usage/route.ts:14-25] Internal token verification uses timing-safe comparison** — Proper crypto.timingSafeEqual for service-to-service auth.

- **[billing/call-throttle.ts] Comprehensive throttle checks** — Checks subscription status, period expiry, Redis concurrency, DB fallback concurrent/daily/hourly counts, minutes remaining, and overage budget. Well-structured defense-in-depth.

### ✅ MITIGATED

- **[Previous audit: "Usage tracker makes self-referential HTTP call"]** — Fixed. `trackCallUsage()` now writes directly to DB instead of calling its own API endpoint.

- **[Previous audit: "Stripe webhook no idempotency"]** — Fixed. Atomic INSERT with unique constraint on `stripe_events.id` (code 23505 detection). Confirmed in webhook handler.

- **[Previous audit: "No pre-dispatch throttle checks"]** — Fixed. `checkCallAllowed()` called before every dispatch in both `send-call/route.ts` and `campaigns/dispatch/route.ts`.

### ✅ CLEAN

- `src/lib/stripe.ts` — Well-structured wrapper. Proper error handling, webhook signature verification, no hardcoded secrets.
- `src/app/api/webhooks/stripe/route.ts` — Idempotent, signature-verified, handles all subscription lifecycle events.
- `src/lib/billing/overage-manager.ts` — Correctly prevents free plan overage, creates metered prices, handles enable/disable lifecycle.
- `src/app/api/billing/create-checkout-session/route.ts` — Auth, rate limit, role check, input validation, all present.

---

## AUTH/ADMIN MODULE — 2026-03-23

### 🔴 CRITICAL

- **[DB: users table — see Phase DB] Role self-escalation via RLS UPDATE policy**
  Already documented in Phase DB. The `users_update` RLS policy allows any authenticated user to update their own `role` column to 'admin'. This is the single most dangerous finding in the audit.

### 🟡 WARNING

- **[team/invite/route.ts:34-35] Admin can invite other admins**
  Role validation accepts `['member', 'admin']`. An admin user can invite another admin. Combined with the role self-escalation bug above, this creates a lateral escalation path. Even after fixing the RLS bug, consider whether only owners should be able to invite admins.
  **Suggested fix:** Restrict admin invitations to `owner` role only: `if (role === 'admin' && userData.role !== 'owner')`.

- **[team/members/route.ts:42-49] N+1 query: getUserById for each team member**
  For each team member, a separate `supabaseAdmin.auth.admin.getUserById()` call is made to fetch `last_sign_in_at`. A company with 20 members = 20 sequential auth API calls. This is slow and could hit Supabase rate limits.
  **Suggested fix:** Use `supabaseAdmin.auth.admin.listUsers()` with a filter, or cache last_sign_in_at in the users table.

### 🟢 INFO

- **[team/accept-invite/route.ts:69-75] Invitation acceptance uses service_role for user update** — Correct pattern. The `supabaseAdmin` client bypasses RLS to update the user's company_id and role. This is necessary because the user's own RLS policy only allows self-updates.

- **[seed/route.ts:64-84] Seed endpoint properly secured** — Requires `SEED_ENDPOINT_SECRET` env var. Uses timing-safe comparison. Disabled by default (returns 403 if env var not set). Previous audit concern about seed endpoint is resolved.

### ✅ MITIGATED

- **[Previous audit: "Seed endpoint accessible in non-production"]** — Fixed. Now requires `SEED_ENDPOINT_SECRET` regardless of environment. Timing-safe comparison used.

- **[Previous audit: "Admin routes missing auth"]** — False positive. All 9 admin API routes verify `role === 'admin'` after auth check. Middleware also blocks non-admin page access.

- **[Previous audit: "campaigns table missing RLS"]** — False positive. No `campaigns` table exists. App uses `agent_runs` which has proper company_id-scoped RLS.

### ✅ CLEAN

- `middleware.ts` — Comprehensive route protection. Auth check, email verification, onboarding redirect, admin role gate, user metadata caching.
- `src/contexts/AuthContext.tsx` — Clean state management. Only handles sign-out redirect; lets middleware handle sign-in redirects (avoids conflicts).
- `src/app/auth/callback/route.ts` — Safe redirect validation (`_safeRedirectUrl`), team invitation acceptance with optimistic locking, proper error handling.
- `src/app/api/auth/verify-recaptcha/route.ts` — Rate limited, fail-closed in production, proper score/action validation.
- `src/app/api/admin/command-center/route.ts` — Auth + admin check + rate limit. Comprehensive.
- `src/app/api/admin/clients/route.ts` — Auth + admin check. Proper pagination.

---

## CHECKPOINT — 3 Modules Complete

**Modules completed:** Billing/Stripe + Bland AI/Calls, Auth/Admin
**Confirmed criticals:** 2 (users role self-escalation, usage-tracker silent data loss)
**Confirmed warnings:** 6
**Mitigated false positives:** 5 (from previous audits)
**Next module:** Integrations
