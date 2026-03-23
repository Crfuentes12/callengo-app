---
tags: [integration, billing, payments]
aliases: [Stripe, Payments]
---

# Stripe Integration

Handles all billing: subscriptions, metered billing for overage, add-on purchases, and invoicing.

## Setup

- SDK: `stripe@20.1.0`
- Wrapper: `src/lib/stripe.ts` (380 lines) — **always use this**, never instantiate Stripe directly
- Webhook handler: `src/app/api/webhooks/stripe/route.ts`
- Signature verification: `src/lib/webhooks.ts`

## Stripe Products

Each [[Subscription|plan]] maps to:
- `stripe_product_id` — The Stripe product
- `stripe_price_id_monthly` — Monthly price
- `stripe_price_id_annual` — Annual price (12% discount)
- `stripe_metered_price_id` — Metered price for overage billing

## Billing Model

1. **Base subscription:** Fixed monthly/annual fee per plan
2. **Metered overage:** Per-minute charges above included minutes ($0.17-$0.29/min by plan)
3. **Add-ons:** Separate subscription items for dedicated numbers, recording vault, calls booster

## Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate new subscription |
| `invoice.paid` | Record payment in billing_history |
| `invoice.payment_failed` | Mark subscription as past_due |
| `customer.subscription.updated` | Sync status changes |
| `customer.subscription.deleted` | Mark as canceled |

## Idempotency

`stripe_events` table tracks processed events to prevent duplicate processing.

## Sync Scripts

```bash
npm run stripe:sync       # Sync products/prices to Stripe test
npm run stripe:sync:live  # Sync to production
npm run stripe:sync:dry   # Preview changes
```

## Related Notes

- [[Billing API]]
- [[Subscription]]
- [[Pricing Model]]
- [[Usage Tracking]]
- [[Add-on]]
