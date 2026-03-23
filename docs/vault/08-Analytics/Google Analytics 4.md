---
tags: [analytics, ga4, google, tracking, events, measurement-protocol]
aliases: [GA4, Google Analytics, Analytics System]
created: 2026-03-23
updated: 2026-03-23
---

# Google Analytics 4

Google Analytics 4 (GA4) is one of two analytics platforms used by Callengo (the other being [[PostHog]]). GA4 handles marketing attribution, acquisition funnels, and aggregate user behavior analysis. It is integrated through the `@next/third-parties/google` package for client-side tracking and the GA4 Measurement Protocol for server-side event capture.

The entire GA4 implementation lives in a single file, `src/lib/analytics.ts` (1,036 lines), which exports categorized event objects and utility functions. A companion reference document is available at `docs/GOOGLE_ANALYTICS.md`.

---

## Environment Variables

| Variable | Scope | Format | Description |
|----------|-------|--------|-------------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Public (client) | `G-XXXXXXXXXX` | GA4 Measurement ID, embedded in the client-side gtag.js snippet |
| `GA_API_SECRET` | Private (server only) | Opaque string | API secret for the GA4 Measurement Protocol, used only in server-side `trackServerEvent()` calls |

Both variables must be set for full analytics coverage. If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is missing, client-side tracking silently degrades. If `GA_API_SECRET` is missing, server-side tracking silently degrades. In neither case does the application break.

---

## Architecture

### Client-Side Tracking

```
Root Layout (src/app/layout.tsx)
  └── GoogleAnalytics component (@next/third-parties/google)
        └── Loads gtag.js with NEXT_PUBLIC_GA_MEASUREMENT_ID
              └── sendGAEvent() dispatches events via gtag()
```

The `GoogleAnalytics` component from `@next/third-parties/google` is rendered in the root layout. It injects the standard gtag.js script tag and configures it with the measurement ID. All subsequent client-side events are dispatched through the `sendGAEvent()` function from the same package.

### Server-Side Tracking

```
API Route / Webhook Handler
  └── trackServerEvent(clientId, userId, eventName, params)
        └── POST https://www.google-analytics.com/mp/collect
              └── measurement_id + api_secret in query params
              └── Event payload in JSON body
```

Server-side tracking uses the GA4 Measurement Protocol, which is a REST API that accepts event data via HTTP POST. This is used in API routes and webhook handlers where there is no browser context. Each event includes an `engagement_time_msec: 1` parameter to ensure GA4 counts the event as an engaged session.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AnalyticsProvider` | Provider component | Sets user properties on login and property changes |
| `PageTracker` | Layout component | Tracks page views on route changes |
| `GoogleAnalytics` | Root layout | Loads gtag.js script |

---

## Production-Only Behavior

All GA4 tracking is conditional on the production environment:

```typescript
const isProduction = () => typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
```

In development, events are not sent to GA4. Instead, they are logged to the browser console via `console.debug()` with a `[GA4 Debug]` prefix, making it easy to verify that the correct events are firing during development without polluting production data.

---

## User Properties

Eight custom user properties are set via `setUserProperties()` when a user logs in or when their profile data changes. These properties are attached to all subsequent events and enable segmentation in GA4 reports.

| Property | Type | Description |
|----------|------|-------------|
| `plan_slug` | string | Current subscription plan: `free`, `starter`, `growth`, `business`, `teams`, `enterprise` |
| `billing_cycle` | string | `monthly` or `annual` |
| `company_industry` | string | Industry classification from onboarding |
| `team_size` | number | Number of team members in the company |
| `country_code` | string | ISO country code from [[Architecture Overview|geolocation]] |
| `currency` | string | Billing currency (USD, EUR, GBP) |
| `integrations_count` | number | Number of active integrations |
| `contacts_count` | number | Total contacts in the company |

Properties are set via `window.gtag('config', gaId, { user_properties: {...} })`. A companion `clearUserProperties()` function resets the user ID on logout.

---

## Event Categories

The analytics system defines 20 event categories, each exported as a named object with methods that call the internal `track()` function. All event names are prefixed with `callengo_` to distinguish them from default GA4 events.

### 1. Auth Events (`authEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `login_started` | `method` (email, google, github) | User initiates login |
| `login_completed` | `method`, `plan` | Successful login |
| `login_failed` | `method`, `error_type` | Failed login attempt |
| `signup_started` | `method` | User initiates registration |
| `signup_completed` | `method` | Registration completed |
| `logout` | -- | User logs out |
| `password_reset_requested` | -- | Password reset email sent |
| `password_reset_completed` | -- | Password successfully reset |

### 2. Onboarding Events (`onboardingEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `onboarding_started` | -- | User enters onboarding flow |
| `onboarding_step_completed` | `step_number`, `step_name` | Each step completion |
| `onboarding_completed` | `total_steps`, `duration_seconds` | Entire flow completed |
| `onboarding_skipped` | `at_step` | User skips onboarding |
| `onboarding_agent_selected` | `agent_type` | Agent type chosen |
| `onboarding_test_call_made` | `agent_type`, `success` | Test call during onboarding |

### 3. Billing Events (`billingEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `pricing_page_viewed` | `source` | Pricing page opened |
| `plan_selected` | `plan`, `billing_cycle`, `price` | Plan chosen in checkout |
| `checkout_started` | `plan`, `billing_cycle` | Stripe checkout session created |
| `checkout_completed` | `plan`, `billing_cycle`, `amount` | Successful payment |
| `checkout_abandoned` | `plan`, `at_step` | User leaves checkout |
| `plan_upgraded` | `from_plan`, `to_plan` | Upgrade completed |
| `plan_downgraded` | `from_plan`, `to_plan` | Downgrade completed |
| `subscription_canceled` | `plan`, `reason` | Subscription canceled |
| `subscription_reactivated` | `plan` | Canceled subscription reactivated |
| `overage_charged` | `amount`, `minutes` | Overage charge triggered |
| `addon_purchased` | `addon_type`, `price` | Add-on purchased |
| `addon_canceled` | `addon_type` | Add-on canceled |
| `billing_cycle_changed` | `from`, `to` | Monthly/annual switch |
| `seat_added` | `total_seats`, `price` | Extra seat purchased |
| `seat_removed` | `total_seats` | Seat removed |
| `payment_method_updated` | `card_brand`, `last4` | Payment method changed |
| `invoice_downloaded` | `invoice_id` | Invoice PDF downloaded |

### 4. Agent Events (`agentEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `agent_created` | `agent_type` (lead_qualification, data_validation, appointment_confirmation) | New agent configured |
| `agent_updated` | `agent_type`, `fields_changed` | Agent settings modified |
| `agent_deleted` | `agent_type` | Agent removed |
| `agent_duplicated` | `agent_type` | Agent cloned |
| `agent_config_opened` | `agent_type` | AgentConfigModal opened |
| `agent_config_saved` | `agent_type`, `steps_completed` | AgentConfigModal saved |
| `agent_config_canceled` | `agent_type`, `at_step` | AgentConfigModal closed without saving |
| `agent_voice_changed` | `agent_type`, `voice_id` | Voice selection changed |
| `agent_script_edited` | `agent_type`, `script_length` | Script modified |
| `agent_test_call_initiated` | `agent_type` | Test call started from config |
| `agent_test_call_completed` | `agent_type`, `duration`, `success` | Test call finished |

### 5. Campaign Events (`campaignEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `campaign_created` | `agent_type`, `contact_count` | New campaign created |
| `campaign_started` | `campaign_id`, `contact_count` | Campaign dispatched |
| `campaign_paused` | `campaign_id`, `calls_completed` | Campaign paused |
| `campaign_resumed` | `campaign_id` | Campaign resumed |
| `campaign_completed` | `campaign_id`, `total_calls`, `success_rate` | All calls finished |
| `campaign_deleted` | `campaign_id` | Campaign removed |
| `campaign_contacts_added` | `campaign_id`, `count`, `source` | Contacts added to campaign |
| `campaign_contacts_removed` | `campaign_id`, `count` | Contacts removed |
| `campaign_scheduled` | `campaign_id`, `scheduled_at` | Campaign scheduled for future |
| `campaign_filter_applied` | `filter_type`, `filter_value` | Campaign list filtered |

### 6. Call Events (`callEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `call_initiated` | `agent_type`, `campaign_id` | Call sent to Bland AI |
| `call_completed` | `duration`, `status`, `agent_type` | Call finished |
| `call_failed` | `error_type`, `agent_type` | Call failed |
| `call_recording_played` | `call_id`, `duration` | Recording playback started |
| `call_transcript_viewed` | `call_id` | Transcript opened |
| `call_analysis_viewed` | `call_id` | AI analysis opened |
| `call_exported` | `format`, `count` | Calls exported |

### 7. Contact Events (`contactEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `contact_created` | `source` (manual, csv, crm_sync) | Contact added |
| `contact_updated` | `fields_changed` | Contact modified |
| `contact_deleted` | `source` | Contact removed |
| `contacts_imported` | `count`, `source`, `success_count`, `error_count` | Bulk import completed |
| `contacts_exported` | `count`, `format` | Contacts exported |
| `contact_list_filtered` | `filter_type` | Contact list filtered |
| `contact_list_searched` | `query_length` | Contact search performed |
| `contact_detail_viewed` | `contact_id` | Contact detail page opened |
| `contact_call_history_viewed` | `contact_id` | Call history tab viewed |
| `contact_crm_synced` | `crm_type`, `direction` | Contact synced with CRM |

### 8. Integration Events (`integrationEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `integration_connected` | `integration_type` | OAuth flow completed |
| `integration_disconnected` | `integration_type` | Integration removed |
| `integration_sync_started` | `integration_type`, `direction` | Manual sync triggered |
| `integration_sync_completed` | `integration_type`, `records_synced` | Sync finished |
| `integration_sync_failed` | `integration_type`, `error_type` | Sync failed |
| `integration_settings_updated` | `integration_type` | Integration config changed |

### 9. Calendar Events (`calendarEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `calendar_connected` | `provider` (google, outlook) | Calendar OAuth completed |
| `calendar_disconnected` | `provider` | Calendar removed |
| `calendar_event_created` | `provider`, `source` | Event created from Callengo |
| `calendar_event_synced` | `provider`, `direction` | Event synced |
| `calendar_availability_checked` | `provider`, `slots_found` | Availability lookup |

### 10. Follow-Up Events (`followUpEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `follow_up_created` | `type`, `due_date` | Follow-up scheduled |
| `follow_up_completed` | `type`, `overdue` | Follow-up marked done |
| `follow_up_snoozed` | `type`, `snooze_duration` | Follow-up postponed |

### 11. Voicemail Events (`voicemailEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `voicemail_played` | `voicemail_id`, `duration` | Voicemail playback |
| `voicemail_downloaded` | `voicemail_id` | Voicemail downloaded |
| `voicemail_deleted` | `voicemail_id` | Voicemail removed |

### 12. Team Events (`teamEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `team_member_invited` | `role` | Invitation sent |
| `team_member_joined` | `role`, `method` | Member accepted invite |
| `team_member_removed` | `role` | Member removed |
| `team_member_role_changed` | `old_role`, `new_role` | Role updated |
| `team_settings_updated` | -- | Team settings changed |

### 13. Navigation Events (`navigationEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `page_viewed` | `page_name`, `referrer` | Route change |
| `sidebar_item_clicked` | `item_name` | Sidebar navigation |
| `breadcrumb_clicked` | `breadcrumb_path` | Breadcrumb navigation |
| `tab_changed` | `tab_name`, `section` | Tab switch within a page |
| `modal_opened` | `modal_name` | Modal opened |
| `modal_closed` | `modal_name`, `action` | Modal closed (save/cancel/dismiss) |

### 14. Settings Events (`settingsEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `settings_tab_viewed` | `tab_name` | Settings tab opened |
| `profile_updated` | `fields_changed` | Profile saved |
| `notification_preference_changed` | `preference`, `value` | Notification toggle |
| `language_changed` | `from`, `to` | Language switched |
| `timezone_changed` | `timezone` | Timezone updated |

### 15. Dashboard Events (`dashboardEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `dashboard_loaded` | `load_time_ms` | Dashboard page loaded |
| `dashboard_widget_interacted` | `widget_name`, `action` | Widget clicked/expanded |
| `dashboard_date_range_changed` | `range` | Date filter changed |
| `dashboard_refreshed` | -- | Manual refresh |

### 16. Analytics Page Events (`analyticsPageEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `analytics_page_viewed` | `section` | Analytics page opened |
| `analytics_chart_interacted` | `chart_type`, `action` | Chart interaction |
| `analytics_report_exported` | `format`, `date_range` | Report exported |
| `analytics_filter_applied` | `filter_type`, `value` | Filter changed |

### 17. AI Chat Events (`aiChatEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `ai_chat_opened` | -- | AI chat interface opened |
| `ai_chat_message_sent` | `message_length` | User sends a message |
| `ai_chat_response_received` | `response_length`, `latency_ms` | AI responds |
| `ai_chat_closed` | `messages_count` | Chat session ended |

### 18. Error Events (`errorEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `api_error` | `endpoint`, `status_code` | API call fails |
| `client_error` | `error_type`, `component` | Client-side error caught |
| `payment_failed` | `plan`, `error_type` | Stripe payment fails |

### 19. Engagement Events (`engagementEvents`)

| Event | Parameters | When Fired |
|-------|-----------|------------|
| `feature_discovered` | `feature_name` | User interacts with a feature for the first time |
| `tooltip_viewed` | `tooltip_id` | Help tooltip displayed |
| `empty_state_viewed` | `section` | Empty state screen shown |
| `empty_state_cta_clicked` | `section`, `cta_type` | CTA button clicked on empty state |
| `session_duration` | `duration_minutes` | Periodic session length tracking |

### 20. Server-Side Events (via Measurement Protocol)

The `trackServerEvent()` function enables event tracking from API routes and webhook handlers where there is no browser context. It sends events via the GA4 Measurement Protocol REST API.

```typescript
export async function trackServerEvent(
  clientId: string,
  userId: string | null,
  eventName: string,
  params: Record<string, string | number | boolean> = {}
)
```

**Endpoint**: `POST https://www.google-analytics.com/mp/collect`

**Required env vars**: Both `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `GA_API_SECRET` must be set.

**Error handling**: All errors are silently caught. Analytics should never break application functionality.

---

## Tracked Pages

The `PageTracker` component tracks views for approximately 15 pages across the application:

| Page | Route |
|------|-------|
| Home/Dashboard | `/home` |
| Agents | `/agents` |
| Contacts | `/contacts` |
| Campaigns | `/campaigns` |
| Calls | `/calls` |
| Calendar | `/calendar` |
| Analytics | `/analytics` |
| Reports | `/reports` |
| Voicemails | `/voicemails` |
| Follow-ups | `/follow-ups` |
| Settings | `/settings` |
| Team | `/team` |
| Integrations | `/integrations` |
| Onboarding | `/onboarding` |
| Pricing | `/pricing` |

---

## Source Files

| File | Lines | Description |
|------|-------|-------------|
| `src/lib/analytics.ts` | 1,036 | All event definitions, `track()`, `setUserProperties()`, `trackServerEvent()` |
| `src/components/analytics/AnalyticsProvider.tsx` | -- | Sets user properties on auth state change |
| `src/components/analytics/PageTracker.tsx` | -- | Tracks page views on route changes |
| `src/app/layout.tsx` | -- | Renders `GoogleAnalytics` component from `@next/third-parties/google` |
| `docs/GOOGLE_ANALYTICS.md` | -- | Reference documentation |

---

## Type Augmentation

The analytics module augments the global `Window` interface to include the `gtag` function:

```typescript
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}
```

This ensures TypeScript does not complain about `window.gtag` calls in `setUserProperties()` and `clearUserProperties()`.

---

## Relationship to PostHog

GA4 and [[PostHog]] serve complementary purposes:

| Concern | GA4 | PostHog |
|---------|-----|---------|
| **Marketing attribution** | Primary | Secondary |
| **Acquisition funnels** | Primary | Secondary |
| **Product behavior** | Secondary | Primary |
| **Session replay** | Not supported | Supported |
| **Feature flags** | Not supported | Supported |
| **Group analytics** | Limited | Full (company-level) |
| **Self-hosted option** | No | Yes |
| **Server-side** | Measurement Protocol | posthog-node |

Both systems track largely the same events (130+ in GA4, comparable count in PostHog), but the event names differ: GA4 events are bare names (e.g., `login_completed`), while PostHog events are tracked through `ph`-prefixed category objects (e.g., `phAuthEvents.loginCompleted()`).

---

## Related Notes

- [[PostHog]] -- Complementary product analytics platform
- [[Architecture Overview]] -- Overall system architecture
- [[Security & Encryption]] -- Privacy considerations for analytics data
- [[Pricing Model]] -- Billing events tracked by GA4
- [[Plan Features]] -- Plan-specific feature interactions
