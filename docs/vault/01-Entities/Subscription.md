---
tags: [entity, billing, stripe]
aliases: [Plan, Company Subscription]
---

# Subscription

Represents a company's active plan and billing relationship with [[Stripe Integration|Stripe]].

## Database Table: `company_subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| subscription_plan_id | UUID FK → subscription_plans | |
| stripe_customer_id | TEXT | |
| stripe_subscription_id | TEXT | |
| stripe_subscription_item_id | TEXT | For metered billing |
| status | TEXT CHECK | active, trialing, past_due, canceled, expired, incomplete, paused |
| billing_cycle | TEXT | monthly, annual |
| current_period_start | TIMESTAMPTZ | |
| current_period_end | TIMESTAMPTZ | |
| trial_end | TIMESTAMPTZ | |
| canceled_at | TIMESTAMPTZ | |

### Add-on Flags

| Column | Type | Notes |
|--------|------|-------|
| addon_dedicated_number | BOOLEAN | Default false |
| addon_recording_vault | BOOLEAN | Default false |
| addon_calls_booster | BOOLEAN | Default false |
| addon_calls_booster_count | INTEGER | Default 0 |

### Usage Tracking

| Column | Type |
|--------|------|
| minutes_used | INTEGER |
| minutes_included | INTEGER |
| calls_used | INTEGER |

## Subscription Plans: `subscription_plans`

| slug | price_monthly | minutes_included | max_concurrent | max_users |
|------|--------------|-----------------|----------------|-----------|
| free | $0 | 15 | 1 | 1 |
| starter | $99 | 300 | 2 | 1 |
| growth | $179 | 600 | 3 | 1 |
| business | $299 | 1,200 | 5 | 3 |
| teams | $649 | 2,250 | 10 | 5 |
| enterprise | $1,499 | 6,000 | ∞ | ∞ |

## Key Constraints

- **UNIQUE:** `(company_id, status)` WHERE status IN (active, trialing, incomplete) — prevents duplicate active subs
- **RLS:** SELECT by company members; UPDATE/INSERT restricted to owner/admin roles only

## Status Lifecycle

```
incomplete → active → canceled → expired
           → trialing → active
           → past_due → active (payment recovered)
                      → canceled (payment failed)
           → paused → active
```

## Related Notes

- [[Pricing Model]]
- [[Plan Features]]
- [[Stripe Integration]]
- [[Usage Tracking]]
- [[Add-on]]
- [[Company]]
