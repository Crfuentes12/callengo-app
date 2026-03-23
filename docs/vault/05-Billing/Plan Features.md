---
tags: [billing, features]
---

# Plan Features

Feature matrix by plan. Source of truth: `src/config/plan-features.ts`.

## Feature Access by Plan

### Core Features
| Feature | Free | Starter | Growth | Business | Teams | Enterprise |
|---------|------|---------|--------|----------|-------|-----------|
| Max Agents | 1 | 3 | 5 | 10 | 25 | ∞ |
| Max Users/Seats | 1 | 1 | 1 | 3 | 5 | ∞ |
| Max Concurrent Calls | 1 | 2 | 3 | 5 | 10 | ∞ |
| Follow-up Attempts | 0 | 2 | 3 | 5 | 10 | ∞ |
| Voicemail Detection | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Call Recording | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Analysis | ❌ | Basic | Basic | Advanced | Advanced | Advanced |
| Overage Billing | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Integrations by Plan

| Integration | Free | Starter | Growth | Business | Teams | Enterprise |
|-------------|------|---------|--------|----------|-------|-----------|
| Google Calendar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Google Meet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zoom | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slack | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SimplyBook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webhooks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Microsoft Outlook | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Microsoft Teams | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| HubSpot | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pipedrive | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Zoho | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Clio | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Salesforce | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dynamics 365 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

## Source File

`src/config/plan-features.ts` — **The single source of truth**. Do not duplicate plan logic elsewhere.

## Related Notes

- [[Pricing Model]]
- [[Subscription]]
- [[Integrations API]]
