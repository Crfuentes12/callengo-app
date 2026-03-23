---
tags: [billing, usage, metering, overage, stripe, database]
aliases: [Usage Metering, Minute Tracking, Overage Tracking]
updated: 2026-03-23
---

# Usage Tracking

Usage tracking is the system that records how many minutes each company consumes per billing period, determines whether they have exceeded their plan allowance, manages overage billing through [[Stripe Integration]], and enforces call throttling to prevent abuse. The system spans three source files, one database table, one RPC function, and integrates with both [[Upstash Redis]] for real-time concurrency control and Stripe for metered billing.

---

## Database Schema

### `usage_tracking` Table

The primary table for tracking per-period minute consumption. One row exists per company per billing period.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique record identifier |
| `company_id` | `uuid` | FK -> `companies(id)` ON DELETE CASCADE, NOT NULL | The company this record belongs to |
| `subscription_id` | `uuid` | FK -> `company_subscriptions(id)` ON DELETE SET NULL | The subscription active during this period |
| `period_start` | `timestamptz` | NOT NULL | Start of the billing period |
| `period_end` | `timestamptz` | NOT NULL | End of the billing period |
| `minutes_used` | `numeric` | DEFAULT 0 | Total minutes consumed in this period (atomically incremented) |
| `minutes_included` | `numeric` | NOT NULL | Base plan minutes for this period (snapshot at period creation) |
| `overage_minutes` | `numeric` | -- | Computed as `max(0, minutes_used - minutes_included)` |
| `total_cost` | `numeric(10,2)` | DEFAULT 0 | Overage cost in USD (`overage_minutes * price_per_extra_minute`) |
| `created_at` | `timestamptz` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT now() | Last update timestamp (used for optimistic locking) |

Row Level Security ensures that each company can only read its own usage records. The `company_id` FK cascades on delete, so when a company is removed (or soft-deleted), its usage history is cleaned up.

### `billing_events` Table

An append-only audit log of all billing-related events. Every usage increment, overage trigger, Stripe report, and error is recorded here for reconciliation purposes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | FK -> `companies(id)` |
| `subscription_id` | `uuid` | FK -> `company_subscriptions(id)` |
| `event_type` | `text` | Type of event (see below) |
| `event_data` | `jsonb` | Structured event payload |
| `minutes_consumed` | `numeric` | Minutes associated with this event |
| `cost_usd` | `numeric(10,2)` | Dollar amount associated with this event |
| `created_at` | `timestamptz` | Event timestamp |

#### Event Types

| Event Type | Trigger | Data Fields |
|------------|---------|-------------|
| `usage_recorded` | Each call's minutes tracked | `call_id`, `minutes`, `total_minutes`, `overage_minutes` |
| `usage_tracking_failed` | Atomic increment RPC failed | `call_id`, `minutes`, `error`, `needs_reconciliation: true` |
| `stripe_usage_report_failed` | Stripe metered billing report failed | `overage_minutes`, `error`, `needs_reconciliation: true` |
| `overage_enabled` | Customer enables overage billing | `budget`, `price_per_minute` |
| `overage_disabled` | Customer disables overage billing | `plan_type` |
| `overage_budget_updated` | Customer changes overage budget | `old_budget`, `new_budget` |
| `payment_received` | Stripe invoice paid | `amount`, `invoice_id` |
| `payment_failed` | Stripe payment failed | `amount`, `invoice_id`, `error` |

### `billing_history` Table

Stores invoice records for display in the customer's billing settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | FK -> `companies(id)` |
| `amount` | `numeric(10,2)` | Invoice amount |
| `currency` | `text` | Currency code (USD, EUR, GBP) |
| `stripe_invoice_id` | `text` | Stripe invoice identifier |
| `invoice_url` | `text` | Stripe-hosted invoice URL |
| `payment_method` | `text` | Card brand and last 4 digits |
| `status` | `text` | Payment status |
| `created_at` | `timestamptz` | Invoice date |

---

## Atomic Increment via RPC

To prevent race conditions when multiple calls complete simultaneously (common during campaign dispatch), usage is incremented atomically using a two-tier strategy:

### Tier 1: Optimistic Locking

The primary method in `trackCallUsage()` uses optimistic locking on the `updated_at` column. The function reads the current usage record, calculates new values, and issues an UPDATE with a `WHERE updated_at = <original_value>` clause. If the row was modified between read and write (another webhook incremented it), the update returns zero rows and the function retries with exponential backoff (50ms, 100ms, 200ms) up to 3 attempts.

```
Attempt 0: Read usage -> Calculate -> UPDATE ... WHERE updated_at = '2026-03-23T10:00:00Z'
  If 0 rows: Wait 50ms
Attempt 1: Re-read usage -> Calculate -> UPDATE ... WHERE updated_at = '2026-03-23T10:00:01Z'
  If 0 rows: Wait 100ms
Attempt 2: Re-read usage -> Calculate -> UPDATE ... WHERE updated_at = '2026-03-23T10:00:01Z'
  If 0 rows: Wait 200ms
Attempt 3: Final try, same pattern
  If 0 rows: Fall back to Tier 2
```

### Tier 2: `atomic_increment_usage` RPC

If optimistic locking fails after all retries (highly unlikely but possible under extreme concurrent load), the system falls back to a PostgreSQL RPC function that performs an unconditional atomic increment:

```sql
CREATE OR REPLACE FUNCTION atomic_increment_usage(
  p_usage_id UUID,
  p_minutes NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE usage_tracking
  SET minutes_used = minutes_used + p_minutes,
      updated_at = NOW()
  WHERE id = p_usage_id;
END;
$$ LANGUAGE plpgsql;
```

This RPC uses the `supabaseAdminRaw` client (untyped, bypassing the generated Database type) and guarantees that usage is never lost, even if the overage cost recalculation is slightly stale.

### Tier 3: Billing Event Fallback

If even the RPC fails (database outage), a `usage_tracking_failed` billing event is inserted with `needs_reconciliation: true`. The [[Admin Command Center]] Reconciliation tab surfaces these events for manual review.

---

## Idempotency

The `trackCallUsage()` function implements call-level idempotency. If a `callId` is provided, the function queries `billing_events` for an existing `usage_recorded` event with that `call_id` in its `event_data`. If found, the function returns immediately without incrementing usage, preventing double-counting from webhook retries.

---

## Usage Check Flow

The `checkUsageLimit()` function in `src/lib/billing/usage-tracker.ts` performs a comprehensive pre-call check to determine whether a company can make another call. The check evaluates multiple conditions in sequence:

1. **Subscription existence:** Returns `allowed: false` with reason "No active subscription" if no subscription is found for the company.

2. **Subscription status:** Only `active` and `trialing` statuses are allowed. Any other status (`past_due`, `canceled`, `expired`, `incomplete`) blocks calls.

3. **Period expiration:** If `current_period_end` is in the past, the subscription is transitioned to `expired` status via an idempotent UPDATE (`WHERE status = 'active'` prevents race conditions) and calls are blocked.

4. **Calls Booster calculation:** Active `calls_booster` add-ons are queried from `company_addons` and their minutes are added to the base plan allowance: `effective_minutes = plan_minutes + sum(booster_quantity * 225)`.

5. **Within included minutes:** If `minutes_used < minutes_included` (including booster minutes), the call is allowed.

6. **Free plan hard block:** If the plan slug is `free` and included minutes are exhausted, calls are blocked with "Trial minutes exhausted. Please upgrade to a paid plan to continue making calls."

7. **Overage disabled:** If `overage_enabled` is false on the subscription, calls are blocked with "Monthly minutes exceeded and overage is disabled."

8. **Overage budget check:** If an `overage_budget` is set and the current overage cost exceeds it, calls are blocked with "Overage budget exceeded."

9. **All checks passed:** Call is allowed (paid plan with overage within budget).

The function returns a `UsageCheckResult` object containing the `allowed` boolean, an optional `reason` string, current usage statistics, and subscription state.

---

## Notification Thresholds

Database triggers fire notifications when usage crosses percentage thresholds of the included minutes:

| Threshold | Alert Level | Trigger Name | Action |
|:---------:|:-----------:|--------------|--------|
| **80%** | Warning | `notify_minutes_limit` | In-app notification and email to account owner |
| **90%** | Critical | `notify_minutes_limit` | Prominent banner in dashboard, email notification |
| **100%** | Exceeded | `notify_minutes_limit` | Dashboard blocked state (if overage disabled), urgent notification |

The notification system works in conjunction with the `overage_alert_level` field on `company_subscriptions`, which is reset to 0 at the start of each billing period by `resetUsageForNewPeriod()`.

---

## Overage Management

The overage system is implemented in `src/lib/billing/overage-manager.ts` and provides four operations:

### `enableOverage({ companyId, budget? })`

Enables metered overage billing for a paid plan subscription. The flow:

1. Validates that the plan is not Free (raises an error if so).
2. Looks up or creates a Stripe metered price for the plan's overage rate using `createMeteredPrice()`.
3. Stores the `stripe_metered_price_id` on the `subscription_plans` record.
4. Adds the metered price as a new item on the existing Stripe subscription (with `proration_behavior: 'none'`).
5. Stores the `stripe_subscription_item_id` on `company_subscriptions`.
6. Sets `overage_enabled = true` and optionally sets the `overage_budget`.
7. Logs an `overage_enabled` billing event.

### `disableOverage(companyId)`

Removes the metered billing item from the Stripe subscription and resets overage tracking:

1. Removes the metered item from the Stripe subscription.
2. Sets `overage_enabled = false`, `overage_budget = 0`, `overage_spent = 0`, `stripe_subscription_item_id = null`.
3. Resets alert tracking (`last_overage_alert_at = null`, `overage_alert_level = 0`).
4. Logs an `overage_disabled` billing event.

### `updateOverageBudget({ companyId, budget })`

Updates the overage budget cap without modifying the Stripe subscription. Logs an `overage_budget_updated` event with old and new budget values.

### `syncAllMeteredUsage()`

Periodic reconciliation function (intended for daily cron execution) that ensures Stripe has accurate usage data for all subscriptions with overage enabled. Processes in pages of 50 subscriptions to avoid timeouts. For each subscription:

1. Reads the latest `usage_tracking` record.
2. Calculates overage minutes (`minutes_used - minutes_included`).
3. Reports to Stripe via `reportUsage()` with `action: 'set'` (idempotent set, not increment).
4. Updates `company_subscriptions.overage_spent` with the calculated overage cost.

---

## Stripe Usage Reporting

Usage is reported to Stripe in two ways:

### Per-Call Reporting (Real-Time)

In `trackCallUsage()`, after each call's minutes are tracked, if overage exists and the subscription has a `stripe_subscription_item_id`, the total overage minutes are reported to Stripe using `action: 'set'`. Using `set` (not `increment`) is critical because:

- Webhook retries would cause double-counting with `increment`.
- The `syncAllMeteredUsage()` reconciliation also uses `set`.
- Both converge to the same correct value.

If the Stripe report fails, a `stripe_usage_report_failed` billing event is logged with `needs_reconciliation: true`.

### Periodic Sync (Reconciliation)

The `syncAllMeteredUsage()` function serves as the authoritative reconciliation point. It re-reads all usage tracking records and sets the Stripe metered quantity to the correct total, correcting any drift from failed per-call reports.

---

## Call Throttle (Pre-Dispatch Enforcement)

The `src/lib/billing/call-throttle.ts` module (346 lines) enforces all call limits before a call is dispatched to [[Bland AI]]. The `checkCallAllowed()` function performs a six-step validation:

### Step 1: Subscription Validation
Verifies the company has an active or trialing subscription. Checks `current_period_end` for expiration.

### Step 2: Redis Capacity Check
Calls `checkCallCapacity()` from [[Upstash Redis]] to verify global and per-company limits:
- Global concurrent calls vs. Bland plan limit (with 90% safety margin)
- Company concurrent calls vs. plan's `maxConcurrentCalls`
- Global daily calls vs. Bland plan daily cap
- Global hourly calls vs. Bland plan hourly cap
- Per-company daily calls vs. company daily soft cap
- Per-company hourly calls vs. company hourly cap
- Contact cooldown (5-minute gap between calls to the same contact)

### Step 3: DB Concurrent Fallback
If Redis is unavailable, falls back to counting active calls from the `call_logs` table (status `in_progress`, `ringing`, or `queued` within the last 30 minutes).

### Step 4: DB Daily Cap Check
Double-checks the daily call count against the database for consistency with Redis.

### Step 5: Hourly Cap Check
Verifies hourly call count against plan-specific hourly caps.

### Step 6: Minutes Available Check
Calls `checkMinutesAvailable()` to verify usage limits, including Calls Booster add-on minutes.

### Daily Soft Caps

These caps limit the number of calls a company can dispatch per day to ensure fair resource distribution:

| Plan | Daily Soft Cap | Hourly Cap |
|------|:--------------:|:----------:|
| Free | 10 | 5 |
| Starter | 10 | 15 |
| Growth | 20 | 25 |
| Business | 40 | 50 |
| Teams | 75 | 100 |
| Enterprise | 500 | 200 |

### `getMaxCallDuration(planSlug)`

Returns the maximum call duration in minutes for a given plan. Maps `-1` (unlimited) to 600 minutes as a practical ceiling. This value is passed as the `max_duration` parameter in the [[Bland AI]] dispatch payload.

---

## Billing Period Reset

When a new billing period starts (triggered by Stripe subscription renewal webhook), `resetUsageForNewPeriod()` performs:

1. Reads the company's subscription and plan details.
2. Checks for an existing usage record for the new period (prevents duplicates via idempotent check).
3. Creates a new `usage_tracking` record with `minutes_used = 0` and `minutes_included` from the plan.
4. Resets overage tracking on the subscription: `overage_spent = 0`, `last_overage_alert_at = null`, `overage_alert_level = 0`.

---

## Source Files

| File | Lines | Purpose |
|------|:-----:|---------|
| `src/lib/billing/usage-tracker.ts` | ~540 | Usage tracking, limit checking, period reset, stats retrieval |
| `src/lib/billing/overage-manager.ts` | ~327 | Overage enable/disable, budget management, Stripe sync |
| `src/lib/billing/call-throttle.ts` | ~346 | Pre-dispatch throttling with Redis and DB fallback |

---

## Related Notes

- [[Pricing Model]] -- plan tiers, overage rates, and unit economics
- [[Plan Features]] -- feature gating matrix including concurrent limits and call durations
- [[Stripe Integration]] -- payment processing and metered billing
- [[Call Processing Flow]] -- how usage is tracked after each call completes
- [[Campaign Dispatch Flow]] -- where throttle checks are applied before dispatch
- [[Upstash Redis]] -- concurrent call tracking and rate limiting
- [[Admin Command Center]] -- reconciliation tab for detecting usage discrepancies
- [[Subscription]] -- subscription lifecycle and status transitions
