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
