---
tags: [billing, usage, metering]
---

# Usage Tracking

Tracks minute and call consumption per billing period for [[Subscription|overage billing]].

## Database Table: `usage_tracking`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| subscription_id | UUID FK → company_subscriptions | |
| period_start | TIMESTAMPTZ | Billing period start |
| period_end | TIMESTAMPTZ | Billing period end |
| minutes_used | NUMERIC | Atomically incremented |
| minutes_included | NUMERIC | From plan |
| calls_used | INTEGER | |
| overage_minutes | NUMERIC | minutes_used - minutes_included (if > 0) |
| overage_cost | NUMERIC(10,2) | overage_minutes × plan overage rate |

## Atomic Increment

Usage is tracked atomically via RPC functions to prevent race conditions:

```sql
-- increment_usage_minutes(company_uuid, minutes_int)
UPDATE usage_tracking
SET minutes_used = minutes_used + minutes_int
WHERE company_id = company_uuid
  AND period_start <= NOW()
  AND period_end >= NOW();
```

## Overage Flow

1. Call completes → webhook records `duration_seconds`
2. Usage tracker increments `minutes_used` atomically
3. If `minutes_used > minutes_included`:
   - Overage minutes calculated
   - Reported to Stripe via metered billing API
   - Charged on next invoice

## Notification Thresholds

Database triggers fire [[Notification]]s at:
- **80%** — `minutes_warning`
- **90%** — `minutes_critical`
- **100%** — `minutes_exceeded`

## Source Files

- Usage tracker: `src/lib/billing/usage-tracker.ts`
- Overage manager: `src/lib/billing/overage-manager.ts`
- Call throttle: `src/lib/billing/call-throttle.ts`

## Related Notes

- [[Pricing Model]]
- [[Stripe Integration]]
- [[Billing API]]
- [[Call Processing Flow]]
