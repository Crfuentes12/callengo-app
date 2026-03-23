---
tags: [entity, billing, stripe, subscription, plan]
aliases: [Plan, Company Subscription, company_subscriptions, subscription_plans]
---

# Subscription

Represents a company's active plan and billing relationship with [[Stripe Integration|Stripe]]. Every [[Company]] has exactly one active subscription record in `company_subscriptions`, linked to a plan definition in `subscription_plans`. The subscription controls what features the company can access, how many minutes/calls they can make, and how many users/agents they can have.

---

## Database Table: `company_subscriptions`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete. **UNIQUE** |
| `plan_id` | UUID FK → `subscription_plans` | — | NO | Current plan |
| `billing_cycle` | TEXT | — | NO | `monthly` or `annual` |
| `status` | TEXT CHECK | `'active'` | NO | See statuses below |
| `current_period_start` | TIMESTAMPTZ | `now()` | YES | Billing period start |
| `current_period_end` | TIMESTAMPTZ | — | NO | Billing period end |
| `cancel_at_period_end` | BOOLEAN | `false` | YES | Cancel at end of period |
| `trial_end` | TIMESTAMPTZ | — | YES | Trial expiration date |
| `extra_users` | INTEGER | `0` | YES | Additional user seats purchased |
| `stripe_subscription_id` | TEXT (UNIQUE) | — | YES | Stripe subscription ID |
| `stripe_customer_id` | TEXT | — | YES | Stripe customer ID |
| `stripe_subscription_item_id` | TEXT | — | YES | For metered billing (overage) |
| `overage_enabled` | BOOLEAN | `false` | YES | Allow usage beyond included minutes |
| `overage_budget` | NUMERIC | `0` | YES | Max overage spend per period (USD) |
| `overage_spent` | NUMERIC | `0` | YES | Current period overage spent |
| `last_overage_alert_at` | TIMESTAMPTZ | — | YES | Last overage alert timestamp |
| `overage_alert_level` | INTEGER | `0` | YES | Alert threshold reached (0-3) |
| `addon_dedicated_number` | BOOLEAN | `false` | YES | Has dedicated number [[Add-on]] |
| `addon_recording_vault` | BOOLEAN | `false` | YES | Has recording vault [[Add-on]] |
| `addon_calls_booster` | BOOLEAN | `false` | YES | Has calls booster [[Add-on]] |
| `addon_calls_booster_count` | INTEGER | `0` | YES | Number of booster add-ons |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |
| `updated_at` | TIMESTAMPTZ | `now()` | YES | |

### Subscription Statuses

| Status | Meaning |
|--------|---------|
| `active` | Subscription is active and paid |
| `trialing` | In free trial period |
| `past_due` | Payment failed, grace period |
| `canceled` | Subscription cancelled |
| `expired` | Past end of period after cancellation |
| `incomplete` | Checkout started but not completed |
| `paused` | Temporarily paused |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_company_subscriptions_company_id` | `company_id` | Company lookup |
| `idx_company_subscriptions_status` | `status` | Status filtering |
| `idx_company_subscriptions_stripe_subscription_id` | `stripe_subscription_id` | Stripe webhook lookup |
| `idx_company_subscriptions_stripe_customer_id` | `stripe_customer_id` | Customer lookup |
| `idx_company_subscriptions_stripe_subscription_item_id` | `stripe_subscription_item_id` | Metered billing |
| `idx_company_subscriptions_plan_id` | `plan_id` | Plan distribution queries |
| `idx_company_subscriptions_company_status` | `(company_id, status)` | Active sub lookup |

### RLS Policies

- `company_subscriptions_select` — Company-scoped SELECT
- `company_subscriptions_update` — Company-scoped UPDATE (owner/admin only since audit fix)

### Trigger

- `update_company_subscriptions_updated_at` — Auto-update timestamp

---

## Subscription Plans: `subscription_plans`

The plan catalog. Six plans from Free to Enterprise.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `name` | TEXT (UNIQUE) | — | Display name |
| `slug` | TEXT (UNIQUE) | — | URL identifier: `free`, `starter`, `growth`, `business`, `teams`, `enterprise` |
| `description` | TEXT | — | Marketing description |
| `price_monthly` | NUMERIC | — | Monthly price (USD) |
| `price_annual` | NUMERIC | — | Annual price (USD, per month equivalent) |
| `minutes_included` | INTEGER | — | Minutes included per period |
| `calls_included` | INTEGER | `0` | Estimated calls (display only) |
| `max_call_duration` | INTEGER | `10` | Max duration per call (minutes) |
| `price_per_extra_minute` | NUMERIC | — | Overage rate per minute |
| `max_users` | INTEGER | `1` | Base user seats |
| `max_seats` | INTEGER | `1` | Alias for max_users |
| `price_per_extra_user` | NUMERIC | `0` | Extra seat cost |
| `extra_seat_price` | NUMERIC | — | Alias for extra user cost |
| `max_agents` | INTEGER | `1` | Max agent instances |
| `max_concurrent_calls` | INTEGER | `1` | Concurrent call limit |
| `max_calls_per_hour` | INTEGER | — | Hourly call cap |
| `max_calls_per_day` | INTEGER | — | Daily call cap |
| `max_follow_up_attempts` | INTEGER | `0` | Follow-up retry limit |
| `auto_overage_default` | BOOLEAN | `false` | Default overage enablement |
| `features` | JSONB | `[]` | Feature flags |
| `is_active` | BOOLEAN | `true` | Active plan flag |
| `display_order` | INTEGER | `0` | UI ordering |
| `stripe_product_id` | TEXT | — | Stripe product reference |
| `stripe_price_id_monthly` | TEXT | — | Stripe monthly price |
| `stripe_price_id_annual` | TEXT | — | Stripe annual price |
| `stripe_metered_price_id` | TEXT | — | Stripe metered price (overage) |

### Plan Summary

| Slug | Monthly | Annual/mo | Minutes | Calls est. | Concurrent | Users | Overage/min |
|------|---------|-----------|---------|-----------|-----------|-------|-------------|
| `free` | $0 | — | 15 (one-time) | ~10 | 1 | 1 | Blocked |
| `starter` | $99 | $87 | 300 | ~200 | 2 | 1 | $0.29 |
| `growth` | $179 | $157 | 600 | ~400 | 3 | 1 | $0.26 |
| `business` | $299 | $263 | 1,200 | ~800 | 5 | 3 | $0.23 |
| `teams` | $649 | $571 | 2,250 | ~1,500 | 10 | 5 | $0.20 |
| `enterprise` | $1,499 | $1,319 | 6,000 | ~4,000+ | ∞ | ∞ | $0.17 |

**RLS:** `subscription_plans_select` — All authenticated users can SELECT plans where `is_active = true`.

---

## Status Lifecycle

```
incomplete → active → canceled → expired
           → trialing → active (payment succeeds)
                      → canceled (trial expires without payment)
           → past_due → active (payment recovered)
                      → canceled (payment irrecoverable)
           → paused → active (resumed)
```

Stripe webhooks drive status transitions: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.

---

## Overage Tracking

When a company exceeds their included minutes, overage billing kicks in:

1. Call completes → `atomic_increment_usage()` increments `minutes_used` in [[Usage Tracking]]
2. If `minutes_used > minutes_included` AND `overage_enabled = true`:
   - Calculate overage minutes
   - Check against `overage_budget`
   - Report to Stripe via `reportUsage()` (metered billing)
   - Track in `overage_spent`
3. If `overage_enabled = false`: block further calls (Free plan always blocks)

---

## Related Notes

- [[Company]] — Each company has one subscription
- [[Pricing Model]] — V4 pricing details
- [[Plan Features]] — Feature matrix by plan
- [[Usage Tracking]] — Minute consumption tracking
- [[Stripe Integration]] — Payment processing
- [[Add-on]] — Subscription add-ons
- [[Billing API]] — API endpoints
