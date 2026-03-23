---
tags: [billing, features, plan-gating, integrations, configuration]
aliases: [Feature Matrix, Plan Gating, Feature Access]
source: src/config/plan-features.ts
updated: 2026-03-23
---

# Plan Features

This document provides a comprehensive reference for every feature gate, integration restriction, and capability limit defined per plan in Callengo. The single source of truth is `src/config/plan-features.ts` (400 lines), which exports several typed constants and utility functions consumed throughout the codebase. No other file should duplicate plan-gating logic -- all checks must route through the exports from this module.

---

## COMMON_FEATURES -- Universal Capabilities

Every plan, including Free, has access to the following 15 baseline features. These are exported as the `COMMON_FEATURES` string array and are used in the frontend pricing page and plan comparison UI to show what all users get regardless of tier.

| # | Feature | Description |
|---|---------|-------------|
| 1 | CSV/Excel/Google Sheets import | Bulk contact upload from spreadsheet files |
| 2 | JSON import/export | Programmatic contact data interchange |
| 3 | Phone normalization | Automatic conversion of phone numbers to E.164 format during import |
| 4 | Contact deduplication | Detection and merging of duplicate contacts based on phone number and email |
| 5 | Custom fields & tag segmentation | User-defined fields on contacts plus tag-based filtering and grouping |
| 6 | AI agent creation & configuration | Ability to create and configure agents from the three available templates ([[Lead Qualification]], [[Data Validation]], [[Appointment Confirmation]]) |
| 7 | Full campaign wizard | Step-by-step campaign creation interface including agent selection, contact assignment, scheduling, and launch |
| 8 | Call analytics & tracking | Per-call and per-campaign analytics with status breakdowns, duration metrics, and outcome distribution |
| 9 | Transcription downloads | Download full call transcripts in text format |
| 10 | Usage dashboard | Real-time view of minutes consumed, remaining allowance, and overage status |
| 11 | Billing alerts | Automated notifications at usage thresholds (80%, 90%, 100%) -- see [[Usage Tracking]] |
| 12 | Auto-rotating phone numbers (spam protection) | Calls are placed from a rotating pool of numbers managed on the master [[Bland AI]] account to reduce spam flagging |
| 13 | Google Calendar & Meet integration | Calendar sync for scheduling meetings and callbacks, with Google Meet video link generation |
| 14 | Zoom integration | Video meeting link generation for scheduled meetings and callbacks |

---

## PLAN_SPECIFIC_FEATURES -- Marketing Copy Per Plan

The `PLAN_SPECIFIC_FEATURES` record maps each plan slug to an array of human-readable feature description strings. These are used on the pricing page, in upgrade modals, and in plan comparison views. They represent the marketing-facing summary of what each plan offers.

### Free Plan
- 10 calls included (trial) -- 15 minutes total, one-time allocation
- 3 min max per call
- 1 concurrent call
- 1 active agent (locked after selection -- cannot switch agents without upgrading)
- Full campaign wizard experience
- Auto-rotated numbers from Callengo pool
- No overage -- upgrade required after trial

### Starter Plan ($99/mo)
- 200 calls/month (~300 min)
- 3 min max per call
- 2 concurrent calls
- 1 active agent (switchable -- can change which agent is active)
- Voicemail detection
- Follow-ups (max 2 attempts)
- Slack notifications
- SimplyBook.me integration
- Webhooks (Zapier, Make, n8n compatible)
- Auto-rotated numbers from Callengo pool
- $0.29/min overage
- Async email support

### Growth Plan ($179/mo)
- 400 calls/month (~600 min)
- 4 min max per call
- 3 concurrent calls
- All agents simultaneously (no limit on active agents)
- Voicemail detection & smart handling
- Smart follow-ups (max 5 attempts)
- Slack notifications
- SimplyBook.me integration
- Webhooks (Zapier, Make, n8n compatible)
- Auto-rotated numbers from Callengo pool
- $0.26/min overage
- Priority email support

### Business Plan ($299/mo)
- 800 calls/month (~1,200 min)
- 5 min max per call
- 5 concurrent calls
- All agents simultaneously
- 3 users (dashboard access)
- Smart follow-ups (max 5 attempts)
- Voicemail detection & smart handling
- Microsoft Outlook & Teams
- HubSpot, Pipedrive, Zoho, and Clio CRM integrations
- Auto-rotated numbers from Callengo pool
- $0.23/min overage
- Priority email support

### Teams Plan ($649/mo)
- 1,500 calls/month (~2,250 min)
- 6 min max per call
- 10 concurrent calls
- All agents simultaneously
- 5 users ($49/extra seat)
- User permissions (admin/member role separation)
- Advanced follow-ups (max 10 attempts)
- Salesforce and Microsoft Dynamics 365 integrations
- All Business integrations included
- Auto-rotated numbers from Callengo pool
- $0.20/min overage
- Priority support

### Enterprise Plan ($1,499/mo)
- 4,000+ calls/month (~6,000 min)
- Unlimited call duration
- Unlimited concurrent calls
- All agents simultaneously
- Unlimited users
- Unlimited follow-up attempts
- All integrations (current + future)
- Auto-rotated numbers from Callengo pool
- $0.17/min overage
- SLA guarantee
- Dedicated account manager
- Annual contract

---

## PHONE_NUMBER_FEATURES -- Phone Number Capabilities Per Plan

All plans use auto-rotated numbers from the Callengo pool by default. The `PHONE_NUMBER_FEATURES` record defines whether each plan supports the dedicated number add-on.

| Plan | Auto-Rotation | Dedicated Number Add-on |
|------|:-------------:|:-----------------------:|
| Free | Yes | No |
| Starter | Yes | Yes |
| Growth | Yes | Yes |
| Business | Yes | Yes |
| Teams | Yes | Yes |
| Enterprise | Yes | Yes |

Dedicated numbers cost $25/mo to the customer ($15/mo cost from [[Bland AI]], yielding $10/mo margin). Up to 3 dedicated numbers are allowed per company, enabling custom rotation with recognizable caller IDs. Numbers are purchased on the master Bland account and logically assigned per company via the `company_phone_numbers` table.

---

## CAMPAIGN_FEATURE_ACCESS -- Granular Feature Gating Matrix

The `CAMPAIGN_FEATURE_ACCESS` record is the primary feature-gating mechanism used throughout the application. Each plan slug maps to an object with boolean and numeric properties that control access to specific features. A value of `-1` means unlimited.

| Feature | Free | Starter | Growth | Business | Teams | Enterprise |
|---------|:----:|:-------:|:------:|:--------:|:-----:|:----------:|
| `maxActiveAgents` | 1 | 1 | -1 | -1 | -1 | -1 |
| `maxConcurrentCalls` | 1 | 2 | 3 | 5 | 10 | -1 |
| `maxCallDurationMinutes` | 3 | 3 | 4 | 5 | 6 | -1 |
| `voicemailDetection` | No | Yes | Yes | Yes | Yes | Yes |
| `followUps` | No | Yes | Yes | Yes | Yes | Yes |
| `maxFollowUpAttempts` | 0 | 2 | 5 | 5 | 10 | -1 |
| `smartFollowUp` | No | No | Yes | Yes | Yes | Yes |
| `slackNotifications` | No | Yes | Yes | Yes | Yes | Yes |
| `zoomMeetings` | Yes | Yes | Yes | Yes | Yes | Yes |
| `microsoftOutlook` | No | No | No | Yes | Yes | Yes |
| `microsoftTeams` | No | No | No | Yes | Yes | Yes |
| `noShowAutoRetry` | No | No | Yes | Yes | Yes | Yes |
| `rescheduling` | No | Yes | Yes | Yes | Yes | Yes |
| `dataExport` | No | Yes | Yes | Yes | Yes | Yes |
| `userPermissions` | No | No | No | No | Yes | Yes |
| `recordingVaultAddon` | No | Yes | Yes | Yes | Yes | Yes |
| `callsBoosterAddon` | No | Yes | Yes | Yes | Yes | Yes |

### Feature Explanations

- **maxActiveAgents:** The number of distinct agent configurations that can be active simultaneously. Free and Starter are limited to 1 (Free locks the selection; Starter allows switching). Growth and above can run all three agent types concurrently.
- **maxConcurrentCalls:** The maximum number of simultaneous in-progress calls for the company, enforced by both [[Upstash Redis]] atomic counters and a DB-based fallback in `src/lib/billing/call-throttle.ts`.
- **maxCallDurationMinutes:** The maximum duration for a single call. Enforced via the `max_duration` parameter sent to [[Bland AI]] in the dispatch payload. Enterprise uses `-1` (unlimited), which maps to 600 minutes in `getMaxCallDuration()`.
- **voicemailDetection:** Whether the system detects voicemail answers via Bland's `answered_by` field and logs them to the `voicemail_logs` table.
- **followUps:** Whether the system creates automatic follow-up entries in the `follow_up_queue` when a call results in no-answer, busy, or voicemail.
- **maxFollowUpAttempts:** The maximum number of follow-up retry calls per contact per campaign. Set to 0 on Free (no follow-ups), capped at 2/5/5/10 on paid plans, unlimited on Enterprise.
- **smartFollowUp:** Whether the system uses AI analysis to determine optimal follow-up timing and approach (available from Growth and above).
- **slackNotifications:** Whether call completion events can trigger Slack channel notifications.
- **noShowAutoRetry:** Whether the [[Appointment Confirmation]] agent automatically retries a call after a no-show detection. Controlled by the `no_show_auto_retry` campaign setting and gated here at the plan level.
- **rescheduling:** Whether contacts can request and receive rescheduled appointments during [[Appointment Confirmation]] calls.
- **userPermissions:** Whether the company has access to admin/member role separation for team members. Only available on Teams and Enterprise.
- **recordingVaultAddon / callsBoosterAddon:** Whether the company can purchase these add-ons. All paid plans have access.

---

## ADDON_AVAILABILITY -- Add-on Eligibility Per Plan

The `ADDON_AVAILABILITY` record determines which add-ons each plan can purchase. Free plans cannot purchase any add-ons.

| Plan | Dedicated Number ($25/mo) | Recording Vault ($12/mo) | Calls Booster ($35/mo) |
|------|:-------------------------:|:------------------------:|:----------------------:|
| Free | No | No | No |
| Starter | Yes | Yes | Yes |
| Growth | Yes | Yes | Yes |
| Business | Yes | Yes | Yes |
| Teams | Yes | Yes | Yes |
| Enterprise | Yes | Yes | Yes |

---

## INTEGRATION_PLAN_REQUIREMENTS -- CRM Access Gating

CRM integrations are gated by plan tier. The `INTEGRATION_PLAN_REQUIREMENTS` record maps each CRM integration name to the list of plan slugs that have access. Integrations not listed in this record (such as Google Calendar, Zoom, Slack, SimplyBook, and Webhooks) are ungated and available to all plans.

| Integration | Required Plan | Allowed Slugs |
|-------------|:-------------:|---------------|
| HubSpot | Business+ | `business`, `teams`, `enterprise` |
| Pipedrive | Business+ | `business`, `teams`, `enterprise` |
| Zoho CRM | Business+ | `business`, `teams`, `enterprise` |
| Clio | Business+ | `business`, `teams`, `enterprise` |
| Salesforce | Teams+ | `teams`, `enterprise` |
| Microsoft Dynamics 365 | Teams+ | `teams`, `enterprise` |

### Integration Tier Summary

| Tier | Integrations Available |
|------|----------------------|
| **Free / Starter / Growth** | Google Calendar, Google Meet, Zoom, Slack, SimplyBook.me, Webhooks (Zapier/Make/n8n) |
| **Business** | All of the above + Microsoft Outlook, Microsoft Teams, HubSpot, Pipedrive, Zoho CRM, Clio |
| **Teams / Enterprise** | All of the above + Salesforce, Microsoft Dynamics 365 |

---

## Utility Functions

The module exports six utility functions used across the codebase for plan-gating checks:

### `getRequiredPlanForFeature(feature)`

Returns the minimum plan slug required to access a given feature from `CAMPAIGN_FEATURE_ACCESS`. Iterates through tiers in order (`free`, `starter`, `growth`, `business`, `teams`, `enterprise`) and returns the first tier where the feature is truthy (boolean `true` or non-zero number). Used in upgrade prompts to tell users which plan they need.

```typescript
getRequiredPlanForFeature('microsoftOutlook') // returns 'business'
getRequiredPlanForFeature('userPermissions')   // returns 'teams'
getRequiredPlanForFeature('zoomMeetings')      // returns 'free'
```

### `getPlanFeatures(slug)` / `getAllPlanFeatures(slug)`

Returns the marketing feature description strings for a given plan slug. `getPlanFeatures` and `getAllPlanFeatures` both return `PLAN_SPECIFIC_FEATURES[slug]`. Used on the pricing page and in plan comparison modals.

### `getPhoneNumberFeatures(slug)`

Returns the `PHONE_NUMBER_FEATURES` object for the given plan slug, falling back to `free` if the slug is not recognized.

### `getCampaignFeatureAccess(slug)`

Returns the `CAMPAIGN_FEATURE_ACCESS` object for the given plan slug, falling back to the `free` tier configuration. This is the primary function used by API routes and components to check whether a feature is available for the current company's plan.

```typescript
const features = getCampaignFeatureAccess('growth');
if (features.smartFollowUp) {
  // Enable smart follow-up UI
}
if (features.maxConcurrentCalls !== -1 && activeCalls >= features.maxConcurrentCalls) {
  // Block dispatch
}
```

### `getAddonAvailability(slug)`

Returns the `ADDON_AVAILABILITY` object for the given plan slug, falling back to `free` if unrecognized. Used in the [[Billing Settings]] component to show/hide add-on purchase options.

### `minutesToEstimatedCalls(minutes)` / `callsToEstimatedMinutes(calls)`

Conversion functions using the 1.5-minute effective average per call attempt. The 1.5-minute average is derived from the blended mix of call outcomes:

- ~45% no-answer attempts (~0.5 min each)
- ~25% voicemail (~1.5 min each)
- ~30% connected conversations (~2.5 min each)
- Weighted average: `0.45 * 0.5 + 0.25 * 1.5 + 0.30 * 2.5 = 1.35`, rounded up to 1.5 for simplicity.

### `isPlanAllowedForIntegration(planSlug, integrationName)`

Checks whether a plan slug has access to a specific CRM integration. Returns `true` if the integration is not in the gated list (ungated integrations like Google Calendar) or if the plan slug is in the allowed list. Used in the [[Integrations API]] middleware and the [[IntegrationsPage]] component to show/hide integration cards.

```typescript
isPlanAllowedForIntegration('starter', 'hubspot')    // false
isPlanAllowedForIntegration('business', 'hubspot')    // true
isPlanAllowedForIntegration('free', 'google-calendar') // true (ungated)
```

---

## Where Plan Features Are Checked

The following locations in the codebase consume plan feature data:

| Location | Purpose |
|----------|---------|
| `src/lib/billing/call-throttle.ts` | `checkCallAllowed()` reads `maxConcurrentCalls` to enforce concurrent limits |
| `src/lib/billing/call-throttle.ts` | `getMaxCallDuration()` reads `maxCallDurationMinutes` to cap call length |
| `src/app/api/campaigns/dispatch/route.ts` | Pre-dispatch validation of plan limits |
| `src/lib/queue/dispatch-queue.ts` | Per-contact throttle check during background processing |
| `src/components/agents/AgentConfigModal.tsx` | Agent count limits and feature toggles |
| `src/components/integrations/IntegrationsPage.tsx` | Integration card visibility based on plan |
| `src/components/settings/BillingSettings.tsx` | Add-on availability and upgrade prompts |
| `src/app/pricing/page.tsx` | Public pricing page feature comparison |
| `src/app/api/integrations/*/route.ts` | API-level integration access checks |

---

## Source File

`src/config/plan-features.ts` -- **the single source of truth for all plan-gating logic**. Do not duplicate feature checks elsewhere. Always import from this module.

---

## Related Notes

- [[Pricing Model]] -- pricing tiers, overage rates, and unit economics
- [[Usage Tracking]] -- how minutes are consumed and tracked
- [[Subscription]] -- subscription lifecycle and status transitions
- [[Integrations API]] -- how CRM access is gated by plan
- [[Campaign Dispatch Flow]] -- where throttle and feature checks are applied
- [[Admin Command Center]] -- plan distribution monitoring
- [[Billing Settings]] -- user-facing plan management UI
