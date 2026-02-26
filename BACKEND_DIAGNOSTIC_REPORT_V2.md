# Callengo Backend - Comprehensive Diagnostic Report V2

**Date:** 2026-02-26
**Scope:** Second exhaustive audit after first migration was applied. Covers: Supabase linter warnings, architecture re-analysis, team invitation workflow, subscription plans, API security, RLS policies, search_path security, and code quality.

---

## EXECUTIVE SUMMARY

After the first migration (`20260226000001`) was applied successfully, the Supabase linter revealed **24 remaining warnings**: 14 `function_search_path_mutable`, 9 `rls_policy_always_true`, and 1 `auth_leaked_password_protection`. This second audit addresses all of these plus implements the missing team invitation workflow, fixes API route security gaps, consolidates duplicate Supabase clients, and adds missing database columns for seat management.

A new migration has been created at:
`supabase/migrations/20260226000002_fix_warnings_and_team_invitations.sql`

New team API routes created at:
`src/app/api/team/members/route.ts`
`src/app/api/team/invite/route.ts`
`src/app/api/team/remove/route.ts`
`src/app/api/team/cancel-invite/route.ts`
`src/app/api/team/accept-invite/route.ts`

---

## CHANGES MADE IN THIS AUDIT

### 1. SQL Migration: `20260226000002_fix_warnings_and_team_invitations.sql`

#### Section 1: Fixed 14 Function Search Path Warnings
All 14 public functions recreated with `SET search_path = public` to prevent search_path manipulation attacks:

| Function | Purpose |
|----------|---------|
| `update_updated_at_column()` | Generic updated_at trigger |
| `update_notifications_updated_at()` | Notifications timestamp |
| `notify_campaign_completion()` | Notification on campaign complete/fail |
| `notify_high_failure_rate()` | Alert on >50% failure rate |
| `notify_minutes_limit()` | Alert at 80/90/100% usage |
| `update_followup_updated_at()` | Follow-up queue timestamp |
| `auto_create_followup()` | Auto-create follow-ups on call failure |
| `handle_updated_at()` | Alternative updated_at trigger |
| `update_usage_tracking_updated_at()` | Usage tracking timestamp |
| `update_call_queue_updated_at()` | Call queue timestamp |
| `update_admin_finances_updated_at()` | Admin finances timestamp |
| `update_contact_lists_updated_at()` | Contact lists timestamp |
| `update_subscription_plans_updated_at()` | Subscription plans timestamp |
| `update_company_subscriptions_updated_at()` | Company subscriptions timestamp |

#### Section 2: Fixed 9 RLS Always-True Policy Warnings
Dropped 9 overly permissive policies and replaced with company-scoped alternatives:

| Old Policy (Dropped) | Table | Replacement |
|----------------------|-------|-------------|
| `authenticated_can_manage_runs` | agent_runs | `Company members can manage agent runs` |
| `authenticated_can_manage_call_logs` | call_logs | `Company members can manage call logs` |
| `anyone_can_create_company` | companies | `Authenticated users can create company` |
| `authenticated_can_update_companies` | companies | `Users can update own company` |
| `authenticated_insert_companies` | companies | `Authenticated users can create company` |
| `authenticated_can_manage_agents` | company_agents | `Company members can manage agents` |
| `authenticated_can_create_settings` | company_settings | `Company members can manage settings` |
| `authenticated_can_update_settings` | company_settings | `Company members can manage settings` |
| `authenticated_can_manage_contacts` | contacts | `Company members can manage contacts` |

#### Section 3: Team Invitations Table
Created `team_invitations` table with:
- `id`, `company_id`, `invited_by`, `email`, `role`, `status`, `token`, `expires_at`, `accepted_at`
- Status: `pending`, `accepted`, `expired`, `cancelled`
- Role: `member`, `admin`
- 7-day expiration by default
- Unique constraint on `(company_id, email, status)` to prevent duplicate pending invites
- Full RLS: company members can view, only owners/admins can create/update/delete
- Service role bypass via RLS
- Indexes on company_id, email, token, status

#### Section 4: Subscription Plans Seat Management
Added 5 new columns to `subscription_plans`:

| Column | Type | Purpose |
|--------|------|---------|
| `max_seats` | INTEGER | Max team members (-1 = unlimited) |
| `extra_seat_price` | NUMERIC(10,2) | Cost per additional seat |
| `max_agents` | INTEGER | Max AI agents (-1 = unlimited) |
| `max_concurrent_calls` | INTEGER | Concurrent call limit |
| `max_call_duration` | INTEGER | Max minutes per call |

Plan configuration:

| Plan | Seats | Extra Seat | Agents | Concurrent | Duration |
|------|-------|-----------|--------|------------|----------|
| Free | 1 | N/A | 1 | 1 | 3 min |
| Starter | 1 | N/A | 1 | 1 | 3 min |
| Business | 3 | N/A | 3 | 3 | 5 min |
| Teams | 5 | $79/mo | Unlimited | 10 | 8 min |
| Enterprise | Unlimited | N/A | Unlimited | 50 | 15 min |

#### Section 5: Missing FK Constraints
- Added `usage_tracking.subscription_id` FK to `company_subscriptions(id)` with SET NULL

#### Section 6: RLS Enablement
Ensured RLS is enabled on all core tables: `agent_runs`, `call_logs`, `companies`, `company_agents`, `company_settings`, `contacts`, `contact_lists`, `users`

#### Section 7: Service Role Bypass Policies
Added `service_role` bypass policies on 7 tables to allow webhook handlers and server-side operations: `agent_runs`, `call_logs`, `contacts`, `company_settings`, `company_agents`, `companies`, `contact_lists`

---

### 2. Team API Routes (NEW - 5 endpoints)

#### `GET /api/team/members`
- Returns all team members with roles, activity, and pending invitations
- Fetches `last_sign_in_at` from auth.users for each member
- Uses `supabaseAdmin` for cross-table queries

#### `POST /api/team/invite`
- **Auth Required**: Owner or Admin role
- **Plan Check**: Business plan or higher required (Free/Starter blocked)
- **Seat Check**: Validates against `max_seats` from subscription plan
- **Duplicate Check**: Prevents duplicate invites and existing member invites
- Creates invitation record in `team_invitations`
- Teams plan allows extra seats at $79/mo even when over limit

#### `POST /api/team/remove`
- **Auth Required**: Owner or Admin role
- **Protection**: Cannot remove yourself, cannot remove owner
- **Admin restriction**: Only owner can remove other admins
- Removes user from company by setting `company_id = null`

#### `POST /api/team/cancel-invite`
- **Auth Required**: Owner or Admin role
- Verifies invitation belongs to same company
- Updates invitation status to `cancelled`

#### `POST /api/team/accept-invite`
- **Auth Required**: Any authenticated user with matching email
- Validates invitation token, expiration, and email match
- Checks user isn't already in another company
- Updates user's `company_id` and `role`
- Marks invitation as `accepted`

---

### 3. API Route Security Fixes

#### `/api/bland/send-call` - Added Authentication
**Before:** No auth check. Any request with a valid `company_id` could trigger calls.
**After:** Requires `supabase.auth.getUser()` + verifies user belongs to the specified company.

#### `/api/billing/report-usage` - Added Authentication
**Before:** Checked auth only if user present, proceeded to update usage even without auth.
**After:** Requires either user authentication OR a valid `x-service-key` header matching the service role key. Unauthenticated requests now get 401.

#### `/api/admin/finances` - Added Owner Access
**Before:** Only checked `role === 'admin'`, owners couldn't access.
**After:** Allows `role === 'admin' || role === 'owner'`.

---

### 4. Duplicate Supabase Client Consolidation

Three files that created their own Supabase clients now import from the shared service:

| File | Before | After |
|------|--------|-------|
| `src/app/api/webhooks/stripe/route.ts` | `createClient(URL, KEY \|\| ANON)` | `import { supabaseAdmin as supabase } from '@/lib/supabase/service'` |
| `src/lib/billing/usage-tracker.ts` | `createClient(URL, KEY \|\| ANON)` | `import { supabaseAdmin as supabase } from '@/lib/supabase/service'` |
| `src/lib/billing/overage-manager.ts` | `createClient(URL, KEY \|\| ANON)` | `import { supabaseAdmin as supabase } from '@/lib/supabase/service'` |

**Why this matters:** The old fallback pattern `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` meant that if the service key was missing, these files would silently use the anon key (RLS-restricted), causing permission errors. The shared `supabaseAdmin` from `service.ts` requires the service role key.

---

### 5. Seed Route Cleanup Fix

**Before:** `POST /api/seed` and `DELETE /api/seed` didn't clean `calendar_events`, `ai_conversations`, or `ai_messages` when removing demo data.
**After:** Both handlers now clean these tables in proper FK order:
- `calendar_events` deleted before `call_logs` (has FK to call_logs)
- `ai_conversations` deleted at the end (cascades to `ai_messages` automatically)

---

## REMAINING ITEMS (Not SQL-fixable)

### `auth_leaked_password_protection` Warning
**What it is:** Supabase Auth's "Leaked Password Protection" feature is disabled.
**How to fix:** Enable it in Supabase Dashboard > Authentication > Settings > Enable "HaveIBeenPwned" integration.
**Impact:** Without this, users can set passwords that appear in known data breach lists.

### Bland AI Webhook Signature Verification
**Location:** `src/app/api/bland/webhook/route.ts`
**Issue:** No signature verification. Anyone who knows the endpoint URL can send fake webhook payloads.
**Recommendation:** Implement HMAC signature verification or IP allowlisting for Bland AI webhooks.

### API Keys in Plaintext
**Location:** `company_settings` table (`bland_api_key`, `openai_api_key`)
**Recommendation:** Consider Supabase Vault for secrets management.

### No User Deletion Endpoint
**Issue:** No `/api/user/delete` endpoint exists. Users cannot self-delete (GDPR concern).
**Recommendation:** Implement endpoint that cancels Stripe subscription, deletes auth user (cascading to all tables), confirms deletion.

### No Rate Limiting on Webhook Endpoints
**Location:** `/api/bland/webhook`, `/api/webhooks/stripe`
**Recommendation:** Add rate limiting, especially for Bland AI (no signature verification).

### TypeScript Types Not Updated
**Location:** `src/types/supabase.ts`
**Issue:** Types don't include `ai_conversations`, `ai_messages`, `team_invitations`, or the new subscription plan columns.
**Fix:** Run `supabase gen types typescript --project-id <id> > src/types/supabase.ts`

---

## ARCHITECTURE ANALYSIS (Post-Fix)

### Multi-Tenant Security Model

The app uses a solid multi-tenant architecture where virtually all data is scoped by `company_id`:

```
auth.users (Supabase Auth)
  └── public.users (CASCADE) ← company_id FK to companies
       └── All company-scoped data tables
```

**After this audit, all tables now have:**
1. Proper FK constraints with CASCADE/SET NULL
2. Company-scoped RLS policies (no more `true` policies)
3. Service role bypass for server-side operations
4. Search path security on all functions

### Team Invitation Flow (NEW)

```
1. Owner/Admin invites email via POST /api/team/invite
   ├── Validates plan allows team members (Business+)
   ├── Checks seat availability (max_seats from subscription_plans)
   ├── Creates team_invitations record (7-day TTL)
   └── Returns invitation token

2. Invited user signs up with that email
   └── During onboarding, calls POST /api/team/accept-invite with token
       ├── Validates token, expiration, email match
       ├── Updates user.company_id and user.role
       └── Marks invitation as accepted

3. Owner/Admin manages team via /team page
   ├── View members: GET /api/team/members
   ├── Remove member: POST /api/team/remove
   └── Cancel invite: POST /api/team/cancel-invite
```

### Subscription Plans Architecture

```
subscription_plans (global)
  ├── slug, name, description
  ├── price_monthly, price_annual
  ├── minutes_included, price_per_extra_minute
  ├── max_seats, extra_seat_price (NEW)
  ├── max_agents, max_concurrent_calls, max_call_duration (NEW)
  ├── stripe_product_id, stripe_price_id_monthly, stripe_price_id_annual
  └── features (JSONB array of feature strings)

company_subscriptions (per company)
  ├── plan_id → subscription_plans
  ├── billing_cycle (monthly/annual)
  ├── status (active/canceled/past_due/trialing)
  ├── overage_enabled, overage_budget, overage_spent
  └── stripe_subscription_id, stripe_customer_id
```

### CASCADE DELETE CHAIN (Updated)

When deleting a **company**:
```
companies
  ├── users (CASCADE)
  │    ├── notifications (CASCADE)
  │    ├── calendar_integrations (CASCADE) → calendar_sync_log (CASCADE)
  │    ├── cancellation_feedback (CASCADE)
  │    └── retention_offer_log (CASCADE)
  ├── contacts (CASCADE)
  ├── contact_lists (CASCADE)
  ├── call_logs (CASCADE)
  │    ├── voicemail_logs.call_id (CASCADE)
  │    ├── follow_up_queue.original_call_id (SET NULL)
  │    └── calendar_events.call_log_id (SET NULL)
  ├── agent_runs (CASCADE)
  │    ├── follow_up_queue.agent_run_id (CASCADE)
  │    ├── voicemail_logs.agent_run_id (SET NULL)
  │    └── calendar_events.agent_run_id (SET NULL)
  ├── company_agents (CASCADE)
  ├── company_settings (CASCADE)
  ├── company_subscriptions (CASCADE)
  │    ├── usage_tracking.subscription_id (SET NULL)
  │    ├── cancellation_feedback.subscription_id (SET NULL)
  │    └── retention_offer_log.subscription_id (SET NULL)
  ├── calendar_integrations (CASCADE) → calendar_sync_log (CASCADE)
  ├── calendar_events (CASCADE)
  ├── notifications (CASCADE)
  ├── ai_conversations (CASCADE) → ai_messages (CASCADE)
  ├── billing_events (CASCADE)
  ├── billing_history (CASCADE)
  ├── usage_tracking (CASCADE)
  ├── follow_up_queue (CASCADE)
  ├── voicemail_logs (CASCADE)
  ├── cancellation_feedback (CASCADE)
  ├── retention_offers (CASCADE)
  ├── retention_offer_log (CASCADE)
  ├── team_invitations (CASCADE) [NEW]
  └── call_queue (CASCADE)
```

### TABLES SUMMARY (Updated)

| Table | company_id FK | RLS | Service Bypass | Status |
|-------|:---:|:---:|:---:|:---:|
| users | CASCADE | YES | - | OK |
| companies | N/A | YES | YES | FIXED |
| contacts | CASCADE | YES | YES | FIXED |
| contact_lists | CASCADE | YES | YES | FIXED |
| call_logs | CASCADE | YES | YES | FIXED |
| agent_runs | CASCADE | YES | YES | FIXED |
| agent_templates | N/A (global) | N/A | - | OK |
| company_agents | CASCADE | YES | YES | FIXED |
| company_settings | CASCADE | YES | YES | FIXED |
| company_subscriptions | CASCADE | YES | - | OK |
| calendar_integrations | CASCADE | YES | - | OK |
| calendar_events | CASCADE | YES | - | OK |
| calendar_sync_log | CASCADE | YES | - | OK |
| ai_conversations | CASCADE | YES | - | OK |
| ai_messages | N/A (via conv) | YES | - | OK |
| notifications | CASCADE | YES | - | FIXED (prev) |
| follow_up_queue | CASCADE | YES | - | FIXED (prev) |
| voicemail_logs | CASCADE | YES | - | FIXED (prev) |
| billing_events | CASCADE | - | - | OK |
| billing_history | CASCADE | - | - | OK |
| usage_tracking | CASCADE | - | - | FIXED (FK) |
| stripe_events | N/A | YES | - | FIXED (prev) |
| subscription_plans | N/A (global) | N/A | - | FIXED (cols) |
| cancellation_feedback | CASCADE | YES | - | FIXED (prev) |
| retention_offers | CASCADE | YES | - | OK |
| retention_offer_log | CASCADE | YES | - | FIXED (prev) |
| admin_finances | N/A | YES | - | FIXED (prev) |
| team_invitations | CASCADE | YES | - | NEW |
| call_queue | CASCADE | - | - | FIXED (prev) |

---

## API SECURITY AUDIT (Updated)

| Endpoint | Auth | Company Check | Status |
|----------|:---:|:---:|:---:|
| GET /api/team/members | YES | YES | NEW |
| POST /api/team/invite | YES | YES + Plan + Seat | NEW |
| POST /api/team/remove | YES | YES + Role | NEW |
| POST /api/team/cancel-invite | YES | YES + Role | NEW |
| POST /api/team/accept-invite | YES | YES (email match) | NEW |
| POST /api/bland/send-call | YES | YES | FIXED |
| POST /api/billing/report-usage | YES (or service key) | YES | FIXED |
| GET /api/admin/finances | YES | YES (admin/owner) | FIXED |
| POST /api/webhooks/stripe | Signature | N/A | OK |
| POST /api/bland/webhook | NONE | N/A | NEEDS FIX |
| POST /api/billing/ensure-free-plan | YES | YES | OK |
| POST /api/billing/create-checkout-session | YES | YES (owner/admin) | OK |
| GET /api/billing/subscription | YES | YES | OK |
| POST /api/billing/change-plan | YES | YES | OK |
| POST /api/billing/check-usage-limit | YES | YES | OK |

---

## HOW TO APPLY

### 1. Run the SQL migration:
```bash
# Via Supabase CLI:
supabase db push

# Or paste contents of the migration file in Supabase SQL Editor
```

### 2. Enable Leaked Password Protection:
Go to Supabase Dashboard > Authentication > Settings > Enable "HaveIBeenPwned"

### 3. Update TypeScript types (optional but recommended):
```bash
supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
```

---

## RECOMMENDATIONS (Future Work)

1. **Implement user deletion endpoint** - Required for GDPR
2. **Add Bland AI webhook signature verification** - Critical security gap
3. **Encrypt API keys at rest** - `bland_api_key` and `openai_api_key` in `company_settings`
4. **Add rate limiting** to all public-facing API routes
5. **Send invitation emails** - Currently invitations are database-only; integrate with Supabase Auth invite or email service
6. **Add Stripe seat billing** - For Teams plan extra seats ($79/mo), integrate with Stripe subscription item
7. **Add `deleted_at` soft-delete** - For audit trail on user/company deletion
8. **Update TypeScript types** - Run `supabase gen types` to include new tables/columns
9. **Add invitation link to onboarding flow** - Check for pending invitations during signup
