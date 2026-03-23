---
tags: [integration, billing, payments, core]
aliases: [Stripe, Payments, Billing Provider]
---

# Stripe Integration

Stripe is the payment processing backbone for all of [[Callengo]]'s billing: subscription management, metered overage billing, add-on purchases, invoicing, and customer portal access. Every dollar of revenue flows through Stripe.

## SDK Configuration

The Stripe SDK wrapper lives at `src/lib/stripe.ts` (380 lines). It instantiates a single `Stripe` client with the following settings:

```typescript
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});
```

**Critical rule:** All code that interacts with Stripe must use the functions exported from `src/lib/stripe.ts`. Never instantiate `Stripe` directly in other files. This ensures consistent API versioning, error handling, and a single point of configuration.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server-side secret key (required, throws on missing) |
| `STRIPE_PUBLISHABLE_KEY` | Client-side publishable key (for Checkout) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |

## Exported Functions

The wrapper exports 13 functions covering the full subscription lifecycle:

### Customer Management

**`getOrCreateStripeCustomer(params)`** -- Creates or retrieves a Stripe customer keyed by email address. If a customer with the given email already exists, it updates their metadata with the latest `company_id`, `user_id`, `company_name`, and `company_website`. The display name in Stripe is formatted as `"User Name (Company)"`. This function is called during checkout session creation and ensures Stripe stays in sync with Callengo's company records.

Parameters: `companyId` (string), `email` (string), `userName?` (string), `companyName?` (string), `companyWebsite?` (string), `userId?` (string).

**`getCustomer(customerId)`** -- Retrieves a customer with expanded subscriptions. Returns `null` if the customer doesn't exist (catches `resource_missing` errors).

### Checkout and Portal

**`createCheckoutSession(params)`** -- Creates a Stripe Checkout session in `subscription` mode. Supports trial periods via `trialPeriodDays`, promotion codes via `allowPromotionCodes` (default `true`), and custom metadata passed to both the session and the subscription. Payment method is limited to `card`.

**`createBillingPortalSession(params)`** -- Creates a customer portal session for self-service subscription management (plan changes, payment method updates, invoice history). Takes `customerId` and `returnUrl`.

### Subscription Operations

**`updateSubscription(params)`** -- Updates a subscription's price (plan change) or metadata. When changing prices, it retrieves the existing subscription to get the current item ID, then swaps the price. Proration behavior defaults to `create_prorations`.

**`cancelSubscription(params)`** -- Cancels a subscription either immediately (`stripe.subscriptions.cancel`) or at period end (`cancel_at_period_end: true`). The `immediately` flag defaults to `false` for graceful cancellation.

**`getSubscription(subscriptionId)`** -- Retrieves a subscription with expanded `latest_invoice`, `customer`, and `items.data.price`. Returns `null` on `resource_missing`.

### Metered Billing (Overage)

**`reportUsage(params)`** -- Reports usage for metered billing. Because `createUsageRecord` was removed in Stripe SDK v20+, this function uses `stripe.rawRequest()` to hit the v1 API directly:

```
POST /v1/subscription_items/{subscriptionItemId}/usage_records
```

Parameters: `subscriptionItemId`, `quantity`, `timestamp` (defaults to now), `action` (`'set'` or `'increment'`, defaults to `'set'`).

**`createMeteredPrice(params)`** -- Creates a metered price for overage billing. Uses `usage_type: 'metered'` with monthly interval and `per_unit` billing scheme.

### Product and Price Management

**`createProduct(params)`** -- Creates a Stripe product with name, description, and metadata.

**`createRecurringPrice(params)`** -- Creates a recurring price for a product. Interval can be `'month'` or `'year'`. Used by the sync scripts to set up monthly and annual prices for each plan.

### Invoice

**`getUpcomingInvoice(customerId)`** -- Retrieves the upcoming invoice (draft status) for a customer. Returns `null` if no upcoming invoice exists.

### Webhook Verification

**`verifyWebhookSignature(payload, signature, secret)`** -- Wraps `stripe.webhooks.constructEvent()` to verify incoming webhook payloads. Used by the webhook handler to ensure requests originate from Stripe.

## Per-Plan Stripe Identifiers

Each plan in the `subscription_plans` table has four Stripe-related columns:

| Column | Purpose |
|--------|---------|
| `stripe_product_id` | The Stripe Product ID for this plan |
| `stripe_price_id_monthly` | Monthly recurring price ID |
| `stripe_price_id_annual` | Annual recurring price ID (12% discount) |
| `stripe_metered_price_id` | Metered price ID for per-minute overage charges |

These IDs are populated by the sync scripts and used during checkout to create the correct subscription items.

## Webhook Events

The webhook handler at `src/app/api/webhooks/stripe/route.ts` processes the following events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate new subscription, create/update `company_subscriptions` record, allocate [[Bland AI]] credits, set plan limits |
| `invoice.paid` | Record payment in `billing_history`, handle cycle renewal credits, reset usage for new billing period |
| `invoice.payment_failed` | Mark subscription as `past_due`, log billing event, optionally notify customer |
| `customer.subscription.updated` | Sync status changes (active, trialing, past_due, canceled), handle plan upgrades/downgrades, deactivate ineligible CRM integrations on downgrade |
| `customer.subscription.deleted` | Mark subscription as `canceled`, deactivate [[Bland AI]] sub-account, log billing event |

### Integration Deactivation on Downgrade

When a `customer.subscription.updated` event indicates a plan downgrade, the webhook handler calls `deactivateIneligibleIntegrations(companyId, newPlanSlug)`. This function iterates over all CRM integration tables ([[HubSpot]], [[Pipedrive]], [[Zoho]], [[Clio]], [[Salesforce]], [[Dynamics 365]]) and sets `is_active = false` for any integrations that the new plan does not support. This prevents unauthorized data sync after a downgrade.

### Addon Type Validation

The webhook handler validates `addon_type` values against a whitelist (`VALID_ADDON_TYPES`) to prevent injection of arbitrary addon types via tampered checkout metadata. Valid types include `dedicated_number`, `recording_vault`, and `calls_booster`.

## Idempotency

The `stripe_events` table stores the `event_id` of every processed webhook event. Before processing, the handler checks if the event ID already exists. If it does, the handler returns a 200 response without reprocessing, preventing duplicate subscription activations, payment recordings, or credit allocations.

## Billing Model

Callengo's billing operates on three layers:

1. **Base subscription** -- Fixed monthly or annual fee per [[Subscription|plan]] tier ($0 Free, $99 Starter, $179 Growth, $299 Business, $649 Teams, $1,499 Enterprise). Annual billing provides a 12% discount (2 months free).

2. **Metered overage** -- When a company exceeds their included minutes, per-minute charges accrue on the metered subscription item at the plan's overage rate ($0.29/min Starter down to $0.17/min Enterprise). Usage is reported to Stripe via `reportUsage()` and appears on the next invoice.

3. **Add-ons** -- Separate subscription items for optional features:
   - **Dedicated Number:** $25/month per number (see [[Bland AI]])
   - **Recording Vault:** $12/month for 12-month recording retention (default 30 days)
   - **Calls Booster:** $35/month for +150 calls / +225 minutes

## Stripe Sync Scripts

Three npm scripts manage Stripe product/price synchronization:

| Script | Command | Description |
|--------|---------|-------------|
| Test sync | `npm run stripe:sync` | Sync products and prices to Stripe test mode |
| Live sync | `npm run stripe:sync:live` | Sync to Stripe production (live keys) |
| Dry run | `npm run stripe:sync:dry` | Preview what would change without making API calls |

These scripts read plan definitions from [[Plan Features|plan-features.ts]] and create or update the corresponding Stripe products, monthly prices, annual prices, and metered overage prices.

## Verify Session Endpoint

The `POST /api/billing/verify-session` endpoint validates checkout sessions after redirect. It confirms the session ID starts with `cs_` (Stripe's checkout session prefix) and sanitizes the `billing_cycle` field to either `'monthly'` or `'annual'`, preventing injection of arbitrary values.

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/stripe.ts` | 380 | Stripe SDK wrapper with all 13 functions |
| `src/app/api/webhooks/stripe/route.ts` | ~400 | Webhook event handler |
| `src/app/api/billing/` | 13 endpoints | Checkout, portal, usage, subscription management |
| `src/lib/billing/usage-tracker.ts` | -- | Usage tracking and overage detection |
| `src/lib/billing/overage-manager.ts` | -- | Overage calculation and reporting |
| `src/lib/billing/call-throttle.ts` | -- | Plan-based call throttling |
| `src/lib/webhooks.ts` | -- | Webhook signature verification utilities |

## Related Notes

- [[Billing API]] -- API endpoints for billing operations
- [[Subscription]] -- subscription data model and lifecycle
- [[Pricing Model]] -- V4 pricing tiers and unit economics
- [[Usage Tracking]] -- how minutes are tracked and reported
- [[Add-on]] -- dedicated numbers, recording vault, calls booster
- [[Command Center]] -- admin financial dashboard (MRR, ARR, Stripe revenue)
- [[Plan Features]] -- source of truth for feature gating by plan
