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
