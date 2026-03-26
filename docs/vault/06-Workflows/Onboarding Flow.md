---
tags: [workflow, ux, registration, onboarding, guided-tour]
aliases: [User Registration, Signup Flow]
updated: 2026-03-26
---

# Onboarding Flow

The onboarding flow takes a new user from initial registration through company setup, agent selection, and first-use configuration. The entire flow is designed to get users to their first call as quickly as possible.

---

## Registration (Step 0)

Users can sign up via two methods:

### Email/Password
1. User visits `/auth/signup`
2. Fills in email and password
3. Supabase Auth creates `auth.users` record
4. Redirect to post-signup setup

### OAuth (Google, GitHub)
1. User clicks "Sign in with Google" or "Sign in with GitHub"
2. Redirect to OAuth provider
3. Callback at `/auth/callback` processes the OAuth response
4. Supabase Auth creates/links `auth.users` record
5. Redirect to post-signup setup

---

## Post-Registration Auto-Setup

After authentication succeeds, the system automatically creates the foundational records:

| Record | Table | Details |
|--------|-------|---------|
| **Company** | `companies` | Name derived from email domain (e.g., "acme" from "john@acme.com") |
| **User** | `users` | Role = `owner`, linked to company via `company_id` |
| **Settings** | `company_settings` | Default voice = `maya`, default max duration = 5 min |
| **Subscription** | `company_subscriptions` | Free plan, 15 one-time minutes, 1 concurrent call |
| **Usage** | `usage_tracking` | Period initialized, `minutes_included = 15` |

---

## Onboarding Wizard (`/onboarding`)

The user is redirected to a multi-step onboarding wizard:

### Step 1: Company Details
- **Company name** (pre-filled from email domain, editable)
- **Website** (optional, used for context extraction)
- **Industry** (dropdown: technology, healthcare, legal, real estate, finance, etc.)
- **Company size** (dropdown: 1-10, 11-50, 51-200, 201-500, 500+)

### Step 2: Agent Selection
- Choose from the three core [[Agent]] types:
  - **Lead Qualification** — "Qualify leads before sales touches them"
  - **Data Validation** — "Stop wasting money on bad data"
  - **Appointment Confirmation** — "Stop losing money from no-shows"
- User selects their primary pain point; corresponding agent is pre-configured

### Step 3: Optional Integration
- Quick-connect to most popular integrations:
  - [[Google Calendar]] (one-click OAuth)
  - [[HubSpot]] / [[Salesforce]] / [[Pipedrive]] (if applicable to plan)
  - Skip option available

---

## Geolocation Auto-Detection

The `useAutoGeolocation` hook runs during onboarding to detect the user's location via IP:

| Detected | Stored In | Used For |
|----------|-----------|---------|
| Country code | `users.country_code` | Integration gating |
| Country name | `users.country_name` | Display |
| City | `users.city` | Analytics |
| Region | `users.region` | Analytics |
| Timezone | `users.timezone` | Calendar defaults |
| IP address | `users.ip_address` | Security logging |
| Currency | `users.currency` | Price display (USD, EUR, GBP) |

The geolocation also determines the **i18n language** (7 languages: en, es, fr, de, it, nl, pt). Location history is stored in `users.location_logs` JSONB array.

---

## Post-Onboarding

After completing the wizard:

1. User redirected to `/home` (the dashboard)
2. Dashboard shows "Quick Start" guide with next steps
3. Free plan: 15 minutes total (one-time, no renewal)
4. Max call duration: 3 minutes (Free plan limit)
5. Max concurrent calls: 1

---

## Home Guided Tour

After the onboarding wizard completes, a **guided tour** launches automatically on the `/home` page. This is a separate, second-phase onboarding experience that walks users through the main UI elements using **driver.js** (v1.4.0).

### Trigger Conditions
- `company_settings.settings.onboarding_wizard_completed = true`
- `company_settings.settings.tour_home_seen` is falsy (never completed or first time)
- Fires 650ms after the home page mounts (via `setTimeout`)

### Tour Steps (9 Total)

| Step | Element | Title | Description |
|------|---------|-------|-------------|
| 1 | (intro) | Welcome to Callengo, {name}! | Overview, pending task count |
| 2 | `#tour-action-cards` | Quick Actions | Campaigns, Contacts, Calendar, Agents shortcuts |
| 3 | `#tour-quick-actions` | Your Get Started checklist | Pending tasks to unlock full power |
| 4 | `#tour-nav-group-0` | Home & Dashboard | Daily overview and live KPIs |
| 5 | `#tour-nav-group-1` | Contacts, Campaigns & Agents | Core workflows |
| 6 | `#tour-nav-group-2` | Calls, Calendar & Follow-ups | Post-call review and scheduling |
| 7 | `#tour-nav-group-3` | Analytics, Integrations & Team | Performance and connectivity |
| 8 | `#tour-settings-btn` | Settings | Account, billing, notifications |
| 9 | `#tour-cali-btn` | Meet Cali, your AI assistant | AI assistant for scripts and insights |

### UI Behavior
- **Overlay click**: disabled (cannot dismiss by clicking overlay)
- **Backdrop opacity**: 62%
- **Stage padding/radius**: 8px / 10px
- **Theme**: Dark Callengo theme (`#12101e` bg, purple accent) injected via `<style dangerouslySetInnerHTML>`
- **Close from anywhere**: `window.__callengoTourClose()` global function called by Sidebar and Header `onClick` handlers when user navigates
- **"View All tasks" button**: hidden during tour to avoid layout shifts

### Persistence
On completion or dismissal, `persistAndClose()` writes `tour_home_seen: true` to `company_settings.settings`. The finish function uses a `finished` boolean guard to prevent double-writes (driver.js `onDestroyed` and manual close can both fire).

---

## Page-Level Tip Cards

Each page in the app shows a **PageTipCard** component (`src/components/ui/PageTipCard.tsx`) with 4–5 contextual tips on first visit. The card:

1. Loads dismissal state from `company_settings.settings[settingKey]` on mount
2. Displays full card with gradient background, 2-column tip grid, and "Got it, don't show again" button
3. On dismiss: persists `settingKey: true` to DB; switches to minimized "Tips" button
4. "Tips" button re-expands the card locally (no additional DB write)
5. Appears with a smooth fade-in + slide-down animation (500ms ease-out)

| Page | settingKey |
|------|-----------|
| Contacts | `tour_contacts_seen` |
| Campaigns | `tour_campaigns_seen` |
| Agents | `tour_agents_seen` |
| Call History | `tour_calls_seen` |
| Calendar | `tour_calendar_seen` |
| Analytics | `tour_analytics_seen` |
| Voicemails | `tour_voicemails_seen` |
| Follow-ups | `tour_followups_seen` |
| Integrations | `tour_integrations_seen` |
| Team | `tour_team_seen` |

---

## Analytics Events

Both [[Google Analytics 4]] and [[PostHog]] track onboarding events:
- `signup_completed` — Registration method, email domain
- `onboarding_step_completed` — Step number, selections
- `onboarding_completed` — Total time, agent selected, integrations connected
- `first_agent_configured` — Agent type, voice selected

---

## Related Notes

- [[User]] — User record creation and geolocation
- [[Company]] — Company record creation
- [[Subscription]] — Free plan auto-assignment
- [[Agent]] — Agent selection during onboarding
- [[Google Calendar]] — Quick integration setup
- [[Google Analytics 4]] — Onboarding analytics events
- [[PostHog]] — Onboarding analytics events
