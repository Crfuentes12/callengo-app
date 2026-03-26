# Callengo Legal Knowledge Base — COMPLETE — Generated March 25, 2026 — Updated March 26, 2026

---

# SECTION 1 — ENTITY & CONTACT INFORMATION

## 1.1 Legal Entity

**Legal Name:** Fuentes Digital Ventures LLC
**Commercial Brand:** Callengo
**Entity Type:** Domestic Limited Liability Company
**Jurisdiction of Formation:** State of Wyoming, United States of America
**Governing Statute:** Wyoming Limited Liability Company Act, Wyoming Statutes §§ 17-29-101 through 17-29-1105

## 1.2 Formation & Filing Details

**State Filing ID:** 2024-001561254
**Formation Date:** November 26, 2024
**Status:** Active / Good Standing
**NAICS Code:** 541512 — Computer Systems Design Services

## 1.3 Principal Office Address

Fuentes Digital Ventures LLC
5830 E 2nd St, Ste 7000 #20312
Casper, WY 82609
United States of America

## 1.4 Registered Agent

Republic Registered Agent LLC
5830 E 2nd St, Ste 7000
Casper, WY 82609
United States of America

## 1.5 Management Structure

**Sole Member and Manager:** Cristopher Fuentes
**Place of Residence:** Valencia, Spain (European Union)

Note: The sole member and manager resides in the European Union. This fact has direct relevance to GDPR applicability analysis set forth in Section 16 of this document.

## 1.6 Contact Information

**Website:** https://callengo.com
**Application URL:** https://app.callengo.com
**Legal Inquiries:** legal@callengo.com
**Support:** Available through the application dashboard

## 1.7 Document Metadata

**Document Type:** Internal Legal Knowledge Base — NOT for public distribution without review
**Intended Use:** Source material for generating Privacy Policy, Terms of Service, DPA, and other public-facing legal documents
**Date Generated:** March 25, 2026
**Governing Law for Company Operations:** Wyoming LLC Act
**Governing Law for Customer Agreements:** Wyoming state law (unless separately specified in executed agreements)

## 1.8 Product Description

Callengo is a business-to-business (B2B) Software-as-a-Service (SaaS) platform that provides automated outbound calling infrastructure powered by artificial intelligence. The platform enables business customers to deploy AI voice agents that autonomously initiate telephone calls to the business customer's own contact lists for purposes defined by the business customer, including but not limited to: lead qualification using the BANT framework, contact data validation and CRM enrichment, and appointment confirmation and scheduling management. Callengo does not itself initiate calls, select contacts, define campaign objectives, or operate as a telemarketer. All calling activity is initiated by and attributed to the business customer (the Callengo account holder), not to Fuentes Digital Ventures LLC.


---

# SECTION 2 — AUTHENTICATION & USER DATA

## 2.1 Authentication Provider

Callengo uses **Supabase Auth** as the primary authentication infrastructure. Supabase Auth is a managed authentication service built on PostgreSQL and GoTrue. All password hashing is performed server-side by Supabase using bcrypt. Fuentes Digital Ventures LLC never stores, processes, or has access to plaintext passwords at any point in the authentication flow.

**Authentication file locations:**
- `src/contexts/AuthContext.tsx` — Client-side auth context provider
- `middleware.ts` — Edge middleware enforcing auth on all protected routes
- `src/app/auth/callback/route.ts` — OAuth and email magic link callback handler
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server-side Supabase client (cookie-based)
- `src/lib/supabase/service.ts` — Service role client (bypasses RLS, used only in server-side API routes)

## 2.2 Authentication Methods

### 2.2.1 Email and Password
Users register with email address and password. Password minimum length is 6 characters (client-side enforced). A password strength indicator is shown during registration. Email verification is required before the account can access protected routes. The middleware explicitly checks `user.email_confirmed_at` and redirects unverified users to `/auth/verify-email`.

### 2.2.2 Social OAuth (Supabase-Managed)
Three social OAuth providers are configured via Supabase Auth:
- **Google** (OAuth 2.0)
- **Microsoft Azure AD** (OAuth 2.0)
- **Slack OIDC** (OpenID Connect)

These are configured as Supabase OAuth providers. The OAuth flow is: Supabase Auth → Provider → Supabase Auth callback → `/auth/callback` → application. Supabase manages the token exchange. Callengo's application layer receives only the authenticated user object; it does not handle raw OAuth tokens from social providers for authentication purposes.

### 2.2.3 Multi-Factor Authentication (TOTP)
TOTP-based MFA is implemented via Supabase Auth MFA API (`src/components/settings/SettingsManager.tsx`). Users can enroll a TOTP authenticator application (Google Authenticator, Authy, Microsoft Authenticator, etc.). The enrollment flow uses `supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Callengo' })`. MFA factors are stored by Supabase. Callengo does not implement SMS-based MFA.

## 2.3 Fields Collected at Registration

The following fields are collected during the signup process (`src/app/auth/signup/page.tsx`):

| Field | Table | Column | Type | Notes |
|-------|-------|--------|------|-------|
| Email address | `users` | `email` | text | Required; unique; used as login |
| Password | Supabase Auth | (hashed) | — | Never stored in plaintext; bcrypt-hashed by Supabase |
| Full name | `users` | `full_name` | text | Required at signup; stored in Supabase `user_metadata` and in `users` table |

reCAPTCHA v3 score is checked server-side at `/api/auth/verify-recaptcha` using `RECAPTCHA_SECRET_KEY`; the score itself is not stored persistently.

### 2.3.1 Additional User-Profile Fields (Stored in `users` Table)
The following fields are populated post-registration or auto-detected:

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| `id` | uuid | Supabase Auth UID | Primary key; equals auth.uid() |
| `company_id` | uuid | Onboarding / team invite | FK to `companies` table |
| `email` | text | Auth signup | Immutable via self-update (trigger `trg_prevent_sensitive_field_changes`) |
| `full_name` | text | Signup form | Editable |
| `role` | text | Default 'member'; set by owner | Possible values: 'owner', 'admin', 'member' |
| `currency` | varchar | Geolocation auto-detect | e.g., 'USD', 'EUR' |
| `country_code` | varchar | Geolocation auto-detect | ISO 3166-1 alpha-2 |
| `country_name` | varchar | Geolocation auto-detect | Full country name |
| `city` | varchar | Geolocation auto-detect | |
| `region` | varchar | Geolocation auto-detect | |
| `timezone` | varchar | Geolocation auto-detect | |
| `ip_address` | varchar | Geolocation auto-detect | IP address at time of location detection |
| `location_logs` | jsonb | Auto-updated | Array of historical location data points |
| `location_updated_at` | timestamptz | Auto-updated | Last geolocation refresh |
| `fav_voices` | jsonb | User preference | Array of favorite AI voice IDs |
| `notifications_enabled` | bool | Default true | In-app notification preference |
| `created_at` | timestamptz | Auto | Record creation timestamp |
| `updated_at` | timestamptz | Auto | Last record update |

**Geolocation note:** Location data (country, city, region, timezone, IP address) is automatically detected using the `useAutoGeolocation` hook (`src/hooks/useAutoGeolocation.ts`) and stored in the `users` table. This is used to pre-select currency and display formatting. IP addresses are stored in the `users` table, constituting personal data under GDPR.

## 2.4 Session Management

Session management is handled by Supabase Auth using JWT access tokens and refresh tokens stored in cookies. The middleware (`middleware.ts`) validates sessions on every protected route request. A `x-user-meta` cookie (HTTPOnly, Secure in production, SameSite=lax, 5-minute TTL) caches `company_id` and `role` to reduce database queries. The `AuthContext.tsx` uses `supabase.auth.onAuthStateChange` to listen for session events and automatically redirects users on `SIGNED_OUT` events.

Session tokens are stored in Supabase-managed HTTP-only cookies. The application does not store auth tokens in `localStorage` or `sessionStorage`.

## 2.5 OAuth Token Handling for Integration Providers

OAuth access tokens and refresh tokens for CRM and calendar integrations (11 providers: HubSpot, Salesforce, Pipedrive, Zoho CRM, Microsoft Dynamics 365, Clio, Google Calendar, Google Sheets, Microsoft Outlook, Zoom, Slack) are encrypted using AES-256-GCM before storage in Supabase (`src/lib/encryption.ts`). The encryption key is `TOKEN_ENCRYPTION_KEY` (exactly 64 hexadecimal characters = 32 bytes). Encrypted tokens are stored in the format `enc:<base64-iv>:<base64-authTag>:<base64-ciphertext>`. Token decryption is backward-compatible with legacy plaintext tokens. OAuth state parameters are signed with HMAC-SHA256 via `src/lib/oauth-state.ts` using `OAUTH_STATE_SECRET` to prevent CSRF attacks.

## 2.6 Google OAuth Scopes (Integration Layer)

The following Google OAuth scopes are requested by Callengo for calendar and spreadsheet integrations. These are distinct from and in addition to any scopes used by Supabase for social login.

**File:** `src/lib/calendar/google.ts` (lines 27–32)
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

These same scopes are used for the Google Sheets integration (shared Google OAuth client). The `calendar` scope provides read/write access to all calendars. The `calendar.events` scope provides read/write access to calendar events. The `userinfo.email` and `userinfo.profile` scopes are used to identify the connecting user and associate the integration with the correct Callengo account.

## 2.7 Microsoft OAuth Scopes

**Microsoft Outlook Calendar — File:** `src/lib/calendar/microsoft.ts` (lines 40–43)
```
Calendars.ReadWrite
User.Read
offline_access
```

**Microsoft Dynamics 365 — File:** `src/lib/dynamics/auth.ts` (lines 40–46)
```
openid
profile
email
offline_access
https://graph.microsoft.com/User.Read
{dynamics_instance_url}/user_impersonation  (dynamically appended per instance)
```

## 2.8 HubSpot OAuth Scopes

**File:** `src/lib/hubspot/auth.ts` (lines 34–42)
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.deals.read
crm.objects.owners.read
crm.lists.read
oauth
```

## 2.9 Salesforce OAuth Scopes

**File:** `src/lib/salesforce/auth.ts` (lines 33–38)
```
api
refresh_token
id
full
```

The `full` scope in Salesforce grants access to all accessible data and operations within the connected Salesforce org. Callengo requests this scope to support comprehensive CRM automation: importing contact and lead records (name, email, phone, company, address, owner), syncing calendar events, and supporting bidirectional data flows as part of the contact enrichment and call result push back to the CRM. The `full` scope is necessary because: (a) Callengo needs to read Contact, Lead, Account, Event, and User objects across the org; (b) the sync architecture supports bidirectional flows (future: pushing call outcomes back to SF records); (c) limiting to named object-level scopes would require maintaining a separate scope list for each Salesforce object type, which Salesforce's per-object OAuth model does not support in a maintainable way. The actual API calls made are strictly limited to SOQL queries on Contact, Lead, Account, Event, and User objects — no bulk delete or mass update operations are performed. This is documented further in GAP-010.

## 2.10 Zoho CRM OAuth Scopes

**File:** `src/lib/zoho/auth.ts` (lines 37–43)
```
ZohoCRM.modules.ALL
ZohoCRM.settings.ALL
ZohoCRM.users.ALL
ZohoCRM.org.ALL
ZohoCRM.notifications.ALL
```

The `modules.ALL` scope covers all Zoho CRM modules (Contacts, Leads, Accounts, etc.) — required for contact and lead import across any module the customer uses. `settings.ALL` is needed to read field metadata and layout configuration to correctly map Zoho fields to Callengo contact fields. `users.ALL` maps record owners (OwnerId) to names. `org.ALL` reads organization-level configuration. `notifications.ALL` enables Zoho notification subscriptions for real-time sync triggers. The integration performs: (a) inbound sync — fetching Contacts, Leads, and Account records; (b) outbound write-back — pushing call results back to Zoho Contact/Lead records as notes via `pushCallResultToZoho()` and `pushContactUpdatesToZoho()` in `src/lib/zoho/sync.ts`. These broad scopes are justified by the bidirectional automation model — Callengo needs to read all contact-related modules and write call outcomes back to the CRM without manual user intervention. See GAP-013 for further analysis.

## 2.11 Pipedrive, Clio — No Explicit Scopes

Pipedrive and Clio OAuth integrations do not pass explicit scope parameters in the authorization URL. Permissions are configured at the application registration level in each provider's developer portal.

## 2.12 SimplyBook.me — Token-Based Authentication

SimplyBook.me uses username/password token exchange rather than OAuth. The `src/lib/simplybook/auth.ts` file sends `company` (login), `login`, and `password` to SimplyBook's admin API endpoint to obtain a session token. The session token is stored encrypted in `simplybook_integrations.sb_token`.

## 2.13 Password Handling Confirmation

Passwords are never stored in plaintext by Fuentes Digital Ventures LLC. Supabase Auth handles all password hashing using bcrypt with appropriate salt rounds. Callengo's application code never receives, logs, transmits, or stores raw passwords. The only password-adjacent operation performed by Callengo's code is passing the plaintext password over HTTPS to Supabase's authentication API endpoint during signup and login operations.

## 2.14 Multi-Factor Authentication

TOTP-based MFA is available to all users. Enrollment is optional and user-initiated from the Settings page. MFA factors are managed entirely by Supabase Auth. Callengo does not store or process TOTP secrets. The issuer name presented to authenticator applications is 'Callengo'.


---

# SECTION 3 — THIRD-PARTY INTEGRATION DATA MAP

The following table documents every third-party service that receives or sends personal data in the Callengo platform. "Customer PII" refers to data about Callengo's business customers (the account holders). "Contact PII" refers to data about the end individuals who are called by Callengo customers (the contacts in campaigns).

## 3.1 Integration Inventory

### Bland AI (Voice Infrastructure)
- **Purpose:** Outbound AI voice call execution, transcription, recording, voicemail detection
- **Data Sent:** Contact phone number (E.164), AI task prompt/script, voice ID, max call duration, voicemail instructions, webhook callback URL, metadata including company_id, contact_id, agent_run_id, agent_template_slug, campaign_id
- **Data Received:** Call ID, call status, duration, recording URL (hosted by Bland AI), full call transcript, AI-generated call summary, price (cost in USD), `answered_by` classification (human/voicemail/machine), error messages
- **Stored in DB:** Yes — `call_logs` table: all fields above; `voicemail_logs` table: detection metadata
- **Auth Method:** Single master API key (`BLAND_API_KEY`); webhook verification via HMAC-SHA256 (`BLAND_WEBHOOK_SECRET`)
- **Processes Customer PII:** Yes (account owner credentials and settings)
- **Processes Contact PII:** Yes (phone numbers, names embedded in call scripts, call recordings and transcripts containing personal conversations)
- **Call Recording:** All calls are recorded by default (`record: true` in `src/lib/bland/master-client.ts` line 215). Recording is enabled globally because audio data is essential for quality analysis, dispute resolution, and AI post-call processing. Recording URLs are served by Bland AI's infrastructure (not stored as binary in Callengo's database — only the URL is stored). Default retention in Callengo's UI is 30 days. Customers who subscribe to the **Recording Vault add-on** ($12/month) receive extended 12-month recording retention. Recording audio is not stored in Supabase directly — it resides on Bland AI's servers at the recording URL. Callengo stores only the reference URL encrypted at rest.
- **Data Processing Agreement:** Bland AI (Intelliga Corporation) publishes a full DPA at `https://www.bland.ai/legal/data-processing-agreement` (updated March 27, 2025). The DPA is executed by reference upon acceptance of Bland's Terms of Service. Key provisions confirmed: (a) purpose limitation — Bland processes Customer Personal Data only for providing the Services; (b) prohibition on sale or sharing of Customer Personal Data; (c) deidentified data may be used for product improvement; (d) Security Measures documented at `https://trust.delve.co/blandai`; (e) deletion of Customer Personal Data upon request within 14 days of service cessation (`compliance@bland.ai`); (f) sub-processor list at `https://trust.delve.co/blandai` with 14-day advance notice of changes; (g) SCCs incorporated for EU/EEA/UK/Switzerland data transfers; (h) breach notification without undue delay; (i) audit rights via SOC 2 Type II report (annually, on reasonable request).
- **Training Data:** The DPA explicitly permits Bland to create Deidentified Data from service data for product improvement purposes. However, Customer Personal Data (including call audio and transcripts) is not used for model training as long as it remains identifiable. Callengo customers whose contacts are EU/EEA residents should be aware of this deidentification provision when preparing their own privacy notices.
- **Privacy Policy:** https://www.bland.ai/privacy

### OpenAI (AI Analysis)
- **Purpose:** Post-call intent analysis (GPT-4o-mini), call outcome classification (GPT-4o), agent recommendation (GPT-4o-mini), context suggestion generation (GPT-4o-mini)
- **Data Sent:** Call transcripts (up to 10,000 characters for intent analysis; unrestricted for full analysis), contact names, email addresses, phone numbers, postal addresses, company names, existing CRM data fields, business descriptions
- **Data Received:** Structured JSON analysis results: intent classification, confidence scores, extracted contact data, sentiment analysis, follow-up recommendations
- **Stored in DB:** Yes — analysis results stored in `call_logs.analysis` (JSONB), `contacts.analysis` (JSONB), `analysis_queue.result` (JSONB)
- **Auth Method:** API key (`OPENAI_API_KEY`)
- **Processes Customer PII:** Yes (business context)
- **Processes Contact PII:** Yes (personal data of called contacts appears in transcripts)
- **Training Opt-Out:** CONFIRMED DISABLED — verified via OpenAI Platform → Settings → Data Controls → Sharing (March 25, 2026). All three options set to Disabled: (1) "Enable sharing of model feedback from the Platform"; (2) "Share evaluation and fine-tuning data with OpenAI"; (3) "Share inputs and outputs with OpenAI". Callengo's API data (call transcripts, prompts, completions) is not used to train OpenAI models. API call logging is enabled (Enabled per call) — prompts and completions are retained by OpenAI for up to 30 days for the organization's own review via the OpenAI Logs dashboard; this is not training data.
- **Privacy Policy:** https://openai.com/policies/privacy-policy

### Supabase (Database & Auth)
- **Purpose:** Primary relational database (PostgreSQL), authentication service, real-time subscriptions, file storage
- **Data Sent:** All application data including user PII, contact PII, call records, billing data, integration tokens
- **Data Received:** All stored data
- **Stored in DB:** IS the database — all 57 tables
- **Auth Method:** Anon key (client-side, respects RLS), service role key (server-side, bypasses RLS), JWT tokens
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes
- **Privacy Policy:** https://supabase.com/privacy

### Stripe (Payments)
- **Purpose:** Subscription billing, payment processing, metered usage billing, customer portal
- **Data Sent:** Company name, user email, subscription plan details, usage records (overage minutes), metadata (company_id, plan_id, billing_cycle)
- **Data Received:** Customer ID (cus_xxx), subscription ID (sub_xxx), subscription item ID, invoice data, payment status, checkout session URLs
- **Stored in DB:** Yes — `company_subscriptions` (Stripe IDs, subscription status), `billing_history` (invoice URLs, payment intent IDs), `stripe_events` (full Stripe event objects), `billing_events`, `company_addons`
- **Auth Method:** Secret API key (`STRIPE_SECRET_KEY`); webhook validation via `STRIPE_WEBHOOK_SECRET` (Stripe signature)
- **Processes Customer PII:** Yes (billing contact email, company metadata)
- **Processes Contact PII:** No
- **Privacy Policy:** https://stripe.com/privacy

### Google (Calendar, Sheets, OAuth)
- **Purpose:** Calendar synchronization (read/write), contact import from Google Sheets, OAuth identity for social login
- **Data Sent:** Calendar event details (title, start/end times, description, attendees), contact data (for Sheets reads), OAuth authorization codes
- **Data Received:** Calendar events (title, times, attendee details, external event IDs), spreadsheet rows (mapped to contact fields), OAuth tokens (access + refresh), user profile (email, name, profile picture URL)
- **Stored in DB:** Yes — `calendar_integrations` (encrypted access/refresh tokens, scopes, provider email), `calendar_events` (synced event details including contact name, phone, email), `google_sheets_integrations` (encrypted tokens), `google_sheets_linked_sheets` (spreadsheet IDs and column mappings)
- **Auth Method:** OAuth 2.0 (access + refresh tokens, encrypted with AES-256-GCM); signed state parameter (HMAC-SHA256)
- **Processes Customer PII:** Yes (calendar owner identity, sheet access)
- **Processes Contact PII:** Yes (contact data in calendar event attendees and sheets)
- **Privacy Policy:** https://policies.google.com/privacy

### Microsoft (Outlook, Dynamics 365)
- **Purpose:** Microsoft Outlook calendar synchronization; Microsoft Dynamics 365 CRM contact sync
- **Data Sent:** Calendar event details; contact sync requests; OAuth authorization codes
- **Data Received:** Calendar events, Dynamics 365 contact records (name, email, phone, company), OAuth tokens, user profile (email, name, tenant ID)
- **Stored in DB:** Yes — `calendar_integrations` (encrypted tokens, microsoft_tenant_id, microsoft_calendar_id), `dynamics_integrations` (encrypted tokens, org details, instance URL), `dynamics_contact_mappings`, `dynamics_sync_logs`
- **Auth Method:** OAuth 2.0 via Microsoft Identity Platform (Azure AD); tenant-specific authorization
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes (contact data from Dynamics 365)
- **Privacy Policy:** https://privacy.microsoft.com/en-us/privacystatement

### HubSpot (CRM Integration + Internal User Sync)
- **Purpose (CRM):** Bidirectional contact sync between Callengo and customer's HubSpot CRM; lifecycle stage updates on subscription events
- **Purpose (Internal):** HubSpot forms used on the marketing website; potential contact sync of Callengo users to HubSpot via `src/lib/hubspot-user-sync.ts`
- **Data Sent (CRM):** Contact data (name, email, phone, address, call outcomes, qualification status); subscription event data (plan name, MRR) for contact/deal updates
- **Data Received (CRM):** HubSpot contact records (name, email, phone, company, deal stage)
- **Stored in DB:** Yes — `hubspot_integrations` (encrypted tokens, hub_id, hub_domain, user details), `hubspot_contact_mappings` (contact ID cross-references), `hubspot_sync_logs`
- **Auth Method:** OAuth 2.0 (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`); Private App Token (`HUBSPOT_PRIVATE_APP_TOKEN`) for internal ops
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes
- **Privacy Policy:** https://legal.hubspot.com/privacy-policy
- **Internal HubSpot Portal ID:** `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` (public env var)

### Salesforce (CRM Integration)
- **Purpose:** Contact import from Salesforce CRM (currently read-only; no outbound push implemented)
- **Data Sent:** OAuth authorization codes; API queries for contacts/leads
- **Data Received:** Salesforce contact and lead records (name, email, phone, company, address)
- **Stored in DB:** Yes — `salesforce_integrations` (encrypted tokens, org details, user details), `salesforce_contact_mappings`, `salesforce_sync_logs`
- **Auth Method:** OAuth 2.0 (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`)
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes
- **Privacy Policy:** https://www.salesforce.com/company/privacy/

### Pipedrive (CRM Integration)
- **Purpose:** Contact import from Pipedrive and outbound push of call results back to Pipedrive persons/deals
- **Data Sent:** OAuth authorization; contact data writes (call outcomes, qualification status) via `pushContactToPipedrive()`
- **Data Received:** Pipedrive person records (name, email, phone, company, deal stage)
- **Stored in DB:** Yes — `pipedrive_integrations` (encrypted tokens, company details), `pipedrive_contact_mappings`, `pipedrive_sync_logs`
- **Auth Method:** OAuth 2.0 (`PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET`)
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes
- **Privacy Policy:** https://www.pipedrive.com/en/privacy

### Zoho CRM (CRM Integration)
- **Purpose:** Contact import from Zoho CRM (currently read-only)
- **Data Sent:** OAuth authorization; contact read queries
- **Data Received:** Zoho CRM contact records (name, email, phone, address, company)
- **Stored in DB:** Yes — `zoho_integrations` (encrypted tokens, org details), `zoho_contact_mappings`, `zoho_sync_logs`
- **Auth Method:** OAuth 2.0 (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`)
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes
- **Privacy Policy:** https://www.zoho.com/privacy.html

### Clio (Legal CRM Integration)
- **Purpose:** Contact import from Clio (legal practice management software); read-only contact sync
- **Data Sent:** OAuth authorization; contact read queries
- **Data Received:** Clio contact records (clients and matters — name, email, phone, address, firm details)
- **Stored in DB:** Yes — `clio_integrations` (encrypted tokens, firm details, user details), `clio_contact_mappings`, `clio_sync_logs`
- **Auth Method:** OAuth 2.0 (`CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET`)
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes (legal client data — heightened sensitivity)
- **Privacy Policy:** https://www.clio.com/privacy-policy/

### SimplyBook.me (Appointment Scheduling Integration)
- **Purpose:** Import of booked appointments as contacts for confirmation calling
- **Data Sent:** Company login, user login, password (for token exchange); contact queries
- **Data Received:** Client records (name, email, phone, booking details)
- **Stored in DB:** Yes — `simplybook_integrations` (encrypted sb_token, user/company details), `simplybook_contact_mappings`, `simplybook_sync_logs`, `simplybook_webhook_logs`
- **Auth Method:** Token-based (username/password exchange, not OAuth)
- **Processes Customer PII:** Yes
- **Processes Contact PII:** Yes (booking client data)
- **Privacy Policy:** https://simplybook.me/en/privacy-policy

### Upstash Redis (Rate Limiting & Concurrency)
- **Purpose:** Distributed rate limiting, call concurrency tracking, call slot management, contact cooldown enforcement
- **Data Sent:** Counter keys (company ID, contact ID, call ID — no PII), TTL values
- **Data Received:** Counter values, slot availability
- **Stored:** In-memory Redis, no persistent storage beyond TTL (max 30 minutes for call slots)
- **Auth Method:** REST API token (`UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`)
- **Processes Customer PII:** No (only UUIDs used as keys)
- **Processes Contact PII:** No (only contact UUID used for cooldown key, no personal data)
- **Privacy Policy:** https://upstash.com/trust/privacy.pdf

### Vercel (Hosting & Deployment)
- **Purpose:** Serverless function hosting, edge middleware, CDN, deployment infrastructure
- **Data Sent:** All HTTP request/response traffic including user data, all server-side logs
- **Data Received:** N/A (hosting provider)
- **Stored:** Vercel logs (function invocation logs, error logs) subject to Vercel's retention policy
- **Auth Method:** Vercel project deployment tokens
- **Processes Customer PII:** Yes (all traffic passes through Vercel infrastructure)
- **Processes Contact PII:** Yes (call dispatch and webhook processing occurs on Vercel)
- **Privacy Policy:** https://vercel.com/legal/privacy-policy

### PostHog (Product Analytics)
- **Purpose:** Product usage analytics, session recording, feature flags, funnel analysis, group analytics
- **Data Sent:** User UUID (Supabase `user.id` — not email), first name, company ID, company name, plan information, behavioral event data (see Section 4), session recordings with PII masking
- **Data Received:** Feature flag values
- **Stored:** PostHog cloud (US region — `us.i.posthog.com`)
- **Auth Method:** Project key (`NEXT_PUBLIC_POSTHOG_KEY`)
- **Processes Customer PII:** Yes (first name, usage behavior — email is NOT sent as of March 25, 2026 fix; users identified by UUID)
- **Processes Contact PII:** No (contacts being called are not tracked in PostHog)
- **Privacy Policy:** https://posthog.com/privacy

### Google Analytics 4 (Web Analytics)
- **Purpose:** Web analytics, user behavior tracking, conversion measurement
- **Data Sent:** User UUID (Supabase `user.id` — not email), behavioral events, session data
- **Data Received:** N/A (data sink)
- **Stored:** Google Analytics cloud
- **Auth Method:** Measurement ID (`NEXT_PUBLIC_GA_MEASUREMENT_ID`), GA4 API secret (`GA_API_SECRET`) for server-side events
- **Processes Customer PII:** Yes (UUID, behavioral data — email is NOT sent as of March 25, 2026 fix; `user_email` property removed from all analytics calls)
- **Processes Contact PII:** No
- **Privacy Policy:** https://policies.google.com/privacy

### Google reCAPTCHA v3 (Bot Detection)
- **Purpose:** Bot detection on signup form
- **Data Sent:** reCAPTCHA assessment token (derived from browser fingerprint, IP address, user behavior)
- **Data Received:** Risk score
- **Stored:** Not stored by Callengo
- **Auth Method:** Site key (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`), secret key (`RECAPTCHA_SECRET_KEY`)
- **Processes Customer PII:** Yes (IP address, browser fingerprint at signup)
- **Processes Contact PII:** No
- **Privacy Policy:** https://policies.google.com/privacy

### Resend (Transactional Email — Currently Not Active)
- **Purpose:** Resend (`RESEND_API_KEY`) is configured as an optional transactional email provider, but it is **not currently the active email delivery path**. All transactional emails (team invitations, billing notifications, email verification, password reset) are delivered by **Supabase Auth's built-in email service**, which uses Supabase's managed SMTP infrastructure (powered by AWS SES in the Supabase platform). Resend may be activated in a future release if custom transactional email templates are required outside of Supabase Auth flows.
- **Supabase Auth emails sent:** Email verification on signup, password reset links, team invitation emails (via `supabase.auth.admin.inviteUserByEmail()`), and magic link emails.
- **Data Sent (via Supabase Auth email):** Recipient email address, invitation or authentication link; processed by Supabase's email infrastructure subject to Supabase's DPA.
- **Data Stored:** Email delivery events are not separately stored in Callengo's database; Supabase Auth manages delivery state.
- **Auth Method (if Resend is activated):** API key (`RESEND_API_KEY`)
- **Processes Customer PII:** Yes — team member email addresses are the recipient of invitation emails
- **Processes Contact PII:** No
- **Privacy Policy (Supabase Auth email):** https://supabase.com/privacy
- **Privacy Policy (Resend — if activated):** https://resend.com/legal/privacy-policy
- **Note:** `src/app/api/team/invite/route.ts` (line 208) contains a `console.log` that logs the invitee's email address to Vercel's runtime log when the invited user already has a Supabase Auth account. This constitutes a PII disclosure to Vercel's log infrastructure. See GAP-024.

### Slack (Notification Integration)
- **Purpose:** Customer-configurable notification delivery to their Slack workspace
- **Data Sent:** Call outcome summaries, campaign completion notifications (as configured by customer)
- **Data Received:** Workspace and channel authorization
- **Stored:** `calendar_integrations` (Slack OAuth tokens encrypted)
- **Auth Method:** OAuth 2.0 (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`); webhook signing (`SLACK_SIGNING_SECRET`)
- **Processes Customer PII:** Yes (Slack workspace identity)
- **Processes Contact PII:** Yes (contact names and call outcomes may appear in notification messages)
- **Privacy Policy:** https://slack.com/trust/privacy/privacy-policy

### Zoom (Video Conferencing Integration)
- **Purpose:** Video meeting link generation for appointment confirmation agent
- **Data Sent:** OAuth authorization; meeting creation requests (title, time, duration)
- **Data Received:** Zoom meeting links (URL, meeting ID, passcode)
- **Stored:** `calendar_integrations` (encrypted Zoom tokens via Supabase OAuth)
- **Auth Method:** Server-to-server OAuth (`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`)
- **Processes Customer PII:** Yes (Zoom account identity)
- **Processes Contact PII:** Indirectly (meeting invitations sent to contacts may include contact email)
- **Privacy Policy:** https://explore.zoom.us/en/privacy/


---

# SECTION 4 — INTERNAL ANALYTICS & TRACKING DETAIL

## 4.1 Google Analytics 4

**Initialization File:** `src/app/layout.tsx` (lines 4, 99–101)
```tsx
import { GoogleAnalytics } from '@next/third-parties/google';
...
{process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
)}
```

**Measurement ID:** Configured via `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable (format: `G-XXXXXXXXXX`). Value not stored in the codebase.
**Server-Side API Secret:** `GA_API_SECRET` (used for Measurement Protocol server-side events)
**Implementation Library:** `@next/third-parties/google` (Next.js official GA4 component)
**Active On:** app.callengo.com (application) — the marketing site status was not separately confirmed but the layout file applies globally.
**GTM:** No Google Tag Manager scripts found in the codebase.
**Google Signals:** Not explicitly configured — default GA4 behavior applies.
**IP Anonymization:** GA4 anonymizes IPs by default (as of 2022, all GA4 IPs are anonymized); no explicit configuration needed.
**Google Ads Linking:** No Google Ads conversion tracking scripts, conversion tags, or remarketing pixels found in the codebase.

### 4.1.1 GA4 User Properties Sent
The `AnalyticsProvider` component (`src/components/analytics/AnalyticsProvider.tsx`) sets the following user properties in GA4 via `gtag('set', 'user_properties', {...})`:

| Property | Contains PII | Notes |
|----------|-------------|-------|
| `user_id` | No (UUID) | GA4 User ID — used for cross-device tracking |
| ~~`email`~~ | ~~**YES**~~ | **Removed March 25, 2026** — `user_email` property deleted from all GA4 calls. Users are identified by UUID only. See GAP-007. |
| `plan_slug` | No | Subscription plan identifier |
| `billing_cycle` | No | 'monthly' or 'annual' |
| `company_industry` | No | |
| `team_size` | No | |
| `country_code` | Partial | ISO country code |
| `currency` | No | |
| `integrations_count` | No | |
| `contacts_count` | No | |

**Current PII status:** Email is no longer sent to GA4. Users are identified by Supabase UUID only. This resolves the compliance risk noted in the original document. See GAP-007 for full documentation of the fix.

### 4.1.2 GA4 Custom Events (130+ Events)
All events and their properties are defined in `src/lib/analytics.ts` (1,036 lines). Complete catalog:

**Authentication:** `sign_up` (method), `login` (method), `logout`, `password_reset_requested`, `password_reset_completed`, `email_verified`, `verification_email_resent`, `social_auth_clicked` (provider)

**Onboarding:** `onboarding_started`, `onboarding_step_completed` (step_name, step_number), `onboarding_company_created` (industry), `onboarding_completed` (industry), `onboarding_skipped` (at_step), `onboarding_wizard_opened` (source), `onboarding_wizard_dismissed` (at_step), `onboarding_company_reviewed`

**Billing:** `pricing_page_viewed` (source), `plan_comparison_viewed`, `checkout_started` (plan, billing_cycle, value, currency), `subscription_started` (plan, billing_cycle, value, currency, transaction_id), `subscription_upgraded` (from_plan, to_plan, value, currency), `subscription_downgraded` (from_plan, to_plan), `subscription_cancelled` (plan, reason, months_subscribed), `subscription_reactivated` (plan), `billing_portal_opened`, `addon_purchased` (addon_type, value, currency), `addon_cancelled` (addon_type), `overage_enabled` (budget_amount), `overage_disabled`, `overage_budget_updated` (budget_amount), `retention_offer_shown` (plan, months_subscribed), `retention_offer_accepted` (plan, discount_type), `retention_offer_declined` (plan), `upgrade_cta_clicked` (location, current_plan, target_plan), `extra_seat_purchased` (total_seats, value, currency), `billing_cycle_toggled` (billing_cycle), `invoice_viewed`

**Agents:** `agents_page_viewed`, `agent_card_clicked` (agent_type), `agent_config_modal_opened` (agent_type), `agent_config_step_completed` (agent_type, step_name, step_number), `agent_config_modal_closed` (agent_type, completed_steps), `agent_created` (agent_type, agent_name), `agent_deleted` (agent_type), `agent_switched` (from_type, to_type), `agent_voice_selected` (voice_id, voice_name, voice_gender), `agent_voice_previewed` (voice_id), `agent_voice_favorited` (voice_id), `test_call_initiated` (agent_type), `test_call_completed` (agent_type, duration_seconds, call_status), `agent_settings_updated` (agent_type, setting_name), `agent_integration_connected` (agent_type, integration_provider)

**Campaigns:** `campaigns_page_viewed`, `new_campaign_clicked`, `ai_agent_recommendation_requested` (description_length), `ai_agent_recommendation_selected` (recommended_type, selected_type, matched), `campaign_created` (agent_type, contact_count, follow_up_enabled, voicemail_enabled, calendar_enabled), `campaign_started` (agent_type, contact_count), `campaign_paused` (agent_type, calls_completed, total_contacts, progress_percent), `campaign_resumed` (agent_type), `campaign_completed` (agent_type, total_contacts, completed_calls, successful_calls, failed_calls, success_rate), `campaign_deleted` (agent_type), `campaign_detail_viewed` (agent_type, campaign_status), `campaigns_filtered` (filter_type, filter_value), `campaigns_searched` (query_length)

**Calls:** `calls_page_viewed`, `call_detail_opened` (call_status, agent_type), `call_recording_played` (agent_type, duration_seconds), `call_transcript_viewed` (agent_type), `call_analysis_viewed` (agent_type, sentiment, interest_level), `calls_filtered` (filter_type, filter_value), `calls_searched` (query_length, results_count), `calls_export_requested` (format)

**Contacts:** `contacts_page_viewed`, `contact_created` (source), `contacts_imported` (source, count, method), `contacts_exported` (format, count), `contact_list_created`, `contact_list_deleted`, `contact_edited` (fields_changed), `contacts_deleted` (count), `contacts_bulk_deleted` (count), `contacts_searched` (query_length, results_count), `contacts_filtered` (filter_type), `contacts_sorted` (sort_field, sort_direction), `contact_detail_viewed`, `ai_segmentation_used` (contact_count), `csv_import_started`, `csv_import_completed` (row_count, columns_matched), `csv_import_failed` (error_type), `google_sheets_import_started`, `google_sheets_import_completed` (row_count), `crm_contacts_subpage_viewed` (provider), `crm_contacts_imported` (provider, count)

**Integrations:** `integrations_page_viewed`, `integration_connect_started` (provider, integration_type), `integration_connected` (provider, integration_type), `integration_disconnected` (provider, integration_type), `integration_sync_started` (provider), `integration_sync_completed` (provider, records_created, records_updated, total_records), `integration_sync_failed` (provider, error_type), `slack_notifications_configured` (channels_count), `webhook_endpoint_created`, `webhook_endpoint_deleted`, `integration_feedback_submitted` (feedback_type)

**Calendar, Follow-ups, Voicemails, Team, Navigation, Settings, Dashboard, Analytics, AI Chat, Errors, Engagement:** Additional events tracking user interactions across all application features. Full catalog in `src/lib/analytics.ts`.

**Server-Side Events:** The `trackServerEvent()` function in `src/lib/analytics.ts` sends server-side GA4 events via the Measurement Protocol from:
- `src/app/api/webhooks/stripe/route.ts` (subscription lifecycle events)
- `src/app/api/bland/webhook/route.ts` (call completion events)

### 4.1.3 Enhanced Measurement
Enhanced Measurement triggers depend on GA4 property configuration in the Google Analytics dashboard (not configurable in code). The implementation uses the standard GA4 script tag which respects Enhanced Measurement settings.

## 4.2 PostHog

**Initialization File:** `src/lib/posthog.ts` (lines 21–62)
**Project Key:** Configured via `NEXT_PUBLIC_POSTHOG_KEY` (format: `phc_XXXXXXXXXX...`). Value not stored in codebase.
**Host:** `NEXT_PUBLIC_POSTHOG_HOST` or default `https://us.i.posthog.com`
**Data Residency:** US region (us.i.posthog.com)
**Active On:** app.callengo.com (the app layout includes PostHog provider)

**PostHog SDK Versions:**
- `posthog-js` (client-side)
- `posthog-node` (server-side, `src/lib/posthog-server.ts`)

**Key Configuration Settings:**
```
capture_pageview: false          (manual pageview tracking via PostHogPageTracker component)
capture_pageleave: true          (session duration tracking)
autocapture: true                (automatically captures clicks, form interactions)
respect_dnt: true                (respects browser Do Not Track setting)
persistence: 'localStorage+cookie'  (cross-session state)
session_recording:
  maskTextSelector: 'input[type="password"], input[type="email"], input[name="phone"]'
```

**Session Recording:** ENABLED. Passwords, email inputs, and phone number inputs are masked. Other form fields (such as company name, contact import fields) may NOT be masked and could capture data visible on screen. The masking selector does not cover all PII-bearing fields.

**Feature Flags:** ENABLED. Used in the application for feature gating. Feature flag keys are not specified in the codebase discovery.

### 4.2.1 PostHog User Properties
The `PostHogProvider` component (`src/components/analytics/PostHogProvider.tsx`) identifies users with:

| Property | Contains PII | Notes |
|----------|-------------|-------|
| `userId` | No (UUID) | Used as PostHog distinct_id — Supabase user UUID |
| ~~`email`~~ | ~~**YES**~~ | **Removed March 25, 2026** — `distinct_id` changed from `user.email` to `user.id`. Email no longer sent to PostHog. See GAP-007. |
| `fullName` | **YES** (low-risk) | User's full name — still sent for display/segmentation; consider removing for full anonymization |
| `planSlug` | No | |
| `billingCycle` | No | |
| `companyId` | No (UUID) | |
| `companyName` | No (business name) | Company name |
| `companyIndustry` | No | |
| `teamSize` | No | |
| `countryCode` | Partial | |
| `currency` | No | |
| `integrationsCount` | No | |
| `contactsCount` | No | |
| `createdAt` | No | |

**Current PII status:** Email removed. Users identified by UUID. First name (`fullName`) remains — lower-risk than email but should be reviewed if full pseudonymization is required for future enterprise contracts. See GAP-007.

Group analytics: `posthog.group('company', companyId)` is called, which enables company-level analytics grouping.

### 4.2.2 PostHog Custom Events (250+ Events)
Categories include all the same areas as GA4 with additional detail: `mfa_enrollment_started`, `mfa_enrollment_completed`, `mfa_disabled`, `ai_chat_response_received`, `ai_chat_suggestion_clicked`, `error_boundary_triggered`, `rate_limit_hit`, `cali_ai_panel_opened`, `cali_ai_question_asked`, and many more. Full catalog in `src/lib/posthog.ts`.

**Server-Side PostHog:** `src/lib/posthog-server.ts` — captures server-side events with `posthog-node` SDK. Called from API routes including Stripe webhook handler and Bland webhook handler.

### 4.2.3 PostHog & Consent
No cookie consent mechanism gates PostHog initialization. PostHog fires on page load for all authenticated users. The `respect_dnt: true` setting means PostHog will not track users who have enabled the Do Not Track browser setting, but no in-product consent UI exists.

## 4.3 HubSpot Tracking

**Portal ID:** Configured via `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` (public env var).
**Contact Form ID:** Configured via `NEXT_PUBLIC_HUBSPOT_CONTACT_FORM_ID` (public env var).

**Finding:** No embedded HubSpot tracking pixel (`_hsq.push` calls) or HubSpot tracking script (`//js.hs-scripts.com/...`) was found injected into any layout or component file. The HubSpot integration in this codebase is primarily a CRM data sync integration for contact management, not a visitor tracking implementation.

**hubspot-user-sync.ts:** The file `src/lib/hubspot-user-sync.ts` exists and performs server-side sync of Callengo account data to HubSpot CRM using the `HUBSPOT_PRIVATE_APP_TOKEN`. This is a B2B customer relationship management function (syncing paying customers to HubSpot), not website visitor tracking.

**HubSpot Cookies:** The following HubSpot tracking cookies (`hubspotutk`, `__hstc`, `__hssc`, `__hssrc`) are NOT expected to be set by the application layer since no HubSpot tracking script was found. They may be set by the marketing website if HubSpot tracking is added separately.

## 4.4 Google Ads, GTM, and Other Tracking

**Google Ads:** No Google Ads conversion tracking tags, remarketing pixels, Google Ads scripts, or `gtag('event', 'conversion', ...)` calls were found in the codebase.

**Google Tag Manager:** No GTM container script (`gtm.js`) or GTM dataLayer initialization was found in any layout file.

**Facebook/Meta Pixel:** Not present.
**TikTok Pixel:** Not present.
**LinkedIn Insight Tag:** Not present.
**Hotjar:** Not present.
**Intercom:** Not present.
**Drift:** Not present.
**Crisp:** Not present.
**Any other third-party embeds:** None identified.

## 4.5 reCAPTCHA v3

**File:** `src/app/auth/signup/page.tsx`
**Site Key:** `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
**Type:** Google reCAPTCHA v3 (invisible, no user challenge)
**Action:** `'signup'`
**Trigger:** Fires on signup form submission only
**Data Processed by Google:** Browser fingerprint, behavioral signals, IP address
**Data Retained by Callengo:** Only pass/fail result. Risk score not stored persistently.


---

# SECTION 5 — COOKIE & CONSENT IMPLEMENTATION

## 5.1 Current State

**Cookie Consent Banner:** NOT IMPLEMENTED. No cookie consent library, custom consent banner, consent management platform (CMP), or consent storage mechanism was found in the codebase at the time of this analysis.

**Consequence:** Google Analytics 4 and PostHog initialize and collect data without prior user consent. This is a compliance gap with respect to GDPR Article 7 (conditions for consent), the EU Cookie Directive (ePrivacy Directive 2002/58/EC as amended), the UK PECR, and comparable privacy laws in countries where the platform has users.

## 5.2 Google Consent Mode v2

**Status:** NOT IMPLEMENTED. Google Consent Mode v2 (`window.gtag('consent', 'update', {...})`) is not configured in any file. The GA4 script loads unconditionally when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, without checking any consent state.

## 5.3 Cookies Set by the Application

The following cookies are set or expected to be set by the Callengo application:

| Cookie Name | Set By | Type | Purpose | Duration | HTTPOnly | Secure | SameSite |
|-------------|--------|------|---------|----------|----------|--------|----------|
| `sb-[project-ref]-auth-token` | Supabase | First-party | Authentication JWT token | Session / refresh-based | Yes | Yes (prod) | Lax |
| `sb-[project-ref]-auth-token-code-verifier` | Supabase | First-party | PKCE code verifier for OAuth flow | Short-lived | Yes | Yes | Strict |
| `x-user-meta` | Callengo (`middleware.ts`) | First-party | Cached user metadata (company_id, role) | 5 minutes | Yes | Yes (prod) | Lax |

**Analytics Cookies (set by third-party scripts if loaded):**

| Cookie Name | Set By | Purpose | Duration |
|-------------|--------|---------|----------|
| `_ga` | Google Analytics | Distinguishes users | 2 years |
| `_ga_[ID]` | Google Analytics | Session state | 2 years |
| `_gid` | Google Analytics | Distinguishes users | 24 hours |
| `ph_[key]_posthog` | PostHog | Session/user identity | 1 year |
| `__ph_opt_in_out_[key]` | PostHog | Opt-in/out state | 1 year |

## 5.4 Consent Architecture Gaps

The application currently lacks:
1. A cookie consent banner or CMP (OneTrust, Cookiebot, Osano, or custom)
2. Categorization of cookies by purpose (strictly necessary, functional, analytics, marketing)
3. A mechanism to block non-essential scripts before consent is obtained
4. Google Consent Mode v2 integration for GA4
5. A mechanism to store and honor consent preferences on return visits
6. Geo-based consent logic (e.g., stricter consent for EU/UK/California users)
7. A cookie policy page (accessible from consent banner and privacy policy)

## 5.5 Strictly Necessary Cookies

The `sb-[project-ref]-auth-token` and `x-user-meta` cookies are strictly necessary for authentication and session management. They do not require consent under the ePrivacy Directive or GDPR. However, their existence and purpose must be disclosed in a cookie policy.

## 5.6 Recommended Consent Architecture

For compliance, the following architecture is recommended (not implemented — see Section 21):
1. Implement Google Consent Mode v2 with default state set to `denied` for `analytics_storage` and `ad_storage`
2. Implement a CMP that collects granular consent before analytics scripts fire
3. Upon consent grant, update consent mode: `gtag('consent', 'update', { analytics_storage: 'granted' })`
4. PostHog: use `posthog.opt_in_capturing()` only after consent obtained
5. Store consent decisions in a first-party cookie or Supabase (for logged-in users)
6. Honor opt-out requests by calling `posthog.opt_out_capturing()` and configuring GA4 data deletion


---

# SECTION 6 — CONTACT DATA FLOWS

## 6.1 Definition

"Contacts" in this document refers to the individuals whose phone numbers and personal information are uploaded by Callengo business customers for use in outbound calling campaigns. These individuals are third parties who have no direct relationship with Fuentes Digital Ventures LLC. They are the data subjects whose personal data is processed on behalf of Callengo's business customers.

## 6.2 How Contact Data Enters the System

Contact data can enter Callengo through the following pathways:

**1. Manual Entry:** Single contact creation via the dashboard UI (POST `/api/contacts`).

**2. CSV File Import:** Batch import via file upload (`POST /api/contacts/import`). Accepts CSV files up to 10MB, maximum 10,000 rows per batch. Column mapping configured by the user. Rate-limited to 3 imports per minute per user. Plan-based contact limits enforced (Free: 50; Starter: 5,000; Growth: 15,000; Business: 50,000; Teams: 100,000; Enterprise: 500,000).

**3. Google Sheets Import:** Import from a linked Google Sheets spreadsheet (`src/lib/google-sheets.ts`). Column mapping configured by the user.

**4. CRM Sync (Inbound):** Contacts pulled from connected CRM systems: HubSpot, Salesforce, Pipedrive, Zoho CRM, Clio, Microsoft Dynamics 365. Sync creates contact records in Callengo and stores cross-reference IDs in the respective mapping tables (`hubspot_contact_mappings`, `salesforce_contact_mappings`, etc.).

**5. SimplyBook.me:** Booking client records imported as contacts for appointment confirmation.

**6. System-Generated:** Contacts can be programmatically created via the API with the `INTERNAL_API_SECRET` for service-to-service operations.

## 6.3 Contact Fields Stored

All contact data is stored in the `contacts` table in Supabase PostgreSQL. Every contact record belongs to exactly one `company_id` and is protected by Row Level Security.

| Column | Type | PII | Description |
|--------|------|-----|-------------|
| `id` | uuid | No | Primary key |
| `company_id` | uuid | No | FK to companies — enforces tenant isolation |
| `company_name` | text | Partial | Name of the contact's employer/organization |
| `address` | text | Yes | Street address |
| `city` | text | Yes | City |
| `state` | text | Yes | State/province |
| `zip_code` | text | Yes | Postal code |
| `phone_number` | text | **Yes** | Primary phone number — stored in **PLAINTEXT** (E.164 format after normalization) |
| `original_phone_number` | text | Yes | Phone number as originally provided before normalization |
| `contact_name` | text | **Yes** | Individual's name |
| `email` | text | **Yes** | Email address |
| `status` | text | No | Campaign status (Pending, In Progress, Complete, etc.) |
| `call_outcome` | text | No | Call result classification |
| `last_call_date` | timestamptz | No | Timestamp of last call attempt |
| `call_attempts` | int4 | No | Number of call attempts made |
| `call_id` | text | No | Bland AI call ID from last call |
| `call_status` | text | No | Status from last call |
| `call_duration` | int4 | No | Duration in seconds of last call |
| `recording_url` | text | No | URL to Bland AI-hosted recording |
| `transcript_text` | text | Indirect | Text transcript of last call — may contain personal information spoken during call |
| `transcripts` | jsonb | Indirect | Array of transcript entries (role, content) |
| `analysis` | jsonb | Indirect | AI-generated analysis results — may contain extracted personal data |
| `call_metadata` | jsonb | Indirect | Bland AI call metadata |
| `notes` | text | Partial | Free-form notes (may contain personal information entered by user) |
| `is_test_call` | bool | No | Marks test calls |
| `tags` | text[] | No | User-defined tags |
| `custom_fields` | jsonb | Potential | Arbitrary custom fields — may contain any data including PII |
| `appointment_date` | timestamptz | No | Scheduled appointment time |
| `appointment_confirmed` | bool | No | Confirmation status |
| `appointment_rescheduled` | bool | No | Rescheduled flag |
| `meeting_scheduled` | bool | No | Meeting booked flag |
| `video_link` | text | No | Video meeting link |
| `no_show_count` | int4 | No | Number of no-shows |
| `list_id` | uuid | No | FK to contact_lists |
| `source` | text | No | Origin source (manual, csv, hubspot, salesforce, etc.) |
| `created_at` | timestamptz | No | Record creation time |
| `updated_at` | timestamptz | No | Last update time |

**Phone Number Storage:** Phone numbers are stored in plaintext. They are not hashed or encrypted. This is operationally necessary because phone numbers must be passed to Bland AI in E.164 format to initiate calls.

## 6.4 How Contact Data Flows to Bland AI

At call dispatch time (`src/app/api/bland/send-call/route.ts`), the following contact-derived fields are sent to Bland AI:

- `phone_number` — the contact's phone number (direct; required for dialing)
- Contact name, company name, email, address, appointment date — incorporated into the `task` prompt text and `first_sentence` by the AI agent script template (e.g., `'Hi {{contact_name}}, this is ...'`)
- `metadata.contact_id` — the Callengo UUID for the contact (not the contact's personal data itself)
- `metadata.company_id` — the Callengo company UUID

The full contact PII (name, email, address, appointment date) is embedded in the natural-language task prompt that Bland AI uses to conduct the conversation. This means Bland AI receives contact PII as part of the call instructions.

## 6.5 Data After Campaign Completion

When a campaign run completes:

1. The `agent_runs` record is marked with status `completed` and timestamps.
2. Each contact's `call_logs` record persists indefinitely (no automatic deletion).
3. The contact record (`contacts` table) retains all fields populated during and after the call, including call outcome, transcript, and AI analysis results.
4. Recording URLs remain stored in `call_logs.recording_url` and point to Bland AI's storage infrastructure. Local stored recording copies are managed by the `Recording Vault` add-on.
5. No automatic deletion of contact data occurs after campaign completion.

## 6.6 Contact Export

Customers can export their contacts via `GET /api/contacts/export`. Supported formats: CSV, JSON, XLSX. Export includes: company_name, contact_name, email, phone_number, address, city, state, zip_code, status, call_outcome, last_call_date, call_attempts, call_duration, notes, source. Rate-limited to 3 exports per minute. Maximum 100,000 contacts per export.

## 6.7 Contact Deletion

**Single Delete:** `DELETE /api/contacts/{id}`. Contact is physically deleted from the `contacts` table. Deletion is blocked if the contact has an active call lock or is in an active call queue.

**Bulk Delete via UI:** Not a dedicated bulk-delete API endpoint; deletion is per-contact or via contact list operations.

**Cascade on Company Deletion:** When a company is marked as orphaned and cleaned up (`/api/admin/cleanup-orphans`), all contacts for that company are physically deleted. Call logs and billing records are preserved for financial audit purposes.

**No Scheduled Auto-Deletion:** There is no scheduled job or time-based trigger that automatically deletes contact data after a campaign. Contact data persists until the customer deletes it or the company account is deleted.

## 6.8 Callengo Access to Customer Contact Data

Callengo's application processes contact data solely for the purpose of executing the campaign as instructed by the business customer. The following represent the only scenarios in which contact data is accessed internally:

1. **Call Dispatch:** Contact phone number and profile sent to Bland AI to execute a call.
2. **AI Analysis:** Call transcript (which may contain contact PII spoken during the call) sent to OpenAI for post-call intent analysis.
3. **CRM Sync:** Contact data synced back to the customer's connected CRM.
4. **Customer Support:** Platform administrators may access contact data with service role credentials when investigating support issues or performing platform maintenance.
5. **Financial Audit / Cleanup:** Company records including associated call logs are preserved after company deletion for financial reconciliation, but operational contact records are deleted.

## 6.9 Cross-Customer Data Isolation

Row Level Security (RLS) is enabled on the `contacts` table with the policy:
```sql
ALL OPERATIONS: company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
```

This policy ensures that authenticated users can only access contact records belonging to their own company. The service role (used by server-side API routes and webhooks) bypasses RLS, but all service-role code includes explicit `company_id` filters. Contact data from one customer account is not accessible to any other customer account.


---

# SECTION 7 — CALL DATA, RECORDINGS & VOICEMAILS

## 7.1 Call Logs Table

All completed call records are stored in the `call_logs` table. Every call initiated through the platform results in a `call_logs` record keyed by the Bland AI call ID (unique constraint on `call_id` column).

| Column | Type | PII | Description |
|--------|------|-----|-------------|
| `id` | uuid | No | Primary key |
| `company_id` | uuid | No | Tenant isolation FK |
| `contact_id` | uuid | No | FK to contacts (nullable) |
| `agent_template_id` | uuid | No | FK to agent_templates |
| `call_id` | text | No | Bland AI call identifier (unique) |
| `status` | text | No | Call status from Bland AI |
| `completed` | bool | No | Whether call was completed |
| `call_length` | int4 | No | Duration in seconds |
| `price` | numeric | No | Bland AI cost for this call in USD |
| `answered_by` | text | No | 'human', 'voicemail', 'machine', 'unknown' |
| `recording_url` | text | No | URL to Bland AI-hosted recording (expires per Bland policy) |
| `transcript` | text | **Yes** | Full call transcript — **contains personal conversations** |
| `summary` | text | **Yes** | AI-generated summary — may reference personal details |
| `analysis` | jsonb | **Yes** | Structured AI analysis — may contain extracted contact PII |
| `error_message` | text | No | Error description if call failed |
| `metadata` | jsonb | Partial | Full Bland AI call metadata including company_id, contact_id |
| `voicemail_detected` | bool | No | Whether voicemail was detected |
| `voicemail_left` | bool | No | Whether a voicemail message was left |
| `voicemail_message_url` | text | No | URL to voicemail recording |
| `voicemail_duration` | int4 | No | Voicemail message duration in seconds |
| `agent_run_id` | uuid | No | FK to agent_runs (nullable) |
| `recording_stored_url` | text | No | URL to Callengo-stored recording (Recording Vault add-on) |
| `recording_expires_at` | timestamptz | No | When the stored recording expires |
| `recording_archived` | bool | No | Whether recording has been archived |
| `created_at` | timestamptz | No | Call timestamp |

## 7.2 Call Recordings

**Primary Storage:** Call recordings are hosted by Bland AI infrastructure. The `recording_url` field in `call_logs` contains a URL to Bland AI's storage. The duration of Bland AI's recording retention is subject to Bland AI's terms of service and privacy policy, not directly controlled by Callengo.

**Recording Vault Add-On:** Customers who subscribe to the `recording_vault` add-on (available as a paid add-on at $12/month) have recordings stored in Callengo's storage infrastructure. The retention period is configurable: `recording_retention_months` field in `company_addons` table (default: 1 month). Recordings stored under the vault are accessible via `call_logs.recording_stored_url` and expire per `call_logs.recording_expires_at`.

**Access Control:** Call recordings are accessible to authenticated members of the same company account. RLS on `call_logs` restricts access to `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())`. No cross-company access is possible through the authenticated API. Platform administrators with service role access can access recordings.

**Content:** Call recordings contain the audio of the conversation between the Bland AI agent and the called individual. They contain the called individual's voice, statements, and any personal information voluntarily disclosed during the call.

## 7.3 Transcripts

**Storage:** Full call transcripts are stored in `call_logs.transcript` (text column) and indexed contacts' `contacts.transcript_text` field. Transcripts are generated by Bland AI and returned via webhook.

**Content:** Transcripts are verbatim text representations of the call conversation. They contain the called individual's spoken words, name, stated contact information, business details, and any other information disclosed during the call. Transcripts are sensitive personal data.

**Retention:** No automatic deletion. Transcripts persist until the customer deletes the contact or the company account is terminated.

**Use:** Transcripts are used for (a) display to the customer in the call detail view, (b) input to OpenAI for post-call analysis (see Section 8), and (c) CRM sync (portions of call analysis).

## 7.4 Voicemail Logs

The `voicemail_logs` table captures voicemail detection events. When the Bland AI agent detects an answering machine and leaves a message:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `company_id` | uuid | Tenant FK |
| `call_id` | uuid | FK to call_logs |
| `agent_run_id` | uuid | FK to agent_runs |
| `contact_id` | uuid | FK to contacts |
| `detected_at` | timestamptz | Detection timestamp |
| `confidence_score` | numeric | Detection confidence (0–1) |
| `detection_method` | varchar | Method used for detection |
| `message_left` | bool | Whether a message was left |
| `message_text` | text | Text of the voicemail message |
| `message_duration` | int4 | Duration in seconds |
| `message_audio_url` | text | URL to voicemail audio |
| `follow_up_scheduled` | bool | Whether a follow-up was scheduled |
| `follow_up_id` | uuid | FK to follow_up_queue |
| `metadata` | jsonb | Additional metadata |
| `created_at` | timestamptz | Record creation |

**Content:** Voicemail messages contain audio addressed to the called individual. The `message_text` field contains the text version of the voicemail script, which includes the contact's name and other identifying information from the agent script.

## 7.5 AI Summary and Analysis

AI-generated call summaries (`call_logs.summary`) are generated by Bland AI as part of the call response. AI analysis results (`call_logs.analysis`, `contacts.analysis`) are generated by OpenAI's GPT-4o-mini. Both may contain personal information extracted from the call conversation. See Section 8 for detailed data flows to AI providers.

## 7.6 Retention Policy

**Current State:** No automatic retention policy or scheduled deletion is implemented for call records, transcripts, or voicemail logs. These records persist indefinitely until the customer takes action or the company account is deleted.

**Recording Vault:** The `recording_vault` add-on provides configurable recording retention of 1–N months. After expiry (`recording_expires_at`), the stored recording should be deleted, but the automated deletion job's implementation status was not confirmed in the codebase exploration.

**Legal Recommendation:** Implement a defined retention period for call records and transcripts (e.g., 24 months), with automated deletion and customer notice. Certain jurisdictions (including those with call recording laws) may require shorter retention periods or active customer opt-in to recording.


---

# SECTION 8 — AI & ML DATA FLOWS

## 8.1 Bland AI — Call Execution

**Integration Files:** `src/lib/bland/master-client.ts`, `src/app/api/bland/send-call/route.ts`
**API Base URL:** `https://api.bland.ai/v1`
**Auth:** Single master API key (`BLAND_API_KEY`) — all customers' calls route through one key

### 8.1.1 Data Sent to Bland AI Per Call

The following data is sent in each call dispatch request to `POST /v1/calls`:

```
phone_number         — Contact's phone number (E.164 format)
task                 — Full AI agent instruction text, including contact name, company name,
                       appointment details, or other context variables interpolated from the
                       contact record and agent template
first_sentence       — Opening line of the call (may include contact name)
voice                — Bland AI voice ID (e.g., 'maya', 'josh')
wait_for_greeting    — Boolean
record               — Boolean (whether to record the call)
max_duration         — Maximum call duration in seconds
voicemail_action     — What to do when voicemail detected
voicemail_message    — Voicemail script text (may include contact name)
answered_by_enabled  — Boolean (enable answering machine detection)
webhook              — HTTPS callback URL for call completion notification
background_track     — Background audio (default: 'office')
model                — Bland AI model (default: 'enhanced')
language             — Language code (default: 'en')
from                 — Caller ID number (dedicated number if company has one)
metadata:
  company_id         — Callengo company UUID
  contact_id         — Callengo contact UUID (when available)
  agent_name         — AI agent name
  agent_run_id       — Campaign run UUID
  agent_template_slug — Template identifier
  campaign_id        — Campaign UUID
  [additional custom fields as configured by customer]
```

**PII in Payload:** The `task`, `first_sentence`, and `voicemail_message` fields contain natural-language text that includes the contact's name, the contact's company, appointment dates, and any other fields interpolated from the contact record. This constitutes direct transmission of contact PII to Bland AI.

### 8.1.2 Data Received from Bland AI

Via webhook at `POST /api/bland/webhook`:
- Call ID, status, completion flag, duration, pricing
- Recording URL (pointing to Bland AI storage)
- Full concatenated transcript of the conversation
- AI-generated summary
- `answered_by` classification
- Error messages (if any)
- Echo of the metadata sent at dispatch

### 8.1.3 Bland AI Training Data and DPA Status

**DPA CONFIRMED (March 2026).** Bland AI publishes a full Data Processing Addendum at `https://www.bland.ai/legal/data-processing-agreement` (updated March 27, 2025). The DPA prohibits Bland from using Customer Personal Data (call audio, transcripts, contact PII) outside the scope of providing the Services. The DPA permits Bland to create **Deidentified Data** (data that cannot be associated with a Data Subject or Customer) for product improvement. This is the sole training/improvement carve-out — identifiable call data is not used for model training under the DPA terms.

There are no specific API headers or parameters required to enforce training opt-out — the protection is contractual via the DPA, not technical. This is standard practice for enterprise AI voice providers operating under a DPA structure.

See GAP-005 for the full DPA review with all provisions documented.

## 8.2 OpenAI — Post-Call Analysis

**Integration Files:** `src/lib/ai/intent-analyzer.ts`, `src/app/api/openai/analyze-call/route.ts`, `src/app/api/openai/recommend-agent/route.ts`, `src/app/api/openai/context-suggestions/route.ts`
**Auth:** API key (`OPENAI_API_KEY`)

### 8.2.1 Intent Analysis (Primary Path)

**Model:** `gpt-4o-mini` | **Temperature:** 0.1 | **Response Format:** JSON object

**Data Sent:** Call transcript (truncated to 10,000 characters), optional metadata (appointment_date, contact_name). The transcript is sanitized to remove prompt injection attempts but is otherwise the verbatim conversation text.

**For Appointment Confirmation calls, the prompt includes:**
- Full transcript
- Contact name (from metadata)
- Appointment date (from metadata)

**For Data Validation calls, the prompt includes:**
- Full transcript
- ALL existing contact data fields currently on file for the contact (name, email, phone, address, company, job title, etc.)

**For Lead Qualification calls, the prompt includes:**
- Full transcript

**Data Returned:** Structured JSON with intent classification, confidence scores, meeting times, extracted data points (can include name, email, phone, address, company, job title, department), sentiment analysis, and call summary.

### 8.2.2 Full Call Analysis (GPT-4o)

**Model:** `gpt-4o` (full model) | **Response Format:** JSON schema

**Data Sent:** Full unrestricted transcript text; all demo/contact data fields provided by the customer for that campaign.

**Data Returned:** Verified address, contact name, verified email, business confirmation, call sentiment, customer interest level, call category, key points, follow-up determination.

### 8.2.3 Agent Recommendation

**Model:** `gpt-4o-mini` | **Temperature:** 0.3 | **Max Tokens:** 50

**Data Sent:** User's free-text description of their business challenge (entered by Callengo customer). This is business context, not contact PII.

**Data Returned:** Recommended agent slug.

### 8.2.4 Context Suggestions

**Model:** `gpt-4o-mini` | **Temperature:** 0.8 | **Max Tokens:** 800

**Data Sent:** Agent type, company name, company description, company website URL. This is the Callengo customer's business information, not contact PII.

**Data Returned:** Three suggested campaign context paragraphs.

### 8.2.5 OpenAI Training Data — Confirmed Disabled

**STATUS: CONFIRMED DISABLED (March 25, 2026).** Verified via OpenAI Platform → Settings → Data Controls → Sharing. All three data sharing options are set to Disabled. OpenAI does not use Callengo's API data (call transcripts, prompts, completions) to train its models.

The OpenAI API client is instantiated without special opt-out flags because no such flags are required — the training opt-out is configured at the organization level in the OpenAI Platform, not at the API call level:
```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

**API call logging:** Enabled per call — prompts and completions are retained by OpenAI for up to 30 days on their servers for the organization's own review. This is not training data. This retention must be disclosed in the Privacy Policy. See GAP-006 for full documentation.

### 8.2.6 Transcript Sanitization

The `sanitizeTranscript()` function in `src/lib/ai/intent-analyzer.ts` (lines 15–22):
- Truncates transcripts to 10,000 characters
- Removes prompt injection patterns (e.g., "ignore previous instructions")
- Does NOT remove personal information (names, phone numbers, emails, addresses) from transcripts before sending to OpenAI

### 8.2.7 Cali AI Assistant — Data Sent to OpenAI Per Request

**Model:** `gpt-4o-mini` (via `OPENAI_API_KEY_CALI_AI`) | **Max Tokens:** 1,000 | **Integration File:** `src/app/api/ai/chat/route.ts`

The Cali AI assistant builds a comprehensive system prompt on every request using live data fetched from the database. **The following data is transmitted to OpenAI with every Cali AI chat message:**

**Customer (account holder) PII and business data in the system prompt:**
- User's full name and email address (`userData.full_name`, `userData.email`)
- User's role within their company
- Company name, description, industry, and website URL
- Current subscription plan name and billing cycle usage (minutes used / minutes included)
- Total number of contacts, calls made, active campaigns, and AI agents
- **Full team member list:** name (or email as fallback), email address, and role for every user in the company (`SELECT full_name, email, role FROM users WHERE company_id = ?`)
- **Last 5 campaign names** with status and call completion counts

**User message content (sent each request):**
- The user's typed chat message
- Up to the last 20 previous messages in the conversation (full conversation history replay)

**Data NOT sent:** Contact PII (individual names, phone numbers, addresses of called parties) is not included in the Cali AI system prompt. Only aggregate counts (total contacts, total calls) are included.

**Privacy significance:** The team member email addresses and full names are PII of Callengo account users. These are sent to OpenAI on every single Cali AI chat request regardless of whether the user's question has anything to do with their team. This constitutes a transfer of customer PII (user identities) to OpenAI under the OpenAI API terms. It is covered by the OpenAI DPA (training opt-out confirmed — see §8.2.5), but it must be disclosed in the Privacy Policy: *"When you use the Cali AI assistant, your company profile information, usage statistics, team member names and emails, and recent campaign data are included in the request sent to OpenAI."*

**Conversation Persistence:** All Cali AI conversations are saved to `ai_conversations` and `ai_messages` tables in Supabase. The `ai_conversations` table stores the conversation title (first 60 characters of the first user message), user_id, company_id, and timestamps. The `ai_messages` table stores role (`user` or `assistant`), content (full message text), and conversation_id. These tables contain personal data — the user's typed questions and Cali's responses — and are subject to RLS by company_id.

**Rate Limiting:** 10 messages per minute per user enforced via `expensiveLimiter` from `src/lib/rate-limit.ts`. This is one of the few places where the rate limiter is actually applied (see GAP-018 for the global rate limiting gap).

## 8.3 AI Analysis Queue

When `AI_ANALYSIS_MODE=async`, AI analysis is deferred to an `analysis_queue` table (asynchronous processing). The queue stores: company_id, call_log_id, contact_id, agent_run_id, template_slug, transcript (full text), call_metadata, and result. Queued analysis jobs are processed in batches of up to 10 by the `/api/queue/process` endpoint. The transcript (containing contact PII) is stored in `analysis_queue.transcript` until the job is processed and the field is cleared.

## 8.4 Agent Templates — Personal Data Placeholders

The three core agent templates stored in `agent_templates` use the following PII placeholders:

- `{{contact_name}}` — Individual's name (required for personalization)
- `{{company_name}}` — Contact's employer name
- `{{appointment_date}}` — Scheduled appointment timestamp
- `{{agent_name}}` — Callengo AI agent name (not personal data of contact)
- `{{product_service}}` — Product or service context (not personal data)

These placeholders are resolved at call dispatch time using the contact record and campaign configuration. The resolved values are transmitted to Bland AI as described in Section 8.1.

## 8.5 Callengo Internal ML Model Training

**Finding:** Callengo does not train any proprietary machine learning models. The platform uses Bland AI for voice generation and call execution, and OpenAI for analysis. No internal training pipeline, model weights, dataset storage, or ML framework was found in the codebase.


---

# SECTION 9 — BILLING & SUBSCRIPTION DATA

## 9.1 Stripe Integration Architecture

Callengo uses Stripe for all payment processing. The architecture ensures that payment card data (PAN, CVV, expiry dates) is collected and processed entirely by Stripe's infrastructure (Stripe Checkout and Stripe Elements). Payment card data never transits through Callengo's servers, is never logged by Callengo, and is never stored in Callengo's database. Callengo is not a PCI DSS cardholder data environment.

## 9.2 Stripe Objects Stored in Supabase

### company_subscriptions Table
| Column | Stripe Object | Notes |
|--------|--------------|-------|
| `stripe_customer_id` | Customer.id (cus_xxx) | Stripe customer identifier |
| `stripe_subscription_id` | Subscription.id (sub_xxx) | Unique constraint |
| `stripe_subscription_item_id` | SubscriptionItem.id (si_xxx) | For metered billing |
| `status` | Subscription.status | active, trialing, past_due, canceled |
| `current_period_start` | Subscription.current_period_start | |
| `current_period_end` | Subscription.current_period_end | |
| `cancel_at_period_end` | Subscription.cancel_at_period_end | |
| `trial_end` | Subscription.trial_end | |
| `billing_cycle` | Derived from price interval | monthly or annual |
| `overage_enabled` | Callengo internal | Whether customer opted in to overage |
| `overage_budget` | Callengo internal | Spending cap for overage |
| `overage_spent` | Callengo internal | Cumulative overage cost this period |

### billing_history Table
| Column | Notes |
|--------|-------|
| `stripe_invoice_id` | Unique constraint |
| `stripe_payment_intent_id` | For payment reconciliation |
| `invoice_url` | Stripe-hosted invoice URL |
| `amount` | Amount in USD |
| `status` | paid, failed, pending |
| `payment_method` | Card type/brand (not card number) |
| `failure_reason` | Error message if failed |

### stripe_events Table (Idempotency Log)
| Column | Notes |
|--------|-------|
| `id` | Stripe event ID (evt_xxx) — unique constraint |
| `type` | Event type string |
| `data` | Full Stripe event object as JSONB |
| `processed` | Boolean |
| `processed_at` | Processing timestamp |

The `stripe_events` table is protected with service-role-only RLS (no authenticated user access).

### company_addons Table
Stores active add-ons with Stripe subscription item IDs for each add-on type (`dedicated_number`, `recording_vault`, `calls_booster`).

### usage_tracking Table
Tracks metered usage (minutes) per billing period. Overage minutes are reported to Stripe via `POST /v1/subscription_items/{item_id}/usage_records` with `action: 'set'` (idempotent — uses total overage, not incremental).

## 9.3 Stripe Webhook Events Handled

All Stripe webhooks arrive at `POST /api/webhooks/stripe`. Signature validated via `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`. Idempotency enforced via `stripe_events` table.

| Event | Handler Action |
|-------|---------------|
| `checkout.session.completed` | Create or update `company_subscriptions`; initialize `usage_tracking`; create Bland AI sub-account; allocate Bland AI credits; record billing event |
| `customer.subscription.created` | Update subscription IDs in `company_subscriptions`; sync customer to HubSpot CRM (if admin HubSpot configured) |
| `customer.subscription.updated` | Update subscription status, period dates, plan; reset overage on plan change; reallocate Bland credits on upgrade; deactivate ineligible CRM integrations on plan downgrade |
| `customer.subscription.deleted` | Mark subscription canceled; downgrade company to free plan; clear Stripe subscription references; deactivate Bland sub-account; log billing event |
| `invoice.payment_succeeded` | Create billing_history record; create billing_event; reset usage_tracking for new period; allocate Bland credits for renewal |
| `invoice.payment_failed` | Update company_subscriptions status to `past_due`; create billing_event; send in-app notification to company owner |
| `customer.subscription.trial_will_end` | Create billing_event; trigger PostHog event for trial-ending notification |

## 9.4 Card Data Confirmation

Stripe Checkout handles all card data collection. Callengo's servers receive only:
- Stripe Customer ID (`cus_xxx`)
- Stripe Subscription ID (`sub_xxx`)
- Invoice metadata (amount, status, invoice URL)
- Payment intent ID (for reconciliation)
- Payment method type/brand (e.g., "Visa", "Mastercard") — NOT the card number, CVV, or expiry

Card numbers, CVV codes, and expiry dates are never transmitted to or stored by Callengo's application servers or database.

## 9.5 Billing Data on Cancellation and Account Deletion

**On Subscription Cancellation:** The `company_subscriptions` record is updated to `canceled` status. The company is downgraded to the free plan (90-day free tier access). Stripe subscription references are cleared. Billing history, usage tracking, and billing events are retained indefinitely for financial audit purposes.

**On Company Account Deletion (Orphan Cleanup):** The following tables are PRESERVED for financial records: `company_subscriptions`, `billing_history`, `billing_events`, `usage_tracking`, `call_logs`. All operational tables (contacts, campaigns, integrations, etc.) are deleted. The company record is soft-deleted (renamed with `[ARCHIVED]` prefix).

**Legal Consideration:** Stripe's merchant agreement requires retention of transaction records for a minimum period (typically 5 years for PCI DSS purposes, longer for tax purposes). Callengo's billing records should be retained in accordance with applicable tax, accounting, and financial regulations.

## 9.6 Customer Billing Portal

Customers access the Stripe Customer Portal via a server-generated portal session URL from `POST /api/billing/portal`. The portal is hosted by Stripe and allows customers to update payment methods, download invoices, and manage subscriptions. Callengo does not store or log portal session contents.


---

# SECTION 10 — WEBHOOK DATA FLOWS

## 10.1 Inbound Webhooks

### 10.1.1 Bland AI Call Completion Webhook

**Endpoint:** `POST /api/bland/webhook`
**Sender:** Bland AI (voice calling platform)
**Signature Validation:** HMAC-SHA256 of raw request body with `BLAND_WEBHOOK_SECRET`. Verified using timing-safe comparison. Accepts `x-bland-signature` or `x-webhook-signature` header. Returns 401 if invalid or missing.

**Payload (PII Fields):**
- `recording_url` — URL to call recording (contains voice of called individual)
- `concatenated_transcript` — Full call transcript (contains spoken words of called individual)
- `summary` — AI-generated summary (may reference personal details)
- `to` — Destination phone number (contact PII)
- `from` — Caller ID
- `metadata.contact_id` — Contact UUID (Callengo internal, not direct PII)
- `metadata.company_id` — Company UUID

**Processing Triggered:**
1. Idempotency check (skip if call_id already processed in call_logs)
2. Upsert call_logs record
3. Voicemail log creation (if voicemail detected)
4. Release Redis concurrency slot
5. Track usage and report to Stripe if overage
6. Trigger post-call AI analysis (sync or async per AI_ANALYSIS_MODE)
7. Dispatch outbound webhooks to customer-configured endpoints
8. Calendar sync (appointment scheduling outcomes)
9. CRM sync (push call results back to connected CRM)
10. GA4 and PostHog event tracking

### 10.1.2 Stripe Webhook

**Endpoint:** `POST /api/webhooks/stripe`
**Sender:** Stripe
**Signature Validation:** Stripe signature via `STRIPE_WEBHOOK_SECRET` using `stripe.webhooks.constructEvent()`. Returns 400 if invalid.
**Idempotency:** Event ID uniqueness enforced via `stripe_events` table (unique constraint on event ID).
**PII in Payload:** Customer email (in Stripe customer object), billing address (in invoice object), company metadata.
**Processing:** See Section 9.3 for complete event handler list.

### 10.1.3 SimplyBook.me Webhook

**Endpoint:** `POST /api/integrations/simplybook/webhook`
**Sender:** SimplyBook.me (appointment scheduling platform)
**Payload:** Booking event data including client name, email, phone, service booked, booking time.
**Stored In:** `simplybook_webhook_logs` table (company_id, integration_id, event_type, payload JSONB).

### 10.1.4 Slack Webhook / OAuth Callback

**Endpoint:** `POST /api/integrations/slack/webhook`; `GET /api/integrations/slack/callback`
**Sender:** Slack
**PII:** Slack workspace identity, channel names.

## 10.2 Outbound Webhooks (Customer-Configured)

### 10.2.1 Architecture

Customers can configure webhook endpoints to receive real-time notifications of platform events. Endpoint management is via:
- `GET /api/webhooks/endpoints` — List endpoints
- `POST /api/webhooks/endpoints` — Create endpoint
- `PATCH /api/webhooks/endpoints/{id}` — Update
- `DELETE /api/webhooks/endpoints/{id}` — Delete

All webhook URLs must be HTTPS. SSRF protection blocks localhost, RFC 1918 private IP ranges, and internal hostnames (`.internal`, `.local`, `.localhost`, `.svc.cluster`).

### 10.2.2 Supported Event Types

```
call.completed          call.failed             call.no_answer
call.voicemail          appointment.scheduled   appointment.confirmed
appointment.rescheduled appointment.cancelled   appointment.no_show
contact.updated         campaign.completed      campaign.started
```

### 10.2.3 Payload Structure

```json
{
  "id": "evt_[unique_id]",
  "type": "[event_type]",
  "created_at": "[ISO 8601 timestamp]",
  "data": { [event-specific data] }
}
```

**PII in Payload:** Call event payloads may include: call transcript excerpts, contact name, phone number, call outcome, AI analysis results. Appointment event payloads include: contact name, appointment time, confirmation status. Contact update events include: modified contact fields (any PII fields in the contact record).

### 10.2.4 Signature and Security

Each webhook endpoint has a generated secret (`whsec_[random]`). Deliveries include:
- `X-Callengo-Signature`: HMAC-SHA256 of JSON body with the endpoint secret
- `X-Callengo-Timestamp`: Unix timestamp
- `X-Callengo-Event`: Event type
- `X-Callengo-Delivery`: Delivery event ID
- `User-Agent`: `Callengo-Webhooks/1.0`
- 5-minute timestamp freshness check for replay protection

### 10.2.5 Delivery Mechanics

Deliveries are fire-and-forget (single attempt, no automatic retry). A 10-second timeout is enforced per delivery. All delivery attempts are logged in `webhook_deliveries` table including payload, HTTP response status, response body, error message, and duration. After 10 consecutive failures, endpoints are auto-disabled (`auto_disabled_at` timestamp set). Customers can view delivery history in the dashboard and manually retry or re-enable disabled endpoints.

### 10.2.6 Data Processor Obligations

By configuring outbound webhook endpoints, customers direct Callengo to transmit event data (including contact PII) to third-party URLs specified by the customer. The customer is responsible for ensuring that their webhook destination (e.g., Zapier, Make, n8n, custom servers) handles the received data in compliance with applicable data protection laws. Callengo's DPA with customers must address this outbound transmission as a customer-directed processing activity.


---

# SECTION 11 — DATA STORAGE, SECURITY & ACCESS CONTROL

## 11.1 Personal Data Tables in Supabase

The following tables contain personal data. All tables have Row Level Security (RLS) enabled.

| Table | PII Columns | Sensitive Columns | RLS Status |
|-------|-------------|-------------------|------------|
| `users` | email, full_name, ip_address, city, region, country_code, country_name, location_logs | role, company_id | Enabled |
| `contacts` | contact_name, email, phone_number, address, city, state, zip_code, company_name, transcript_text, analysis | custom_fields, transcripts | Enabled |
| `call_logs` | transcript, summary, analysis, recording_url | metadata | Enabled |
| `voicemail_logs` | message_text, message_audio_url | — | Enabled |
| `calendar_events` | contact_name, contact_phone, contact_email, ai_notes | attendees (JSONB) | Enabled |
| `team_invitations` | email | token | Enabled |
| `hubspot_integrations` | hs_user_email, hs_display_name | access_token, refresh_token (encrypted) | Enabled |
| `salesforce_integrations` | sf_email, sf_username, sf_display_name | access_token, refresh_token (encrypted) | Enabled |
| `pipedrive_integrations` | pd_user_email, pd_user_name | access_token, refresh_token (encrypted) | Enabled |
| `zoho_integrations` | zoho_user_email, zoho_user_name | access_token, refresh_token (encrypted) | Enabled |
| `dynamics_integrations` | dynamics_user_email, dynamics_user_name | access_token, refresh_token (encrypted) | Enabled |
| `clio_integrations` | clio_user_email, clio_user_name | access_token, refresh_token (encrypted) | Enabled |
| `simplybook_integrations` | sb_user_email, sb_user_name | sb_token (encrypted), sb_refresh_token | Enabled |
| `google_sheets_integrations` | google_email | access_token, refresh_token (encrypted) | Enabled |
| `calendar_integrations` | email, provider_email, provider_user_name | access_token, refresh_token (encrypted) | Enabled |
| `cancellation_feedback` | reason_details (may contain PII) | — | Enabled |
| `integration_feedback` | message (may contain PII) | — | Enabled |
| `analysis_queue` | transcript | call_metadata | Enabled |
| `ai_messages` | content (may contain PII in conversation) | — | Enabled |
| `notifications` | title, message (may contain contact PII in messages) | — | Enabled |
| `admin_audit_log` | ip_address, user_agent | old_value, new_value (JSONB) | Enabled |
| `openai_usage_logs` | user_id (UUID), company_id (UUID) | feature_key, model, input_tokens, output_tokens, cost_usd, metadata (JSONB) | Enabled |
| `ai_conversations` | title (may contain first message text — PII if user asks about personal matters) | user_id, company_id | Enabled |

Note: `ai_messages` (listed above) and `ai_conversations` are created by the Cali AI assistant feature (`src/app/api/ai/chat/route.ts`). `openai_usage_logs` was added in migration `20260325000001_openai_usage_tracking.sql` (March 25, 2026) and tracks API usage per feature for billing and admin cost analysis. It contains user_id and company_id as identifying references but does not store prompts or completions — those are retained by OpenAI for up to 30 days on their platform (see §8.2.5).

## 11.2 RLS Policy Summary

All 57 tables have RLS enabled. Primary RLS patterns:

**Standard Company Isolation:**
```sql
USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
```
Applied to: contacts, call_logs, agent_runs, company_agents, campaigns, contact_lists, calendar_events, calendar_integrations, all CRM integration tables, voicemail_logs, follow_up_queue, notifications, webhook_endpoints, call_queue, company_settings.

**User Self-Access:**
```sql
USING (id = auth.uid())
```
Applied to: `users` table (users can only read/update their own record).

**Role-Restricted:**
- `company_subscriptions`: SELECT for company members, UPDATE restricted to owner/admin
- `company_addons`: SELECT for company members, INSERT/UPDATE/DELETE service-role only
- `admin_audit_log`: SELECT for admin/owner roles; INSERT service-role only
- `admin_platform_config`: ALL operations for admin/owner roles only
- `admin_finances`: ALL operations for admin/owner roles or service-role
- `stripe_events`: Service-role only (no authenticated user access)

**No Sensitive Tables with RLS Disabled:** No tables containing personal data with RLS disabled were identified.

## 11.3 Service Role Key Usage

The `SUPABASE_SERVICE_ROLE_KEY` is used in server-side API routes via `createServiceSupabaseClient()` (`src/lib/supabase/service.ts`). The service role bypasses RLS and has full read/write access to all tables. Usage is limited to:

- Stripe webhook handler (billing operations across companies)
- Bland AI webhook handler (call result processing across companies)
- Admin API routes (admin/command-center, admin/monitor, admin/cleanup-orphans, admin/reconcile)
- Queue processing routes
- Team management operations (invite, accept, remove)
- Seed/demo data operations

The service role key is a server-only secret, never exposed to the client. It is stored as a Vercel environment variable (`SUPABASE_SERVICE_ROLE_KEY`).

## 11.4 Upstash Redis — Data in Cache

The following data is cached in Upstash Redis. No personal data (names, email addresses, phone numbers) is stored in Redis. Only UUIDs and counters are used as Redis keys.

| Key Pattern | Data Stored | TTL | PII |
|-------------|------------|-----|-----|
| `callengo:concurrent:global` | Integer counter | 30 min | No |
| `callengo:concurrent:company:{uuid}` | Integer counter | 30 min | No |
| `callengo:hourly:{bucket}` | Integer counter | 2 hours | No |
| `callengo:daily:{bucket}` | Integer counter | 24 hours | No |
| `callengo:daily:{date}:{companyId}` | Integer counter | 24 hours | No |
| `callengo:hourly:{hour}:{companyId}` | Integer counter | 2 hours | No |
| `callengo:contact_cooldown:{contactId}` | Presence flag | 5 min | No (UUID only) |
| `callengo:active_call:{callId}` | JSON: {companyId, contactId, ts} | 30 min | No (UUIDs only) |
| `callengo:bland_plan_info` | Bland AI plan limits object | 1 hour | No |

## 11.5 Environment Variables Containing Secrets

The following environment variables contain secrets. Their names are documented here; values are never stored in the codebase. All are configured as Vercel environment variables.

**Authentication & Platform:**
- `SUPABASE_SERVICE_ROLE_KEY` — Full DB access key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public (client-safe), respects RLS
- `TOKEN_ENCRYPTION_KEY` — 64 hex chars for AES-256-GCM OAuth token encryption
- `INTERNAL_API_SECRET` — Service-to-service authentication
- `QUEUE_PROCESSING_SECRET` — Queue processor authentication
- `CRON_SECRET` — Vercel cron job authentication
- `OAUTH_STATE_SECRET` — HMAC signing for OAuth state parameters

**Third-Party API Keys:**
- `BLAND_API_KEY` — Bland AI master API key
- `BLAND_WEBHOOK_SECRET` — Bland AI webhook HMAC secret
- `OPENAI_API_KEY` — OpenAI API key
- `STRIPE_SECRET_KEY` — Stripe server-side key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `RESEND_API_KEY` — Transactional email
- `GA_API_SECRET` — GA4 Measurement Protocol
- `RECAPTCHA_SECRET_KEY` — reCAPTCHA verification
- `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_PRIVATE_APP_TOKEN`
- `SALESFORCE_CLIENT_SECRET`
- `PIPEDRIVE_CLIENT_SECRET`
- `ZOHO_CLIENT_SECRET`
- `DYNAMICS_CLIENT_SECRET`
- `CLIO_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_SECRET`
- `ZOOM_CLIENT_SECRET`
- `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`

**Not committed to repository:** All secret variables are listed in `.env.example` with placeholder values only. Git history was not audited for secret leakage, which should be confirmed separately.

## 11.6 Client-Side Storage

**localStorage:** Non-sensitive UI state only:
- `callengo_dismissed_alerts` — Dismissed alert IDs
- `callengo_quick_start_dismissed` — Quick start guide dismissal flag
- `callengo_sync_preferences` — Calendar sync UI preferences
- Language preference (i18n locale)

**sessionStorage:** Not used for sensitive data.

**Cookies:** See Section 5.3 for complete cookie inventory.

**No sensitive data** (tokens, API keys, personal data, contact information) is stored in localStorage or sessionStorage.

## 11.7 HTTPS Enforcement

HSTS (HTTP Strict Transport Security) is configured via Next.js response headers (`next.config.ts`):
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
This instructs browsers to use HTTPS exclusively for all connections to callengo.com and app.callengo.com for one year. Authentication cookies use `secure: true` in production. All webhook URLs must be HTTPS (validated in `src/lib/webhooks.ts`).

**Note:** HSTS preloading (submission to browser preload lists) is not confirmed. Initial connections from new users may be subject to TLS downgrade attacks until the HSTS header is received.

## 11.8 Security Headers

The following security headers are configured (`next.config.ts`):

| Header | Value |
|--------|-------|
| `X-Frame-Options` | DENY |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `X-XSS-Protection` | 1; mode=block |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains |
| `Content-Security-Policy` | (See below) |

**CSP Summary:** `default-src 'self'`; scripts from self, Stripe, Google Analytics, PostHog; styles self with unsafe-inline; images from self, data:, https:, blob:; connections to Supabase, Stripe, Bland AI, OpenAI, GA4, PostHog; frames from Stripe, YouTube, Google; no objects; base-uri restricted to self.

## 11.9 CORS Configuration

CORS is not explicitly configured in the application layer beyond Next.js defaults. API routes are server-side rendered and do not expose cross-origin API access. The Supabase client handles its own CORS via the Supabase anon key and project URL configuration.

## 11.10 Database Security Controls

**Trigger: `trg_prevent_sensitive_field_changes`** — Prevents users from modifying their own `company_id` or `email` fields via direct updates.

**Trigger: `trg_prevent_role_self_escalation`** — Prevents authenticated users from escalating their own role. Role changes require service-role access (executed through admin API routes with appropriate authorization checks).

**CHECK Constraints:** Status columns in 8 tables are validated with CHECK constraints at the database level, preventing invalid status values regardless of application-layer validation.

**Partial Index on companies.deleted_at:** `WHERE deleted_at IS NULL` ensures efficient querying of active companies while preserving soft-deleted records.


---

# SECTION 12 — DATA RETENTION & DELETION LOGIC

## 12.1 Scheduled Deletion Jobs

**Current State:** No scheduled cron jobs, database triggers, or background workers that automatically delete data based on age or time elapsed were found in the codebase. Data retention is driven by customer action or platform administrator action, not by automated policies.

**Exception — Redis TTLs:** Redis keys expire automatically per their TTL (see Section 11.4). This is operational data, not personal data.

**Exception — Contact Lock TTL:** The `custom_fields._locked` flag on contact records expires logically after 10 minutes (checked in deletion endpoint), but this is a processing lock, not a data deletion mechanism.

## 12.2 Account Deletion Flow

Account deletion for a company is not currently exposed as a self-service user action. There is no "delete my account" button in the customer dashboard at the time of this analysis. Account deletion is performed administratively via:

**Admin Cleanup Orphans:** `POST /api/admin/cleanup-orphans` — Identifies companies with no active user accounts (all users deleted their Supabase Auth accounts) and purges operational data while preserving financial records.

**What is DELETED on company cleanup:**
- All records in: `contacts`, `contact_lists`, `company_agents`, `agent_runs`, `call_queue`, `follow_up_queue`, `voicemail_logs`, `notifications`, `company_settings`, `company_addons`, `calendar_integrations`, `calendar_events`, `ai_conversations`, `ai_messages`
- All CRM integration records: `hubspot_integrations`, `hubspot_contact_mappings`, `hubspot_sync_logs`, `pipedrive_integrations`, `pipedrive_contact_mappings`, `pipedrive_sync_logs`, `salesforce_integrations`, `salesforce_contact_mappings`, `salesforce_sync_logs`, `zoho_integrations`, `zoho_contact_mappings`, `zoho_sync_logs`, `dynamics_integrations`, `dynamics_contact_mappings`, `dynamics_sync_logs`, `clio_integrations`, `clio_contact_mappings`, `clio_sync_logs`, `simplybook_integrations`, `simplybook_contact_mappings`, `simplybook_sync_logs`
- Webhook endpoints and deliveries: `webhook_endpoints`, `webhook_deliveries`
- Other: `analysis_queue`, `team_calendar_assignments`, `integration_feedback`, `cancellation_feedback`
- Bland AI sub-accounts are deactivated via Bland API

**What is PRESERVED after company cleanup (financial audit trail):**
- `companies` — soft-deleted (renamed with `[ARCHIVED]` prefix, not physically deleted)
- `company_subscriptions` — preserved
- `billing_history` — preserved
- `billing_events` — preserved
- `usage_tracking` — preserved
- `call_logs` — preserved (financial/operational records)

**Individual User Deletion:** Individual team members can be removed from a company via `DELETE /api/team/remove`. This deletes the user's record from the `users` table. The Supabase Auth account is not automatically deleted. User-associated audit entries in `admin_audit_log` reference the user_id but are retained.

## 12.3 Subscription Cancellation Flow

When a customer cancels their Stripe subscription:

1. Stripe sends `customer.subscription.deleted` webhook
2. `company_subscriptions` is updated: status → `canceled`; company downgraded to free plan with 90-day expiry
3. Overage settings are cleared
4. Bland sub-account is deactivated (calls are blocked)
5. **No contact data, call logs, or other operational data is deleted** — the account retains all data
6. Customer can log in and export their data during the 90-day window
7. No automated post-cancellation deletion schedule exists

**Legal Gap:** There is no defined data retention period or automated deletion after subscription cancellation. This may need to be addressed in the Terms of Service and Privacy Policy to establish clear expectations, and an automated deletion workflow should be implemented.

## 12.4 Data Export Functionality

| Data Type | Export Available | Format | Endpoint | Notes |
|-----------|-----------------|--------|----------|-------|
| Contacts | Yes | CSV, JSON, XLSX | `GET /api/contacts/export` | Up to 100,000 contacts |
| Call logs | Not confirmed as self-service | — | — | Data visible in UI but bulk export not confirmed |
| Billing history | Via Stripe Customer Portal | PDF invoices | Stripe-hosted | Stripe handles invoice downloads |
| Integration mappings | No | — | — | No export endpoint found |

## 12.5 Legal Hold

No legal hold mechanism is implemented. All deletions described above are permanent (for the operational tables) or soft-permanent (for companies). If a legal hold requirement arises (e.g., from litigation, regulatory inquiry), administrators would need to manually prevent the automated cleanup process from running.

## 12.6 Data Subject Deletion Requests (Right to Erasure)

**GDPR Article 17 / CCPA Deletion Rights:** There is no dedicated data subject deletion request workflow implemented in the product. If a contact (the person who was called) submits a deletion request, the current mechanism would require the customer (Callengo's business customer) to:
1. Locate the contact record
2. Use the single-contact delete endpoint (`DELETE /api/contacts/{id}`)
3. Manually delete associated call logs (no automated cascade currently)
4. Request recording deletion from Bland AI (external process)

Call logs containing transcripts are not automatically deleted when a contact record is deleted (the FK on `call_logs.contact_id` is SET NULL on contact deletion, not CASCADE). This means transcripts may persist in `call_logs` even after the contact record is deleted.

**Legal Gap:** No automated erasure workflow, no self-service portal for data subjects, and no cascade deletion from contacts to call transcripts. See Section 21.


---

# SECTION 13 — TEAM ACCESS & AUDIT CONTROLS

## 13.1 Role Structure

Callengo uses a three-tier role-based access control system stored in `users.role`:

| Role | Description | Assignment |
|------|-------------|------------|
| `owner` | Account creator; full access; billing control; can manage all roles | Auto-assigned at company creation |
| `admin` | Elevated user; can manage team members; cannot manage billing | Assigned by owner |
| `member` | Standard user; access to operational features only | Default role at invitation |

Role changes are blocked at the database level via the `trg_prevent_role_self_escalation` trigger, which prevents users from updating their own role. Role changes can only be made by the service role (via admin API routes with appropriate authorization).

## 13.2 Team Invitation Flow

1. Owner or admin sends invitation via `POST /api/team/invite`
2. Only owners can invite with `admin` role (admins can only invite `member` role)
3. Plan-based seat limits are enforced at invite time (existing members + pending invites)
4. Invitation record created in `team_invitations` table with:
   - UUID token (invitation secret)
   - 7-day expiry
   - Email, role, company_id, invited_by
5. Email sent to invitee via Supabase Auth's built-in email service (`supabase.auth.admin.inviteUserByEmail()`) — Resend is configured but not the active delivery path
6. Invitee accepts via `POST /api/team/accept-invite`
7. Acceptance verifies: token validity, pending status, not expired, email match, not already in another company
8. On acceptance: user's `company_id` and `role` are updated; invitation marked `accepted`

**Invitation uniqueness constraint:** `(company_id, email, status)` — prevents duplicate pending invitations.

## 13.3 Role-Based Feature Access

| Feature | owner | admin | member |
|---------|-------|-------|--------|
| View contacts | ✅ | ✅ | ✅ |
| Edit contacts | ✅ | ✅ | ✅ |
| Delete contacts | ✅ | ✅ | ✅ |
| View call recordings | ✅ | ✅ | ✅ |
| View call transcripts | ✅ | ✅ | ✅ |
| Create campaigns | ✅ | ✅ | ✅ |
| Manage billing | ✅ | ❌ | ❌ |
| Invite team members | ✅ | ✅ (member only) | ❌ |
| Remove team members | ✅ | ✅ (members only) | ❌ |
| Assign admin role | ✅ | ❌ | ❌ |
| Access admin panel | Admin/Owner only (platform admin) | ✅ | ❌ |
| View subscription details | ✅ | ✅ | ✅ |
| Cancel subscription | ✅ | ❌ | ❌ |
| Connect integrations | ✅ | ✅ | ✅ |

Note: `admin` role in the Callengo platform context refers to the account-level admin role within a customer's company. The platform-level admin (accessing `/admin/command-center`) requires the database `role = 'admin'` or `role = 'owner'` AND is only assigned to the platform operator (Fuentes Digital Ventures LLC personnel).

## 13.4 Cross-Organization Data Access

Team members cannot access data from other organizations. RLS policies ensure all queries are scoped to the user's `company_id`. Team members can only access contacts, calls, campaigns, and settings belonging to their own company. There is no cross-tenant data sharing mechanism in the product.

## 13.5 Admin Audit Log

**Table:** `admin_audit_log`
**Location:** `supabase/migrations/20260321000002_admin_platform_config.sql`

All administrative actions performed via the Admin Command Center are logged to `admin_audit_log`. Each entry records:
- `user_id` — Who performed the action
- `action` — What action was taken (e.g., 'bland_plan_updated', 'platform_config_changed')
- `entity_type` — Type of entity affected
- `entity_id` — ID of the affected entity
- `old_value` — Previous state (JSONB)
- `new_value` — New state (JSONB)
- `ip_address` — IP address of the admin
- `user_agent` — Browser user agent of the admin
- `created_at` — Timestamp

**Access:** Only users with `role = 'admin'` or `role = 'owner'` can read the audit log. Inserts are restricted to service-role (performed by the platform API, not directly by users).

**Scope Limitation:** The audit log currently captures admin-level platform configuration changes. It does not currently capture customer-account-level operations such as individual contact deletions, campaign creations, or team membership changes. Expanding audit coverage is a recommended security improvement.

## 13.6 Prevent Role Escalation

**Database Trigger:** `trg_prevent_role_self_escalation` on the `users` table (BEFORE UPDATE).

The trigger function `prevent_role_self_escalation()` (SECURITY DEFINER) checks if the authenticated user is updating their own record AND attempting to change the `role` field. If so, it raises an exception. The trigger allows service_role to make role changes freely (for admin operations). This prevents a compromised user account from self-escalating to admin or owner.

## 13.7 Sensitive Field Protection

**Database Trigger:** `trg_prevent_sensitive_field_changes` on the `users` table (BEFORE UPDATE).

The trigger function `prevent_sensitive_field_changes()` (SECURITY DEFINER) blocks self-updates to `company_id` and `email`. This prevents a user from reassigning themselves to a different company (tenant escape) or changing their email (which could affect authentication) through direct DB updates.


---

# SECTION 14 — LEGAL POSITIONS A THROUGH D

## 14.A Technology Provider Position

Fuentes Digital Ventures LLC, operating as Callengo, is a technology infrastructure provider. The Company develops, hosts, and maintains a software platform that provides AI voice agent technology, campaign orchestration tools, CRM and calendar integration infrastructure, usage-based billing mechanisms, and related software-as-a-service tooling to business customers. The Company does not itself make outbound telephone calls to any individual. The Company does not select, originate, compile, purchase, or maintain lists of individuals to be contacted. The Company does not define the business purpose, sales objective, qualifying criteria, or informational content of any calling campaign. The Company does not employ human agents who call individuals. The Company does not operate as a telephone solicitor, telemarketer, automatic telephone dialing system operator, or telephone company as those terms are defined under any applicable law.

All outbound telephone calls initiated through the Callengo platform are initiated by and legally attributable to the business customer (the account holder) that configured and launched the campaign. The business customer: (a) provides the contact list containing the phone numbers to be dialed; (b) configures the AI agent task, script, and parameters; (c) defines the purpose of the call (lead qualification, appointment confirmation, data validation); (d) authorizes the initiation of each campaign; (e) controls when campaigns start and stop; and (f) receives and uses the output of each call. Callengo provides the technical means by which the customer's instructions are executed; the legal and regulatory responsibility for the calling campaign resides with the customer.

This technology provider classification has specific regulatory significance. Under the Telephone Consumer Protection Act (TCPA), 47 U.S.C. § 227, and FCC regulations implementing the TCPA, the party "making" a call is the one who initiates it with a purpose. Courts and the FCC have analyzed whether a platform provider is the "maker" or "initiator" of calls, and the determination frequently hinges on whether the platform provider selects the recipients and determines when to call. Because Callengo's customers supply their own contact lists and determine their own campaign timing and purpose, Callengo is in the position of a technology vendor, not a calling party. However, this analysis is fact-specific and may vary depending on the degree of automation and the extent of Callengo's operational involvement in any particular calling activity.

Callengo is not a data broker as defined under state consumer privacy laws. The Company does not sell, license, trade, or exchange data about individuals to third parties. Contact data uploaded by customers remains owned by the customer, processed solely for the customer's stated campaign purpose, and not commercialized by Callengo.

**Customer Obligations:** As a condition of using the Callengo platform, each business customer agrees that it is solely responsible for: (a) obtaining all legally required consents from individuals before calling them; (b) complying with all applicable federal and state telemarketing, calling, and consumer protection laws; (c) maintaining accurate and complete DNC records and honoring opt-out requests; (d) ensuring its use of AI voice agents complies with any applicable AI disclosure, voice synthesis, or consent-to-record laws; (e) ensuring that the purpose of each call is lawful; and (f) indemnifying and holding harmless Fuentes Digital Ventures LLC for any claims arising from the customer's calling activity. These obligations are incorporated by reference into the Callengo Terms of Service.

## 14.B Contact Data — Customer Ownership and Responsibility

All contact data uploaded to, imported into, or generated within the Callengo platform by a business customer is the property of that customer. Fuentes Digital Ventures LLC claims no ownership, license, or right to commercially exploit contact data. The Company does not sell, rent, license, sublicense, share, or disclose contact data to any party for any purpose other than: (a) processing it at the customer's direction to execute calling campaigns; (b) transmitting it to Bland AI for voice call execution (as directed by the customer's campaign configuration); (c) transmitting call transcripts to OpenAI for post-call analysis (as enabled by the customer); (d) syncing data to the customer's own connected CRM systems (as configured by the customer); and (e) delivering event data to the customer's configured webhook endpoints (as configured by the customer).

In the language of the General Data Protection Regulation (GDPR), the business customer is the **data controller** with respect to the contact data. The customer determines the purposes for which contact data is processed and the means of that processing. Fuentes Digital Ventures LLC, operating as Callengo, is a **data processor** acting on behalf of the customer. The Company processes contact data only on documented instructions from the customer (the campaign configuration), for no purpose other than executing the customer's campaign, and subject to the data processing obligations set forth in a Data Processing Agreement (DPA) to be executed with each customer where GDPR, UK GDPR, or equivalent data protection law applies.

Under the TCPA, the business customer is the party responsible for ensuring prior express consent to be called. The TCPA requires, for calls made using an automatic telephone dialing system (ATDS) or prerecorded or artificial voice to mobile telephone numbers, prior express written consent of the called party. Courts and the FCC are actively developing the legal framework for how AI-generated voice calls interact with ATDS and artificial voice requirements under the TCPA. As of 2024, the FCC has issued a ruling clarifying that calls using AI-generated voices require prior express written consent under 47 C.F.R. § 64.1200(a)(2). It is the business customer's responsibility to ensure that: (a) all contacts in their list have provided the requisite level of consent for the type of call being made; (b) consent records are maintained and producible upon demand; and (c) any withdrawal of consent is immediately reflected in the customer's contact list.

State-level DNC laws (California, Florida, Indiana, Oregon, Texas, and others) impose additional requirements beyond the National DNC Registry. The business customer, not Callengo, bears the obligation to comply with all applicable state DNC laws with respect to its contact lists.

Customers must make the following representations and warranties to Callengo as a condition of using the platform: (a) all contacts in the customer's lists have provided any legally required consent to be contacted by the customer using automated or AI voice means; (b) the customer maintains consent records that can be produced upon request; (c) the customer's contact lists do not include numbers registered on the National DNC Registry (unless the customer has a specific exemption or consent that permits contacting such numbers); (d) the customer will honor opt-out requests received during calls and remove opted-out numbers from future campaigns; (e) the customer has the legal right to possess and process the contact data it uploads.

## 14.C AI Disclosure and Automated Calling Compliance

Callengo's AI voice agents are powered by Bland AI's voice synthesis and conversation technology. The agents conduct telephone conversations that, to the recipient, may sound human. Multiple federal and state laws impose disclosure requirements for AI-generated voices, automated calls, and robocalls.

**Technical Capability in the Product:** Callengo's agent configuration system provides customers with the ability to configure a `first_sentence` (opening statement) for the AI agent. Customers can use this configuration field to include a disclosure such as "This is an automated call from [Company Name]" or "I'm an AI assistant calling on behalf of [Company Name]." The `task` prompt field can include instructions directing the AI agent to disclose its AI nature when asked or at the start of calls. However, this is a customer-configurable feature and is not enforced or mandated at the platform level.

**Customer's Sole Responsibility:** It is the business customer's sole and exclusive responsibility to: (a) determine whether the laws applicable to their calling activity require disclosure of AI or automated nature; (b) configure the AI agent scripts to include any required disclosures; (c) ensure that disclosures are accurate, timely, and lawful; and (d) update disclosures as laws change. Callengo provides the technical means to include disclosures; it does not audit customers' scripts for compliance and makes no warranty that any particular script configuration satisfies any applicable law.

**Relevant Legal Framework:**

*Federal — TCPA (47 U.S.C. § 227):* The TCPA prohibits initiating any telephone call using an artificial or prerecorded voice to residential telephones and wireless telephones without prior express consent (with certain exemptions). The FCC's February 2024 declaratory ruling clarified that AI-generated voices are "artificial voices" under the TCPA, requiring prior express written consent for calls to wireless numbers. Callengo customers making calls to consumer wireless numbers must obtain prior express written consent before deploying AI voice agents.

*Federal — FTC Telemarketing Sales Rule (16 C.F.R. Part 310):* For telemarketing calls, the TSR requires prompt disclosure of: (a) the call is a sales call; (b) the seller's identity; (c) the product or service. AI-generated calls that constitute telemarketing must comply with TSR disclosure requirements from the beginning of the call.

*California — Business & Professions Code § 17512:* California requires that robocalls (including AI-generated voice calls) clearly disclose the automated nature of the call at or near the beginning of the call.

*Florida — Florida Telephone Solicitation Act:* Florida requires identification of the calling party and prohibits deceptive practices in automated calls.

*Illinois — Artificial Intelligence Video Interview Act and related legislation:* Illinois has enacted multiple laws addressing AI in communication contexts. Depending on the call purpose and industry, additional disclosure obligations may apply.

*EU AI Act (Regulation (EU) 2024/1689):* The EU AI Act, applicable from 2024/2025, includes transparency requirements for AI systems that interact with natural persons. Systems that impersonate human communication must inform the recipient they are interacting with an AI, unless this is obvious from context. Callengo customers calling EU residents are subject to these requirements.

**Callengo's Position:** Callengo recommends (without warranty) that customers configure AI agents to identify themselves as AI assistants at the beginning of every call. This recommendation does not constitute legal advice, and customers are solely responsible for ensuring their compliance with all applicable laws. Callengo expressly disclaims any warranty that the platform's features satisfy any specific legal requirement in any jurisdiction.

## 14.D Google API Services — Limited Use Compliance

This section is written to directly address the requirements of the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy) and to provide documentation suitable for Google's OAuth verification process.

### D.1 Google API Data Accessed

Callengo's Google integration accesses the following Google API scopes on behalf of users who explicitly authorize the connection:

**`https://www.googleapis.com/auth/calendar`** — Read and write access to all Google Calendars associated with the connected Google account. This scope is used to: (a) read existing calendar events to provide availability context to the AI agent; (b) create new calendar events for confirmed appointments; (c) update existing calendar events when appointments are rescheduled or cancelled.

**`https://www.googleapis.com/auth/calendar.events`** — Read and write access to calendar events. This scope is used in conjunction with the calendar scope to manage individual event records. Note: this scope overlaps with the `calendar` scope; the combination ensures both calendar list access and event-level access.

**`https://www.googleapis.com/auth/userinfo.email`** — Access to the user's email address. This scope is used solely to identify the Google account being connected and to associate the integration with the correct Callengo user account.

**`https://www.googleapis.com/auth/userinfo.profile`** — Access to the user's basic profile information (name, profile picture URL). This scope is used to display the connected user's name in the integration dashboard.

**Google Sheets (same OAuth client):** When users connect Google Sheets, the same OAuth flow requests the `calendar` and `calendar.events` scopes (shared Google OAuth client). Additionally, the Google Sheets API is accessed using the OAuth token to read spreadsheet data for contact import purposes.

### D.2 Use of Google User Data

Google user data accessed through the Google API is used exclusively for the following purposes, which are directly related to the features the user authorized when connecting their Google account:

1. **Calendar data** is used to: sync appointment events created by Callengo's AI agents to the user's Google Calendar; read existing events to determine availability for scheduling; update events based on AI agent-confirmed rescheduling or cancellations; display calendar events within the Callengo application interface.

2. **User email and profile data** is used to: identify and display the connected Google account within the Callengo integration settings; associate the OAuth token with the correct Callengo user account.

Callengo does not use Google user data for any of the following purposes:
- Serving advertising
- Personalizing advertising
- Selling or transferring data to third parties (except to the sub-processors listed herein, solely for the purpose of executing calendar operations)
- Use of data for any purpose beyond the specific features the user authorized

### D.3 Limited Use Compliance Statement

Callengo's use of information received from Google APIs adheres to the **Google API Services User Data Policy**, including the **Limited Use requirements**. Specifically:

- Google user data is used only to provide or improve features visible to the user in the Callengo application
- Google user data is not transferred to third parties except as necessary to provide the service (specifically: calendar event data may be included in AI agent call metadata sent to Bland AI for appointment context)
- Google user data is not used for serving advertisements
- No human reads user Google data except with the user's explicit permission or as required by security or legal processes

### D.4 Google Data Storage

Google OAuth access tokens and refresh tokens are stored in the `calendar_integrations` table in Supabase PostgreSQL. Tokens are encrypted at rest using AES-256-GCM (`src/lib/encryption.ts`). Token storage includes: provider-associated email, provider user ID and name, token expiry timestamp, authorized scopes, and raw profile JSONB. Tokens are stored only for the duration of the integration connection and are deleted when the user disconnects the integration.

Calendar event data created or synced through the Google Calendar integration is stored in the `calendar_events` table in Supabase. This data is subject to the same company-level access controls as all other Callengo data.

Google Sheets data (spreadsheet IDs, column mappings, linked sheet details) is stored in `google_sheets_integrations` and `google_sheets_linked_sheets` tables. Row data fetched from linked sheets is used in-memory during contact import operations and is not separately persisted beyond the resulting contact records.

### D.5 Google Data Retention and Deletion

When a user disconnects the Google Calendar or Google Sheets integration through the Callengo dashboard, the access token and refresh token stored for that user are deleted from the database. Callengo revokes the OAuth token with Google upon disconnection. Calendar events that were previously synced to Callengo remain in `calendar_events` as historical records (the user's appointment history) but new sync operations cease.

Users who wish to revoke Callengo's access to their Google account can also do so at any time through their Google Account settings at https://myaccount.google.com/permissions. Revocation removes Callengo's ability to access the user's Google data but does not delete historical synced data already stored in Callengo.


---

# SECTION 15 — LEGAL POSITIONS E THROUGH H

## 15.E Microsoft API Data Handling

Callengo's Microsoft integration accesses Microsoft services through the Microsoft Identity Platform (Azure Active Directory) on behalf of users who explicitly authorize the connection.

### Microsoft Outlook Calendar

**Scopes Requested:** `Calendars.ReadWrite`, `User.Read`, `offline_access`

**`Calendars.ReadWrite`:** Provides read and write access to the user's Microsoft Outlook calendars. Used to: create appointment events confirmed by AI agents; read existing events to determine availability; update events on rescheduling or cancellation; sync Callengo calendar events to Outlook; display Outlook events in the Callengo calendar view.

**`User.Read`:** Provides access to the signed-in user's profile (display name, email address, tenant ID). Used to identify the Microsoft account being connected and associate the integration with the correct Callengo user.

**`offline_access`:** Permits issuance of a refresh token for background token refresh without requiring the user to re-authenticate. Necessary for scheduled sync operations when the user is not actively logged in.

### Microsoft Dynamics 365 CRM

**Scopes Requested:** `openid`, `profile`, `email`, `offline_access`, `https://graph.microsoft.com/User.Read`, and a dynamic `{instance_url}/user_impersonation` scope

**`openid`, `profile`, `email`:** Standard OIDC scopes for user identity. Used to identify the connecting Microsoft account.

**`https://graph.microsoft.com/User.Read`:** Accesses the user's basic profile from Microsoft Graph. Used to confirm user identity and display connection details.

**`{instance_url}/user_impersonation`:** Grants access to the specified Dynamics 365 instance on behalf of the authenticated user. This scope is dynamically constructed using the customer's Dynamics 365 instance URL. Used to read and sync contact records (leads, contacts) from the customer's Dynamics 365 instance.

**Data Handling:** Microsoft OAuth access tokens and refresh tokens are stored encrypted (AES-256-GCM) in `calendar_integrations` (for Outlook) and `dynamics_integrations` (for Dynamics 365). Tenant IDs are stored for multi-tenant Azure AD navigation. Contact data imported from Dynamics 365 is stored in the `contacts` table and `dynamics_contact_mappings` table. Tokens are revoked and deleted on integration disconnection.

**Limited Use:** Microsoft data is used only for calendar synchronization and CRM contact management as described. Microsoft data is not shared beyond Callengo's sub-processors and is not used for advertising or any purpose other than the authorized integration feature.

## 15.F CRM Integration Data Handling

Callengo's CRM integrations enable customers to sync their existing CRM contact records into Callengo for use in calling campaigns, and (for some CRMs) to push call outcomes back to the CRM. All CRM data processing occurs on behalf of the Callengo business customer. The customer, as data controller of their CRM data, authorizes Callengo to access and process that data for campaign purposes.

### HubSpot

Callengo reads from HubSpot: contact records including first name, last name, email address, phone number, company name, deal stage, owner assignment, and list membership. Callengo writes back to HubSpot (via `pushContactToPipedrive()` pattern, and via subscription lifecycle hooks): contact lifecycle stage updates, call activity notes, and deal stage updates upon subscription events. Data read from HubSpot is stored in `contacts` (contact PII) and `hubspot_contact_mappings` (HubSpot-to-Callengo ID cross-reference). Callengo does not retain HubSpot contact data beyond what is necessary to execute the customer's campaigns. The customer retains ownership of all HubSpot CRM data.

### Salesforce

Callengo reads from Salesforce: contact and lead records including name, email, phone, account name, address, and standard Salesforce fields. Outbound write-back to Salesforce is not currently implemented (read-only sync). Data read from Salesforce is stored in `contacts` and `salesforce_contact_mappings`. The Salesforce `full` scope was observed in the implementation; legal counsel should verify whether a more restricted scope can satisfy the functional requirement and whether the current scope grant is disclosed appropriately in the integration authorization UI.

### Pipedrive

Callengo reads from Pipedrive: person records including name, email, phone, organization name, and pipeline stage. Callengo writes back to Pipedrive: updated person fields with call outcomes and qualification results via `pushContactToPipedrive()`. Data is stored in `contacts` and `pipedrive_contact_mappings`. The customer remains the data controller.

### Zoho CRM

Callengo reads from Zoho CRM: contact records (name, email, phone, address, company). Currently read-only; no outbound write-back implemented. Data stored in `contacts` and `zoho_contact_mappings`. The `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`, `ZohoCRM.users.ALL`, `ZohoCRM.org.ALL`, and `ZohoCRM.notifications.ALL` scopes are requested. Legal counsel should evaluate whether narrower scopes can satisfy the functional requirement.

### Microsoft Dynamics 365

Callengo reads from Dynamics 365: contact and lead records from the customer's Dynamics 365 instance. Currently read-only. Data stored in `contacts` and `dynamics_contact_mappings`. Authentication uses tenant-specific OAuth with `user_impersonation` scope.

### Clio (Legal Practice Management)

Callengo reads from Clio: client records including name, email, phone, address, matter details, and firm association. The Clio integration targets the legal industry. Legal client data is subject to heightened sensitivity (attorney-client privilege considerations, state bar regulations, and legal professional ethics rules). Callengo processes Clio data only as directed by the law firm customer. Read-only; no outbound write-back implemented. Data stored in `contacts` and `clio_contact_mappings`.

**Special Note on Legal Client Data:** Law firms using Callengo to call their clients bear independent professional obligations under state bar rules regarding client communication. The use of AI voice agents to contact legal clients may implicate ethics rules on supervision of communication and disclosure. Callengo makes no warranty of compliance with any bar association rule and strongly recommends law firm customers obtain ethics guidance before deploying AI calling to clients.

### General Principles for All CRM Integrations

1. Callengo does not access any CRM data beyond what the customer explicitly configures and authorizes.
2. CRM contact data is used exclusively to populate Callengo contact records for use in customer-configured calling campaigns.
3. Callengo does not share CRM data with other Callengo customers or any third party except: (a) Bland AI (for call execution), (b) OpenAI (for post-call analysis), and (c) the customer's own webhook endpoints.
4. CRM data is retained in Callengo for as long as the contact record exists in the customer's Callengo account. No separate or extended retention applies.
5. When an integration is disconnected, the OAuth tokens are deleted. The contact records that were imported from the CRM are NOT automatically deleted (they become "orphaned" contacts in the customer's account that the customer can manage).

## 15.G Internal Analytics Data Handling

### Distinction Between Analytics Subjects

Callengo's internal analytics (PostHog, Google Analytics 4) track the behavior of **Callengo's business customers and their team members** — the people who log in to app.callengo.com and use the platform. Analytics do not track the behavior of the **contacts** — the individuals being called by customers' campaigns. Contact data is entirely separate from analytics data. No contact phone numbers, names, emails, or call transcripts flow into PostHog or GA4.

### PostHog

PostHog is used to track product usage by logged-in users. User identity (email, name) is sent to PostHog for session identification. Session recordings are enabled and capture screen activity during logged-in sessions; password fields, email fields, and phone number fields are masked. The `autocapture` feature captures UI interactions.

**Cookie consent gap:** PostHog initializes for all logged-in users without a consent gate. For users in EU/EEA jurisdictions, this may require a legal basis other than consent (e.g., legitimate interests for analytics of existing customers) or implementation of a consent mechanism. The `respect_dnt: true` configuration provides partial mitigation (users who set browser DNT flag are not tracked).

**Data retention:** PostHog data retention is configured in the PostHog account settings, not in the Callengo codebase. Default PostHog retention periods apply unless separately configured.

**User opt-out:** Users can currently opt out of PostHog tracking by enabling the browser Do Not Track setting. No in-product opt-out UI exists. Implementation of an in-product analytics opt-out is recommended.

### Google Analytics 4

GA4 is used to track page views and user interactions. Email addresses are sent as GA4 user properties, which is a compliance risk (see Section 21). GA4 loads without consent gating. No Google Ads linking or remarketing was found. IP anonymization is applied by default in GA4 since 2022.

**Data retention:** GA4 data retention is configured in the Google Analytics account settings, not in the codebase. The recommended setting for EU compliance is 2 months for event data.

### HubSpot Internal Tracking

No HubSpot tracking pixel or `_hsq.push` calls were found in the application code. HubSpot is used for CRM management of Callengo's own customers (B2B relationship management), not for website visitor tracking within the application. The `hubspot-user-sync.ts` server-side sync sends Callengo customer data (company name, plan, user email) to Callengo's own HubSpot CRM account for business relationship management.

### Cookie Compliance

The combination of PostHog and GA4 without a consent mechanism creates compliance obligations. The ePrivacy Directive requires consent for non-essential cookies in EU/EEA. PECR requires the same for UK users. A cookie banner with granular consent categories, Google Consent Mode v2, and PostHog opt-in gating is required for full compliance. See Section 5 and Section 21.

## 15.H Stripe Billing Data

Stripe is the exclusive payment processor for Callengo subscriptions, metered billing, and add-on purchases. The following principles govern Stripe data handling:

**Card Data Isolation:** Payment card numbers, CVV codes, and expiry dates are collected exclusively by Stripe's PCI DSS-compliant infrastructure (Stripe Checkout for initial subscriptions, Stripe Customer Portal for payment method updates). This data never transits through Callengo's servers, is never present in Callengo's logs, and is never stored in Callengo's database. Callengo is not a PCI DSS cardholder data environment.

**Callengo Stripe Storage:** Callengo stores Stripe object identifiers (customer ID, subscription ID, invoice IDs, payment intent IDs) and metadata for subscription management, billing display, and usage metering. Invoice URLs (Stripe-hosted) are stored for display in the billing history UI. Payment method type/brand (e.g., "Visa") is stored; no card number or sensitive card data is stored.

**Stripe's Data Processing Obligations:** Stripe processes payment data under Stripe's own privacy policy and data processing agreement. Stripe is an independent controller with respect to payment processing. For GDPR purposes, Stripe processes billing contact data (name, email, billing address) as a controller for fraud prevention and financial transaction purposes, and as a processor for payment execution on Callengo's behalf.

**Billing Data on Cancellation:** Upon subscription cancellation or account deletion, billing records (`billing_history`, `billing_events`, `usage_tracking`, `company_subscriptions`) are preserved indefinitely. These records constitute financial and accounting records and are subject to applicable record retention obligations (e.g., IRS requirements for US businesses, EU VAT record requirements for European customers). The recommended minimum retention period for billing records is 7 years.

**Customer Data with Stripe:** Callengo passes the following customer data to Stripe upon checkout: user email address, company name, company website, and a Callengo-assigned customer metadata object (including `company_id`). Stripe stores this as customer metadata associated with the Stripe Customer record. This is subject to Stripe's privacy policy (https://stripe.com/privacy).


---

# SECTION 16 — LEGAL POSITIONS I THROUGH N

## 16.I Bland AI — Voice Infrastructure Sub-Processor

Bland AI is Callengo's critical voice infrastructure sub-processor. All AI voice calls initiated through the Callengo platform are executed by Bland AI using a single master API key maintained by Fuentes Digital Ventures LLC. Bland AI is not a separate account for each customer; all customers' calls are routed through a single Bland AI account with isolation managed by Callengo via metadata tags.

**Data Transmitted to Bland AI:** For every call, Callengo transmits to Bland AI: the contact's phone number, the AI task instruction text (which includes the contact's name and other personalized details), voice configuration, call parameters, and metadata including Callengo's internal company and contact IDs. This constitutes transmission of personal data (specifically, the contact's phone number and identifying information embedded in the task prompt) to Bland AI.

**Bland AI as Sub-Processor:** In GDPR terminology, Callengo's business customers are data controllers with respect to their contacts. Callengo is a data processor acting on customers' instructions. Bland AI is therefore a sub-processor, processing personal data on Callengo's behalf at the direction of Callengo's customers. Callengo is responsible for ensuring that Bland AI provides sufficient guarantees under Article 28(4) GDPR.

**Bland AI Data Retention:** Upon end of Services, Bland AI will delete or return Customer Personal Data on written request to `compliance@bland.ai` within 14 days of service cessation (per DPA Section 2.6). Back-up archives are securely isolated. Callengo's application-layer recording retention is 30 days by default; 12 months with the Recording Vault add-on. Note that Bland AI's infrastructure-side retention of recordings and transcripts is governed by the DPA deletion provisions, not by Callengo's UI settings — customers requiring guaranteed deletion should submit a formal deletion request via `compliance@bland.ai`.

**Training Data — RESOLVED (March 2026):** Bland AI's DPA (reviewed March 2026 — see Section 21 / GAP-005) confirms that Customer Personal Data, including call recordings and transcripts, is not used for model training as long as it remains identifiable. The DPA permits Bland to create Deidentified Data for product improvement, but this carve-out requires technical deidentification measures such that the data cannot be associated with a Data Subject or Customer. No API-level opt-out flag is required — protection is contractual under the DPA.

**Callengo's Sub-Processor Obligations to Customers:** Callengo's DPA with its business customers must: (a) identify Bland AI as a sub-processor; (b) describe the data categories and processing activities Bland AI performs; (c) confirm that Callengo has entered into a GDPR-compliant DPA with Bland AI; (d) notify customers of any changes to sub-processors; and (e) permit customers to object to new sub-processors.

**Security Measures:** Communications to Bland AI's API use HTTPS. Webhook responses from Bland AI are authenticated via HMAC-SHA256 signature verification. The Bland AI master API key is stored as a Vercel server-side environment variable (`BLAND_API_KEY`) and never exposed to client-side code.

## 16.J Limitation of Liability

The following represents the complete limitation of liability framework that should be incorporated into Callengo's Terms of Service.

**Liability Cap:** The aggregate liability of Fuentes Digital Ventures LLC, its members, managers, employees, contractors, agents, and successors, whether in contract, tort, negligence, strict liability, warranty, or any other theory, arising out of or relating to the Callengo platform or Terms of Service, shall not exceed the greater of: (a) the total amounts paid by the customer to Fuentes Digital Ventures LLC in the twelve (12) calendar months immediately preceding the event giving rise to the claim; or (b) one hundred United States dollars (USD $100).

**Exclusion of Consequential Damages:** In no event shall Fuentes Digital Ventures LLC be liable for any indirect, incidental, special, exemplary, punitive, or consequential damages of any kind, including without limitation: loss of profits, loss of revenue, loss of data, loss of business opportunity, loss of goodwill, loss of anticipated savings, cost of substitute goods or services, whether or not Fuentes Digital Ventures LLC has been advised of the possibility of such damages, and whether arising under contract, tort, or otherwise.

**Explicitly Excluded Scenarios:** Without limiting the foregoing, Fuentes Digital Ventures LLC expressly excludes all liability for:

1. Any TCPA violation, Telemarketing Sales Rule violation, state DNC law violation, or other telemarketing or calling law violation committed by the customer in connection with the customer's use of the Callengo platform;
2. Any claim by a third party (including any individual who was called by the customer) arising from calls initiated by the customer using the Callengo platform;
3. Any failure or delay attributable to Bland AI, Supabase, Stripe, OpenAI, or any other third-party service;
4. Any unauthorized access to or disclosure of customer data or contact data resulting from the customer's failure to maintain credential security;
5. Any harm caused to individuals on the basis of contact data that was obtained by the customer without adequate legal consent or authorization;
6. Any claim arising from the customer's failure to obtain required consents before calling individuals;
7. Any AI agent script content configured by the customer that violates applicable law;
8. Any failure of the customer to honor opt-out or DNC requests received during calls;
9. Any regulatory investigation, fine, or penalty assessed against the customer;
10. Any claim arising from the customer's breach of any representation or warranty made to Callengo.

**Essential Basis:** The customer acknowledges that the limitations of liability set forth herein are an essential element of the basis of the bargain between Callengo and the customer, and that Callengo would not provide the platform at the prices offered without such limitations.

## 16.K Customer Indemnification

As a condition of using the Callengo platform, each customer agrees to indemnify, defend, and hold harmless Fuentes Digital Ventures LLC and its sole member Cristopher Fuentes, managers, officers, employees, contractors, successors, and assigns (the "Callengo Indemnitees") from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to:

1. The customer's use of the Callengo platform to initiate telephone calls to any individual;
2. Any alleged or actual violation of the TCPA, FCC regulations, FTC Telemarketing Sales Rule, National DNC Registry requirements, or any federal, state, or local telemarketing or calling law;
3. Any contact data uploaded, imported, or used by the customer that was obtained without adequate legal consent, by unlawful means, or in violation of any third-party rights;
4. The customer's failure to obtain legally required prior express written consent (or other applicable consent) from any individual before initiating a call to that individual;
5. The customer's failure to honor any opt-out request, DNC registration, or withdrawal of consent;
6. Any AI disclosure law violation resulting from the customer's configuration of AI agent scripts;
7. Any claim by an individual who was called by the customer using the Callengo platform;
8. The customer's breach of any representation, warranty, covenant, or obligation under the Terms of Service;
9. The customer's use of any CRM data imported from a third-party CRM in violation of the CRM's terms of service or any applicable data protection law;
10. Any third-party claim arising from the customer's direction of Callengo to transmit data to the customer's webhook endpoints or integrated CRM systems.

The customer's indemnification obligation shall survive termination or expiration of the Terms of Service.

## 16.L TCPA and Telemarketing Law Compliance Framework

The following framework describes the legal landscape that Callengo's business customers must navigate. This framework is provided for informational purposes only; it does not constitute legal advice. Customers are solely responsible for their own legal compliance.

**TCPA (47 U.S.C. § 227):** The TCPA is the primary federal law governing telemarketing and automated calling in the United States. Key provisions:

- Prohibits using an automatic telephone dialing system (ATDS) or artificial or prerecorded voice to call mobile telephone numbers without prior express written consent.
- As of the FCC's February 2024 ruling, AI-generated voices constitute "artificial voices" under the TCPA. Calls made using AI-generated voices to wireless numbers require prior express written consent.
- "Prior express written consent" requires: a signed written agreement (including electronic signatures), specific identification of the calling entity, and an agreement that includes a clear and conspicuous disclosure that the person agrees to receive calls using artificial or prerecorded voice messages.
- Prohibits calling numbers on the National DNC Registry (with limited exemptions for established business relationships and express consent).
- Imposes per-violation statutory damages of $500, trebled to $1,500 for willful violations.

**FTC Telemarketing Sales Rule (16 C.F.R. Part 310):** The TSR prohibits:
- Abandoning outbound calls at a rate exceeding 3% per campaign
- Failing to transmit caller ID information
- Calling individuals who have asked not to be called
- Misrepresenting any material aspect of the call's purpose

The TSR requires prompt disclosure at the start of outbound sales calls: (a) the call is a sales call; (b) the seller's identity; (c) the nature of the goods or services.

**National DNC Registry:** Telemarketers must scrub contact lists against the National DNC Registry before initiating telemarketing calls. The exemption for an "established business relationship" was significantly narrowed by FCC rulemaking. An active subscription relationship does not automatically exempt a caller from NDNC requirements for new product or service offers.

**Call Time Restrictions:** Federal regulations (47 C.F.R. § 64.1200(c)(1)) prohibit telemarketing calls before 8:00 a.m. or after 9:00 p.m. local time of the called party. Callengo's campaign scheduling tools allow customers to configure calling hours; customers must configure compliant time windows respecting the called party's local timezone.

**State DNC Laws:** Numerous states maintain their own DNC registries and/or impose additional restrictions beyond federal law, including: California (CCPA restrictions on commercial solicitation), Florida (Florida Telephone Solicitation Act, Florida Do Not Call Act — extends restrictions to business-to-business calls), Indiana (Telephone Privacy Act), Oregon (Telemarketing Registration Act), Texas (Business & Commerce Code Chapter 304). Customers operating in these states must comply with applicable state laws.

**Record-Keeping:** The TSR and TCPA best practices require telemarketers to maintain records of: consent forms obtained from called parties, call logs, DNC compliance records, and opt-out records. Customers are responsible for maintaining these records; Callengo's `call_logs` table provides a record of calls made but does not constitute a consent management system.

**Opt-Out Honoring:** When a called individual asks to be placed on the caller's DNC list during a call, the caller is legally required to honor that request within a specified timeframe (30 days under TSR; immediately under some state laws). Callengo's AI agent can be configured to detect and log opt-out requests, but the mechanical process of removing opted-out numbers from future campaigns is the customer's responsibility.

**Platform-Level Call Frequency Safeguards (Callengo Technical Controls):** Callengo enforces the following technical limits that provide a degree of protection against harassment-level call frequencies, independent of any customer-configured settings:
- **Contact cooldown:** A 5-minute minimum interval between calls to the same contact phone number is enforced at the Redis level (`callengo:contact_cooldown:{contactId}` key with 5-minute TTL, `src/lib/redis/concurrency-manager.ts`). Any attempt to dispatch a second call to the same contact within 5 minutes will be blocked.
- **Concurrent call caps:** Per-company concurrent call limits (determined by subscription plan) prevent bulk simultaneous calling to the same contact list.
- **Daily and hourly limits:** Daily and hourly call count limits are enforced globally and per-company, preventing sustained high-frequency calling campaigns.
These technical controls do not substitute for the customer's obligation to maintain and honor a proper DNC list, comply with TCPA consent requirements, and respect federal and state call frequency best practices.

## 16.M Data Security and Breach Notification

**Security Practices:** Callengo implements the following security measures for customer and contact data:
- All data transmitted between users and the platform is encrypted in transit using TLS 1.2 or higher (enforced via HSTS)
- OAuth tokens for all integrations are encrypted at rest using AES-256-GCM with 32-byte random IV per token
- Row Level Security (RLS) is enabled on all 57 database tables
- Authentication sessions use HTTP-only, Secure, SameSite=Lax cookies
- Sensitive operations are protected by rate limiting via Upstash Redis
- Database-level triggers prevent privilege escalation and unauthorized field modification
- All webhook endpoints are validated against SSRF attacks before data transmission
- HMAC-SHA256 verification is used for all inbound webhooks (Bland AI, Stripe)
- Security headers including CSP, X-Frame-Options, HSTS, and Permissions-Policy are applied to all responses
- Platform administrators have IP address and user agent logging in the audit log

**Wyoming Data Breach Notification (Wyo. Stat. §§ 40-12-501 through 40-12-509):** Fuentes Digital Ventures LLC is incorporated in Wyoming. Wyoming's data breach notification law applies to any person conducting business in Wyoming who owns or licenses computerized data that includes personal information of Wyoming residents. Under Wyoming law:

- "Personal information" includes name combined with any of: SSN, driver's license number, financial account number with access credentials, medical information, health insurance information, or unique biometric data.
- Upon discovery of a breach, the business must notify affected Wyoming residents in the most expedient time possible and without unreasonable delay.
- Notification is not required if, after reasonable investigation, it is determined that the breach is not reasonably likely to cause harm.
- If the breach affects more than 500 Wyoming residents, the Wyoming Attorney General must also be notified.

**Federal Standards:** While no single comprehensive federal data breach notification law applies to all businesses, the FTC Act's Section 5 prohibition on unfair or deceptive acts requires companies to have reasonable security measures and to remediate breaches promptly. The FTC Safeguards Rule (for financial institutions) and HIPAA (for healthcare entities) impose specific requirements; these likely do not apply directly to Callengo but may apply to Callengo's customers in those sectors.

**GDPR Article 33:** Given that Callengo's sole member resides in the EU and that Callengo may process personal data of EU residents (both customers and contacts), GDPR Article 33 breach notification requirements may apply. Under Article 33, the data controller must notify the competent supervisory authority within 72 hours of becoming aware of a personal data breach that is likely to result in a risk to the rights and freedoms of natural persons. Article 34 requires direct notification to affected data subjects where the breach is likely to result in a high risk. Callengo should identify the competent supervisory authority (likely the Spanish Data Protection Agency, AEPD, given the sole member's residence in Spain) and establish a breach response procedure.

## 16.N GDPR Applicability

**Applicable Law Question:** Fuentes Digital Ventures LLC is organized under Wyoming law with its principal office in Wyoming, United States. However, the sole member and manager, Cristopher Fuentes, resides in Valencia, Spain, a member state of the European Union. The GDPR (Regulation (EU) 2016/679) applies under Article 3 in the following circumstances:

1. **Establishment:** If Callengo has an "establishment" in the EU — which includes having a person (the sole member) who exercises effective management and control of the company from within the EU — then GDPR Article 3(1) may apply. The sole member's residence in Spain and his role as the sole decision-maker of Fuentes Digital Ventures LLC creates a strong argument that the company has an establishment in Spain, bringing it within the territorial scope of GDPR.

2. **Targeting:** Under GDPR Article 3(2), GDPR applies to companies not established in the EU that offer goods or services to EU data subjects (Article 3(2)(a)) or that monitor the behavior of EU data subjects (Article 3(2)(b)). Callengo's multilingual platform (including Spanish, French, German, Italian, Dutch, Portuguese) and geolocation-based currency detection suggest the platform is designed to attract EU customers. EU-based customers whose employees and contacts are EU residents would make Callengo subject to GDPR under Article 3(2).

**Conclusion:** GDPR likely applies to Callengo on both the establishment basis and the targeting basis. Legal counsel should confirm this analysis and identify the lead supervisory authority.

**Legal Basis for Processing:**

With respect to **customer data** (Callengo account holders and their team members):
- **Performance of contract** (GDPR Art. 6(1)(b)): Processing of user accounts, billing, and operational features is necessary for the performance of the SaaS agreement.
- **Legitimate interests** (GDPR Art. 6(1)(f)): Analytics (PostHog, GA4) and security monitoring may be justified on legitimate interests, subject to a balancing test.
- **Consent** (GDPR Art. 6(1)(a)): Currently, no consent mechanism gates analytics cookies or session recording. This must be remediated.

With respect to **contact data** (individuals called by customers):
- Callengo is a data processor; the legal basis is determined by the customer (data controller), not by Callengo.
- Callengo's DPA with customers must require customers to identify their legal basis for processing contact data through the platform.

**Data Processing Agreement (DPA):** GDPR Article 28 requires a written contract between the controller (Callengo's business customer) and the processor (Callengo). The DPA must cover: the subject matter, duration, nature, and purpose of processing; the type of personal data and categories of data subjects; the controller's obligations and rights; and the specific requirements of Article 28(3) including: processing only on documented instructions; confidentiality obligations; security measures; sub-processor management; data subject rights assistance; deletion or return of data; audit cooperation.

**Data Subject Rights:** EU data subjects have the following rights under GDPR regarding their personal data processed by Callengo:
- **Art. 15 — Right to access:** Data subjects can request confirmation of processing and a copy of their personal data.
- **Art. 16 — Right to rectification:** Data subjects can request correction of inaccurate data.
- **Art. 17 — Right to erasure ("right to be forgotten"):** Data subjects can request deletion of their personal data, subject to certain exceptions (legal obligations, legitimate interests).
- **Art. 18 — Right to restriction:** Data subjects can request that processing be restricted in certain circumstances.
- **Art. 20 — Right to data portability:** Data subjects can request their data in a machine-readable format.
- **Art. 21 — Right to object:** Data subjects can object to processing based on legitimate interests.

**Current Implementation Gap:** There is no self-service data subject rights portal. Rights requests must be submitted to legal@callengo.com and handled manually. An internal procedure for handling GDPR rights requests within the 30-day statutory deadline should be established.

**EU Representative:** If GDPR applies under Article 3(2) and Callengo is not established in the EU (which is debatable given the sole member's EU residence), Article 27 would require appointing an EU representative in writing. If the sole member's residence constitutes an EU establishment, this requirement may be satisfied. Legal counsel must determine the applicable position.

**Spanish Lead Supervisory Authority:** Given the sole member's residence in Spain, the lead supervisory authority for GDPR enforcement purposes would likely be the Agencia Española de Protección de Datos (AEPD). Contact: https://www.aepd.es

**Data Protection Impact Assessment (DPIA) — GDPR Article 35 Obligation:** GDPR Article 35 requires a Data Protection Impact Assessment (DPIA) before commencing processing operations that are "likely to result in a high risk to the rights and freedoms of natural persons." A DPIA is specifically required where processing involves: (a) systematic and extensive evaluation of personal aspects relating to natural persons based on automated processing, including profiling; (b) large-scale processing of special categories of data; or (c) systematic monitoring of publicly accessible areas on a large scale.

Callengo's core processing activities likely trigger the DPIA requirement on the basis of (a): the platform uses AI voice agents to autonomously call individuals, records those conversations, and then applies automated AI analysis (OpenAI) to classify the called individual's intent, interest level, sentiment, and data accuracy. This constitutes automated evaluation of personal aspects (contact qualification, behavioral intent classification, sentiment assessment) at potentially large scale. Additionally, Callengo processes conversation content (call recordings and transcripts) which may incidentally capture sensitive personal information disclosed during conversations.

**No DPIA has been conducted.** This represents a compliance gap that must be addressed before the platform is made available to EU/EEA-based customers or processes personal data of EU residents at scale. The DPIA should assess: the nature, scope, context, and purposes of the processing; the necessity and proportionality; the risks to data subjects; and the measures to address those risks (including safeguards, security measures, and mechanisms to ensure protection of personal data).

See GAP-025 for the open item tracking this obligation.


---

# SECTION 17 — LEGAL POSITION O — CCPA

## 17.1 California Consumer Privacy Act — Applicability Analysis

The California Consumer Privacy Act (Cal. Civ. Code §§ 1798.100–1798.199.100), as amended by the California Privacy Rights Act (CPRA), establishes privacy rights for California residents and imposes obligations on businesses that meet certain thresholds.

**CCPA Thresholds:** A "business" subject to CCPA must meet one of the following:
1. Annual gross revenues exceeding $25 million;
2. Annually buys, sells, or shares personal information of 100,000 or more consumers or households; OR
3. Derives 50% or more of annual revenues from selling or sharing personal information.

**Threshold Analysis at Current Scale:**
- Callengo is an early-stage SaaS company (formed November 2024). It is unlikely to meet the $25 million revenue threshold at current scale.
- Callengo does not sell or share personal information within the meaning of the CCPA (see below); threshold (3) does not apply.
- With respect to threshold (2): Callengo processes contact data on behalf of its business customers. Whether contacts processed through customer campaigns count toward Callengo's 100,000 consumer threshold is legally uncertain. If Callengo has processed contact data for more than 100,000 California residents across all customers' campaigns (as an aggregate), it may meet threshold (2). This threshold should be monitored as the platform scales.

**Provisional Conclusion:** Callengo likely does not currently meet CCPA thresholds as a direct obligated business. However, this may change as the platform scales, and certain CCPA rights should be honored proactively as a matter of best practice.

## 17.2 CCPA Rights of California Residents

**Callengo Account Holders (California residents):** The personal information Callengo collects from California residents who are Callengo customers includes: email address, full name, company name, IP address, location data, usage behavior, and billing information. If and when CCPA thresholds are met, California resident account holders have the right to:

- **Right to Know:** What personal information has been collected, the purposes for collection, the categories of sources, and whether it has been shared.
- **Right to Delete:** Request deletion of personal information, subject to exceptions.
- **Right to Correct:** Request correction of inaccurate personal information.
- **Right to Opt-Out of Sale or Sharing:** Callengo does not sell or share personal information for cross-context behavioral advertising purposes. The "Do Not Sell or Share My Personal Information" link is therefore not currently required, but should be implemented when CCPA thresholds are met.
- **Right to Limit Use of Sensitive Personal Information:** Callengo collects IP addresses (which may be considered sensitive). No other sensitive personal information categories (as defined by CPRA) are collected from account holders.
- **Right to Non-Discrimination:** California residents who exercise CCPA rights shall not receive discriminatory treatment.

## 17.3 Contact Data and CCPA Service Provider Classification

When Callengo processes contact data (the data of individuals being called) on behalf of business customers, Callengo acts as a **service provider** under CCPA. A service provider is a for-profit entity that processes personal information on behalf of a business pursuant to a written contract that prohibits the service provider from retaining, using, or disclosing the personal information for any purpose other than performing the services specified in the contract.

Callengo's Terms of Service and Data Processing Addendum must include service provider contract language that: (a) prohibits Callengo from retaining, using, or disclosing contact data for any purpose other than performing the specified services; (b) prohibits combining contact data from one customer with contact data from other customers or with data from Callengo's own direct customer interactions; (c) certifies that Callengo understands and will comply with these restrictions.

**Combining Prohibition:** Callengo must not combine personal information received as a service provider with personal information obtained from other sources. Because each customer's contacts are isolated in their own company partition (enforced by RLS), and Callengo does not combine or aggregate contact data across customers, Callengo currently satisfies this requirement operationally. The Terms of Service must include the contractual restriction.

## 17.4 Do Not Sell / Do Not Share

Callengo does not sell personal information (the company has no revenue model that involves monetizing personal data). Callengo does not share personal information for cross-context behavioral advertising. The sharing of contact data with Bland AI (for call execution) and OpenAI (for analysis) constitutes a service provider relationship, not a "sale" or "share" under CCPA. The sharing of data with customers' own connected CRMs is at the customer's direction and is not a sale.

## 17.5 CCPA and the Analytics Context

Google Analytics 4 and PostHog receive personal information about Callengo's account holders (email addresses, behavioral data, IP addresses). Whether this constitutes a "sale" or "sharing" under CCPA depends on whether GA4/PostHog use the data for cross-context behavioral advertising. GA4 by default may use data for Google's ad measurement purposes. The use of GA4 without a service provider agreement or without disabling advertising features may constitute "sharing" of personal information under CCPA if California users interact with the platform and Callengo meets the applicable threshold. Callengo should restrict GA4 data processing to analytics purposes only (disable advertising features in GA4 settings) and execute a Google Ads Data Processing Amendment.


---

# SECTION 18 — GOOGLE OAUTH COMPLIANCE SUMMARY

> **Note:** This section is structured as a standalone, self-contained response addressed to Google's OAuth API verification team. It is designed to be cited independently without reference to other parts of this document. It covers Callengo's use of the Google Calendar OAuth integration only. Google Analytics 4 is a separate product and is not covered by this OAuth verification.

---

## Overview

**Application Name:** Callengo
**Application URL:** https://app.callengo.com
**Operator Legal Name:** Fuentes Digital Ventures LLC
**Contact for Google Verification:** legal@callengo.com
**Integration Purpose:** Allow Callengo users to connect their personal Google Calendar so that AI calling agents can schedule and confirm appointments by reading and writing calendar events.

Callengo is a B2B SaaS platform that automates outbound voice calling. The Google Calendar integration is an **optional feature** that account holders voluntarily connect from within the application's settings panel. The integration is not required to use the platform. Users connect their Google Account through a standard OAuth 2.0 authorization flow and may revoke access at any time.

---

## 18.1 Data Accessed

Callengo requests the following OAuth 2.0 scopes from the Google Authorization Server:

| Scope | Description | Why Requested |
|-------|-------------|---------------|
| `https://www.googleapis.com/auth/calendar` | Full read and write access to the user's Google Calendar | Required to check availability and create, update, or delete calendar events on behalf of the user |
| `https://www.googleapis.com/auth/calendar.events` | Read and write access to calendar events | Provides more granular event-level access as a functional redundancy |
| `https://www.googleapis.com/auth/userinfo.email` | Read the user's email address | Required to match the Google Account to the Callengo user account and to confirm the correct calendar is being connected |
| `https://www.googleapis.com/auth/userinfo.profile` | Read the user's basic profile information (name, profile picture) | Used to display the connected account name in the UI so users can confirm which account they have connected |

**Data actually retrieved and stored:**

- **Access token and refresh token** — stored encrypted at rest using AES-256-GCM (`TOKEN_ENCRYPTION_KEY`, 256-bit key). Stored in the `integrations_calendar` table in Supabase, scoped to the user's `company_id`. Refresh token is used to maintain long-lived access without requiring re-authorization.
- **Google account email address** — stored as `calendar_email` in `integrations_calendar`, used solely as a display label so the user can identify which Google Account is connected.
- **Calendar events** — read in real time when the calling agent needs to check availability or schedule an appointment. Events are not stored in Callengo's database; they are read, used for scheduling logic, and discarded from memory.
- **User display name / profile information** — used only to display in the UI at the moment of connection. Not stored persistently.

**Data NOT retrieved:** Callengo does not request and does not receive the contents of email messages (Gmail), contact lists, Google Drive files, browsing history, or any other Google product data beyond the calendar scopes listed above.

---

## 18.2 Data Usage

Google user data obtained through the OAuth integration is used **exclusively** for the following purposes, which are directly requested by the user at the time of authorization:

1. **Availability checking** — When a Callengo AI calling agent determines during a live phone call that the call recipient wishes to schedule a meeting, the agent reads the connected user's calendar to identify available time slots. This data is used in real time and not retained.

2. **Appointment creation** — When a call recipient agrees to a meeting time, the agent creates a calendar event in the user's Google Calendar using the `calendar.events` scope.

3. **Appointment modification and cancellation** — When a call recipient reschedules or cancels via a follow-up call, the agent updates or deletes the corresponding calendar event.

4. **Account identity confirmation** — The user's Google account email address is displayed in the Callengo settings UI so the user can confirm which account is currently connected and disconnect it if desired.

**Callengo does NOT use Google user data for:**

- Training machine learning models or AI systems
- Advertising or ad targeting
- Profiling users for purposes unrelated to calendar scheduling
- Sharing with third parties for any purpose other than direct execution of the scheduling action (see Section 18.3)
- Selling, renting, or licensing user data
- Any automated decision-making that affects the user's legal rights or significant interests

The use of Google user data is strictly limited to what is necessary to provide the calendar integration feature as described above (principle of data minimization). This is consistent with Google's Limited Use Policy.

---

## 18.3 Data Sharing

Google user data is **not shared** with third parties except as described below, and in each case the sharing is strictly necessary to provide the requested service:

| Recipient | What Is Shared | Purpose | Relationship |
|-----------|---------------|---------|-------------|
| **Supabase (PostgreSQL)** | Encrypted OAuth tokens, calendar email | Persistent storage of credentials so users do not need to re-authorize on every session | Data processor / sub-processor under written contract |
| **Bland AI** | None — Google data is never sent to Bland AI | Calendar scheduling is handled entirely within Callengo's server-side code after Bland AI has completed the call | N/A |
| **OpenAI** | None — Google user data is never sent to OpenAI | Post-call analysis operates on call transcripts only, which do not contain Google user data | N/A |
| **Vercel** | OAuth tokens transit through Vercel serverless functions during the OAuth callback | Vercel hosts Callengo's API endpoints; tokens are immediately encrypted and written to the database | Infrastructure processor |

**No Google user data is shared with:**

- Other Callengo customers (each customer's data is isolated by Row Level Security on all database tables)
- Data brokers, marketers, or advertisers
- Any entity for the purpose of building a profile on the user for purposes unrelated to the calendar integration

The integration credentials (access token and refresh token) are isolated per user and per company. No Google user data from one customer is visible to or combined with data from another customer.

---

## 18.4 Data Storage and Protection

**Storage Location:** Supabase (PostgreSQL), hosted on AWS infrastructure in the United States (US East region). Supabase is SOC 2 Type II certified and GDPR-compliant.

**Encryption at Rest:**
- OAuth tokens (access token, refresh token) are encrypted using AES-256-GCM before being written to the database.
- The encryption key (`TOKEN_ENCRYPTION_KEY`) is a 256-bit (32-byte) key stored as an environment variable in Vercel's encrypted secret store, never committed to source code.
- The encrypted format is: `enc:<base64-iv>:<base64-authTag>:<base64-ciphertext>`.

**Encryption in Transit:**
- All data transmission between the browser and Callengo's servers is over TLS 1.2 / TLS 1.3 (enforced by Vercel).
- All server-to-server communication (e.g., Callengo servers to Google APIs) is over HTTPS.
- HSTS is enforced via the `Strict-Transport-Security` response header.

**Access Controls:**
- Google user data in the database is protected by Supabase Row Level Security (RLS). Only authenticated users belonging to the same `company_id` can read their own integration records.
- No Callengo employee or service account has routine access to individual users' Google OAuth tokens. The service role key (which bypasses RLS) is used only for server-side operations and is stored as an encrypted environment variable.
- No Google user data is cached in Redis or any other shared cache. Only UUIDs and session metadata are cached.

**Security Headers:**
Callengo's application enforces the following HTTP security headers: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

**Incident Response:**
In the event of a data breach affecting Google user data, Callengo will: (a) notify affected users within 72 hours; (b) notify Google as required by the API Terms of Service; (c) revoke and cycle affected OAuth tokens; (d) conduct a post-incident review.

---

## 18.5 Data Retention and Deletion

**Retention Period:**
Google OAuth tokens and the associated calendar email address are retained for as long as the user maintains an active Callengo account and the Google Calendar integration remains connected.

**User-Initiated Disconnection:**
Users can revoke Callengo's access to their Google Account at any time by navigating to **Settings → Integrations → Google Calendar → Disconnect**. Upon disconnection:
1. The access token and refresh token stored in Callengo's database (`integrations_calendar` table) are deleted immediately.
2. The calendar email address stored in `integrations_calendar` is deleted.
3. Callengo also revokes the token at Google's authorization server by calling the token revocation endpoint, so that the token cannot be used after disconnection even if it were somehow retrieved.

**Account Deletion:**
When a Callengo customer account is deleted (via the account deletion flow or by administrative action), all integration records including Google OAuth tokens are deleted from the database. Callengo applies a 30-day soft-delete period for companies, after which all associated data including integration credentials is permanently deleted from the production database.

**Deletion of Google Data from Caches:**
Google user data is not stored in any cache (Redis or otherwise), so no cache invalidation is required upon disconnection or deletion.

**Backup Retention:**
Supabase automated backups may retain data for up to 30 days after deletion. After this period, the data is permanently purged from backup storage.

---

---

# SECTION 19 — COMPLIANCE CHECKLIST

> **Purpose:** This checklist provides a high-level snapshot of Callengo's compliance posture across applicable legal regimes as of March 25, 2026. Status values: ✅ Compliant | ⚠️ Partial / In Progress | ❌ Non-Compliant / Gap | ➖ Not Applicable.

---

| Regulation / Framework | Applicability to Callengo | Responsible Party | Current Status | Notes |
|------------------------|--------------------------|-------------------|---------------|-------|
| **TCPA (Telephone Consumer Protection Act)** | HIGH — Callengo dispatches automated outbound voice calls to phone numbers provided by customers | Customer (primary); Callengo (platform liability) | ⚠️ Partial | Callengo's Terms must require customers to: (a) obtain prior express written consent before calling contacts; (b) maintain Do-Not-Call compliance; (c) provide TCPA-compliant disclosures. Callengo must disclaim liability for customer TCPA violations. Current ToS does not appear to include required TCPA pass-through obligations. See Legal Position B. |
| **FTC Telemarketing Sales Rule (TSR)** | HIGH — Automated outbound calls are subject to the TSR if they constitute telemarketing. Calls for appointment confirmation, data validation, and lead qualification may qualify. | Customer (primary); Callengo (platform) | ⚠️ Partial | Customers must comply with TSR call-time restrictions (8 AM–9 PM local), opt-out mechanisms, and disclosure requirements. Callengo's ToS must require this. No technical enforcement of call-time windows in the platform. |
| **National Do Not Call Registry (NDNC / FTC DNC)** | HIGH — Customers initiating telemarketing calls must scrub against the FTC DNC Registry and honor company-specific DNC lists. | Customer | ❌ Gap | Callengo has no built-in DNC Registry scrubbing feature. ToS must explicitly require customers to scrub contact lists before uploading to Callengo. Callengo should consider adding an acknowledgment checkbox at campaign launch. |
| **CAN-SPAM Act** | MEDIUM — Applies to commercial email. Callengo sends transactional emails (team invitations, email verification, password reset) via Supabase Auth's built-in email infrastructure (powered by AWS SES). Resend is configured but not currently the active delivery path. | Fuentes Digital Ventures LLC | ✅ Compliant | Transactional emails are system-triggered (not commercial solicitations). No bulk commercial email campaigns are sent. CAN-SPAM requires sender identification and a mechanism to stop commercial messages — not applicable to pure transactional emails. Review annually. |
| **GDPR (General Data Protection Regulation)** | HIGH — Fuentes Digital Ventures LLC's sole member resides in the EU; the platform serves B2B customers including EU-based businesses; EU residents' personal data is processed. | Fuentes Digital Ventures LLC (Controller and Processor) | ⚠️ Partial | Privacy Policy, Cookie Policy, DPA, SCCs, and cookie consent banner are required. No cookie consent banner exists. No formal DPA template published. EU data subjects' rights procedures not documented in public-facing materials. Lawful basis analysis not yet published. Legal rep in EU not formally appointed (though the sole member resides in the EU). See Legal Position L. |
| **State Call Recording Consent Laws (Two-Party Consent)** | CRITICAL — Bland AI records all calls by default. At least 11 US states (CA, FL, IL, MD, MA, MI, MT, NH, OR, PA, WA) require all-party consent to record a call. Customer contacts in these states must consent before recording begins. | Customer (primary obligation); Callengo (disclosure and ToS pass-through) | ❌ Gap | No customer-facing disclosure about default recording. No in-app consent workflow for recording. ToS must impose recording consent obligations on customers. Platform must clearly disclose that all calls are recorded by default. See GAP-023. |
| **GDPR Article 28 — Data Processing Agreements** | HIGH — Required with all sub-processors who process personal data on Callengo's behalf. | Fuentes Digital Ventures LLC | ⚠️ Partial | DPAs confirmed: Bland AI (DPA reviewed March 2026; SCCs included; see GAP-005). DPA with OpenAI: OpenAI offers an enterprise DPA; not confirmed as executed. DPA with PostHog: available, status unknown. DPA with Google (Analytics): Google's ToS includes DPA terms; must accept and configure. Supabase and Vercel: standard contract terms. |
| **GDPR Article 46 — International Data Transfers** | HIGH — Callengo transfers EU personal data to US sub-processors (Supabase/AWS, Vercel, Bland AI, OpenAI, PostHog, Upstash, Resend). | Fuentes Digital Ventures LLC | ⚠️ Partial | Sub-processors enrolled in EU-US Data Privacy Framework (DPF) or covered by SCCs. Supabase, Google, Stripe, PostHog listed as DPF participants. Bland AI and Upstash DPF status not confirmed. SCCs should be verified or included in DPA with each sub-processor. |
| **CCPA / CPRA (California Consumer Privacy Act / Privacy Rights Act)** | MEDIUM — Applies if Callengo meets the threshold: processes personal information of 100,000+ California consumers or households per year, or derives 50%+ of revenue from selling personal information. Threshold may be met as platform scales. | Fuentes Digital Ventures LLC | ⚠️ Partial | Privacy Policy should include CCPA disclosures. "Do Not Sell or Share My Personal Information" link not required if thresholds not met, but GA4 advertising features should be disabled. Service provider agreements must include CCPA-compliant contract language. See Legal Position O. |
| **Wyoming Breach Notification Act (Wyo. Stat. § 40-12-501 et seq.)** | HIGH — Callengo is a Wyoming LLC and processes personal information. | Fuentes Digital Ventures LLC | ⚠️ Partial | Wyoming requires notification to affected residents within 45 days of discovery of a breach of security involving computerized data that includes personal information. Callengo must: (a) implement a written incident response plan; (b) include breach notification procedures in Privacy Policy; (c) maintain a log of security incidents. No public incident response policy confirmed. |
| **Google API Services User Data Policy** | HIGH — Callengo uses Google OAuth for Calendar integration and must comply with Google's Limited Use Policy. | Fuentes Digital Ventures LLC | ⚠️ Partial | Limited Use attestation must be included in Callengo's Privacy Policy. The Privacy Policy must state that Google user data is used only to provide the calendar feature. The application must be verified by Google if it uses sensitive/restricted scopes. Calendar scopes (`auth/calendar`) are classified as restricted and require security assessment. See Section 18. |
| **Google Consent Mode v2** | HIGH — Required for all EU users if using Google Analytics 4 with consent-based measurement. Effective March 2024. | Fuentes Digital Ventures LLC | ❌ Non-Compliant | No cookie consent management platform (CMP) implemented. No Consent Mode v2 signals being sent. GA4 may be operating in non-compliant mode for EU users. Must implement a CMP (e.g., Cookiebot, OneTrust, Consentmanager) and configure Consent Mode v2 tags before EU marketing begins or EU users are onboarded. This is a critical gap. |
| **PECR (Privacy and Electronic Communications Regulations — UK)** | MEDIUM — Applies to processing of personal data of UK residents in the context of electronic communications, including cookies and email marketing. | Fuentes Digital Ventures LLC | ❌ Gap | No cookie consent banner for UK users. No PECR-compliant cookie policy published. No "opt-in" mechanism for non-essential cookies. Required if Callengo serves UK-based customers. |
| **EU AI Act** | MEDIUM — Applies to AI systems placed on the EU market or affecting EU residents. Callengo deploys AI voice agents that interact with EU residents via phone. Automated AI voice calling may be classified as a "limited risk" AI system requiring transparency obligations. | Fuentes Digital Ventures LLC | ⚠️ Partial | Transparency requirement: persons interacting with AI systems must be informed they are interacting with AI, unless this is obvious from context. Callengo's calling agents should include a disclosure at the start of each call (e.g., "This is an automated call from [Company Name]'s AI assistant."). Must be verified in agent script templates. EU AI Act Article 52 transparency obligations apply. Higher-risk provisions (emotion recognition, biometric categorization) are not currently triggered by Callengo's use case. |
| **SOC 2 Type II** | LOW-MEDIUM — Not legally required, but increasingly demanded by enterprise B2B customers as a condition of vendor onboarding. | Fuentes Digital Ventures LLC | ❌ Not Achieved | No SOC 2 audit has been conducted. Not currently required for the current customer base but will be required as Callengo pursues enterprise accounts. Planning a SOC 2 Type II readiness assessment in 2026 is recommended. |
| **HIPAA (Health Insurance Portability and Accountability Act)** | LOW — Applies only if Callengo processes Protected Health Information (PHI) on behalf of a Covered Entity or Business Associate. | Not currently applicable | ➖ Not Applicable | Callengo is a general B2B calling platform and does not market itself for healthcare use cases. If healthcare customers onboard and use Callengo to call patients about appointments, HIPAA may be triggered. Terms of Service should prohibit use for PHI processing unless a Business Associate Agreement (BAA) is in place. Add ToS exclusion clause. |
| **COPPA (Children's Online Privacy Protection Act)** | LOW — Applies to online services directed at children under 13. | Not applicable | ➖ Not Applicable | Callengo is a B2B enterprise SaaS platform not directed at children. Terms of Service should include a minimum age requirement (18 years, or 16 for EU under GDPR Article 8). |
| **ePrivacy Directive (EU Cookie Law)** | HIGH — Requires prior consent for non-essential cookies. Applies to EU users. | Fuentes Digital Ventures LLC | ❌ Non-Compliant | No cookie banner or consent mechanism. GA4 and PostHog are loaded unconditionally. ePrivacy Directive requires opt-in consent for analytics cookies in most EU member states. Must implement CMP before serving EU users. |
| **FTC Act Section 5 (Unfair or Deceptive Acts or Practices)** | HIGH — Applies to all US businesses. Privacy policies, ToS, and marketing claims must not be deceptive. | Fuentes Digital Ventures LLC | ⚠️ Partial | Privacy Policy and ToS must be published and accurate. No deceptive claims about data practices are made in the product currently. Must ensure published legal policies match actual data practices as documented in this document. |
| **Spam Laws — Canada (CASL)** | MEDIUM — Applies if Callengo sends commercial electronic messages to Canadian recipients. | Customer (primary) | ⚠️ Partial | Customers using Callengo to call Canadian contacts must comply with CASL. ToS should note this obligation. Callengo's own outbound email (team invitations) is transactional and exempt from CASL. |
| **LOPD / LOPDGDD (Spain)** | MEDIUM — Spain's data protection law implementing GDPR. Relevant because the sole member resides in Spain. | Fuentes Digital Ventures LLC | ⚠️ Partial | The sole member's residence in Spain does not by itself create a Spanish "establishment" for GDPR purposes, but it is a relevant factor. If Callengo is found to have a Spanish establishment, AEPD (Spain's data protection authority) would be the lead supervisory authority. Standard GDPR compliance (see above) is the primary obligation. |

---

---

# SECTION 20 — SUB-PROCESSOR LIST

> **Purpose:** This section documents all third-party sub-processors who process personal data on behalf of Callengo as of March 25, 2026. A sub-processor is any entity other than Fuentes Digital Ventures LLC that processes personal data in connection with the Callengo service. Risk levels: 🟢 Low | 🟡 Medium | 🔴 High.

---

## 20.1 Infrastructure Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Supabase, Inc.** | Database and Authentication | Hosts the PostgreSQL database (56 tables) containing all Callengo platform data, including user accounts, company records, contact data, call logs, campaign data, and encrypted OAuth tokens. Also provides the authentication service (Supabase Auth) that manages user sessions, JWTs, and OAuth social login. | Account holder PII (name, email, company name), contact PII (name, phone, email), call transcripts, campaign data, encrypted OAuth tokens, billing metadata | AWS US-East-1 | [Supabase DPA](https://supabase.com/docs/guides/platform/gdpr) available; GDPR and SOC 2 Type II compliant | Yes (via AWS DPF) | 🔴 High — contains all platform data |
| **Vercel, Inc.** | Application Hosting and Serverless Functions | Hosts the Next.js application and executes all 142+ API serverless functions. All network traffic between users and the application transits through Vercel's infrastructure. | All data in transit; HTTP request payloads including PII in API calls; edge middleware cache (company_id, role — 5-min HTTPOnly cookie) | AWS/GCP (US and global edge) | [Vercel DPA](https://vercel.com/legal/dpa) available; SOC 2 Type II | Yes | 🟡 Medium — transient processing |
| **Upstash, Inc.** | Redis Cache | Provides managed Redis used for: (a) call slot concurrency tracking (UUIDs only); (b) rate limiting (IP addresses, user IDs); (c) session-level caching of company plan data. No contact PII is stored in Redis. | IP addresses (rate limiting), user UUIDs, company UUIDs, call slot UUIDs, Bland AI plan configuration | AWS US-East-1 | [Upstash Privacy Policy](https://upstash.com/privacy); no formal DPA template published — **gap to resolve** | Status unknown | 🟡 Medium — IP addresses are personal data |

---

## 20.2 Authentication and Security Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Google LLC** | OAuth Social Login (Sign in with Google) | Processes authentication requests when users choose "Sign in with Google." Google authenticates the user and returns an ID token with the user's email address and profile name to Callengo. Callengo does not receive or store Google account passwords. | Email address, display name, Google account ID (sub claim) | Google global infrastructure | [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum); Google API Services User Data Policy | Yes | 🟡 Medium |
| **GitHub, Inc. (Microsoft)** | OAuth Social Login (Sign in with GitHub) | Processes authentication requests when users choose "Sign in with GitHub." GitHub authenticates the user and returns an access token with the user's email address and username. | Email address, GitHub username, GitHub user ID | GitHub global infrastructure | [GitHub DPA](https://github.com/customer-terms) | Yes (via Microsoft DPF) | 🟡 Medium |
| **Google LLC** | reCAPTCHA v3 | Google reCAPTCHA v3 is loaded on the signup page to detect automated bot submissions. reCAPTCHA sends behavioral signals (mouse movements, typing patterns, IP address) to Google for fraud scoring. No visible challenge is presented. | IP address, browser fingerprint signals, behavioral data on signup page only | Google global infrastructure | Google Privacy Policy; no separate DPA for reCAPTCHA | Yes | 🟡 Medium — loaded only on signup |

---

## 20.3 Voice Calling Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Bland AI (Intelliga Corporation)** | AI Voice Calling | Executes all outbound AI voice calls on behalf of Callengo customers. Receives: destination phone number (E.164), call script/task description, voice configuration, webhook URL, and metadata (company_id, contact_id, campaign_id). Records all calls by default (`record: true`). Returns: call transcript, call duration, call status, recording URL, and analysis metadata. | Contact phone numbers, names (in call scripts), call transcripts (potentially containing sensitive personal information disclosed during calls), call audio recordings, company metadata | Bland AI US infrastructure | **DPA confirmed (March 2026):** Full DPA published at https://www.bland.ai/legal/data-processing-agreement (updated March 27, 2025). Provisions include: purpose limitation, no sale/sharing of Customer Personal Data, deidentified data carve-out, SCCs for EU/UK/Switzerland transfers, breach notification, deletion within 14 days on request, SOC 2 Type II audit rights. Sub-processor list at https://trust.delve.co/blandai. See GAP-005 for full DPA review. | Status unconfirmed (check https://www.dataprivacyframework.gov/) | 🟡 Medium — DPA confirmed; call audio and transcripts are high-sensitivity data; recording consent obligations pass through to customers |

---

## 20.4 AI Analysis Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **OpenAI, LLC** | Post-Call AI Analysis, Contact Analysis, Cali AI Assistant, Onboarding | Processes data across 8 feature areas using GPT-4o-mini and GPT-4o: (a) post-call intent analysis and lead scoring via `intent-analyzer.ts`; (b) real call deep analysis via `bland/analyze-call` (GPT-4o); (c) demo call analysis; (d) contact list quality and smart list suggestions; (e) agent configuration recommendations; (f) campaign context suggestions; (g) Cali AI in-app conversational assistant (GPT-4o-mini, up to 1,000 tokens/response); (h) company name/summary/industry detection during onboarding. **Data sharing confirmed DISABLED (March 25, 2026):** All three "Share inputs/outputs/feedback with OpenAI" settings are set to Disabled. OpenAI does NOT use Callengo API data for training. **API call logging:** Set to "Enabled per call" — prompts and completions are retained on OpenAI's servers for 30 days for the organization's own review. **2 separate API keys** now in use: `OPENAI_API_KEY` for all features (call analysis, contact analysis, onboarding, demo), and `OPENAI_API_KEY_CALI_AI` for Cali AI (rate limit isolation). | Call transcripts (contact names, call content, potentially sensitive disclosures), contact metadata, company summaries, user chat messages (Cali AI), onboarding company URLs | OpenAI US infrastructure | OpenAI API Terms confirm no training on API data. Prompts retained 30 days (API call logging enabled). No separate DPA execution required for standard API usage per OpenAI ToS. | Yes | 🟡 Medium — training opt-out confirmed; 30-day prompt retention on OpenAI servers is residual risk |

---

## 20.5 Payments Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Stripe, Inc.** | Payment Processing and Billing | Handles all credit card processing, subscription billing, invoicing, and the customer billing portal. Callengo never receives or stores raw card data. Stripe stores the Stripe Customer ID, payment method metadata (last 4 digits, card type, expiry), and subscription details. Callengo stores only the `stripe_customer_id` and `stripe_subscription_id` as foreign keys. | Cardholder name, billing email, billing address, payment method metadata, subscription history, invoice data | Stripe global (US primary) | [Stripe DPA](https://stripe.com/legal/dpa); PCI DSS Level 1; SOC 2 Type II | Yes | 🟡 Medium — card data isolated to Stripe |

---

## 20.6 Analytics Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Google LLC (Google Analytics 4)** | Behavioral Analytics | Receives 130+ custom events tracking user behavior throughout the application. Receives user properties including: user UUID (not email — email removed March 25, 2026), company_id, plan slug, user role. Receives page view data including URL paths. GA4 may use data for Google's own advertising and measurement purposes unless advertising features are disabled. | User UUID (not email), company ID, plan, user role, IP address (anonymized by default in GA4), page views, behavioral events, browser/device metadata | Google US data centers (with EU data residency option) | [Google Ads Data Processing Terms](https://privacy.google.com/businesses/processorterms/); must be accepted. | Yes | 🟡 Medium — email removed (March 2026); potential CCPA "sharing" risk remains if ad features enabled |
| **PostHog, Inc.** | Product Analytics and Session Recording | Receives 250+ custom events. Records user sessions with field masking on password/email/phone fields. Identifies users by email address (distinct_id). Autocapture is enabled. Tracks group analytics (company_id as group). | Email address (distinct_id), user display name, company_id, plan, user role, IP address, session recordings (with masked fields), feature flag assignments, behavioral events, browser metadata | US region (PostHog Cloud US) | [PostHog DPA](https://posthog.com/dpa) available; GDPR-compliant | Yes | 🔴 High — session recordings; email as distinct_id |

---

## 20.7 Email Sub-Processors

| Sub-Processor | Role | Service Description | Data Categories Processed | Infrastructure Region | DPA / Privacy Framework | DPF Enrolled | Risk Level |
|---------------|------|--------------------|--------------------------|-----------------------|------------------------|--------------|-----------|
| **Supabase, Inc.** | Transactional Email (Active) | Supabase Auth's built-in email service (powered by AWS SES via Supabase's infrastructure) sends all transactional emails: email verification, password reset, magic links, and team invitations (via `supabase.auth.admin.inviteUserByEmail()`). This is the active email delivery path. | Recipient email address, email content (invitation/verification links) | Supabase-managed AWS SES infrastructure (US) | [Supabase DPA](https://supabase.com/privacy) — email delivery covered as part of Auth service | Covered under Supabase | 🟢 Low |
| **Resend, Inc.** | Transactional Email (Configured — Not Currently Active) | `RESEND_API_KEY` is present in environment variables but Resend is not the active email delivery path. May be activated in future if custom transactional email templates are required outside Supabase Auth flows. | Would process: recipient email address, display name, company name, invitation metadata | US infrastructure | [Resend Privacy Policy](https://resend.com/legal/privacy-policy) | Status unknown | 🟡 Medium — activate only after confirming DPA coverage |

---

## 20.8 CRM and Calendar Integration Sub-Processors

> These sub-processors are activated only when a Callengo customer voluntarily connects the corresponding integration. They are conditional sub-processors — they do not process data unless the customer explicitly enables the integration.

| Sub-Processor | Integration | Data Categories Processed | Plans | DPA / Privacy Framework | Risk Level |
|---------------|-------------|--------------------------|-------|------------------------|-----------|
| **Google LLC** | Google Calendar | Calendar events (titles, times, attendees), Google account email, OAuth tokens (encrypted at rest) | All plans | Google Cloud DPA | 🟡 Medium |
| **Microsoft Corporation** | Microsoft Outlook Calendar | Calendar events, Microsoft account email, OAuth tokens (encrypted at rest) | Business+ | Microsoft DPA / EU Model Clauses | 🟡 Medium |
| **Microsoft Corporation** | Microsoft Dynamics 365 | CRM contacts, companies, deals, user information. OAuth tokens encrypted. | Teams+ | Microsoft DPA / EU Model Clauses | 🔴 High — broad `user_impersonation` scope |
| **HubSpot, Inc.** | HubSpot CRM | Contacts, companies, deals, owners, lists. OAuth tokens encrypted. | Business+ | [HubSpot DPA](https://legal.hubspot.com/dpa) | 🟡 Medium |
| **Salesforce, Inc.** | Salesforce CRM | Contacts, accounts, opportunities, and all objects permitted by the `full` scope. OAuth tokens encrypted. | Teams+ | [Salesforce DPA](https://www.salesforce.com/content/dam/web/en_us/www/documents/legal/salesforce_MSA.pdf) | 🔴 High — `full` scope is overly broad |
| **Pipedrive, Inc.** | Pipedrive CRM | Contacts, deals, organizations, activities. OAuth tokens encrypted. | Business+ | [Pipedrive DPA](https://www.pipedrive.com/en/privacy) | 🟡 Medium |
| **Zoho Corporation** | Zoho CRM | Contacts, leads, accounts, deals, users, settings, org data (all modules via `ZohoCRM.modules.ALL`). OAuth tokens encrypted. | Business+ | [Zoho DPA](https://www.zoho.com/privacy/gdpr.html) | 🔴 High — `org.ALL` and `notifications.ALL` scope is broad |
| **Clio (Themis Solutions Inc.)** | Clio Legal CRM | Legal contacts, matters, calendar entries. OAuth tokens encrypted. Potentially contains legally privileged information. | Business+ | [Clio Privacy Policy](https://www.clio.com/privacy-policy/) | 🔴 High — may contain legally privileged data |
| **SimplyBook.me, Ltd.** | SimplyBook Scheduling | Appointments, clients, service providers. API key / secret authentication (not OAuth). Credentials encrypted. | Free+ | [SimplyBook Privacy Policy](https://simplybook.me/en/privacy-policy) | 🟡 Medium |
| **Zoom Video Communications** | Zoom Meeting Links | Meeting links generated and associated with calendar events. OAuth tokens. | Free+ | [Zoom DPA](https://explore.zoom.us/en/gdpr/) | 🟡 Medium |
| **Slack Technologies, LLC** | Slack Notifications | Slack workspace metadata, OAuth tokens. Sends call completion notifications to Slack channels. | Free+ | [Slack DPA](https://slack.com/intl/en-gb/trust/data-management/privacy-principles) | 🟢 Low — notification content only |

---

---

# SECTION 21 — OPEN ITEMS AND LEGAL GAPS

> **Purpose:** This section documents known compliance gaps, unanswered questions, and items requiring legal review or remediation as of March 26, 2026 (updated from March 25, 2026). Each item includes the relevant file path(s) where applicable, risk level, and suggested remediation. Priority levels: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low.

---

## 21.1 Critical — Must Resolve Before EU/UK Users Are Onboarded

---

### GAP-001: No Cookie Consent Banner / CMP
**Description:** The application loads Google Analytics 4 and PostHog unconditionally on every page, without any cookie consent mechanism. Both tools set persistent cookies and collect behavioral data. Under the ePrivacy Directive (EU), PECR (UK), and the GDPR as interpreted by EU supervisory authorities, prior opt-in consent is required for non-essential analytics cookies. Google Consent Mode v2 (mandatory for GA4 in the EU since March 2024) is not implemented.

**Relevant Files:**
- `src/app/layout.tsx` — GA4 `<GoogleAnalytics>` loaded unconditionally
- `src/components/analytics/AnalyticsProvider.tsx` — GA4 and PostHog initialized without consent check
- `src/components/analytics/PostHogProvider.tsx` — PostHog initialized without consent check
- `src/lib/posthog.ts` — PostHog configuration

**Risk Level:** 🔴 Critical

**Remediation:**
1. Implement a cookie consent management platform (CMP) — options: Cookiebot, OneTrust, Consentmanager, or a lightweight GDPR-focused solution.
2. Gate GA4 and PostHog initialization on consent granted.
3. Implement Google Consent Mode v2 with `analytics_storage` and `ad_storage` signals.
4. Publish a Cookie Policy page listing all cookies set by the application, their purpose, duration, and whether they are first-party or third-party.
5. Add a cookie preference center that allows users to withdraw consent at any time.

---

### GAP-002: No Privacy Policy Published
**Description:** No public-facing Privacy Policy has been identified in the codebase. A Privacy Policy is legally required under GDPR (Article 13/14), CCPA, CAN-SPAM, and virtually all applicable regulations. It must be accessible before users provide personal data (i.e., before or during signup).

**Relevant Files:**
- No privacy policy page found in `src/app/` routes

**Risk Level:** 🔴 Critical

**Remediation:**
1. Draft and publish a Privacy Policy at `/privacy` or `/legal/privacy`.
2. Policy must cover: data controller identity, data categories collected, purposes and lawful bases, retention periods, sub-processors, international transfers, user rights, cookies, and contact information for privacy inquiries.
3. Link to the Privacy Policy from the signup page, login page, and footer.
4. This LEGAL.md document provides the technical source of truth for drafting the Privacy Policy.

---

### GAP-003: No Terms of Service Published
**Description:** No public-facing Terms of Service has been identified in the codebase. Terms of Service are contractually required to: establish the customer's obligations regarding TCPA, TSR, and DNC compliance; include the Data Processing Addendum (DPA) for GDPR; define Callengo's liability limitations; and establish the service provider relationship required for CCPA compliance.

**Relevant Files:**
- No terms of service page found in `src/app/` routes

**Risk Level:** 🔴 Critical

**Remediation:**
1. Draft and publish Terms of Service at `/terms` or `/legal/terms`.
2. Must include: TCPA/TSR customer obligation pass-through; DPA provisions (Article 28 GDPR); CCPA service provider contract terms; liability limitations; acceptable use policy; prohibited industries clause (healthcare PHI, children's services); dispute resolution.
3. Require customers to accept Terms at signup (checkbox or click-through) and record acceptance with timestamp.

---

### GAP-004: No Data Processing Addendum (DPA) Template
**Description:** Callengo processes personal data on behalf of its customers (their contact lists, CRM data, call results). Under GDPR Article 28, a written DPA is mandatory between Callengo (as data processor) and its business customers (as data controllers). No DPA template has been identified.

**Relevant Files:** N/A — document does not exist

**Risk Level:** 🔴 Critical

**Remediation:**
1. Draft a DPA that covers: subject matter and nature of processing; purpose and duration; data categories and data subjects; Callengo's obligations as processor (confidentiality, security, sub-processor management, audit rights, breach notification, deletion/return of data); list of sub-processors as an annex.
2. Include Standard Contractual Clauses (SCCs) as an annex for international transfers.
3. Either embed the DPA in the Terms of Service or publish it as a standalone document at `/legal/dpa`.
4. For enterprise customers who require their own DPA, establish a process for review and execution.

---

## 21.2 High Priority — Resolve Before Significant Scale

---

### GAP-005: Bland AI DPA — Reviewed and Documented

**Description:** Bland AI (Intelliga Corporation) processes call audio, transcripts, and contact phone numbers on behalf of Callengo as a data processor. As of March 27, 2025, Bland AI publishes a comprehensive Data Processing Addendum at `https://www.bland.ai/legal/data-processing-agreement`. The DPA is incorporated by reference into Bland AI's Enterprise Services Agreement and is accepted at the time of account creation and ToS acceptance.

**DPA Provisions Confirmed (reviewed March 25, 2026):**

The Bland AI DPA has been reviewed in full. The following key provisions are confirmed:

- **Purpose Limitation (Section 2.1):** Bland processes Customer Personal Data only for the specific purpose of performing the Services and as required by applicable laws. Bland will not retain, use, or disclose Customer Personal Data outside the direct business relationship. No selling or sharing (as defined by CCPA and analogous laws) of Customer Personal Data.
- **Deidentified Data (Section 2.7):** Bland may create and derive Deidentified Data to improve its products and services. Bland must take reasonable technical and organizational measures to ensure such data cannot be associated with a Data Subject or Customer. This is the sole training/improvement carve-out in the DPA — identifiable Customer Personal Data (including actual call recordings and transcripts) is not used for model training.
- **Service Data (Section 2.8):** Data about the *use* of the Services (billing, account management, analytics) is treated as Bland's own Controller data under Bland's Privacy Policy. This is distinct from Customer Personal Data (call audio, transcripts, contact PII).
- **Security Measures (Section 2.5):** Bland maintains appropriate technical and organizational security measures documented at `https://trust.delve.co/blandai`. Callengo has agreed these meet the requirements of Data Protection Law.
- **Deletion / Disposal (Section 2.6):** Upon end of Services, Bland will delete or return all Customer Personal Data upon written request submitted within 14 days of cessation date to `compliance@bland.ai`. Back-up archives are securely isolated.
- **Data Subject Rights (Section 3.1):** Customer is responsible for responding to Data Subject Requests. Bland provides commercially reasonable assistance on written request.
- **Breach Notification (Section 4.1):** Bland will notify Customer without undue delay after becoming aware of a Security Incident.
- **Sub-Processors (Section 6):** Sub-processor list published at `https://trust.delve.co/blandai`. 14-day advance notice of new sub-processors. Customer may object within 14 days.
- **International Data Transfers (Section 7):** EU/EEA transfers covered by EU SCCs (Module 2 or 3 as applicable). UK transfers covered by SCCs + UK IDTA (Version B1.0, 21 March 2022). Switzerland transfers covered by FADP-specific SCC modifications. Callengo is the "data exporter"; Bland is the "data importer."
- **Audit Rights (Section 5):** Bland provides SOC 2 Type II reports on request. Customer may conduct one documentary audit per 12-month period with 30 days' advance notice.

**Call Recording — Default Behavior:**
Bland records all calls by default. This is configured in `src/lib/bland/master-client.ts` line 215 (`record: payload.record ?? true`). Recordings are retained on Bland AI's servers and accessible via the recording URL returned in the webhook. Callengo's Supabase database stores only the recording URL (not the binary audio). Default Callengo-side recording retention is 30 days; customers with the **Recording Vault add-on** ($12/month) receive 12-month retention. Callengo's control over Bland-side recording storage is subject to Bland's own retention policies and the DPA deletion provisions.

**Open Items (post-review):**
1. Retain dated evidence that Bland AI's ToS and DPA were reviewed and accepted (screenshot, email confirmation, or dated internal note). This constitutes the GDPR Article 28 written agreement.
2. Confirm whether Bland AI is enrolled in the EU-US Data Privacy Framework (DPF) at `https://www.dataprivacyframework.gov/` — enrollment provides an additional adequacy mechanism for EU→US transfers alongside SCCs.
3. Record Bland AI as a confirmed sub-processor in the published sub-processor list with the DPA URL and effective date.
4. Disclose in the Privacy Policy that call audio and transcripts are processed by Bland AI, that Bland may create deidentified data for product improvement, and that recordings are retained for 30 days by default (12 months with Recording Vault add-on).

**Relevant Files:**
- `src/lib/bland/master-client.ts` — `record: true` default, all call dispatch
- `src/app/api/bland/send-call/route.ts` — per-call dispatch entry point
- `src/app/api/bland/webhook/route.ts` — receives recording URL, transcript, status

**Risk Level:** 🟡 Low-Medium (DPA confirmed, provisions reviewed; open item is formal acceptance evidence and DPF enrollment check)

---

### GAP-006: OpenAI Data Sharing Configuration

**Description:** This section documents the confirmed configuration of OpenAI's data sharing and logging settings as they apply to Callengo's API usage. These settings directly determine what data OpenAI retains and whether API input/output data is used for model training.

**Data Sharing Settings (verified March 25, 2026 — OpenAI Platform → Settings → Data Controls → Sharing):**
- "Enable sharing of model feedback from the Platform" → **Disabled**
- "Share evaluation and fine-tuning data with OpenAI" → **Disabled**
- "Share inputs and outputs with OpenAI" → **Disabled**

All three options are disabled. OpenAI does not use Callengo's API data (call transcripts, prompts, completions) to train its foundation models.

**API Call Logging (verified March 25, 2026):** The "API call logging" setting is **Enabled per call**. This means OpenAI stores the actual prompt and completion content of each API call for up to 30 days on OpenAI's servers, accessible to Callengo via the OpenAI Logs dashboard. This is logging for the operator's own review — it is not used for training. However, it means that call transcripts and contact data sent to OpenAI as prompts are retained on OpenAI's infrastructure for up to 30 days beyond the completion of each API call. This retention period must be disclosed in the Privacy Policy under the OpenAI sub-processor entry.

**OpenAI Audit Logging (verified March 25, 2026):** Audit logging is **Disabled**. Audit logging records configuration changes and administrative actions within the OpenAI organization console. Without it, there is no OpenAI-side compliance audit trail. This should be enabled before enterprise customer onboarding or any SOC 2 readiness effort. Note: once enabled, audit logging cannot be disabled without contacting OpenAI support.

**Full Inventory of OpenAI Usage in Callengo (codebase audit March 25, 2026):**

| Feature | File | Model | Data Sent |
|---------|------|-------|-----------|
| Post-call intent analysis | `src/lib/ai/intent-analyzer.ts` | GPT-4o-mini | Call transcript (up to 10,000 chars), contact name |
| Full call analysis | `src/app/api/bland/analyze-call/route.ts` | GPT-4o | Full call transcript, contact context |
| Demo call analysis | `src/app/api/openai/analyze-call/route.ts` | GPT-4o-mini | Demo transcript |
| Agent recommendation | `src/app/api/openai/recommend-agent/route.ts` | GPT-4o-mini | Business description |
| Campaign context suggestions | `src/app/api/openai/context-suggestions/route.ts` | GPT-4o-mini | Contact list metadata |
| Contact quality analysis | `src/app/api/contacts/ai-analyze/route.ts` | GPT-4o-mini | Contact field data |
| Cali AI assistant | `src/app/api/ai/chat/route.ts` | GPT-4o-mini | User chat messages, conversation history (last 20 msgs), company profile, usage stats, **full team member names + emails**, recent campaign names and statuses |
| Onboarding company detection | `src/lib/web-scraper.ts` | GPT-4o-mini | Company website content |

**API Key Architecture:** Callengo uses a two-key architecture: `OPENAI_API_KEY` (all features except Cali AI) and `OPENAI_API_KEY_CALI_AI` (Cali AI assistant only — isolated for independent rate limiting). All usage is tracked in the `openai_usage_logs` table and visible in the Admin Command Center → Finances → AI Infrastructure Costs section.

**Required Privacy Policy Disclosures:**
1. OpenAI is used for call analysis, contact analysis, AI assistant (Cali AI), and onboarding.
2. Prompts and completions are retained by OpenAI for up to 30 days for logging purposes (not training).
3. Callengo's API data is not used to train OpenAI models (all sharing options disabled).

**Risk Level:** 🟢 Low — training opt-out confirmed; logging retention disclosed

---

### GAP-007: Analytics PII — Email Replaced with UUID

**Description:** Account holder email addresses were previously sent to Google Analytics 4 (as the `user_email` user property) and to PostHog (as the `distinct_id`). Email address constitutes personal data under GDPR, CCPA, and virtually all privacy frameworks, and its presence in third-party analytics tools creates a data transfer disclosure obligation and increases the scope of any privacy request response.

**Resolution applied (March 25, 2026):** Email replaced with the Supabase user UUID (`user.id`) as the analytics identifier across all analytics providers. The following changes were made:
- `src/components/analytics/AnalyticsProvider.tsx` — `user_email` property removed; user identified by UUID only
- `src/components/analytics/PostHogProvider.tsx` — `distinct_id` changed from `user.email` to `user.id`
- `src/lib/analytics.ts` — `setUserProperties()` updated to remove email property
- Server-side PostHog and GA4 event files updated to remove email references

**Current state of PII in analytics:**

| Field | GA4 | PostHog | Notes |
|-------|-----|---------|-------|
| User UUID | Yes | Yes | Non-predictable identifier, GDPR-acceptable |
| Email address | **No** | **No** | Removed March 25, 2026 |
| First name | No | Yes | Lower-risk display label; consider removing for full anonymization |
| Company name | Yes | Yes | B2B context; company is the data controller, not a natural person |
| Plan / subscription info | Yes | Yes | No direct PII |

**Impact on analytics:** Full user-level analytics continuity is maintained. UUID uniquely identifies each user across sessions for funnel analysis, retention, and cohort tracking. The only operational change is that manual lookup of a specific user by email address in PostHog or GA4 is no longer possible — UUID-based lookup remains available. This is an acceptable trade-off for regulatory compliance.

**Remaining consideration:** The user's first name is still included as a PostHog property for display/segmentation purposes. First name alone is lower-risk than email in the analytics context, but if full pseudonymization is required (e.g., for enterprise customer contracts or future GDPR audit), it should also be removed.

**Relevant Files:**
- `src/components/analytics/AnalyticsProvider.tsx`
- `src/components/analytics/PostHogProvider.tsx`
- `src/lib/analytics.ts`

**Risk Level:** 🟢 Low — email removed; UUID-based identification is compliant

---

### GAP-008: TCPA / TSR Compliance Acknowledgment Not Present in Campaign Flow

**Description:** Callengo enables customers to place automated outbound voice calls to lists of phone numbers using AI-generated voices. Under the TCPA (47 U.S.C. § 227), the FCC's February 2024 declaratory ruling, and the FTC Telemarketing Sales Rule (16 C.F.R. Part 310), the business customer is the "caller" responsible for obtaining required prior express written consent from each called party. Callengo is the technology platform, not the caller. However, Callengo as a platform provider bears secondary exposure if it knowingly facilitates unlawful calling without requiring acknowledgment of customer obligations.

**Confirmed absence of in-app enforcement (codebase audit March 25, 2026):**
- `src/app/api/campaigns/dispatch/route.ts` — no TCPA consent field in dispatch payload
- `src/components/campaigns/CampaignsOverview.tsx` — no compliance acknowledgment checkbox
- `src/app/(app)/campaigns/[id]/page.tsx` — no TCPA disclosure or acknowledgment in campaign detail
- `src/app/api/bland/send-call/route.ts` — no TCPA consent gate before Bland AI dispatch
- No `tcpa_consent_confirmed`, `compliance_acknowledged`, or analogous field exists in the `campaigns` table schema

**Legal position and liability allocation:** Callengo's legal structure relies entirely on contractual pass-through of TCPA and TSR obligations to the customer through the Terms of Service (GAP-003). The Terms must explicitly require customers to: (a) obtain prior express written consent from all contacts before calling; (b) honor all federal and state Do-Not-Call registrations; (c) maintain consent records and produce them upon demand; (d) comply with permitted calling hours (8 AM–9 PM local time for consumer contacts); (e) include required caller ID disclosures. Without an in-app enforcement mechanism, Callengo relies exclusively on contractual self-certification. This is common practice among outbound calling platforms, but is legally insufficient on its own.

**Remediation:**
1. Add a mandatory TCPA/TSR compliance acknowledgment checkbox to the campaign creation/launch flow — displayed immediately before dispatch begins: *"I confirm that I have obtained prior express written consent (as required by the TCPA and applicable law) from all contacts in this campaign, that my contact list complies with federal and state Do-Not-Call requirements, and that my use of this platform complies with all applicable telemarketing laws. I accept full legal responsibility for the calling activity initiated through this campaign."* This checkbox creates a timestamped self-certification record per campaign.
2. Include TCPA/TSR compliance obligations in the Terms of Service (see GAP-003).
3. Consider adding a persistent in-app compliance help section explaining customer TCPA obligations, state recording consent laws, and DNC compliance requirements.
4. Consider implementing call-time window validation: block dispatches to US contacts outside 8 AM–9 PM in the contact's detected local time zone as a technical safe harbor measure.

**Relevant Files:**
- `src/app/api/campaigns/dispatch/route.ts` — dispatch entry point
- `src/components/campaigns/CampaignsOverview.tsx` — campaign list and launch UI
- `src/app/api/bland/send-call/route.ts` — individual call dispatch

**Risk Level:** 🟠 High — no in-app enforcement mechanism present; sole protection is ToS language (not yet drafted)

---

### GAP-009: No Incident Response / Breach Notification Policy
**Description:** Wyoming breach notification law (Wyo. Stat. § 40-12-501) requires notification to affected Wyoming residents within 45 days of discovering a breach of computerized data containing personal information. GDPR requires notification to the supervisory authority within 72 hours and to affected data subjects without undue delay. No written incident response plan or breach notification policy has been identified.

**Risk Level:** 🟠 High

**Remediation:**
1. Draft and document an internal Incident Response Plan covering: detection, containment, assessment, notification (users, regulators, Google if OAuth tokens affected), and post-incident review.
2. Include a breach notification section in the Privacy Policy.
3. Establish a security incident tracking log.
4. Consider cyber liability insurance coverage given the nature of data processed.

---

### GAP-010: Salesforce `full` Scope — Business Justification and Mitigation

**Description:** The Salesforce OAuth integration requests the `full` scope in addition to `api`, `refresh_token`, and `id`. The `full` scope grants Callengo programmatic access to all accessible Salesforce data and operations within the connected org. From a data minimization standpoint, this is broader than what a narrowly scoped CRM connector requires.

**Business justification for current scope configuration:**

The `full` scope is requested because Callengo's Salesforce integration operates as a comprehensive automation layer, not a simple read-only contact importer. The scope enables:

1. **Contact and Lead import:** SOQL queries on `Contact` and `Lead` objects, including `AccountId`, `Account.Name`, mailing address, phone, email, title, source, owner, and status fields.
2. **Account/Company data enrichment:** SOQL queries on `Account` objects to enrich contact company data.
3. **Event/Calendar sync:** SOQL queries on `Event` objects for appointment correlation between Salesforce calendar entries and Callengo call activity.
4. **User data:** SOQL queries on `User` objects to map `OwnerId` to human-readable owner names for contact context.
5. **Future bidirectional sync:** The architecture supports pushing call outcomes (call status, qualification result, AI analysis) back to Salesforce Contact/Lead records as notes or field updates — this write capability requires `full` rather than a read-only subset.

**Actual operations performed (confirmed by codebase audit — `src/lib/salesforce/sync.ts`):**
- `fetchSalesforceContacts()` — SOQL SELECT on Contact object
- `fetchSalesforceLeads()` — SOQL SELECT on Lead object
- `fetchSalesforceEvents()` — SOQL SELECT on Event object
- `fetchSalesforceUsers()` — SOQL SELECT on User object
- Writes: contact/lead records upserted into Callengo's own `contacts` table in Supabase (no destructive operations on the Salesforce org)
- No Salesforce record deletions, bulk updates, or mutations to Salesforce data are performed in the current implementation

**Mitigation measures in place:**
- Despite the `full` scope, actual API calls are strictly limited to SOQL SELECT queries on Contact, Lead, Account, Event, and User objects
- No Apex triggers, metadata API calls, org configuration changes, or bulk data operations are performed
- OAuth token is encrypted at rest (AES-256-GCM via `src/lib/encryption.ts`)

**Legal exposure assessment:** The `full` scope creates a representation gap — the actual data access footprint is narrow (read + limited write on 5 object types), but the authorized scope is unrestricted. For GDPR data minimization, the authorized scope is what matters, not just actual usage. For enterprise customers whose Salesforce org contains regulated or sensitive data (PHI if healthcare CRM, financial data, etc.), the `full` scope could present an audit risk.

**Remediation path:**
1. The current implementation works and is functional. The scope represents the ceiling of permissions requested, not what is actually used.
2. For enterprise or regulated-industry customers, consider documenting in the privacy terms that Salesforce integration requests `full` scope for CRM automation and clearly listing the object types actually accessed.
3. If Salesforce releases a scoped permission model that can cover the objects above without `full`, migrate. As of 2026, Salesforce's named-object scopes (`chatter_api`, `wave_api`, etc.) do not cover the standard CRM object set comprehensively via OAuth.
4. Include the actual object access list in the Privacy Policy's Salesforce integration disclosure.

**Relevant Files:**
- `src/lib/salesforce/auth.ts` — scope definition (lines 33–38)
- `src/lib/salesforce/sync.ts` — actual sync operations

**Risk Level:** 🟡 Medium — scope broader than strictly necessary; actual access limited; disclosure in Privacy Policy mitigates

---

### GAP-011: SimplyBook Uses Username/Password Rather Than OAuth
**Description:** SimplyBook.me integration uses a username/password token exchange authentication rather than OAuth 2.0. This means the customer's SimplyBook credentials (or an API key/secret pair) are provided to Callengo and stored in the database. This is a higher-risk pattern than OAuth because it grants persistent access without the customer-facing consent flow and is harder to revoke.

**Relevant Files:**
- `src/lib/simplybook/` — SimplyBook auth implementation

**Risk Level:** 🟡 Medium

**Remediation:**
1. Confirm that SimplyBook API key/secret is encrypted at rest using `encryptToken()` from `src/lib/encryption.ts`.
2. In the Privacy Policy, disclose that SimplyBook integration stores API credentials.
3. Clearly inform customers in the integration setup UI what credentials are being stored.
4. If SimplyBook supports OAuth in the future, migrate to OAuth.

---

## 21.3 Medium Priority — Resolve in Next 90 Days

---

### GAP-012: No Google Consent Mode v2
**Description:** Google Consent Mode v2 is required for all EU users using GA4. Without it, GA4 operates in non-consent mode and may not model data correctly, and Callengo may be in violation of Google's policies.

**Relevant Files:**
- `src/app/layout.tsx`
- `src/components/analytics/AnalyticsProvider.tsx`

**Risk Level:** 🟡 Medium (once CMP is implemented — see GAP-001)

**Remediation:** Implement alongside GAP-001 (CMP). Consent Mode v2 signals are typically managed by the CMP.

---

### GAP-013: Zoho Scopes — Business Justification and Minimization Assessment

**Description:** The Zoho CRM integration requests five scopes: `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`, `ZohoCRM.users.ALL`, `ZohoCRM.org.ALL`, and `ZohoCRM.notifications.ALL`. Of these, `org.ALL` and `notifications.ALL` are the broadest and warrant documentation of their business necessity.

**Justification per scope:**
- `ZohoCRM.modules.ALL` — Required. Callengo reads Contact, Lead, and Account modules and pushes call results back as notes. Module scope must cover all modules the customer uses.
- `ZohoCRM.settings.ALL` — Required. Needed to read field definitions and layout metadata for accurate field mapping during contact import.
- `ZohoCRM.users.ALL` — Required. Maps record `OwnerId` to user names for contact context display.
- `ZohoCRM.org.ALL` — Used to read org-level configuration and confirm API region/datacenter for correct endpoint selection. Could potentially be eliminated if Zoho's API behavior is consistent without it, but removing it may cause issues for some customer org configurations.
- `ZohoCRM.notifications.ALL` — Used to set up real-time webhook notifications from Zoho to Callengo when contact or lead records change. This enables automatic re-sync when CRM data is updated outside Callengo. Without this scope, sync would be limited to scheduled/manual triggers only.

**Operations confirmed in codebase (`src/lib/zoho/sync.ts`):** Contact fetch, Lead fetch, User fetch, bidirectional sync (inbound to Callengo + outbound call results back to Zoho via `pushCallResultToZoho()` and `pushContactUpdatesToZoho()`). No destructive operations on the Zoho org.

**Remediation assessment:** `org.ALL` is a candidate for removal if Zoho's API works without it in practice. `notifications.ALL` is functionally justified by the real-time sync architecture. The Privacy Policy should disclose that Zoho integration accesses organization settings and notification data in addition to contact/lead records.

**Relevant Files:**
- `src/lib/zoho/auth.ts` lines 37–43
- `src/lib/zoho/sync.ts` — sync operations

**Risk Level:** 🟡 Low-Medium — scopes documented with justification; `org.ALL` warrants testing for removal

---

### GAP-014: Microsoft Dynamics `user_impersonation` Scope — Justification

**Description:** The Microsoft Dynamics 365 integration requests `user_impersonation` scope dynamically via `{instanceUrl}/user_impersonation` in addition to `openid`, `profile`, `email`, `offline_access`, and `User.Read`. The `user_impersonation` scope is the standard scope required to call the Dynamics 365 Web API on behalf of a signed-in user. It is not an elevated administrative permission — it grants Callengo the ability to call the Dynamics REST API with the same permissions as the authenticated user account.

**Why `user_impersonation` is necessary:** Microsoft Dynamics 365's API access model requires `user_impersonation` for all third-party applications that access Dynamics data on behalf of a user via OAuth. There is no narrower scope that provides access to Dynamics CRM entities (Contact, Lead, Account, SystemUser) without `user_impersonation`. This is a Microsoft platform design constraint, not a Callengo design choice.

**Operations confirmed in codebase (`src/lib/dynamics/sync.ts`):** Contact fetch, Lead fetch, SystemUser fetch, bidirectional sync (inbound contact import + outbound call result push via `pushCallResultToDynamics()` and `pushContactUpdatesToDynamics()`). No destructive operations on the Dynamics org.

**Mitigating factors:** The connected user's Dynamics role controls the actual data access scope. If the customer connects Callengo using a Dynamics user with limited role permissions (e.g., read-only on Contact/Lead entities only), the `user_impersonation` scope operates within those role limits. Callengo recommends customers create a dedicated integration user with minimum required Dynamics security roles.

**Privacy Policy disclosure required:** Disclose that Microsoft Dynamics 365 integration accesses Contact, Lead, Account, and User entities under the permissions of the connected Dynamics user account.

**Relevant Files:**
- `src/lib/dynamics/auth.ts` — scope construction (lines 40–46)
- `src/lib/dynamics/sync.ts` — actual data operations

**Risk Level:** 🟡 Low — `user_impersonation` is the only available Dynamics API access mechanism; actual scope limited by user role in Dynamics

---

### GAP-015: Phone Numbers Stored in Plaintext
**Description:** Contact phone numbers are stored in plaintext (E.164 format) in the `contacts` table. Phone numbers are personal data under GDPR and may be considered "sensitive" in certain contexts. While plaintext storage is required for Bland AI call dispatch (the number must be readable), it represents a risk if the database were compromised.

**Relevant Files:**
- `supabase/` — contacts table schema (phone column type TEXT)
- `src/app/api/bland/send-call/route.ts` — reads phone number and sends to Bland AI

**Risk Level:** 🟡 Medium

**Remediation:**
1. Document the business justification for plaintext storage (required for call dispatch) in the Privacy Policy.
2. Ensure the RLS policy on the `contacts` table strictly limits access to the owning company.
3. Consider application-level encryption of phone numbers with decryption only at call dispatch time. This would require changes to search/filter functionality.
4. At minimum, implement database-level audit logging on the `contacts` table for access by service role.

---

### GAP-016: No Minimum Age Requirement Enforced at Signup
**Description:** The signup form does not enforce or verify a minimum age. GDPR Article 8 sets the age of digital consent at 16 (or lower if member states opt down to 13). COPPA applies to services directed at under-13s in the US. While Callengo is a B2B platform (implicitly adults only), a ToS clause and signup declaration are still recommended.

**Relevant Files:**
- `src/app/auth/signup/page.tsx`

**Risk Level:** 🟡 Medium

**Remediation:**
1. Add a minimum age declaration to the signup flow ("I confirm I am 18 years of age or older").
2. Include an age restriction clause in the Terms of Service.

---

### GAP-017: Agent Call Scripts Contain PII Placeholder Templates
**Description:** The core agent configuration templates in the database migration file contain PII placeholder strings such as `{{contact_name}}`, `{{contact_phone}}`, `{{company_name}}` in agent prompt templates. These are variable substitutions, not actual PII, but confirm that the agent prompt system processes personal data at call dispatch time.

**Relevant Files:**
- `supabase/migrations/20260123000001_configure_core_agents.sql` — agent template scripts with PII placeholders

**Risk Level:** 🟡 Medium

**Remediation:** This is not a remediation gap per se (placeholder substitution is expected functionality), but: (a) document in the Privacy Policy that agent scripts process contact name and company in the call prompt; (b) ensure the full resolved prompt (with substituted PII) is not logged to persistent storage unnecessarily; (c) confirm that resolved prompts sent to Bland AI are covered by the Bland AI DPA (GAP-005).

---

## 21.4 Low Priority — Track and Address in Future Releases

---

### GAP-018: Rate Limiting Defined But Not Applied Globally
**Description:** A rate limiting utility (`src/lib/rate-limit.ts`) exists in the codebase but is not applied globally across API endpoints. Critical endpoints (billing, authentication, call dispatch) are potentially vulnerable to automated abuse.

**Relevant Files:**
- `src/lib/rate-limit.ts`
- `src/app/api/billing/` — billing endpoints
- `src/app/api/bland/send-call/route.ts` — call dispatch endpoint

**Risk Level:** 🟢 Low (security gap rather than privacy gap; documented in Known Bugs)

**Remediation:** Apply `rate-limit.ts` to all public-facing API endpoints. Prioritize: auth endpoints, call dispatch, billing webhook, and contact import.

---

### GAP-019: Free Plan Expiration Logic Incomplete
**Description:** The Free plan is described as providing a one-time allocation of approximately 10 calls (15 minutes). The logic to enforce blocking after the free allocation is exhausted may not be fully implemented, potentially allowing continued free usage.

**Risk Level:** 🟢 Low (business risk, not privacy/legal risk)

**Remediation:** Complete the free plan expiration logic in the billing and call dispatch flow. This is a billing integrity issue, not a direct legal compliance gap, but may create implied contractual obligations if customers rely on continued free access.

---

### GAP-020: Static Exchange Rates for EUR/GBP
**Description:** EUR and GBP conversion rates are hardcoded in the application rather than fetched dynamically. This is relevant for pricing transparency under EU consumer protection law if Callengo presents prices in EUR to EU customers.

**Risk Level:** 🟢 Low

**Remediation:** If EU pricing is displayed in EUR, either (a) use dynamic exchange rates from a financial data API, or (b) fix prices in EUR directly as a billing currency supported by Stripe.

---

### GAP-021: Admin Audit Log Not Exposed in Privacy Requests
**Description:** The `admin_audit_log` table records administrative actions. When processing data subject access requests (DSARs) under GDPR Article 15, Callengo should consider whether the audit log records referencing a data subject's user ID constitute personal data that must be provided in the DSAR response.

**Relevant Files:**
- `supabase/migrations/20260321000002_admin_platform_config.sql` — `admin_audit_log` table definition

**Risk Level:** 🟢 Low

**Remediation:** Define a DSAR process that includes the audit log. Confirm whether audit log records are in scope for GDPR Article 15 responses. Legal counsel should advise on this point.

---

### GAP-022: No Published Sub-Processor Change Notification Process
**Description:** Under GDPR Article 28(2), when a processor engages a new sub-processor, the controller must be given an opportunity to object. Callengo's DPA (when drafted) should include a mechanism for notifying customers of sub-processor changes (e.g., email notification with a 30-day window to object).

**Risk Level:** 🟢 Low

**Remediation:** Include a sub-processor change notification clause in the DPA. Maintain a publicly accessible sub-processor list page (e.g., at `/legal/sub-processors`) that Callengo updates when sub-processors change.

---

### GAP-023: Call Recording Consent — State Two-Party Consent Laws Not Addressed in Customer Obligations

**Description:** Bland AI records all calls by default (`record: true` in `src/lib/bland/master-client.ts`). This means every call made through Callengo produces an audio recording of a conversation involving a third party (the contact being called). Under United States law, call recording consent requirements vary by state. The federal standard (one-party consent under 18 U.S.C. § 2511) permits recording if one party to the call consents. However, a significant number of states require **all parties** to a call to consent to recording (two-party or "all-party" consent states).

**States with all-party (two-party) call recording consent requirements as of 2026:**

| State | Law | Key Requirement |
|-------|-----|----------------|
| California | CA Penal Code § 632 | All parties must consent; civil and criminal penalties apply; $5,000 per violation civil penalty |
| Florida | FL Stat. § 934.03 | All parties must consent; both civil and criminal liability |
| Illinois | Illinois Eavesdropping Act (720 ILCS 5/14-2) | All parties must consent; criminal penalties apply |
| Maryland | MD Code, Courts § 10-402 | All parties must consent |
| Massachusetts | MA Gen. Laws ch. 272, § 99 | All parties must consent; criminal penalties |
| Michigan | MI Comp. Laws § 750.539c | All parties must consent |
| Montana | MT Code § 45-8-213 | All parties must consent |
| New Hampshire | NH Rev. Stat. § 570-A:2 | All parties must consent |
| Oregon | OR Rev. Stat. § 165.540 | All parties must consent |
| Pennsylvania | PA Cons. Stat. § 5704 | All parties must consent; one of the strictest in the US |
| Washington | RCW 9.73.030 | All parties must consent; civil penalty of $100/day or $1,000 per violation |

Note: Connecticut, Hawaii, and Nevada have nuanced requirements that may impose two-party consent in some circumstances. Laws change — this list should be reviewed annually or upon any significant change to calling territories.

**Business context and recording rationale:** Callengo records all calls by default because recording data is essential for: (a) post-call AI analysis of conversation quality, intent, and outcomes; (b) quality assurance and agent tuning; (c) dispute resolution if a contact later disputes the content of a call; (d) customer review of call performance through the Callengo dashboard. Extended recording access (beyond 30 days) requires the Recording Vault add-on ($12/month). Recording is a core functional component of the platform.

**Callengo's legal position:** Callengo is the technology platform — the business customer initiates and controls the call. Under this structure, the obligation to obtain two-party consent (in states that require it) falls on the **business customer**, not Callengo. Callengo's Terms of Service must explicitly impose this obligation on the customer and disclaim Callengo's liability for any customer failure to obtain required consents.

**Required Terms of Service language (to be included in ToS — GAP-003):**

The Terms of Service must include, at minimum, the following pass-through obligations for customers:

> *"You are solely responsible for ensuring that all calls made using the Service comply with applicable federal and state call recording consent laws. In states that require all-party consent to call recording (including, without limitation, California, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, New Hampshire, Oregon, Pennsylvania, and Washington), you must obtain the affirmative consent of the called party before recording the call. Callengo records all calls by default as part of its standard Service functionality. If you do not wish to record calls, you must contact Callengo to disable recording for your account. Callengo assumes no liability for any failure by you to obtain required recording consents, and you agree to indemnify and hold harmless Callengo from any claims, penalties, or damages arising from your failure to comply with applicable recording consent laws."*

**Recommended in-app disclosures:** When a customer creates a campaign or launches a call to contacts in a two-party consent state, the UI should display a notice: *"Calls to contacts in California, Florida, Illinois, Pennsylvania, Washington, and other two-party consent states may require advance consent from the called party for recording. Ensure you have the required consent before launching this campaign."*

**Implementation option — Consent disclosure in call script:** Customers targeting contacts in two-party consent states can include an AI-spoken disclosure at the beginning of the call (e.g., *"This call may be recorded for quality assurance purposes"*) as part of their agent script. This constitutes notice (though not necessarily affirmative consent) and can reduce legal exposure in many jurisdictions. The Terms should encourage this practice.

**Relevant Files:**
- `src/lib/bland/master-client.ts` — `record: payload.record ?? true` (line 215) — default recording enabled
- `src/app/(app)/campaigns/` — campaign creation UI (no recording consent workflow)
- `src/config/plan-features.ts` — `recordingVault` add-on definition

**Risk Level:** 🔴 Critical — Callengo's platform automatically records all calls including calls to contacts in all-party consent states; no customer-facing disclosure or consent workflow exists; entire liability exposure currently falls on customers by operation of the platform without explicit contractual notice; Terms of Service required before public launch

---

### GAP-024: PII Logged to Vercel Runtime Logs in Team Invite Route

**Description:** In `src/app/api/team/invite/route.ts` (line 208), the following `console.log` statement is present:
```typescript
console.log(`User ${email} already exists in auth, invitation saved in DB for manual acceptance`);
```
This statement logs the invitee's email address to Vercel's runtime log infrastructure whenever an invitation is sent to a user whose email address already exists in Supabase Auth. In Vercel deployments, `console.log` output is captured in Vercel's Observability product (formerly "Runtime Logs") and is retained for up to 72 hours (or longer on Enterprise plans). This means the email address of an invited user may appear in Vercel's log storage.

**Privacy implication:** Email addresses are personal data under GDPR and CCPA. Logging personal data to a third-party infrastructure provider (Vercel / Vercel Inc.) without explicit documentation of this transfer in the sub-processor list constitutes an undisclosed processing activity. Vercel is already used as the deployment platform (and should be listed as a sub-processor for general infrastructure processing), but the specific disclosure that email addresses may appear in runtime logs is not documented.

**Relevant File:** `src/app/api/team/invite/route.ts` — line 208

**Risk Level:** 🟡 Medium

**Remediation:**
1. Remove or redact the email from the console.log: `console.log('User already exists in auth, invitation saved in DB for manual acceptance');`
2. Alternatively, log only the user UUID: `console.log(`User ${userId} already exists in auth...`);`
3. Ensure Vercel is listed as a sub-processor in the DPA and sub-processor list (GAP-022) with appropriate documentation that infrastructure logs may contain incidental PII.
4. Review all other `console.log` and `console.error` statements in API routes for PII leakage. The `console.error` in the same file and others may also include error objects that contain email addresses in stack traces or error messages.

---

### GAP-025: No Data Protection Impact Assessment (DPIA) Conducted

**Description:** GDPR Article 35 requires a Data Protection Impact Assessment (DPIA) prior to commencing processing operations that are likely to result in a high risk to the rights and freedoms of natural persons. A DPIA is specifically mandated when processing involves systematic automated evaluation of personal aspects (profiling) at scale.

Callengo's core operations — autonomously calling individuals using AI voice agents, recording those conversations, and applying automated AI classification of intent, sentiment, interest level, and data validity — constitute systematic automated evaluation of personal aspects within the meaning of GDPR Article 35(3)(a). The involvement of special categories of data (conversations may touch on health, financial, or legal matters depending on the customer's industry) and the potential for adverse decisions based on AI classifications (e.g., contact marked as "cold" or "DNC") further increase the risk profile.

**No DPIA has been conducted.** This must be addressed before the platform is made available to EU/EEA-based customers or processes personal data of EU residents at meaningful scale.

**The DPIA must assess:**
1. A systematic description of the envisaged processing operations and their purposes
2. An assessment of the necessity and proportionality of the processing in relation to the purposes
3. An assessment of the risks to the rights and freedoms of data subjects (the individuals who are called)
4. The measures envisaged to address those risks, including safeguards, security measures, and mechanisms to ensure protection of personal data

**Where high risks cannot be mitigated,** GDPR Article 36 requires prior consultation with the supervisory authority (AEPD in Spain) before processing begins.

**Relevant Processing Activities:**
- Automated outbound voice calls to individuals using AI agents
- AI classification of call intent, sentiment, interest, and data accuracy (OpenAI)
- Recording and transcription of private telephone conversations
- Storage of AI-generated assessments of individuals in contact records
- Transmission of contact PII and conversation data to Bland AI and OpenAI sub-processors

**Risk Level:** 🟠 High — Required before EU market entry; failure to conduct a DPIA when required is itself a GDPR violation (Art. 83(4), up to €10 million or 2% of global annual turnover)

**Remediation:**
1. Engage legal counsel with GDPR expertise to conduct a formal DPIA.
2. Document the DPIA findings and maintain them as internal compliance records.
3. If the DPIA identifies high residual risks, consult with AEPD before proceeding.
4. Review the DPIA annually or whenever there is a significant change to processing activities.

---

