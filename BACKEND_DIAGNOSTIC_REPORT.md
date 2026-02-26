# Callengo Backend - Comprehensive Diagnostic Report

**Date:** 2026-02-26
**Scope:** Full exhaustive audit of database schema, RLS policies, FK constraints, cascade deletes, API routes, data integrity, and security.

---

## EXECUTIVE SUMMARY

The Callengo backend is well-architected overall with a solid multi-tenant structure. However, this audit found **23 issues** across 6 categories that need attention. The most critical are **missing foreign key constraints** that break cascade deletion of test users, a **type mismatch** on `contacts.list_id`, and **overly permissive RLS policies** that could allow cross-company data access.

A comprehensive SQL migration has been created at:
`supabase/migrations/20260226000001_comprehensive_backend_fixes.sql`

---

## WHAT'S GOOD (Strengths)

1. **Solid multi-tenant architecture**: Nearly all tables have `company_id` with CASCADE delete to `companies`. This is the correct pattern.

2. **Calendar integration is well-designed**: Proper OAuth token storage, bidirectional sync, incremental sync tokens, comprehensive event types, and well-indexed tables.

3. **Stripe integration is robust**: Idempotency via `stripe_events` table prevents duplicate webhook processing. Proper event handling for all subscription lifecycle events.

4. **Trigger-based automation**: Smart use of PostgreSQL triggers for auto-creating follow-ups, notification on campaign completion, high failure rate alerts, and minutes limit warnings.

5. **RLS is enabled on all major tables**: Calendar, AI conversations, notifications, follow-ups, voicemails, and retention tables all have company-scoped RLS policies.

6. **Mock data is isolated**: The `/api/seed` endpoint and `mock-data.ts` only target `crfuentes12@gmail.com`. No risk of mock data leaking into production.

7. **Comprehensive indexes**: 57+ indexes across all tables, including conditional/partial indexes for common query patterns.

8. **All data displayed in the app comes from the database**: Dashboard, analytics, reports, contacts, campaigns, billing, calendar - all pages fetch real data via Supabase queries. No fabricated/hardcoded display data.

---

## CRITICAL ISSUES (Must Fix)

### ISSUE 1: `contacts.list_id` is TEXT but `contact_lists.id` is UUID
**Severity:** CRITICAL
**Impact:** No FK constraint can exist between `contacts` and `contact_lists`. Orphaned contacts when lists are deleted. Data integrity violations.
**Location:** `contacts` table schema
**Fix:** Migration converts `list_id` from TEXT to UUID and adds FK with SET NULL on delete.

### ISSUE 2: Missing FK on `cancellation_feedback.user_id`
**Severity:** CRITICAL
**Impact:** Deleting a user leaves orphaned cancellation feedback records. These records will reference non-existent users.
**Location:** `scripts/migration-retention-tables.sql` - `user_id UUID NOT NULL` with no FK
**Fix:** Migration adds FK to `users(id)` with CASCADE.

### ISSUE 3: Missing FK on `retention_offer_log.user_id`
**Severity:** CRITICAL
**Impact:** Same as above - orphaned records when users are deleted.
**Location:** `scripts/migration-retention-tables.sql`
**Fix:** Migration adds FK to `users(id)` with CASCADE.

### ISSUE 4: Missing FK on `call_logs.agent_run_id`
**Severity:** HIGH
**Impact:** `call_logs.agent_run_id` references `agent_runs.id` in code but has no FK constraint. Can have dangling references. The seed route manually deletes in FK order because of this.
**Location:** `call_logs` table
**Fix:** Migration adds FK to `agent_runs(id)` with SET NULL (preserve call history when campaign deleted).

### ISSUE 5: Overly permissive RLS INSERT policies
**Severity:** HIGH
**Impact:** Two tables have `WITH CHECK (true)` INSERT policies, meaning ANY authenticated user can insert into ANY company:
- `voicemail_logs` - "System can insert voicemail logs" uses `true`
- `notifications` - "System can insert notifications" uses `true`
**Location:** `add_notifications_system.sql`, `20260123000003_add_followups_voicemails.sql`
**Fix:** Migration replaces these with company-scoped + service_role policies.

### ISSUE 6: `stripe_events` table has no RLS
**Severity:** HIGH
**Impact:** Any authenticated user could potentially read/write Stripe webhook event data.
**Location:** `20260103000001_add_stripe_fields.sql` - RLS not enabled
**Fix:** Migration enables RLS and restricts to service_role only.

---

## MODERATE ISSUES

### ISSUE 7: `/api/bland/send-call` - No auth check
**Severity:** MODERATE
**Impact:** The send-call endpoint validates `company_id` from the request body but does NOT verify the caller is authenticated or belongs to that company. Any request with a valid `company_id` can trigger calls.
**Location:** `src/app/api/bland/send-call/route.ts`
**Recommendation:** Add `supabase.auth.getUser()` check and verify user belongs to the specified company.

### ISSUE 8: `/api/billing/report-usage` - Proceeds without auth
**Severity:** MODERATE
**Impact:** The POST handler checks auth only if a user is present (`if (user)`), but proceeds to update usage even without authentication. This allows unauthenticated usage reporting.
**Location:** `src/app/api/billing/report-usage/route.ts:29`
**Recommendation:** Either require authentication or add an API key/secret for server-to-server calls.

### ISSUE 9: `public.users.id -> auth.users.id` FK may be missing
**Severity:** MODERATE
**Impact:** If this FK doesn't exist, deleting a user from `auth.users` (e.g., via Supabase dashboard) won't cascade to `public.users`, leaving an orphaned user record.
**Location:** `public.users` table
**Fix:** Migration ensures this FK exists with CASCADE.

### ISSUE 10: API keys stored in plaintext
**Severity:** MODERATE
**Impact:** `company_settings` stores `bland_api_key` and `openai_api_key` as plain text columns. These are sensitive secrets.
**Location:** `company_settings` table, used in `src/app/api/bland/send-call/route.ts:33`
**Recommendation:** Consider using Supabase Vault for secrets management, or at minimum encrypt at rest.

### ISSUE 11: Duplicate Supabase clients
**Severity:** LOW-MODERATE
**Impact:** Three files create their own Supabase clients instead of using the shared ones from `lib/supabase/service.ts`:
- `src/app/api/webhooks/stripe/route.ts:9-12` - Creates its own client
- `src/lib/billing/overage-manager.ts:10-13` - Creates its own client
- `src/lib/billing/usage-tracker.ts:8-11` - Creates its own client
**Risk:** Inconsistent connection configuration. The fallback `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` in these files means if the service key is missing, they'll use the anon key (RLS-restricted), leading to silent permission errors.
**Recommendation:** Import `supabaseAdmin` from `lib/supabase/service.ts` instead.

### ISSUE 12: No user deletion endpoint
**Severity:** MODERATE
**Impact:** There's no `/api/user/delete` or account deletion UI. Users cannot self-delete their accounts (GDPR/privacy concern). Deleting must be done manually in Supabase dashboard.
**Recommendation:** Implement a deletion endpoint that: cancels Stripe subscription, deletes auth user (cascading to all tables), and confirms deletion.

---

## LOW SEVERITY ISSUES

### ISSUE 13: `follow_up_queue` has redundant RLS policies
Two policies overlap: `FOR SELECT` and `FOR ALL` with the same USING clause. The `FOR ALL` policy already covers SELECT.
**Fix:** Migration removes the redundant SELECT policy.

### ISSUE 14: Admin finances route checks `role !== 'admin'` but not `'owner'`
**Location:** `src/app/api/admin/finances/route.ts:21`
**Impact:** Company owners cannot access admin finances even though they should have the highest privilege.
**Recommendation:** Allow `role === 'admin' || role === 'owner'`.

### ISSUE 15: Seed cleanup doesn't delete calendar_events or ai_conversations
**Location:** `src/app/api/seed/route.ts`
**Impact:** When cleaning demo data, `calendar_events`, `ai_conversations`, `ai_messages`, and `calendar_sync_log` are not deleted. They'll be orphaned after other data is removed.
**Recommendation:** Add these to the cleanup sequence.

### ISSUE 16: `usage_tracking` has no FK to `company_subscriptions`
**Impact:** If a subscription is deleted, usage tracking records become orphaned.
**Recommendation:** Add FK with CASCADE or SET NULL.

### ISSUE 17: Missing `updated_at` triggers
Several tables have `updated_at` columns but no trigger to auto-update them:
- `company_subscriptions`
- `contacts`
- `company_settings`
**Fix:** Migration adds triggers for these.

### ISSUE 18: `ai_chat/route.ts` uses `@ts-ignore` for table access
**Location:** `src/app/api/ai/chat/route.ts:244-268`
**Impact:** TypeScript type safety is bypassed. If table schema changes, no compile-time errors.
**Recommendation:** Update `types/supabase.ts` to include `ai_conversations` and `ai_messages` tables.

### ISSUE 19: Stripe webhook creates client with fallback to anon key
**Location:** `src/app/api/webhooks/stripe/route.ts:11`
```typescript
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```
**Impact:** If `SUPABASE_SERVICE_ROLE_KEY` is not set, the webhook handler will use the anon key and fail silently on RLS-protected operations.
**Recommendation:** Throw an error if service key is missing rather than silently falling back.

### ISSUE 20: No rate limiting on webhook endpoints
**Location:** `/api/bland/webhook`, `/api/webhooks/stripe`
**Impact:** No protection against webhook replay attacks beyond Stripe's signature verification (Bland AI webhook has no signature verification at all).
**Recommendation:** Add signature verification for Bland AI webhooks. Consider rate limiting.

### ISSUE 21: Bland AI webhook has no signature verification
**Location:** `src/app/api/bland/webhook/route.ts`
**Impact:** Anyone who knows the endpoint URL can send fake webhook payloads and insert data into `call_logs`, update `contacts`, and create `calendar_events`.
**Recommendation:** Implement HMAC signature verification or IP allowlisting for Bland AI webhooks.

### ISSUE 22: `notifications_id_seq` GRANT may fail
**Location:** `add_notifications_system.sql:184`
**Impact:** The `GRANT USAGE ON SEQUENCE notifications_id_seq` will fail because `notifications.id` uses `gen_random_uuid()`, not a sequence. This is a no-op error.
**Recommendation:** Remove this line from the migration.

### ISSUE 23: Missing composite index for common billing queries
**Impact:** Several billing queries filter by `company_id + status` but no composite index exists.
**Fix:** Migration adds composite indexes for common query patterns.

---

## CASCADE DELETE CHAIN (After Fixes)

When deleting a **company** (`DELETE FROM companies WHERE id = ?`), the following cascade occurs:

```
companies
  |-- users (CASCADE) -> [user deletion chain below]
  |-- contacts (CASCADE)
  |-- contact_lists (CASCADE)
  |-- call_logs (CASCADE)
  |     |-- voicemail_logs.call_id (CASCADE)
  |     |-- follow_up_queue.original_call_id (SET NULL)
  |     |-- calendar_events.call_log_id (SET NULL)
  |-- agent_runs (CASCADE)
  |     |-- follow_up_queue.agent_run_id (CASCADE)
  |     |-- voicemail_logs.agent_run_id (SET NULL)
  |     |-- calendar_events.agent_run_id (SET NULL)
  |-- company_agents (CASCADE)
  |-- company_settings (CASCADE)
  |-- company_subscriptions (CASCADE)
  |     |-- cancellation_feedback.subscription_id (SET NULL)
  |     |-- retention_offer_log.subscription_id (SET NULL)
  |-- calendar_integrations (CASCADE)
  |     |-- calendar_sync_log.integration_id (CASCADE)
  |     |-- calendar_events.integration_id (SET NULL)
  |-- calendar_events (CASCADE)
  |-- notifications (CASCADE)
  |-- ai_conversations (CASCADE)
  |     |-- ai_messages (CASCADE)
  |-- billing_events (CASCADE)
  |-- billing_history (CASCADE)
  |-- usage_tracking (CASCADE)
  |-- follow_up_queue (CASCADE)
  |-- voicemail_logs (CASCADE)
  |-- cancellation_feedback (CASCADE)
  |-- retention_offers (CASCADE)
  |-- retention_offer_log (CASCADE)
  |-- call_queue (CASCADE) [if exists]
```

When deleting a **user** (`DELETE FROM users WHERE id = ?`):

```
users
  |-- notifications.user_id (CASCADE)
  |-- calendar_integrations.user_id (CASCADE)
  |     |-- calendar_sync_log.integration_id (CASCADE)
  |-- cancellation_feedback.user_id (CASCADE) [NEW - added by migration]
  |-- retention_offer_log.user_id (CASCADE) [NEW - added by migration]
```

When deleting from **auth.users** (`DELETE FROM auth.users WHERE id = ?`):

```
auth.users
  |-- public.users.id (CASCADE) [ensured by migration]
  |     |-- [everything in the user chain above]
  |-- ai_conversations.user_id (CASCADE)
  |     |-- ai_messages (CASCADE)
```

---

## TABLES SUMMARY

| Table | company_id FK | user_id FK | RLS Enabled | Cascade OK |
|-------|:---:|:---:|:---:|:---:|
| users | CASCADE | N/A (is the user) | Assumed | YES (after fix) |
| companies | N/A (is the company) | N/A | Assumed | YES |
| contacts | CASCADE | N/A | Assumed | YES (after list_id fix) |
| contact_lists | CASCADE | N/A | Assumed | YES |
| call_logs | CASCADE | N/A | Assumed | YES (after agent_run FK fix) |
| agent_runs | CASCADE | N/A | Assumed | YES |
| agent_templates | N/A (global) | N/A | N/A | YES |
| company_agents | CASCADE | N/A | Assumed | YES |
| company_settings | CASCADE | N/A | Assumed | YES |
| company_subscriptions | CASCADE | N/A | Assumed | YES |
| calendar_integrations | CASCADE | CASCADE | YES | YES |
| calendar_events | CASCADE | N/A | YES | YES |
| calendar_sync_log | CASCADE | N/A | YES | YES |
| ai_conversations | CASCADE | CASCADE (auth) | YES | YES |
| ai_messages | N/A | N/A | YES | YES (via conversation) |
| notifications | CASCADE | CASCADE | YES | YES |
| follow_up_queue | CASCADE | N/A | YES | YES |
| voicemail_logs | CASCADE | N/A | YES | YES (after RLS fix) |
| billing_events | CASCADE | N/A | Assumed | YES |
| billing_history | CASCADE | N/A | Assumed | YES |
| usage_tracking | CASCADE | N/A | Assumed | YES |
| stripe_events | N/A | N/A | YES (after fix) | YES |
| subscription_plans | N/A (global) | N/A | N/A | YES |
| cancellation_feedback | CASCADE | CASCADE (after fix) | YES | YES (after fix) |
| retention_offers | CASCADE | N/A | YES | YES |
| retention_offer_log | CASCADE | CASCADE (after fix) | YES | YES (after fix) |
| admin_finances | N/A | N/A | YES (after fix) | YES |
| call_queue | CASCADE (after fix) | N/A | Unknown | YES (after fix) |

---

## MIGRATION FILE

All fixes are in: `supabase/migrations/20260226000001_comprehensive_backend_fixes.sql`

**What it does:**
1. Adds 3 missing FK constraints (cancellation_feedback, retention_offer_log, call_logs)
2. Converts `contacts.list_id` from TEXT to UUID with proper FK
3. Ensures `public.users.id -> auth.users.id` CASCADE FK exists
4. Fixes 2 overly permissive RLS INSERT policies
5. Adds RLS to `stripe_events` (service_role only)
6. Adds 8 performance indexes
7. Cleans existing orphaned data
8. Adds 3 missing `updated_at` triggers
9. Adds GRANT permissions for retention tables

**How to run:**
```bash
# If using Supabase CLI:
supabase db push

# If running manually in SQL Editor:
# Copy and paste the contents of the migration file
```

---

## RECOMMENDATIONS (Future Work)

1. **Implement user deletion endpoint** - Required for GDPR compliance
2. **Add Bland AI webhook signature verification** - Critical security gap
3. **Encrypt API keys at rest** - `bland_api_key` and `openai_api_key` in `company_settings`
4. **Consolidate Supabase clients** - Replace 3 duplicate client instantiations with shared `supabaseAdmin`
5. **Add auth to `/api/bland/send-call`** - Currently no authentication check
6. **Update TypeScript types** - Run `supabase gen types` to include ai_conversations, ai_messages in `types/supabase.ts`
7. **Add Stripe subscription cancellation on user delete** - Currently Stripe subscriptions survive user deletion
8. **Add rate limiting to public-facing API routes** - Prevent abuse
9. **Consider adding a `deleted_at` soft-delete column** - For audit trail on user/company deletion
