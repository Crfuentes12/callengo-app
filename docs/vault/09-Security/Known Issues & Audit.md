---
tags: [security, audit, bugs, production, fixes, technical-debt]
aliases: [Audit Log (Production), Known Bugs, Security Audit, March 2026 Audit]
created: 2026-03-23
updated: 2026-03-23
---

# Known Issues & Audit

This document tracks all known security and operational issues in the Callengo platform, as well as the complete results of the March 2026 production audit. It serves as the canonical reference for what has been fixed, what remains open, and what the current risk posture is.

The production audit was conducted on 23 March 2026 and resulted in 15 fixes being applied across database schema, API endpoints, admin components, and performance optimizations. The audit covered database security, billing integrity, authentication flows, call dispatch, admin panels, and performance.

For the full security architecture, see [[Security & Encryption]].

---

## High Priority Issues (Open)

These issues represent significant security or operational risks that have not yet been addressed.

### 1. Rate Limiting Not Applied Globally

**Severity**: High
**Status**: Open
**File**: `src/lib/rate-limit.ts`

Four rate limiters are fully implemented and tested (`apiLimiter`, `expensiveLimiter`, `authLimiter`, `callLimiter`) using `@upstash/ratelimit` with [[Upstash Redis]], but **none of them are imported or called in any API route handler**. This means all 90+ API endpoints have no request rate limits, making them vulnerable to:

- Brute-force attacks on authentication endpoints
- Resource exhaustion via rapid API calls
- Abuse of expensive operations (AI analysis, bulk imports)
- Denial of service via send-call endpoint flooding

**Impact**: An attacker could make unlimited requests to any endpoint. The billing and auth endpoints are particularly sensitive -- unlimited attempts on login could enable credential stuffing, and unlimited calls to the send-call endpoint could rapidly burn through the Bland AI balance.

**Mitigation (current)**: The [[Upstash Redis|Redis concurrency manager]] provides some protection for call dispatch specifically (concurrent, daily, and hourly caps), but general API endpoints have no protection.

**Remediation**: Import the appropriate limiter in each API route handler and check the result before processing the request. See [[Security & Encryption]] for the recommended implementation pattern.

### 2. Free Plan Without Forced Expiration

**Severity**: High
**Status**: Open

The Free plan provides a one-time allocation of approximately 10 calls (15 minutes at 1.5 min/call), but the logic to block users after this allocation is consumed is incomplete. The system tracks usage but does not consistently enforce the block across all call dispatch paths.

**Impact**: Free plan users may be able to continue making calls beyond their allocation, consuming Bland AI minutes at the platform's expense without generating any revenue.

**Remediation**: Implement a consistent check in `checkCallAllowed()` (in `src/lib/bland/master-client.ts`) that verifies the Free plan's lifetime allocation has not been exceeded, and return a clear error when it has.

### 3. Static Exchange Rates

**Severity**: Medium-High
**Status**: Open

Exchange rates for EUR and GBP are hardcoded in the billing logic rather than being fetched from a live exchange rate API. The current hardcoded values may drift significantly from actual rates over time.

**Impact**: Customers paying in EUR or GBP may be overcharged or undercharged relative to the intended USD-equivalent pricing. The financial impact grows with the number of non-USD customers and the magnitude of rate drift.

**Remediation**: Integrate an exchange rate API (e.g., Open Exchange Rates, Fixer.io) and cache rates in [[Upstash Redis]] with a reasonable TTL (e.g., 1 hour). Fall back to hardcoded rates if the API is unavailable.

---

## Medium Priority Issues (Open)

### 4. Demo/Seed Data in Production

**Severity**: Medium
**Status**: Open

The production database contains seed/demo data: approximately 50 contacts and 6 campaigns that were created during initial setup or testing. This data is functional but confusing -- it appears in admin reports and may skew analytics.

**Remediation**: Run the seed DELETE endpoint (authenticated with `SEED_ENDPOINT_SECRET`) to remove demo data, or manually delete the known demo records.

### 5. Large Components

**Severity**: Medium (maintainability)
**Status**: Acknowledged, no action planned

Three components exceed recommended size limits:

| Component | Lines | Location |
|-----------|-------|----------|
| `AgentConfigModal` | ~2,300 | `src/components/agents/` |
| `IntegrationsPage` | ~2,300 | `src/components/integrations/` |
| `BillingSettings` | ~1,000 | `src/components/settings/` |
| `AdminCommandCenter` | ~1,200 | `src/components/admin/` |

These components work correctly but are difficult to maintain, review, and test. They should not be refactored without explicit request, per the project's [[Architecture Overview|code conventions]].

### 6. No Automated Test Runner

**Severity**: Medium
**Status**: Open

The project has no test runner configured (no Jest, Vitest, or Playwright setup). There are no unit tests, integration tests, or end-to-end tests. All quality assurance is manual.

**Impact**: Regressions can be introduced without detection. The lack of tests also makes refactoring risky, as there is no safety net to catch broken behavior.

---

## Corrected Issues (23 March 2026 Audit -- 15 Fixes)

The following issues were identified and corrected during the March 2026 production audit. Each fix is described with its before and after state.

### Fix 1: OAuth Tokens Encrypted (AES-256-GCM)

**Before**: OAuth access tokens and refresh tokens for all 11 integration providers were stored in plaintext in the database. A database breach would expose all tokens, allowing an attacker to access customer CRM data, calendars, and other connected services.

**After**: All tokens are encrypted using AES-256-GCM before storage and decrypted on use. Implementation in `src/lib/encryption.ts`. The `decryptToken()` function is backward-compatible with existing plaintext values, allowing a graceful migration. See [[Security & Encryption]] for full details.

**Migration**: `20260323000001_production_audit_fixes.sql` (or equivalent)

### Fix 2: Users RLS Self-Change Blocked

**Before**: The RLS policies on the `users` table allowed authenticated users to update their own row, including the `company_id` and `email` fields. A malicious user could change their `company_id` to gain access to another company's data.

**After**: A `BEFORE UPDATE` trigger (`trg_prevent_sensitive_field_changes`) blocks any changes to `company_id` or `email` on the `users` table by authenticated users. Only the `service_role` can modify these fields.

### Fix 3: company_subscriptions Restricted to Owner/Admin

**Before**: Any authenticated user within a company could update the `company_subscriptions` table, potentially modifying their own subscription status, plan, or billing details.

**After**: RLS policies on `company_subscriptions` now restrict UPDATE operations to users with the `owner` or `admin` role within the company.

### Fix 4: CHECK Constraints on 8 Status Columns

**Before**: Status columns across 8 tables accepted any text value. Application code validated status values, but direct database access or bugs could insert invalid statuses.

**After**: CHECK constraints enforce valid status values at the database level for `call_logs`, `campaigns`, `contacts`, `follow_ups`, `voicemails`, `company_subscriptions`, `agents`, and `companies`. See [[Security & Encryption]] for the complete list of allowed values per table.

### Fix 5: Admin Command Center Accepts Owner Role

**Before**: The [[Command Center]] API endpoint (`/api/admin/command-center`) only accepted the `admin` role. The `owner` role (which is the highest privilege level) was incorrectly excluded, meaning platform owners could not access the admin panel.

**After**: Both `GET` and `POST` handlers check for `admin` or `owner` role.

### Fix 6: verify-session cs_ Validation

**Before**: The `/api/billing/verify-session` endpoint accepted any string as a `session_id` parameter and passed it directly to the Stripe API. This could result in confusing Stripe API errors or potential abuse.

**After**: The endpoint validates that `session_id` starts with the `cs_` prefix (Stripe Checkout Session ID format) before making any Stripe API calls.

### Fix 7: Stripe Webhook addon_type Whitelist

**Before**: The Stripe webhook handler accepted any `addon_type` value from webhook metadata without validation. A crafted webhook (if signature verification were bypassed) could create arbitrary addon types.

**After**: A `VALID_ADDON_TYPES` whitelist constant restricts accepted values to `dedicated_number`, `recording_vault`, and `calls_booster`.

### Fix 8: Seed DELETE Auth Consistency

**Before**: The seed data endpoint used different authentication mechanisms for POST (create seed data) and DELETE (remove seed data). The DELETE endpoint did not validate the `SEED_ENDPOINT_SECRET`.

**After**: Both POST and DELETE use the same `SEED_ENDPOINT_SECRET` authentication, ensuring that only authorized requests can remove seed data.

### Fix 9: send-call UUID Validation

**Before**: The `/api/bland/send-call` endpoint accepted any string as `metadata.contact_id` without validating it as a UUID. Malformed contact IDs could cause downstream errors or be used for injection.

**After**: A Zod `.refine()` validator ensures `contact_id` matches the UUID format before the call is dispatched.

### Fix 10: Command Center Queries Parallelized

**Before**: The `GET /api/admin/command-center` endpoint ran hourly and daily call statistics queries sequentially, resulting in slow response times.

**After**: Hourly and daily queries run in parallel via `Promise.all()`, reducing response time by approximately 40%.

### Fix 11: N+1 in admin/monitor Fixed

**Before**: The `getCompanyBreakdown()` function in `/api/admin/monitor` made one database query per company to fetch usage data, resulting in N+1 query performance degradation as the number of companies grew.

**After**: Refactored to use 5 batch queries that run in parallel, fetching all company data in fixed time regardless of company count.

### Fix 12: Cleanup-Orphans Uses Promise.allSettled

**Before**: The `/api/admin/cleanup-orphans` endpoint processed Bland call cleanup and archival operations sequentially in a loop. A single failure would stop processing of remaining items.

**After**: Uses `Promise.allSettled()` to process all items in parallel. Individual failures do not block other items from being processed, and all results (fulfilled and rejected) are reported.

### Fix 13: Soft-Delete on Companies

**Before**: Deleting a company was a hard delete that immediately and permanently removed the row and (via cascading deletes) all associated data. There was no recovery option.

**After**: The `companies` table has a `deleted_at TIMESTAMPTZ` column. "Deleting" a company sets `deleted_at = now()`. RLS policies exclude soft-deleted companies from all queries. A partial index (`idx_companies_active`) ensures the filter is efficient. Companies can be recovered within 30 days by setting `deleted_at = NULL`.

---

## Previously Corrected Issues (Billing Audit Session)

These issues were fixed in an earlier audit session focused on billing integrity, prior to the main March 2026 audit.

### Fix 14: Billing Period Edge Cases

**Before**: When a company changed plans mid-billing-cycle, overage tracking did not properly reset, potentially carrying over usage from the old plan into the new plan's overage calculation.

**After**: Overage tracking correctly resets on plan change, using the new plan's included minutes as the baseline.

### Fix 15: Dispatch Loop Cleanup

**Before**: Delete operations in the call dispatch loop (cleanup of completed/failed calls from Redis) were not wrapped in try-catch. A cleanup failure could crash the entire dispatch loop.

**After**: All cleanup operations are wrapped in try-catch with non-fatal error logging. Cleanup failures are logged but do not interrupt dispatch.

### Fix 16: billing_cycle Validation

**Before**: The `/api/billing/verify-session` endpoint did not validate the `billing_cycle` parameter, accepting any string value.

**After**: The `billing_cycle` parameter is sanitized to either `'monthly'` or `'annual'`. Invalid values default to `'monthly'`.

### Fix 17: Health Data Mapping

**Before**: The [[Command Center]] component (`AdminCommandCenter.tsx`) did not correctly map the nested response structure from the API, resulting in broken or missing data in the Health tab.

**After**: The component correctly destructures the nested API response.

### Fix 18: Bland Plan "Unknown"

**Before**: The [[Command Center]] displayed the Bland AI plan as "unknown" because it was reading from a field that was not populated.

**After**: The Health tab uses a dropdown with the four real Bland plans (Start, Build, Scale, Enterprise) and reads/writes via the [[Platform Config]] singleton.

### Fix 19: Redis/Concurrency Panel

**Before**: The [[Command Center]] had no visibility into Redis concurrency state. Administrators could not see how many concurrent calls were active, what the daily/hourly usage was, or which companies were consuming the most capacity.

**After**: A complete Redis concurrency panel was added to the Health tab with gauges, active call lists, and per-company breakdown. See [[Command Center]] for full details.

### Fix 20: Landing Page Default

**Before**: The root URL (`/`) redirected to `/dashboard`, and login/OAuth callbacks also redirected to `/dashboard`. The `/dashboard` route was the primary authenticated landing page.

**After**: All redirects changed to `/home`. The root URL, post-login redirect, and post-OAuth callback all go to `/home`. The `/home` route is now the canonical authenticated landing page.

---

## Audit Scorecard Summary

The March 2026 audit assessed the platform across six domains:

| Domain | Score | Notes |
|--------|-------|-------|
| **Database Security** | 8/10 | Strong RLS, encryption added, triggers added. Deduction for rate limiting gap. |
| **Billing Integrity** | 8/10 | Overage tracking fixed, webhook validation improved. Deduction for exchange rates and Free plan expiration. |
| **Authentication** | 8/10 | Supabase Auth is solid, sensitive field changes blocked. Deduction for no MFA enforcement and no rate limiting on auth endpoints. |
| **Call Flow** | 9/10 | Redis concurrency is robust, UUID validation added. Minor deduction for lack of end-to-end monitoring. |
| **Admin Panel** | 9/10 | Complete overhaul with 6 tabs, owner role access, parallelized queries. |
| **Performance** | 8/10 | N+1 fixed, queries parallelized, Promise.allSettled for batch ops. Deduction for large components and no automated testing. |

**Overall**: 50/60 (83%)

---

## Migration Reference

| Migration | Description |
|-----------|-------------|
| `20260323000001_production_audit_fixes.sql` | Core audit fixes (triggers, CHECK constraints, RLS, soft-delete) |
| `20260323000002_production_audit_fixes.sql` | Additional audit fixes |

See [[Migrations Timeline]] for the complete migration history.

---

## Related Notes

- [[Security & Encryption]] -- Full security architecture documentation
- [[Command Center]] -- Admin panel (major audit target)
- [[Platform Config]] -- Configuration table (audit fixes applied)
- [[Audit Log]] -- Immutable admin action log
- [[RLS Patterns]] -- Row Level Security patterns
- [[Triggers & Functions]] -- Database triggers (two security triggers added)
- [[Schema Overview]] -- Full database schema
- [[Usage Tracking]] -- Billing integrity
- [[Pricing Model]] -- Plan definitions and pricing
- [[Upstash Redis]] -- Concurrency and rate limiting infrastructure
