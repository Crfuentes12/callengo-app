# Billing System Audit Report — March 2026

> Comprehensive audit of Callengo's billing pipeline: Bland AI sub-accounts, Stripe integration, throttling, overage, and unit economics.

---

## Executive Summary

The billing system had **critical gaps** where plan limits were defined in config but **not enforced at runtime**. Bland AI sub-account lifecycle was partially implemented (column existed, management code didn't). Stripe webhooks handled subscriptions but missed credit allocation. This audit identifies 12 issues and implements fixes for the 8 highest-priority ones.

---

## Issues Found & Fixes Applied

### CRITICAL — Fixed

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| **C1** | **No pre-dispatch throttle checks** — `send-call/route.ts` dispatched calls to Bland without checking concurrent limits, daily caps, or usage limits | Companies could exceed plan limits indefinitely; Bland charges Callengo per minute regardless | Created `src/lib/billing/call-throttle.ts` with `checkCallAllowed()` — checks subscription status, concurrent calls, daily cap, hourly cap, minutes remaining, and overage budget before every call |
| **C2** | **Bland sub-account manager missing** — `bland_subaccount_id` column existed but no code created, funded, or managed sub-accounts | Sub-accounts never created; all calls used master API key (no isolation, shared billing) | Created `src/lib/bland/subaccount-manager.ts` — full lifecycle: create, allocate credits, reclaim, deactivate, upgrade pro-ration, cycle renewal |
| **C3** | **Stripe webhook didn't trigger Bland setup** — `checkout.session.completed` created the subscription but never provisioned Bland credits | New paying customers had no Bland credits; calls would fail or use master account balance | Added Bland sub-account creation + credit allocation in `handleCheckoutSessionCompleted` |
| **C4** | **No credit renewal on billing cycle** — `invoice.payment_succeeded` didn't replenish Bland credits | After month 1, companies had depleted credits with no refresh | Added `handleCycleRenewalCredits()` call in invoice.payment_succeeded handler |

### HIGH — Fixed

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| **H1** | **max_duration not plan-enforced** — Client could set `max_duration` up to 60min regardless of plan | Free users could make 60-min calls; Enterprise limit not applied | `getMaxCallDuration()` caps duration by plan; server overrides client value |
| **H2** | **No usage alerts** — Companies hit 100% usage with no warning | Surprise blocks, support tickets | Progressive alerts at 70%, 90%, 100% in `report-usage/route.ts` with `billing_events` logging |
| **H3** | **Missing DB indexes for throttle queries** — `call_logs` had no composite index on `(company_id, status, created_at)` | Concurrent call counting would be slow at scale | Migration adds 5 indexes for throttle, usage, and event queries |
| **H4** | **No subscription cancellation cleanup** — Bland credits not reclaimed on cancel | Unused credits left in sub-accounts after cancellation | Added `deactivateBlandSubAccount()` in `customer.subscription.deleted` handler |

### MEDIUM — Documented (Not Fixed)

| # | Issue | Recommendation |
|---|-------|---------------|
| **M1** | `rate-limit.ts` defined but not applied to billing endpoints | Apply `expensiveLimiter` to all `/api/billing/*` routes |
| **M2** | Exchange rates (EUR/GBP) hardcoded | Integrate a rates API or update weekly via cron |
| **M3** | Overage tracking edge cases on mid-period plan changes | Current pro-ration logic handles upgrade; downgrade needs manual review |
| **M4** | No automated tests in CI | Tests written (`src/__tests__/billing/`) but no CI pipeline configured |

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/lib/billing/call-throttle.ts` | Pre-dispatch throttle service (concurrent, daily, hourly, usage checks) |
| `src/lib/bland/subaccount-manager.ts` | Bland AI sub-account lifecycle manager |
| `src/__tests__/billing/credit-calculation.test.ts` | Unit tests for credit calculation and throttle logic |
| `supabase/migrations/20260320000001_billing_audit_fixes.sql` | DB migration: column, indexes, RPC function |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/api/bland/send-call/route.ts` | Added throttle checks before dispatch; enforced plan max_duration |
| `src/app/api/billing/report-usage/route.ts` | Added progressive usage alerts (70/90/100%) |
| `src/app/api/webhooks/stripe/route.ts` | Added Bland sub-account creation, credit allocation, cycle renewal, cancellation cleanup |

---

## Architecture: Call Dispatch Flow (After Audit)

```
Client → POST /api/bland/send-call
  │
  ├── 1. Auth check (Supabase RLS)
  ├── 2. Rate limit (IP-based)
  ├── 3. checkCallAllowed() ← NEW
  │     ├── Subscription active?
  │     ├── Concurrent calls < plan limit?
  │     ├── Daily calls < daily cap?
  │     ├── Hourly calls < hourly cap?
  │     ├── Minutes remaining (included + booster)?
  │     ├── Overage enabled & within budget?
  │     └── Returns: allowed/blocked + reason + upgrade suggestion
  ├── 4. Get company's Bland API key (sub-account)
  ├── 5. Cap max_duration by plan
  └── 6. Dispatch to Bland AI
```

## Architecture: Billing Cycle (After Audit)

```
Stripe webhook: invoice.payment_succeeded
  │
  ├── billing_reason = "subscription_cycle"?
  │     ├── Reclaim unused Bland credits from sub-account
  │     ├── Allocate fresh credits for new period
  │     └── Reset overage alert level
  │
  └── billing_reason = "subscription_create"?
        ├── Create Bland sub-account
        └── Allocate initial credits
```

---

## Unit Economics Validation

| Plan | Price | Minutes | Bland Cost | Gross Margin | Margin % |
|------|-------|---------|------------|-------------|----------|
| Starter | $99 | 300 | $33.00 | $66.00 | 66.7% |
| Growth | $179 | 600 | $66.00 | $113.00 | 63.1% |
| Business | $299 | 1,200 | $132.00 | $167.00 | 55.9% |
| Teams | $649 | 2,250 | $247.50 | $401.50 | 61.9% |
| Enterprise | $1,499 | 6,000 | $660.00 | $839.00 | 56.0% |

**Overage margins:**

| Plan | Overage Rate | Bland Cost | Overage Margin |
|------|-------------|------------|---------------|
| Starter | $0.29/min | $0.11/min | 62.1% |
| Growth | $0.26/min | $0.11/min | 57.7% |
| Business | $0.23/min | $0.11/min | 52.2% |
| Teams | $0.20/min | $0.11/min | 45.0% |
| Enterprise | $0.17/min | $0.11/min | 35.3% |

All plans maintain healthy margins (>35%). Enterprise overage is the tightest but acceptable given volume.

---

## SQL Migration Summary

`supabase/migrations/20260320000001_billing_audit_fixes.sql`:

1. `bland_api_key` column added to `company_settings`
2. `increment_usage_minutes()` RPC for atomic usage updates
3. Index: `call_logs(company_id, status, created_at)` — concurrent call counting
4. Index: `call_logs(company_id, created_at)` — daily/hourly call counting
5. Index: `stripe_events(type, processed)` — idempotency checks
6. Index: `usage_tracking(company_id, subscription_id, period_start, period_end)` — usage queries
7. Index: `billing_events(company_id, event_type, created_at)` — event queries

---

## Recommendations for Next Steps

1. **Apply rate limiting** to `/api/billing/*` and `/api/bland/*` endpoints
2. **Add CI pipeline** to run `src/__tests__/billing/` tests on every PR
3. **Monitor Bland credit balance** — add a daily cron that checks sub-account balances vs expected
4. **Dynamic exchange rates** — replace hardcoded EUR/GBP rates
5. **Downgrade flow** — handle credit adjustment when customer downgrades mid-period
6. **Alert delivery** — connect `billing_events` usage alerts to email/Slack notifications

---

*Generated: March 20, 2026*
