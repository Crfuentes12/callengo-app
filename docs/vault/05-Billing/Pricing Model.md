---
tags: [billing, pricing, plans]
aliases: [Plans, Pricing]
---

# Pricing Model

V4 pricing (March 2026). 6 tiers + annual discount + add-ons.

## Plan Tiers

| Plan | Monthly | Annual (12% off) | Minutes | Calls (~) | Concurrent | Users | Overage/min |
|------|---------|-------------------|---------|-----------|-----------|-------|-------------|
| **Free** | $0 | — | 15 (one-time) | ~10 | 1 | 1 | Blocked |
| **Starter** | $99 | $87 | 300 | ~200 | 2 | 1 | $0.29 |
| **Growth** | $179 | $157 | 600 | ~400 | 3 | 1 | $0.26 |
| **Business** | $299 | $263 | 1,200 | ~800 | 5 | 3 | $0.23 |
| **Teams** | $649 | $571 | 2,250 | ~1,500 | 10 | 5 | $0.20 |
| **Enterprise** | $1,499 | $1,319 | 6,000 | ~4,000+ | ∞ | ∞ | $0.17 |

## Key Metrics

- **Internal unit:** Minutes
- **Frontend display:** Calls = minutes / 1.5
- **Annual discount:** 12% (2 months free)
- **Bland AI cost floor:** $0.11/min (all overage rates are above this)

## Add-ons

| Add-on | Price/mo | Description |
|--------|---------|-------------|
| Dedicated Number | $15 | Custom outbound number (max 3) |
| Recording Vault | $12 | Extended recording storage |
| Calls Booster | $35 | Additional call capacity |

## Extra Seats

- $49/mo per additional seat (Business and Teams plans only)

## Plan Slugs (DB)

`free`, `starter`, `growth`, `business`, `teams`, `enterprise`

## Source of Truth

- Plan features: `src/config/plan-features.ts` (254 lines)
- Plan data: `subscription_plans` table
- Stripe sync: `npm run stripe:sync`

## Related Notes

- [[Plan Features]]
- [[Subscription]]
- [[Stripe Integration]]
- [[Usage Tracking]]
- [[ICP & Positioning]]
