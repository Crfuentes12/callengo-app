# Callengo Pricing Model V4 (March 2026)

> **Status**: Active
> **Effective**: March 2026
> **Architecture**: Bland AI sub-accounts (one per company, isolated)
> **Billing metric**: Calls/month (displayed to users) = minutes / 1.5 min effective average

---

## Plans Overview

| Plan | Price/mo | Annual/mo | Calls/mo | Minutes | Concurrent | Max Duration | Overage | Users | Extra Seat |
|------|----------|-----------|---------|---------|-----------|-------------|---------|-------|-----------|
| **Free** | $0 | — | ~10 | 15 | 1 | 3 min | ❌ | 1 | — |
| **Starter** | $99 | $87 | ~200 | 300 | 2 | 3 min | $0.29/min | 1 | — |
| **Growth** | $179 | $159 | ~400 | 600 | 3 | 4 min | $0.26/min | 1 | — |
| **Business** | $299 | $269 | ~800 | 1,200 | 5 | 5 min | $0.23/min | 3 | $49 |
| **Teams** | $649 | $579 | ~1,500 | 2,250 | 10 | 6 min | $0.20/min | 5 | $49 |
| **Enterprise** | $1,499 | $1,349 | ~4,000+ | 6,000 | ∞ | Unlimited | $0.17/min | ∞ | Included |

Annual billing = 12% discount (2 months free).

---

## Add-ons

Available on Starter and above.

| Add-on | Price/mo | Description |
|--------|----------|-------------|
| **Dedicated Number** | $15 | Own dedicated outbound phone number (transferred via Bland sub-account) |
| **Recording Vault** | $12 | Extends call recording retention from 30 days → 12 months |
| **Calls Booster** | $35 | +150 calls (~+225 min) per month. Stackable. |

---

## Effective Call Duration Model

Callengo displays **calls/month** to users as the primary metric. Internally tracked in **minutes**.

**Conversion**: `calls = minutes / 1.5` (rounded)

**Why 1.5 min effective average?**

| Outcome | % of attempts | Billed duration | Weighted |
|---------|---------------|-----------------|---------|
| No answer / hung up | ~45% | ~0.5 min | 0.225 |
| Voicemail | ~25% | ~1.5 min | 0.375 |
| Connected call | ~30% | ~2.5 min | 0.750 |
| **Effective avg** | | | **~1.35–1.5 min** |

We use **1.5 min** for conservative, user-friendly estimates.

---

## Unit Economics (Bland AI Scale Plan: $0.11/min)

| Plan | Revenue | Bland Cost | Gross Profit | Margin |
|------|---------|------------|-------------|--------|
| Starter | $99 | $33 (300 × $0.11) | $66 | 66.7% |
| Growth | $179 | $66 (600 × $0.11) | $113 | 63.1% |
| Business | $299 | $132 (1,200 × $0.11) | $167 | 55.9% |
| Teams | $649 | $247.50 (2,250 × $0.11) | $401.50 | 61.9% |
| Enterprise | $1,499 | $660 (6,000 × $0.11) | $839 | 56.0% |

### Overage Margins

| Plan | Overage Rate | Bland Cost | Profit/min | Margin |
|------|-------------|------------|-----------|--------|
| Starter | $0.29 | $0.11 | $0.18 | 62% |
| Growth | $0.26 | $0.11 | $0.15 | 57% |
| Business | $0.23 | $0.11 | $0.12 | 52% |
| Teams | $0.20 | $0.11 | $0.09 | 45% |
| Enterprise | $0.17 | $0.11 | $0.06 | 35% |

All overage rates are **above the $0.11/min Bland cost floor**. Never sell below cost.

---

## Feature Access Matrix

### Calling Features

| Feature | Free | Starter | Growth | Business | Teams | Enterprise |
|---------|------|---------|--------|----------|-------|------------|
| Max concurrent calls | 1 | 2 | 3 | 5 | 10 | ∞ |
| Max call duration | 3 min | 3 min | 4 min | 5 min | 6 min | Unlimited |
| Active agents | 1 (locked) | 1 | All | All | All | All |
| Voicemail detection | ❌ | ✅ | ✅ (smart) | ✅ (smart) | ✅ (smart) | ✅ (smart) |
| Follow-ups | ❌ | ✅ max 2 | ✅ max 5 | ✅ max 5 | ✅ max 10 | ✅ unlimited |
| Smart follow-ups | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| No-show auto-retry | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| User permissions | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Users included | 1 | 1 | 1 | 3 | 5 | Unlimited |
| Extra seat | — | — | — | $49 | $49 | Included |

### Integrations

| Integration | Free | Starter | Growth | Business | Teams | Enterprise |
|-------------|------|---------|--------|----------|-------|------------|
| Google Calendar + Meet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zoom | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slack notifications | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SimplyBook.me | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webhooks (Zapier/Make/n8n) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Microsoft Outlook | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Microsoft Teams | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| HubSpot CRM | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pipedrive CRM | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Zoho CRM | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Clio (legal) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Salesforce CRM | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Microsoft Dynamics 365 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Phone Numbers

All plans use **auto-rotated numbers** from Callengo's pool (prevents spam flags).

> ⚠️ **Twilio BYOP is NOT available** — Bland AI's BYOP feature requires Enterprise parent account access and cannot be isolated per sub-account. This would break multi-tenancy architecture.

Dedicated numbers available as an add-on ($15/mo) via Bland sub-account number transfer.

---

## Free Plan (Trial)

- **10 calls / 15 minutes** — one-time, non-renewable
- No overage (calls blocked after trial exhausted)
- User must upgrade to a paid plan to continue
- No credit card required to start
- Zoom available from Free (for scheduling demos)
- 1 AI agent, locked after first selection

---

## Sub-account Architecture

Each company gets an **isolated Bland AI sub-account** at registration:
- Own API key (`bland_subaccount_id` stored in `company_settings`)
- Independent credit balance (funded from parent account credits)
- Independent call history and analytics
- No shared concurrency — each company has its own concurrent call limits

**Credit flow**:
1. Company subscribes → Stripe charges monthly fee
2. Webhook triggers → credits allocated to company's Bland sub-account
3. Bland deducts credits in real-time per minute used
4. Overage: Bland charges against credits → Stripe metered billing charges customer at period end

**Risk management**: `overage_budget` field in `company_subscriptions` caps maximum overage exposure.

---

## Recording Vault

**Default**: Call recordings kept for **30 days** (downloaded from Bland, stored in Supabase Storage).

**Recording Vault add-on ($12/mo)**: Extends retention to **12 months**.

A cron job runs daily to delete expired recordings from Supabase Storage based on `recording_expires_at` in `call_logs`.

Storage cost: ~$0.021/GB/month (negligible at typical usage volumes).

---

## Calls Booster Add-on

- **$35/mo** per booster unit
- Adds **+150 calls** (~+225 minutes) to monthly allocation
- Stackable (multiple boosters per account)
- Available on Starter and above
- Credits allocated to Bland sub-account same as base plan subscription

---

## Annual Billing

Annual subscribers pay 12 months upfront at a discounted rate (12% off = 2 months free):

| Plan | Monthly | Annual (per mo) | Annual Total | Savings |
|------|---------|-----------------|-------------|---------|
| Starter | $99 | $87 | $1,044 | $144 |
| Growth | $179 | $159 | $1,908 | $240 |
| Business | $299 | $269 | $3,228 | $360 |
| Teams | $649 | $579 | $6,948 | $840 |
| Enterprise | $1,499 | $1,349 | $16,188 | $1,800 |

---

## Plan Slugs (DB)

`subscription_plans.slug`: `free`, `starter`, `growth`, `business`, `teams`, `enterprise`

`display_order`: 10, 20, 30, 40, 50, 60

---

## Stripe Products

Each plan has a Stripe product with:
- Monthly price (recurring: month)
- Annual price (recurring: year, billed as 12× monthly equivalent)
- 3 currencies: USD, EUR (×0.92), GBP (×0.79)
- Metered price for overage billing

Each add-on has a separate Stripe product with:
- Monthly price only
- 3 currencies

---

## Competitive Positioning

| Competitor | Approach | Our Advantage |
|-----------|----------|---------------|
| Bland AI direct | Per-minute only, no SaaS layer | We provide full campaign management, CRM integrations, analytics |
| Air.ai | $0.11/min + platform fee | Comparable price, we offer more integrations at lower tiers |
| Synthflow | ~$0.13/min | We're cheaper at all overage tiers |
| Vapi | Developer-focused, no campaign wizard | We're business-user ready |

Our **minimum viable margin** is maintained above the $0.11/min Bland cost at all overage rates.
