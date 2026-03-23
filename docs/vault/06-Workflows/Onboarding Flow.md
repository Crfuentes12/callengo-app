---
tags: [workflow, ux, registration, onboarding]
aliases: [User Registration, Signup Flow]
updated: 2026-03-23
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
