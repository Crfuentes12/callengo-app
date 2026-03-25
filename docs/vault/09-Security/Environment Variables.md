---
tags: [security, configuration, environment, deployment, vercel]
aliases: [Env Vars, Environment Configuration, .env]
updated: 2026-03-25
---

# Environment Variables

Complete reference of all environment variables used by Callengo. The canonical file is `.env.example` in the project root. Copy it to `.env.local` for local development. In production, these are configured in Vercel's Environment Variables panel.

**Total:** 59 variables across 11 categories.

---

## Quick Reference by Category

### Core Infrastructure (3 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Supabase anonymous key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes | Supabase service role key (bypasses RLS). **Never expose to client.** |

### Application (2 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Application base URL. `http://localhost:3000` in dev, `https://app.callengo.com` in prod |
| `NODE_ENV` | Server | Auto | `development`, `production`, `test` |

### Payments — [[Stripe Integration]] (3 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `STRIPE_SECRET_KEY` | Server | Yes | Stripe API key. `sk_test_...` or `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Yes | Stripe publishable key. `pk_test_...` or `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Server | Yes | Stripe webhook signing secret. `whsec_...` |

### Voice / Telephony — [[Bland AI]] (3 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `BLAND_API_KEY` | Server | Yes | Master API key. Single key for all companies (master key architecture). |
| `BLAND_WEBHOOK_SECRET` | Server | Yes | HMAC-SHA256 webhook signature verification secret |
| `BLAND_COST_PER_MINUTE` | Server | No | Override default Bland cost/min. Default: `0.14`. Used in P&L and margin calculations. |

### AI Analysis — [[OpenAI]] (8 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `OPENAI_API_KEY` | Server | Yes | OpenAI API key — base fallback for all features |
| `OPENAI_API_KEY_CALL_ANALYSIS` | Server | No | Key for call transcript analysis. Falls back to `OPENAI_API_KEY` |
| `OPENAI_API_KEY_CONTACT_ANALYSIS` | Server | No | Key for contact quality scoring, agent suggestions, web scraper, and onboarding. Falls back to `OPENAI_API_KEY` |
| `OPENAI_API_KEY_CALI_AI` | Server | No | Key for Cali AI in-app assistant (Cmd+K). Falls back to `OPENAI_API_KEY` |
| `OPENAI_WEBHOOK_SECRET` | Server | No | HMAC-SHA256 secret for verifying `POST /api/openai/webhook` requests |
| `OPENAI_MODEL` | Server | No | Default model override. Default: `gpt-4o-mini`. Used by `getDefaultModel()` in tracker |
| `OPENAI_MODEL_PREMIUM` | Server | No | Premium model override for deep analysis. Default: `gpt-4o`. Used by `getPremiumModel()` |
| `AI_ANALYSIS_MODE` | Server | No | `sync` (default, inline in webhook) or `async` (via `analysis_queue` table) |

### Concurrency — [[Upstash Redis]] (2 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Server | Yes | Upstash Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Yes | Upstash Redis REST API token |

### Product Analytics (4 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Public | No | [[Google Analytics 4]] measurement ID (`G-XXXXXXXXXX`). Graceful degradation if not set. |
| `GA_API_SECRET` | Server | No | GA4 Measurement Protocol API secret (for server-side events) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Public | No | [[PostHog]] project API key (`phc_XXX`). Graceful degradation if not set. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Public | No | PostHog host. Default: `https://us.i.posthog.com`. Use `eu.i.posthog.com` for EU. |

### Internal Security (6 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `TOKEN_ENCRYPTION_KEY` | Server | Yes | AES-256-GCM key for OAuth token encryption. **Exactly 64 hex characters** (32 bytes). See [[Security & Encryption]]. |
| `INTERNAL_API_SECRET` | Server | Yes | Service-to-service API authentication |
| `QUEUE_PROCESSING_SECRET` | Server | Yes | Cron job / queue processor authentication |
| `CRON_SECRET` | Server | Yes | Vercel Cron job authentication |
| `OAUTH_STATE_SECRET` | Server | Yes | HMAC signing for OAuth state parameters (prevents CSRF in OAuth flows) |
| `SEED_ENDPOINT_SECRET` | Server | No | **Dev/staging only.** Auth for seed data endpoint. Never set in production. |

### reCAPTCHA (2 vars)

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Public | No | Google reCAPTCHA v3 site key (bot protection on auth forms) |
| `RECAPTCHA_SECRET_KEY` | Server | No | Google reCAPTCHA v3 secret key |

### CRM Integrations — OAuth Credentials (17 vars)

All CRM tokens stored in DB are encrypted with AES-256-GCM. These env vars are the OAuth **app credentials** (not user tokens).

| Variable | CRM | Plan | Description |
|----------|-----|------|-------------|
| `HUBSPOT_APP_ID` | [[HubSpot]] | Business+ | HubSpot app ID |
| `HUBSPOT_CLIENT_ID` | [[HubSpot]] | Business+ | OAuth client ID |
| `HUBSPOT_CLIENT_SECRET` | [[HubSpot]] | Business+ | OAuth client secret |
| `HUBSPOT_PRIVATE_APP_TOKEN` | [[HubSpot]] | Business+ | Private app token for server API calls |
| `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` | HubSpot Marketing | — | Portal ID for embedded contact forms |
| `NEXT_PUBLIC_HUBSPOT_CONTACT_FORM_ID` | HubSpot Marketing | — | Contact form GUID |
| `SALESFORCE_CLIENT_ID` | [[Salesforce]] | Teams+ | OAuth client ID |
| `SALESFORCE_CLIENT_SECRET` | [[Salesforce]] | Teams+ | OAuth client secret |
| `SALESFORCE_LOGIN_URL` | [[Salesforce]] | Teams+ | Login URL. Default: `https://login.salesforce.com`. Sandbox: `https://test.salesforce.com` |
| `PIPEDRIVE_CLIENT_ID` | [[Pipedrive]] | Business+ | OAuth client ID |
| `PIPEDRIVE_CLIENT_SECRET` | [[Pipedrive]] | Business+ | OAuth client secret |
| `ZOHO_CLIENT_ID` | [[Zoho]] | Business+ | OAuth client ID |
| `ZOHO_CLIENT_SECRET` | [[Zoho]] | Business+ | OAuth client secret |
| `DYNAMICS_CLIENT_ID` | [[Dynamics 365]] | Teams+ | Azure AD app client ID |
| `DYNAMICS_CLIENT_SECRET` | [[Dynamics 365]] | Teams+ | Azure AD app client secret |
| `DYNAMICS_TENANT_ID` | [[Dynamics 365]] | Teams+ | Azure AD tenant ID |
| `CLIO_CLIENT_ID` | [[Clio]] | Business+ | OAuth client ID |
| `CLIO_CLIENT_SECRET` | [[Clio]] | Business+ | OAuth client secret |

### Calendar & Video Integrations (8 vars)

| Variable | Integration | Plan | Description |
|----------|-------------|------|-------------|
| `GOOGLE_CLIENT_ID` | [[Google Calendar]] + [[Google Sheets]] | Free+ | Google Cloud OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | [[Google Calendar]] + [[Google Sheets]] | Free+ | Google Cloud OAuth client secret |
| `MICROSOFT_CLIENT_ID` | [[Microsoft Outlook]] | Business+ | Azure AD app client ID |
| `MICROSOFT_CLIENT_SECRET` | [[Microsoft Outlook]] | Business+ | Azure AD app client secret |
| `MICROSOFT_TENANT_ID` | [[Microsoft Outlook]] | Business+ | Azure AD tenant ID |
| `ZOOM_ACCOUNT_ID` | [[Video Providers\|Zoom]] | Free+ | Zoom account ID |
| `ZOOM_CLIENT_ID` | [[Video Providers\|Zoom]] | Free+ | Zoom OAuth client ID |
| `ZOOM_CLIENT_SECRET` | [[Video Providers\|Zoom]] | Free+ | Zoom OAuth client secret |

### Other Integrations (4 vars)

| Variable | Integration | Description |
|----------|-------------|-------------|
| `SLACK_CLIENT_ID` | Slack | Slack app client ID |
| `SLACK_CLIENT_SECRET` | Slack | Slack app client secret |
| `SLACK_SIGNING_SECRET` | Slack | Webhook signature verification |
| `RESEND_API_KEY` | Resend | Transactional email (invitations, notifications) |

---

## Scope Legend

| Scope | Prefix | Accessible From | Security |
|-------|--------|----------------|----------|
| **Public** | `NEXT_PUBLIC_` | Browser + Server | Safe to expose (measurement IDs, publishable keys) |
| **Server** | No prefix | Server only | **Never** expose to browser. Contains secrets. |

---

## Deployment Notes

- **Local dev:** Copy `.env.example` → `.env.local`, fill in values
- **Vercel:** Configure in Project Settings → Environment Variables
- **All environments:** Most vars are set for "All Environments" in Vercel
- **Graceful degradation:** Analytics vars (GA4, PostHog) and reCAPTCHA are optional; the app works without them (logs to console in dev)
- **Token generation:** For `TOKEN_ENCRYPTION_KEY`, generate 64 hex chars: `openssl rand -hex 32`
- **Secret generation:** For `INTERNAL_API_SECRET`, `QUEUE_PROCESSING_SECRET`, etc.: `openssl rand -base64 32`

---

## Related Notes

- [[Security & Encryption]] — Token encryption details (AES-256-GCM)
- [[Bland AI]] — Master key architecture
- [[Stripe Integration]] — Payment processing
- [[Upstash Redis]] — Concurrency control
- [[Google Analytics 4]] — GA4 event tracking
- [[PostHog]] — Behavioral analytics
- [[App Identity]] — Full tech stack reference
