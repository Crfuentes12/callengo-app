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
