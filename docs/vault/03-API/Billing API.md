---
tags: [api, billing, stripe]
---

# Billing API

13 endpoints for plan management, checkout, and usage tracking.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/plans` | List all subscription plans |
| GET | `/api/billing/subscription` | Get current company subscription |
| POST | `/api/billing/create-checkout` | Create Stripe Checkout session for plan purchase |
| GET | `/api/billing/verify-session` | Verify Stripe Checkout completion (validates `cs_` prefix) |
| POST | `/api/billing/create-portal` | Create Stripe Customer Portal session |
| GET | `/api/billing/usage` | Get current period usage (minutes, calls, overage) |
| POST | `/api/billing/report-usage` | Report metered usage to Stripe |
| GET | `/api/billing/history` | Get billing history (payments, overages, credits) |
| GET | `/api/billing/invoices` | Get Stripe invoices |
| POST | `/api/billing/change-plan` | Change subscription plan (upgrade/downgrade) |
| POST | `/api/billing/cancel` | Cancel subscription |
| POST | `/api/billing/resume` | Resume paused subscription |
| POST | `/api/billing/addons` | Purchase/manage add-ons |

## Stripe Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/stripe` | Process Stripe webhook events |

### Handled Events
- `checkout.session.completed` — Activate subscription
- `invoice.paid` — Record payment
- `invoice.payment_failed` — Mark past_due
- `customer.subscription.updated` — Sync status changes
- `customer.subscription.deleted` — Mark canceled

Idempotency via `stripe_events` table.

## Key Implementation Details

- **verify-session:** Validates session_id starts with `cs_` prefix (security fix)
- **billing_cycle:** Sanitized to `'monthly'` or `'annual'` only
- **addon_type:** Whitelist validation via `VALID_ADDON_TYPES`
- **Overage:** Tracked in `usage_tracking`, charged via Stripe metered billing
- **Minutes metric:** Internal unit is minutes; frontend displays `calls = minutes / 1.5`

## Source Files

- Stripe wrapper: `src/lib/stripe.ts` (380 lines)
- Usage tracker: `src/lib/billing/usage-tracker.ts`
- Overage manager: `src/lib/billing/overage-manager.ts`
- Call throttle: `src/lib/billing/call-throttle.ts`

## Related Notes

- [[Stripe Integration]]
- [[Usage Tracking]]
- [[Subscription]]
- [[Pricing Model]]
