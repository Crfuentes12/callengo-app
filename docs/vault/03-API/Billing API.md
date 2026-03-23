---
tags: [api, billing, stripe, subscriptions, usage, addons, payments]
created: 2026-03-23
updated: 2026-03-23
---

# Billing API

The Billing API encompasses 22 endpoints that manage the entire subscription lifecycle: plan discovery, checkout, subscription activation, usage tracking, overage billing, add-on purchases, phone number management, and portal access. Stripe is the payment processor for all monetary transactions, with the Stripe SDK accessed exclusively through the wrapper at `src/lib/stripe.ts` (380 lines). The internal billing metric is **minutes**, while the frontend displays calls using the formula `calls = minutes / 1.5`.

All billing endpoints require authentication. Most billing management operations (checkout, plan changes, add-on purchases) additionally require the `owner` or `admin` role. Usage reporting can also be triggered internally via a service-to-service call using the `INTERNAL_API_SECRET` header.

---

## Endpoint Reference

### POST /api/billing/create-checkout-session

Creates a Stripe Checkout session for purchasing a subscription plan. This is the primary entry point for new paid subscriptions and plan upgrades.

**Authentication:** Required. Owner or admin role.

**Rate limit:** 5 requests/minute per user.

**Request body:**

```json
{
  "planId": "uuid",
  "billingCycle": "monthly",
  "currency": "USD"
}
```

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `planId` | string (UUID) | Yes | -- | ID from `subscription_plans` table |
| `billingCycle` | string | No | `monthly`, `annual` | Defaults to `monthly` |
| `currency` | string | No | `USD`, `EUR`, `GBP` | Defaults to `USD` |

**Behavior:**
1. Validates user role (owner/admin only)
2. Fetches plan from `subscription_plans` (must be active)
3. Resolves Stripe price ID:
   - USD: uses stored `stripe_price_id_monthly` / `stripe_price_id_annual` from the plan
   - EUR/GBP: queries Stripe API by product + currency + interval
4. Gets or creates Stripe customer via `getOrCreateStripeCustomer()`, enriched with company metadata
5. Creates Stripe Checkout session with:
   - Success URL: `/subscription/success?session_id={CHECKOUT_SESSION_ID}`
   - Cancel URL: `/settings?canceled=true`
   - Metadata: `company_id`, `plan_id`, `billing_cycle`, `user_id`
   - 7-day trial for new customers (no trial for existing subscribers)

**Response:**

```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

**Source file:** `src/app/api/billing/create-checkout-session/route.ts`

---

### POST /api/billing/verify-session

Fallback endpoint to verify a Stripe Checkout session and activate the subscription directly in the database. This endpoint exists as a safety net in case the Stripe webhook fails to process `checkout.session.completed`. It is called by the frontend after redirecting back from Stripe Checkout.

**Authentication:** Required.

**Rate limit:** 5 requests/minute per user.

**Request body:**

```json
{ "session_id": "cs_test_xxx" }
```

**Validation:**
- `session_id` must be a non-empty string
- `session_id` must start with `cs_` prefix (security fix from audit -- prevents arbitrary session ID injection)
- Session must belong to the authenticated user's company (checked via `metadata.company_id`)

**Behavior:**
1. Retrieves checkout session from Stripe (expands subscription)
2. Verifies payment status is `paid` or session status is `complete`
3. Sanitizes `billing_cycle` to exactly `'monthly'` or `'annual'` (audit fix)
4. Checks if the webhook already processed this subscription (idempotency via `stripe_subscription_id` comparison)
5. Updates `company_subscriptions` with plan, billing cycle, period dates, Stripe IDs
6. Creates or updates `usage_tracking` for the new period (resets `minutes_used` to 0)

**Response:**

```json
{
  "updated": true,
  "subscription": { "id": "uuid", "plan_id": "uuid", "status": "active" },
  "plan": "Growth"
}
```

**Source file:** `src/app/api/billing/verify-session/route.ts`

---

### POST /api/billing/create-portal-session

Creates a Stripe Customer Portal session so the user can manage their payment methods, view invoices, and update billing details directly in Stripe's hosted UI.

**Authentication:** Required. Owner or admin role.

**Response:**

```json
{ "url": "https://billing.stripe.com/p/session/xxx" }
```

**Source file:** `src/app/api/billing/create-portal-session/route.ts`

---

### GET /api/billing/subscription

Returns the current company's subscription details, including the plan information and current-period usage.

**Authentication:** Required.

**Response:**

```json
{
  "subscription": {
    "id": "uuid",
    "company_id": "uuid",
    "plan_id": "uuid",
    "status": "active",
    "billing_cycle": "monthly",
    "current_period_start": "2026-03-01T00:00:00Z",
    "current_period_end": "2026-04-01T00:00:00Z",
    "stripe_subscription_id": "sub_xxx",
    "stripe_customer_id": "cus_xxx",
    "overage_enabled": true,
    "overage_budget": 50,
    "overage_spent": 12.50,
    "plan": {
      "id": "uuid",
      "slug": "growth",
      "name": "Growth",
      "price_monthly": 179,
      "price_yearly": 1891,
      "minutes_included": 600,
      "max_concurrent_calls": 3,
      "price_per_extra_minute": 0.26
    }
  },
  "usage": {
    "minutes_used": 450,
    "minutes_included": 600,
    "period_start": "2026-03-01T00:00:00Z",
    "period_end": "2026-04-01T00:00:00Z"
  }
}
```

**Source file:** `src/app/api/billing/subscription/route.ts`

---

### POST /api/billing/change-plan

**Admin-only** endpoint that modifies a subscription directly in the database without going through Stripe. This is used for admin overrides such as granting a plan to a partner or test account. Regular plan changes must go through the Stripe Checkout flow (`create-checkout-session`).

**Authentication:** Required. Admin role only (not owner).

**Rate limit:** 3 requests/minute per user.

**Request body:**

```json
{
  "planId": "uuid",
  "billingCycle": "monthly"
}
```

**Behavior:**
1. Updates or creates `company_subscriptions` record
2. Creates or resets `usage_tracking` for the new period
3. Logs a `billing_history` entry with status `admin_override`

**Source file:** `src/app/api/billing/change-plan/route.ts`

---

### GET /api/billing/plans

Returns all available subscription plans. This is a public endpoint (no authentication required) used by the pricing page.

**Response:**

```json
{
  "plans": [
    {
      "id": "uuid",
      "slug": "starter",
      "name": "Starter",
      "price_monthly": 99,
      "price_yearly": 1045,
      "minutes_included": 300,
      "max_concurrent_calls": 2,
      "max_seats": 1,
      "price_per_extra_minute": 0.29,
      "is_active": true
    }
  ]
}
```

**Source file:** `src/app/api/billing/plans/route.ts`

---

### GET /api/billing/history

Returns the billing history for the current company, including subscription payments, overage charges, and credits.

**Authentication:** Required.

**Source file:** `src/app/api/billing/history/route.ts`

---

### POST /api/billing/report-usage

Reports metered overage usage to Stripe. This endpoint is called internally (service-to-service) after a call completes to track minutes that exceed the plan's included allocation. It can also be called by authenticated users.

**Authentication:** Required (user session OR `x-service-key` header with `INTERNAL_API_SECRET`).

**Rate limit:** 3 requests/minute per caller.

**Request body:**

```json
{
  "companyId": "uuid",
  "minutes": 2,
  "callId": "bland-call-uuid"
}
```

**Behavior:**
1. Verifies authentication (session or service token via timing-safe comparison)
2. Checks if company has overage enabled and budget remaining
3. Reports usage to Stripe via `reportUsage()` from the Stripe wrapper
4. Updates `usage_tracking` with incremented minutes

**Source file:** `src/app/api/billing/report-usage/route.ts`

---

### POST /api/billing/check-usage-limit

Checks whether a company has remaining minutes in their current billing period. Used before dispatching calls to prevent overage without consent.

**Authentication:** Required.

**Source file:** `src/app/api/billing/check-usage-limit/route.ts`

---

### POST /api/billing/update-overage

Updates the overage settings for a company's subscription: enables/disables overage, sets the monthly budget cap.

**Authentication:** Required. Owner or admin role.

**Request body:**

```json
{
  "overageEnabled": true,
  "overageBudget": 100
}
```

**Source file:** `src/app/api/billing/update-overage/route.ts`

---

### POST /api/billing/ensure-free-plan

Ensures a company has at least a free plan subscription record. Called during onboarding to set up the initial subscription.

**Authentication:** Required.

**Source file:** `src/app/api/billing/ensure-free-plan/route.ts`

---

### POST /api/billing/check-retention

Checks whether a company is eligible for a retention offer (discount coupon) when they attempt to cancel.

**Authentication:** Required.

**Source file:** `src/app/api/billing/check-retention/route.ts`

---

### POST /api/billing/cancellation-feedback

Stores cancellation feedback when a user cancels their subscription. The feedback is saved to the `cancellation_feedback` table.

**Authentication:** Required.

**Source file:** `src/app/api/billing/cancellation-feedback/route.ts`

---

### POST /api/billing/notifications

Manages billing notifications (payment reminders, usage alerts).

**Authentication:** Required.

**Source file:** `src/app/api/billing/notifications/route.ts`

---

### POST /api/billing/addon-checkout

Creates a Stripe Checkout session for purchasing an add-on. Requires an active paid subscription (Starter plan or higher).

**Authentication:** Required. Owner or admin role.

**Rate limit:** 5 requests/minute per user.

**Request body:**

```json
{
  "addonType": "dedicated_number",
  "currency": "USD"
}
```

**Valid addon types:**
- `dedicated_number` -- Dedicated Phone Number ($25/mo, Bland cost $15/mo)
- `recording_vault` -- Recording Vault ($12/mo)
- `calls_booster` -- Calls Booster ($35/mo, adds 225 minutes)

**Validation:**
- `addonType` must be in the `ADDON_TYPE_LABELS` whitelist (audit fix)
- Currency must be USD, EUR, or GBP
- Company must have an active paid subscription (not free plan)

**Source file:** `src/app/api/billing/addon-checkout/route.ts`

---

### POST /api/billing/seat-checkout

Creates a Stripe Checkout session for purchasing an extra seat. Available on Business and Teams plans where `extra_seat_price` is configured ($49/mo).

**Authentication:** Required. Owner or admin role.

**Source file:** `src/app/api/billing/seat-checkout/route.ts`

---

### Phone Number Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/phone-numbers` | List company's dedicated phone numbers |
| POST | `/api/billing/phone-numbers/search` | Search available numbers by area code/country |
| POST | `/api/billing/phone-numbers/purchase` | Purchase a dedicated phone number via Bland AI |
| POST | `/api/billing/phone-numbers/release` | Release a dedicated phone number |

**Source files:** `src/app/api/billing/phone-numbers/`

---

## Stripe Webhook Handler

### POST /api/webhooks/stripe

Processes all inbound Stripe webhook events. The endpoint verifies the webhook signature using `STRIPE_WEBHOOK_SECRET` and enforces idempotency via the `stripe_events` table (each event ID is recorded to prevent duplicate processing).

**Authentication:** Stripe webhook signature verification (not session-based).

**Handled events:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activates subscription, creates `company_subscriptions` and `usage_tracking` records, allocates Bland credits |
| `invoice.paid` | Records payment in `billing_history`, handles cycle renewal credits |
| `invoice.payment_failed` | Marks subscription as `past_due`, records failed payment |
| `customer.subscription.updated` | Syncs plan changes, handles upgrade/downgrade credits, deactivates ineligible CRM integrations on downgrade |
| `customer.subscription.deleted` | Marks subscription as `canceled`, deactivates Bland sub-account |

**Plan downgrade handling:** When a subscription is updated to a lower plan, `deactivateIneligibleIntegrations()` checks each CRM integration against the new plan's allowed integrations (using `isPlanAllowedForIntegration()` from `src/config/plan-features.ts`) and deactivates any that are no longer permitted. A billing event is logged for audit.

**External integrations triggered:** On relevant events, the webhook also pushes data to HubSpot (via `hubspot-user-sync.ts`) for CRM tracking of the customer lifecycle: updating contact plan, closing deals, creating tasks, logging product events.

**Source file:** `src/app/api/webhooks/stripe/route.ts`

---

## Billing Data Flow

```
User selects plan on /pricing or /settings
        |
        v
POST /api/billing/create-checkout-session
        |
        v
Stripe Checkout (hosted page)
        |
        v
  [Payment succeeds]
        |
   +----+----+
   |         |
   v         v
Stripe     User redirected to
webhook    /subscription/success
   |              |
   v              v
POST /api/    POST /api/billing/
webhooks/     verify-session
stripe        (fallback)
   |              |
   v              v
company_subscriptions updated
usage_tracking reset
Bland credits allocated
```

---

## Key Implementation Details

- **Internal metric is minutes.** The frontend converts to calls using `calls = minutes / 1.5` (average call duration assumption).
- **Annual billing:** 12% discount (equivalent to 2 months free). Annual prices are stored in `price_yearly` / `stripe_price_id_annual`.
- **Overage billing:** When a company exceeds their included minutes and has overage enabled, additional usage is reported to Stripe as metered billing at the plan's `price_per_extra_minute` rate.
- **billing_cycle sanitization:** The `verify-session` endpoint sanitizes the billing cycle value to exactly `'monthly'` or `'annual'` to prevent injection of arbitrary values (audit fix).
- **cs_ prefix validation:** The `verify-session` endpoint validates that the session ID starts with `cs_` to prevent arbitrary string injection (audit fix).
- **addon_type whitelist:** The webhook and addon endpoints validate addon types against a `VALID_ADDON_TYPES` whitelist (audit fix).

---

## Overage Rate by Plan

| Plan | Included Minutes | Overage Rate |
|------|-----------------|-------------|
| Free | 15 (one-time) | Blocked |
| Starter | 300 | $0.29/min |
| Growth | 600 | $0.26/min |
| Business | 1,200 | $0.23/min |
| Teams | 2,250 | $0.20/min |
| Enterprise | 6,000 | $0.17/min |

---

## Source Files

- Billing routes: `src/app/api/billing/`
- Stripe webhook: `src/app/api/webhooks/stripe/route.ts`
- Stripe wrapper: `src/lib/stripe.ts` (380 lines)
- Usage tracker: `src/lib/billing/usage-tracker.ts`
- Overage manager: `src/lib/billing/overage-manager.ts`
- Call throttle: `src/lib/billing/call-throttle.ts`
- Plan features: `src/config/plan-features.ts`

## Related Notes

- [[Stripe Integration]]
- [[Usage Tracking]]
- [[Subscription]]
- [[Pricing Model]]
- [[Add-on]]
- [[API Overview]]
