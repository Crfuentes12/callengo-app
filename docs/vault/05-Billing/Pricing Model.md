---
tags: [billing, pricing, plans, stripe, unit-economics]
aliases: [Plans, Pricing, V4 Pricing, Pricing Model V4]
version: V4
updated: 2026-03-23
---

# Pricing Model

Callengo operates on a tiered SaaS subscription model (V4, March 2026) with six plans designed to serve customers from solo operators evaluating the platform through to large enterprise deployments. Revenue is driven by three streams: base subscription fees, metered overage charges for minutes consumed beyond plan allowances, and optional paid add-ons. All pricing is denominated in USD, with display-layer currency conversion for EUR and GBP (note: exchange rates are currently static -- see [[Known Bugs]] for details).

---

## Plan Tiers

The six plans form a progressive ladder where each tier unlocks more minutes, higher concurrency, additional user seats, and access to premium integrations. The internal billing metric is **minutes**; the frontend converts this to an estimated call count using the formula `calls = minutes / 1.5`, reflecting the blended average call duration across no-answer attempts (~0.5 min), voicemails (~1.5 min), and connected conversations (~2.5 min). This conversion is implemented in the `minutesToEstimatedCalls()` and `callsToEstimatedMinutes()` utility functions in [[Plan Features]].

| Plan | Monthly Price | Annual Price/mo | Included Minutes | Est. Calls | Max Concurrent | Users | Overage Rate/min | Max Call Duration |
|------|:------------:|:---------------:|:----------------:|:----------:|:--------------:|:-----:|:-----------------:|:-----------------:|
| **Free** | $0 | -- | 15 (one-time) | ~10 | 1 | 1 | Blocked | 3 min |
| **Starter** | $99 | $87 | 300 | ~200 | 2 | 1 | $0.29 | 3 min |
| **Growth** | $179 | $157 | 600 | ~400 | 3 | 1 | $0.26 | 4 min |
| **Business** | $299 | $263 | 1,200 | ~800 | 5 | 3 | $0.23 | 5 min |
| **Teams** | $649 | $571 | 2,250 | ~1,500 | 10 | 5 | $0.20 | 6 min |
| **Enterprise** | $1,499 | $1,319 | 6,000 | ~4,000+ | Unlimited | Unlimited | $0.17 | Unlimited |

### Annual Billing

Annual subscriptions receive a 12% discount, equivalent to two months free. The billing cycle value is stored as `'monthly'` or `'annual'` in `company_subscriptions.billing_cycle`, sanitized during checkout verification in `src/app/api/billing/verify-session/route.ts`. The annual price is calculated as `monthly_price * 12 * 0.88`.

### Plan Slugs in Database

The `subscription_plans` table uses lowercase string slugs as the canonical identifier for each plan:

| Plan | Slug |
|------|------|
| Free | `free` |
| Starter | `starter` |
| Growth | `growth` |
| Business | `business` |
| Teams | `teams` |
| Enterprise | `enterprise` |

These slugs are used throughout the codebase to look up plan features via `CAMPAIGN_FEATURE_ACCESS[slug]` in [[Plan Features]], to determine [[Usage Tracking]] thresholds, and to gate access to [[Integrations API]] endpoints. The slug is the join key between the `subscription_plans` table and the feature configuration in `src/config/plan-features.ts`.

---

## Free Plan (Trial)

The Free plan functions as a one-time trial rather than a recurring subscription. Users receive 15 minutes total (approximately 10 calls) with no renewal, no overage, and no recharge. Once minutes are exhausted, the platform blocks further calls and prompts an upgrade. Key constraints:

- **One-time allocation:** The 15 minutes are not replenished monthly. The `usage_tracking` record is created during [[Onboarding Flow]] with `minutes_included = 15`.
- **No overage:** Attempting to enable overage on a Free plan raises an error in `src/lib/billing/overage-manager.ts` ("Overage is not available on the free trial plan").
- **Max call duration:** 3 minutes per call, enforced by `getMaxCallDuration()` in `src/lib/billing/call-throttle.ts`.
- **Single agent:** Only one active agent, locked after selection. The agent cannot be switched on Free (unlike Starter where it is switchable).
- **Period expiration:** `checkUsageLimit()` checks `current_period_end` and transitions the subscription to `expired` status if past due, preventing calls in the window between expiry detection and async status update.

---

## Overage Billing

Paid plans (Starter through Enterprise) can optionally enable overage billing, which allows calls to continue beyond the included minutes at a per-minute rate. The overage rate decreases with higher plan tiers, forming a descending ladder: $0.29, $0.26, $0.23, $0.20, $0.17. All rates sit above the Bland AI cost floor of $0.11/min (Scale plan) to ensure positive gross margin on every overage minute.

### Overage Flow

1. A call completes and the [[Call Processing Flow]] webhook fires.
2. `trackCallUsage()` in `src/lib/billing/usage-tracker.ts` atomically increments `usage_tracking.minutes_used` using optimistic locking with retry (up to 3 attempts), falling back to the `atomic_increment_usage` RPC if the optimistic lock is exhausted.
3. If `minutes_used > minutes_included`, overage minutes are calculated.
4. If the company has `overage_enabled = true` on their subscription, the overage quantity is reported to [[Stripe Integration]] via `reportUsage()` using `action: 'set'` with the cumulative total (not an increment) to prevent double-counting on webhook retries.
5. If an `overage_budget` is configured, the system checks whether the current overage cost exceeds the budget. If so, further calls are blocked with reason code `overage_budget`.

### Overage Budget

Companies can set a maximum monthly overage spend via `company_subscriptions.overage_budget`. The `checkMinutesAvailable()` function in `call-throttle.ts` enforces this cap. When the budget is reached, the throttle returns `reasonCode: 'overage_budget'` and suggests upgrading to the next plan tier.

### Stripe Metered Billing

Overage is implemented as a metered price item attached to the Stripe subscription. When overage is first enabled, `enableOverage()` in `src/lib/billing/overage-manager.ts` either finds an existing metered price or creates one via `createMeteredPrice()`, then adds it as an additional subscription item. The `stripe_subscription_item_id` is stored on `company_subscriptions` for subsequent usage reporting. The periodic `syncAllMeteredUsage()` function reconciles all active overage subscriptions with Stripe, processing in pages of 50 to avoid timeouts.

---

## Add-ons

Add-ons are supplementary products available to paid plans (Starter and above). They are managed as separate Stripe subscription items and tracked in the `company_addons` table.

| Add-on | Monthly Price | Bland Cost | Description | Availability |
|--------|:------------:|:----------:|-------------|:------------:|
| **Dedicated Number** | $25/mo | $15/mo from Bland | Custom outbound caller ID number purchased on the master [[Bland AI]] account and assigned logically per company. Maximum 3 numbers per company for custom rotation. | Starter+ |
| **Recording Vault** | $12/mo | -- | Extends call recording retention from the default 30 days to 12 months. Recordings are stored via Bland's infrastructure. | Starter+ |
| **Calls Booster** | $35/mo | Variable | Adds 225 extra minutes (approximately 150 calls) to the monthly allowance. Multiple boosters can be stacked; each booster's `quantity` field multiplies the base 225 minutes. | Starter+ |

### Calls Booster Mechanics

When checking usage limits, both `checkUsageLimit()` in `usage-tracker.ts` and `checkMinutesAvailable()` in `call-throttle.ts` query the `company_addons` table for active `calls_booster` entries. The total booster minutes are calculated as `sum(quantity * 225)` across all active booster add-ons and added to the plan's base `minutes_included`. This means a Business plan with two Calls Boosters would have `1,200 + (2 * 225) = 1,650` effective minutes per period.

### Add-on Availability Matrix

The `ADDON_AVAILABILITY` constant in [[Plan Features]] defines which add-ons are available per plan:

| Plan | Dedicated Number | Recording Vault | Calls Booster |
|------|:----------------:|:---------------:|:-------------:|
| Free | No | No | No |
| Starter | Yes | Yes | Yes |
| Growth | Yes | Yes | Yes |
| Business | Yes | Yes | Yes |
| Teams | Yes | Yes | Yes |
| Enterprise | Yes | Yes | Yes |

---

## Extra Seats

The Business and Teams plans include 3 and 5 user seats respectively. Additional seats can be purchased at $49/month each. Enterprise plans have unlimited seats at no additional charge. Extra seats are managed as Stripe subscription line items and tracked in the `company_subscriptions` metadata.

---

## Unit Economics

Callengo's unit economics are driven by the spread between the customer-facing price and the underlying Bland AI cost. The Bland cost varies by the master account's plan tier:

| Bland Plan | Cost/min | Concurrent Limit | Daily Limit | Hourly Limit |
|------------|:--------:|:-----------------:|:-----------:|:------------:|
| Start | $0.14 | 10 | 100 | 100 |
| Build | $0.12 | 50 | 2,000 | 1,000 |
| Scale | $0.11 | 100 | 5,000 | 1,000 |
| Enterprise | $0.09 | Unlimited | Unlimited | Unlimited |

The active Bland plan is configured via the dropdown in the [[Admin Command Center]] Health tab and cached in [[Upstash Redis]] with a 1-hour TTL. The `BLAND_COST_PER_MINUTE` environment variable can override the default cost for conservative estimates.

### Gross Margin Per Plan (Overage)

| Plan | Overage Rate | Bland Cost (Scale) | Gross Margin/min | Margin % |
|------|:-----------:|:------------------:|:----------------:|:--------:|
| Starter | $0.29 | $0.11 | $0.18 | 62% |
| Growth | $0.26 | $0.11 | $0.15 | 58% |
| Business | $0.23 | $0.11 | $0.12 | 52% |
| Teams | $0.20 | $0.11 | $0.09 | 45% |
| Enterprise | $0.17 | $0.11 | $0.06 | 35% |

### Key Metrics (Admin Command Center)

The [[Admin Command Center]] Operations tab displays real-time unit economics:

- **MRR/ARR:** Monthly and annualized recurring revenue from all active subscriptions.
- **ARPC (Average Revenue Per Company):** Total revenue divided by active companies.
- **Cost Per Call:** Bland cost per successful call attempt (varies by call duration and Bland plan tier).
- **Gross Margin:** Revenue minus Bland AI costs, OpenAI analysis costs, and Supabase infrastructure.
- **Bland Burn Rate:** Monthly spend on the master Bland account with estimated runway based on current balance.
- **Churn Rate:** Percentage of subscriptions cancelled or past_due in the last 30 days.
- **Trial Conversion:** Percentage of Free plan users who upgrade to a paid plan.

---

## Stripe Synchronization

Plan data is synchronized between the codebase and Stripe using dedicated scripts:

| Command | Purpose |
|---------|---------|
| `npm run stripe:sync` | Sync products and prices to Stripe test environment |
| `npm run stripe:sync:live` | Sync to Stripe production (use with caution) |
| `npm run stripe:sync:dry` | Dry-run showing what would change without applying |

The sync script reads from `src/config/plan-features.ts` and the `subscription_plans` table, then creates or updates Stripe products and prices to match. It handles both the base subscription price and the metered overage price for each plan.

---

## Source of Truth

| Aspect | Location |
|--------|----------|
| Feature matrix per plan | `src/config/plan-features.ts` (400 lines) |
| Plan database records | `subscription_plans` table in Supabase |
| Stripe product/price IDs | `subscription_plans.stripe_product_id`, `stripe_price_id`, `stripe_metered_price_id` |
| Overage rates | `subscription_plans.price_per_extra_minute` |
| Billing logic | `src/lib/billing/` directory |
| Stripe SDK wrapper | `src/lib/stripe.ts` (380 lines) |

---

## Related Notes

- [[Plan Features]] -- full feature matrix and access control functions
- [[Usage Tracking]] -- minute consumption, atomic increments, and overage detection
- [[Stripe Integration]] -- payment processing, webhook handling, metered billing
- [[Subscription]] -- subscription lifecycle and status management
- [[Admin Command Center]] -- financial monitoring and Bland plan configuration
- [[Bland AI]] -- underlying telephony provider and cost structure
- [[Onboarding Flow]] -- Free plan assignment during signup
- [[ICP & Positioning]] -- target customer profiles per plan tier
