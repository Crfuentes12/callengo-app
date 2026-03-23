---
tags: [analytics, posthog, tracking, events, session-replay, feature-flags, group-analytics]
aliases: [PostHog Analytics, Product Analytics, PH]
created: 2026-03-23
updated: 2026-03-23
---

# PostHog

PostHog is Callengo's product analytics platform, complementing [[Google Analytics 4]] by focusing on product behavior, user journeys, session replay, and feature flags. While GA4 handles marketing attribution and acquisition funnels, PostHog provides deep insight into how users interact with the product once they are inside the application.

The implementation spans two files: `src/lib/posthog.ts` (1,698 lines, client-side) and `src/lib/posthog-server.ts` (43 lines, server-side). A reference document is available at `docs/POSTHOG.md`.

---

## Environment Variables

| Variable | Scope | Format | Description |
|----------|-------|--------|-------------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Public (client) | `phc_XXX...` | PostHog project API key, used by both client and server SDKs |
| `NEXT_PUBLIC_POSTHOG_HOST` | Public (client) | URL | PostHog ingestion host. Defaults to `https://us.i.posthog.com` if not set |

Both the client SDK (`posthog-js`) and the server SDK (`posthog-node`) use the same API key. The host variable is optional and only needs to be set if using a self-hosted PostHog instance or a different cloud region.

---

## NPM Dependencies

| Package | Version | Scope | Purpose |
|---------|---------|-------|---------|
| `posthog-js` | `^1.360.1` | Client | Browser SDK for event capture, session replay, feature flags |
| `posthog-node` | `^5.28.1` | Server | Node.js SDK for server-side event capture in API routes |

The two packages are intentionally kept in separate files to avoid bundling `posthog-node` (which depends on Node.js APIs like `node:fs`) in client-side code.

---

## Architecture

### Client-Side

```
PostHogProvider (component)
  └── initPostHog() — initializes posthog-js SDK
  └── identifyUser() — sets distinct_id, user properties, company group
  └── PostHogPageTracker — captures $pageview on route changes

User Interaction
  └── phXxxEvents.methodName() — calls capture() internally
        └── posthog.capture(eventName, properties)
```

### Server-Side

```
API Route / Webhook Handler
  └── captureServerEvent(distinctId, eventName, properties, groups?)
        └── new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
        └── client.capture({ distinctId, event, properties })
        └── await client.shutdown()
```

The server-side client is instantiated fresh for each event capture and immediately flushed and shut down. This pattern is necessary in serverless environments (Vercel) where there is no persistent process to batch events. The `flushAt: 1` and `flushInterval: 0` settings ensure immediate delivery.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PostHogProvider` | Provider component | Initializes SDK, identifies user, sets company group |
| `PostHogPageTracker` | Layout component | Captures `$pageview` events on Next.js route changes |

---

## Initialization

The `initPostHog()` function is called once by `PostHogProvider` and is safe to call multiple times (idempotent via the `initialized` flag). Configuration:

| Setting | Value | Description |
|---------|-------|-------------|
| `capture_pageview` | `false` | Disabled because page views are captured manually by `PostHogPageTracker` |
| `capture_pageleave` | `true` | Captures page leave events for session duration analysis |
| `autocapture` | `true` | Automatically captures clicks and form submissions |
| `respect_dnt` | `true` | Honors the browser's Do Not Track setting |
| `persistence` | `localStorage+cookie` | Stores anonymous ID and super properties across sessions |

In development mode, `ph.debug()` is called after initialization to enable verbose console logging.

---

## Session Replay

PostHog session replay is enabled with privacy-conscious defaults:

| Setting | Value | Description |
|---------|-------|-------------|
| `maskTextSelector` | `input[type="password"], input[type="email"], input[name="phone"]` | Masks sensitive input fields in recordings |
| DNT respect | `true` | Users with Do Not Track enabled are excluded from replay |

Session replays can be tagged with custom labels using the `tagSession(tag)` function. This is used to mark sessions where specific events occur (e.g., `password_change_failed`) so they can be easily found in the PostHog replay interface.

---

## User Identification

The `identifyUser()` function is called when a user logs in or when their profile data changes. It performs three operations:

### 1. User Identification

PostHog's `identify()` is called with the user's email as the `distinct_id` (or user UUID as fallback). User properties are set:

| Property | Source | Description |
|----------|--------|-------------|
| `email` | User profile | Email address |
| `name` | User profile | Display name |
| `plan_slug` | Subscription | Current plan (free, starter, growth, etc.) |
| `billing_cycle` | Subscription | monthly or annual |
| `company_name` | Company | Company display name |
| `company_industry` | Company | Industry from onboarding |
| `role` | Team | User's role (owner, admin, member) |
| `team_size` | Company | Number of team members |
| `country_code` | Geolocation | ISO country code |
| `currency` | Billing | Billing currency |

### 2. Group Analytics (Company)

PostHog groups allow aggregating events at the company level rather than the individual user level. After identifying the user, the SDK calls:

```typescript
posthog.group('company', props.companyId, {
  name: props.companyName,
  plan: props.planSlug,
  industry: props.companyIndustry,
})
```

This enables PostHog dashboards and insights to analyze behavior "per company" -- for example, which plans have the highest feature adoption, or which industries generate the most calls.

### 3. Reset on Logout

The `resetUser()` function calls `posthog.reset()` to clear the user's identity and generate a new anonymous ID. This prevents event leakage between different users on the same device.

---

## Feature Flags

PostHog's built-in feature flag system is exposed through three utility functions:

| Function | Description |
|----------|-------------|
| `isFeatureEnabled(flagKey)` | Returns `true` if the flag is active for the current user |
| `getFeatureFlagPayload(flagKey)` | Returns the flag's JSON payload (for multivariate flags) |
| `reloadFeatureFlags()` | Forces a re-fetch of flag values from PostHog |

Feature flags are evaluated client-side using the PostHog SDK's local evaluation, which means flag decisions are fast and do not require a network round-trip after the initial load.

---

## Event Categories

PostHog events are organized into 29 categories, each exported as a `ph`-prefixed constant object. Events are captured through a central `capture()` utility that handles both production and debug modes.

### Core Event Categories (20 categories mirroring GA4)

These categories track the same user actions as [[Google Analytics 4]] but use PostHog's SDK and naming conventions:

| # | Export Name | Category | Example Events |
|---|-----------|----------|---------------|
| 1 | `phAuthEvents` | Authentication | `login_started`, `login_completed`, `login_failed`, `signup_started`, `signup_completed`, `logout`, `password_reset_requested`, `password_reset_completed` |
| 2 | `phOnboardingEvents` | Onboarding | `onboarding_started`, `step_completed`, `onboarding_completed`, `onboarding_skipped`, `agent_selected`, `test_call_made`, `test_call_completed` |
| 3 | `phBillingEvents` | Billing | `pricing_viewed`, `plan_selected`, `checkout_started`, `checkout_completed`, `checkout_abandoned`, `plan_upgraded`, `plan_downgraded`, `subscription_canceled`, `subscription_reactivated`, `overage_charged`, `addon_purchased`, `addon_canceled`, `seat_added`, `seat_removed`, `payment_method_updated`, `invoice_downloaded` |
| 4 | `phAgentEvents` | Agents | `agent_created`, `agent_updated`, `agent_deleted`, `agent_duplicated`, `config_opened`, `config_saved`, `config_canceled`, `voice_changed`, `script_edited`, `test_call_initiated`, `test_call_completed` |
| 5 | `phCampaignEvents` | Campaigns | `campaign_created`, `campaign_started`, `campaign_paused`, `campaign_resumed`, `campaign_completed`, `campaign_deleted`, `contacts_added`, `contacts_removed`, `campaign_scheduled` |
| 6 | `phCallEvents` | Calls | `call_initiated`, `call_completed`, `call_failed`, `recording_played`, `transcript_viewed`, `analysis_viewed`, `call_exported` |
| 7 | `phContactEvents` | Contacts | `contact_created`, `contact_updated`, `contact_deleted`, `contacts_imported`, `contacts_exported`, `list_filtered`, `list_searched`, `detail_viewed`, `call_history_viewed`, `crm_synced` |
| 8 | `phIntegrationEvents` | Integrations | `integration_connected`, `integration_disconnected`, `sync_started`, `sync_completed`, `sync_failed`, `settings_updated` |
| 9 | `phCalendarEvents` | Calendar | `calendar_connected`, `calendar_disconnected`, `event_created`, `event_synced`, `availability_checked` |
| 10 | `phFollowUpEvents` | Follow-ups | `follow_up_created`, `follow_up_completed`, `follow_up_snoozed` |
| 11 | `phVoicemailEvents` | Voicemails | `voicemail_played`, `voicemail_downloaded`, `voicemail_deleted` |
| 12 | `phTeamEvents` | Team | `member_invited`, `member_joined`, `member_removed`, `role_changed`, `settings_updated` |
| 13 | `phNavigationEvents` | Navigation | `page_viewed`, `sidebar_clicked`, `breadcrumb_clicked`, `tab_changed`, `modal_opened`, `modal_closed` |
| 14 | `phSettingsEvents` | Settings | `tab_viewed`, `profile_updated`, `notification_changed`, `language_changed`, `timezone_changed` |
| 15 | `phDashboardEvents` | Dashboard | `dashboard_loaded`, `widget_interacted`, `date_range_changed`, `refreshed` |
| 16 | `phAnalyticsPageEvents` | Analytics Page | `page_viewed`, `chart_interacted`, `report_exported`, `filter_applied` |
| 17 | `phAiChatEvents` | AI Chat | `chat_opened`, `message_sent`, `response_received`, `chat_closed` |
| 18 | `phErrorEvents` | Errors | `api_error`, `client_error`, `payment_failed`, `integration_error`, `call_error` |
| 19 | `phEngagementEvents` | Engagement | `feature_discovered`, `tooltip_viewed`, `empty_state_viewed`, `empty_state_cta_clicked`, `session_duration` |

### PostHog-Exclusive Categories (10 additional categories)

These categories exist only in PostHog and have no GA4 equivalent. They leverage PostHog-specific features like flow tracking and decision analysis.

| # | Export Name | Category | Description |
|---|-----------|----------|-------------|
| 20 | `phFlowEvents` | Flow Tracking | Generic start/complete/abandon flow tracking. Used by onboarding, agent config, campaign creation, and CSV import flows. Measures funnel completion rates. |
| 21 | `phDecisionEvents` | Decision Points | Tracks key user decisions: plan selection rationale, agent type choice, CRM selection, campaign scheduling preference, contact source preference. Feeds into product decision analysis. |
| 22 | `phQuickStartEvents` | Quick Start Guide | Tracks progress through the quick start guide: guide_opened, step_completed, guide_completed, guide_dismissed. Measures activation velocity. |
| 23 | `phTestCallEvents` | Test Calls | Detailed tracking of test call flows: test_call_started, test_call_number_entered, test_call_initiated, test_call_completed, test_call_failed, test_call_feedback_submitted. |
| 24 | `phCopyShareEvents` | Copy & Share | Tracks copy-to-clipboard and sharing actions: link_copied, transcript_copied, analysis_copied, report_shared, invite_link_copied. |
| 25 | `phPageEvents` | Page Performance | Detailed page load and interaction metrics: page_load_time, first_contentful_paint, time_to_interactive, interaction_to_next_paint. |
| 26 | `phReportsEvents` | Reports | Reports page interactions: report_generated, report_filtered, report_exported, report_scheduled, report_template_selected. |
| 27 | `phCaliAiEvents` | Cali AI Assistant | Cali AI chatbot interactions: cali_opened, cali_message_sent, cali_response_received, cali_action_taken, cali_feedback_given, cali_closed. |
| 28 | `phSecurityEvents` | Security | Security-related user actions: password_changed, password_change_failed, mfa_enrollment_started, mfa_enrollment_completed, mfa_enrollment_cancelled, mfa_disabled. |
| 29 | -- (server-side) | Server Events | Server-side tracking via `captureServerEvent()` in `src/lib/posthog-server.ts`. Used in API routes and webhooks. |

---

## Server-Side Tracking

Server-side event capture lives in a separate file (`src/lib/posthog-server.ts`, 43 lines) to avoid bundling `posthog-node` (which uses Node.js-only APIs) in client-side code.

```typescript
export async function captureServerEvent(
  distinctId: string,
  eventName: string,
  properties: Record<string, string | number | boolean> = {},
  groups?: { company?: string }
)
```

| Parameter | Description |
|-----------|-------------|
| `distinctId` | User's email or UUID (must match client-side identification) |
| `eventName` | Event name |
| `properties` | Event properties |
| `groups` | Optional company group association |

The function creates a new `PostHog` client instance per call, captures the event, and immediately shuts down the client. This is the recommended pattern for serverless environments where there is no persistent process. All errors are silently caught to ensure analytics failures never break application functionality.

---

## Autocapture

PostHog's autocapture feature is enabled, which automatically tracks:

- **Click events**: All clicks on buttons, links, and interactive elements
- **Form submissions**: All form submit events
- **Page views**: Captured manually via `PostHogPageTracker` (automatic page view capture is disabled)

Autocapture provides a baseline of interaction data without requiring explicit event code. It is particularly useful for tracking interactions with UI elements that do not have explicit event tracking, such as navigation links and help buttons.

---

## Data Persistence

PostHog uses `localStorage+cookie` persistence, which means:

- The anonymous ID survives browser restarts and tab closures
- Super properties (set via `posthog.register()`) persist across sessions
- The identified user ID persists until `resetUser()` is called
- Cookie fallback ensures tracking works even if localStorage is cleared

---

## Privacy

| Feature | Implementation |
|---------|---------------|
| **Do Not Track** | Honored via `respect_dnt: true` |
| **Input masking** | Passwords, emails, and phone inputs masked in session replay |
| **Data residency** | US cloud by default (`us.i.posthog.com`), configurable via host variable |
| **User reset** | `resetUser()` clears all identifying data on logout |

---

## Source Files

| File | Lines | Description |
|------|-------|-------------|
| `src/lib/posthog.ts` | 1,698 | Client SDK initialization, identification, all event categories, feature flags, session tagging |
| `src/lib/posthog-server.ts` | 43 | Server-side event capture via posthog-node |
| `src/components/posthog/PostHogProvider.tsx` | -- | SDK initialization, user identification, group analytics setup |
| `src/components/posthog/PostHogPageTracker.tsx` | -- | Manual page view tracking on route changes |
| `docs/POSTHOG.md` | -- | Reference documentation |

---

## Related Notes

- [[Google Analytics 4]] -- Complementary marketing analytics platform
- [[Architecture Overview]] -- Overall system architecture
- [[Security & Encryption]] -- Privacy and data protection
- [[Plan Features]] -- Feature adoption analysis by plan
- [[Pricing Model]] -- Billing event tracking
