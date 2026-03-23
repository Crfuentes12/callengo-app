---
tags: [api, integrations, crm, oauth, hubspot, salesforce, pipedrive, zoho, dynamics, clio, simplybook, google-sheets, slack, webhooks, encryption]
created: 2026-03-23
updated: 2026-03-23
---

# Integrations API

The Integrations API is the largest API group in Callengo, comprising over 60 endpoints that handle OAuth flows, contact synchronization, and data exchange with 7 CRM providers, 2 calendar providers, Google Sheets, Slack, Zoom, and outbound webhooks. Every CRM integration follows a standardized endpoint pattern, making the system extensible. All OAuth tokens are encrypted at rest using AES-256-GCM via the `encryptToken()` / `decryptToken()` functions from `src/lib/encryption.ts`.

The frontend for all integrations is managed by the `IntegrationsPage` component (`src/components/integrations/IntegrationsPage.tsx`, approximately 2,300 lines).

---

## Integration Plan Gating

Not all integrations are available on every plan. Access is governed by the [[Pricing Model]] and enforced at the API level:

| Integration | Minimum Plan | Plan Slug Check |
|-------------|-------------|-----------------|
| [[Google Calendar]] | Free | `free+` |
| Google Meet | Free | `free+` |
| [[Zoom]] | Free | `free+` |
| [[Slack]] | Free | `free+` |
| [[SimplyBook]] | Free | `free+` |
| Webhooks (Zapier/Make/n8n) | Free | `free+` |
| Google Sheets | Free | `free+` |
| [[Microsoft Outlook]] | Business | `business+` |
| Microsoft Teams | Business | `business+` |
| [[HubSpot]] | Business | `business+` |
| [[Pipedrive]] | Business | `business+` |
| [[Zoho]] | Business | `business+` |
| [[Clio]] | Business | `business+` |
| [[Salesforce]] | Teams | `teams+` |
| [[Dynamics 365]] | Teams | `teams+` |

Plan gating is checked via `isPlanAllowedForIntegration()` from `src/config/plan-features.ts`. On plan downgrade, the Stripe webhook handler calls `deactivateIneligibleIntegrations()` to automatically deactivate CRM integrations that the new plan does not support.

---

## Per-CRM Endpoint Pattern

Each of the 7 CRM providers follows a standardized set of 5-6 endpoints. The table below shows the pattern, with `{crm}` replaced by the provider slug.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/{crm}/callback` | OAuth callback -- exchange authorization code for tokens |
| POST | `/api/integrations/{crm}/connect` | Initiate OAuth flow -- generate authorization URL |
| POST | `/api/integrations/{crm}/disconnect` | Deactivate integration -- mark as inactive, clear tokens |
| GET | `/api/integrations/{crm}/contacts` | List contacts from the CRM (paginated) |
| POST | `/api/integrations/{crm}/sync` | Trigger bidirectional contact sync |
| GET | `/api/integrations/{crm}/users` | List CRM users (for assignment mapping) |

### CRM Provider Details

| CRM | Slug | Auth Type | Library | DB Table | Notes |
|-----|------|-----------|---------|----------|-------|
| [[HubSpot]] | `hubspot` | OAuth 2.0 | `src/lib/hubspot/` | `hubspot_integrations` | Also receives call results via webhook push |
| [[Salesforce]] | `salesforce` | OAuth 2.0 | `src/lib/salesforce/` | `salesforce_integrations` | Also receives call results via webhook push |
| [[Pipedrive]] | `pipedrive` | OAuth 2.0 | `src/lib/pipedrive/` | `pipedrive_integrations` | Also receives call results via webhook push |
| [[Zoho]] | `zoho` | OAuth 2.0 | `src/lib/zoho/` | `zoho_integrations` | |
| [[Dynamics 365]] | `dynamics` | OAuth 2.0 (Azure AD) | `src/lib/dynamics/` | `dynamics_integrations` | Azure AD tenant required |
| [[Clio]] | `clio` | OAuth 2.0 | `src/lib/clio/` | `clio_integrations` | Legal CRM; also receives call results |
| [[SimplyBook]] | `simplybook` | API Key + Secret | `src/lib/simplybook/` | -- | No OAuth; uses direct API credentials |

---

## OAuth Flow (Standard Pattern)

All OAuth-based CRM integrations follow the same flow:

### Step 1: Connect (POST /api/integrations/{crm}/connect)

The frontend calls this endpoint to initiate the OAuth flow. The endpoint generates an authorization URL with a signed state parameter.

**Authentication:** Required.

**Request body:**

```json
{
  "return_to": "/integrations"
}
```

**Behavior:**
1. Validates user authentication and company membership
2. Checks plan eligibility via `isPlanAllowedForIntegration()`
3. Generates a signed state parameter containing `user_id`, `company_id`, and `return_to` using HMAC-SHA256 (via `createSignedState()` from `src/lib/oauth-state.ts`)
4. Constructs the OAuth authorization URL with required scopes
5. Returns the URL for the frontend to redirect to

**Response:**

```json
{
  "url": "https://app.hubspot.com/oauth/authorize?client_id=xxx&scope=crm.objects.contacts.read..."
}
```

### Step 2: OAuth Provider Grants Permission

The user is redirected to the CRM provider's consent page. After granting permission, the provider redirects back to the callback URL.

### Step 3: Callback (GET /api/integrations/{crm}/callback)

The callback endpoint exchanges the authorization code for tokens and stores them encrypted.

**Authentication:** Verified via signed state parameter (not session-based, since this is a redirect).

**Query parameters (from provider):**
- `code` -- Authorization code
- `state` -- Signed state parameter (HMAC-SHA256 verified)
- `error` -- Error code if the user denied permission

**Behavior:**
1. Verifies the signed state parameter via `verifySignedState()` (HMAC-SHA256)
2. Verifies the authenticated user matches the `user_id` in the state (prevents CSRF -- audit fix ALTA-005)
3. Verifies the user's current `company_id` matches the state's `company_id` (prevents cross-company attacks)
4. Sanitizes `return_to` to prevent open redirects (must start with `/`, must not start with `//`)
5. Exchanges the authorization code for access and refresh tokens
6. Encrypts tokens with AES-256-GCM via `encryptToken()` before storage
7. Stores integration record in the provider's table (e.g., `hubspot_integrations`) with `is_active: true`
8. Optionally fetches token info (e.g., HubSpot hub ID, account name) for display
9. Redirects to the `return_to` URL with a success parameter

**Example callback URL:**
```
/api/integrations/hubspot/callback?code=xxx&state=eyJhbGciOi...
```

**Redirect on success:**
```
/integrations?hubspot_connected=true
```

**Redirect on error:**
```
/integrations?error=hubspot_auth_denied
```

### Step 4: Disconnect (POST /api/integrations/{crm}/disconnect)

Deactivates the integration by marking it as inactive in the database.

**Authentication:** Required.

**Behavior:**
1. Sets `is_active: false` in the integration table
2. Clears sync tokens and last sync timestamps
3. Does NOT delete the record (preserves sync history for audit)

---

## CRM-Specific Endpoints

### HubSpot Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/hubspot/connect` | Initiate HubSpot OAuth |
| GET | `/api/integrations/hubspot/callback` | HubSpot OAuth callback |
| POST | `/api/integrations/hubspot/disconnect` | Deactivate HubSpot |
| GET | `/api/integrations/hubspot/contacts` | List HubSpot contacts |
| POST | `/api/integrations/hubspot/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/hubspot/users` | List HubSpot users |

**OAuth scopes:** `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.read`, `crm.objects.deals.write`

**Call result push:** When a call completes, `pushCallResultToHubSpot()` creates a note on the HubSpot contact with call details, duration, transcript summary, and outcome.

**Library:** `src/lib/hubspot/`

---

### Salesforce Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/salesforce/connect` | Initiate Salesforce OAuth |
| GET | `/api/integrations/salesforce/callback` | Salesforce OAuth callback |
| POST | `/api/integrations/salesforce/disconnect` | Deactivate Salesforce |
| GET | `/api/integrations/salesforce/contacts` | List Salesforce contacts/leads |
| POST | `/api/integrations/salesforce/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/salesforce/users` | List Salesforce users |

**Plan requirement:** Teams or higher.

**Call result push:** `pushCallResultToSalesforce()` creates a Task record in Salesforce linked to the Contact/Lead.

**Library:** `src/lib/salesforce/`

---

### Pipedrive Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/pipedrive/connect` | Initiate Pipedrive OAuth |
| GET | `/api/integrations/pipedrive/callback` | Pipedrive OAuth callback |
| POST | `/api/integrations/pipedrive/disconnect` | Deactivate Pipedrive |
| GET | `/api/integrations/pipedrive/contacts` | List Pipedrive persons |
| POST | `/api/integrations/pipedrive/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/pipedrive/users` | List Pipedrive users |

**Call result push:** `pushCallResultToPipedrive()` creates an Activity in Pipedrive linked to the Person record.

**Library:** `src/lib/pipedrive/`

---

### Zoho CRM Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/zoho/connect` | Initiate Zoho OAuth |
| GET | `/api/integrations/zoho/callback` | Zoho OAuth callback |
| POST | `/api/integrations/zoho/disconnect` | Deactivate Zoho |
| GET | `/api/integrations/zoho/contacts` | List Zoho contacts |
| POST | `/api/integrations/zoho/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/zoho/users` | List Zoho users |

**Library:** `src/lib/zoho/`

---

### Microsoft Dynamics 365 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/dynamics/connect` | Initiate Dynamics OAuth (Azure AD) |
| GET | `/api/integrations/dynamics/callback` | Dynamics OAuth callback |
| POST | `/api/integrations/dynamics/disconnect` | Deactivate Dynamics |
| GET | `/api/integrations/dynamics/contacts` | List Dynamics contacts |
| POST | `/api/integrations/dynamics/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/dynamics/users` | List Dynamics users |

**Auth provider:** Azure AD (requires tenant configuration).

**Plan requirement:** Teams or higher.

**Library:** `src/lib/dynamics/`

---

### Clio Endpoints (Legal CRM)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/clio/connect` | Initiate Clio OAuth |
| GET | `/api/integrations/clio/callback` | Clio OAuth callback |
| POST | `/api/integrations/clio/disconnect` | Deactivate Clio |
| GET | `/api/integrations/clio/contacts` | List Clio contacts |
| POST | `/api/integrations/clio/sync` | Sync contacts bidirectionally |
| GET | `/api/integrations/clio/users` | List Clio users/matters |

**Call result push:** `pushCallResultToClio()` creates a communication entry in Clio linked to the contact/matter.

**Library:** `src/lib/clio/`

---

### SimplyBook.me Endpoints

SimplyBook uses API key + secret authentication instead of OAuth. It integrates with SimplyBook's booking system.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/simplybook/connect` | Save API credentials |
| POST | `/api/integrations/simplybook/disconnect` | Deactivate integration |
| GET | `/api/integrations/simplybook/clients` | List SimplyBook clients |
| GET | `/api/integrations/simplybook/bookings` | List SimplyBook bookings |
| GET | `/api/integrations/simplybook/providers` | List service providers |
| POST | `/api/integrations/simplybook/sync` | Sync clients/bookings |
| POST | `/api/integrations/simplybook/webhook` | Receive SimplyBook webhook events |

**Library:** `src/lib/simplybook/`

---

## Calendar Provider Endpoints

### Google Calendar

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/google-calendar/connect` | Initiate Google OAuth for Calendar |
| GET | `/api/integrations/google-calendar/callback` | Google OAuth callback |
| POST | `/api/integrations/google-calendar/disconnect` | Deactivate Google Calendar |
| POST | `/api/integrations/google-calendar/sync` | Sync calendar events |

**Library:** `src/lib/calendar/google.ts`

### Microsoft Outlook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/microsoft-outlook/connect` | Initiate Microsoft OAuth for Outlook |
| GET | `/api/integrations/microsoft-outlook/callback` | Microsoft OAuth callback |
| POST | `/api/integrations/microsoft-outlook/disconnect` | Deactivate Outlook |
| POST | `/api/integrations/microsoft-outlook/sync` | Sync calendar events |

**Library:** `src/lib/calendar/outlook.ts`

### Zoom

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/zoom/connect` | Initiate Zoom OAuth |
| GET | `/api/integrations/zoom/callback` | Zoom OAuth callback |
| POST | `/api/integrations/zoom/disconnect` | Deactivate Zoom |

---

## Google Sheets Endpoints

Google Sheets provides a contact import pipeline from spreadsheets, distinct from the CRM sync pattern.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/google-sheets/connect` | Initiate Google OAuth for Sheets |
| GET | `/api/integrations/google-sheets/callback` | Google OAuth callback |
| POST | `/api/integrations/google-sheets/disconnect` | Deactivate Google Sheets |
| GET | `/api/integrations/google-sheets/spreadsheets` | List user's spreadsheets |
| POST | `/api/integrations/google-sheets/link` | Link a specific sheet to contacts |
| GET | `/api/integrations/google-sheets/sheet-data` | Preview sheet data (headers + sample rows) |
| POST | `/api/integrations/google-sheets/sync` | Sync contacts from linked sheet |

**Note:** Google Sheets is import-only. There is no outbound push of call results to Google Sheets.

---

## Slack Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/slack/connect` | Initiate Slack OAuth |
| GET | `/api/integrations/slack/callback` | Slack OAuth callback |
| POST | `/api/integrations/slack/disconnect` | Deactivate Slack |
| GET | `/api/integrations/slack/channels` | List Slack channels |
| POST | `/api/integrations/slack/webhook` | Configure Slack notification webhook |

**Purpose:** Slack integration sends notifications about call completions, campaign progress, and important events to configured Slack channels.

---

## Outbound Webhook Endpoints

Outbound webhooks allow companies to send call results and events to external services (Zapier, Make, n8n, custom endpoints).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks/endpoints` | List configured webhook endpoints |
| POST | `/api/webhooks/endpoints` | Create a webhook endpoint |
| GET | `/api/webhooks/endpoints/[id]` | Get webhook endpoint details |
| PUT | `/api/webhooks/endpoints/[id]` | Update webhook endpoint |
| DELETE | `/api/webhooks/endpoints/[id]` | Delete webhook endpoint |

**Webhook payload** (dispatched by `dispatchWebhookEvent()` from `src/lib/webhooks.ts` after call completion):

```json
{
  "event": "call.completed",
  "timestamp": "2026-03-23T15:31:33Z",
  "data": {
    "call_id": "bland-call-uuid",
    "contact_id": "uuid",
    "contact_name": "John Smith",
    "phone_number": "+14155551234",
    "status": "completed",
    "duration": 93,
    "transcript": "...",
    "analysis": {
      "sentiment": "positive",
      "category": "successful",
      "followUpRequired": false
    }
  }
}
```

---

## Integration Status Endpoint

### GET /api/integrations/status

Returns the connection status of all integrations for the current company. Used by the IntegrationsPage to display which integrations are connected.

**Authentication:** Required.

**Response:**

```json
{
  "hubspot": { "connected": true, "lastSync": "2026-03-23T10:00:00Z" },
  "salesforce": { "connected": false },
  "pipedrive": { "connected": true, "lastSync": "2026-03-22T15:00:00Z" },
  "zoho": { "connected": false },
  "dynamics": { "connected": false },
  "clio": { "connected": false },
  "simplybook": { "connected": false },
  "google_calendar": { "connected": true },
  "microsoft_outlook": { "connected": false },
  "zoom": { "connected": true },
  "slack": { "connected": false },
  "google_sheets": { "connected": true, "linkedSheet": "Contact List Q1" }
}
```

**Source file:** `src/app/api/integrations/status/route.ts`

---

## Integration Feedback Endpoint

### POST /api/integrations/feedback

Collects user feedback about integration experience. Stored in the `integration_feedback` table.

**Authentication:** Required.

**Source file:** `src/app/api/integrations/feedback/route.ts`

---

## OAuth Token Security

All OAuth tokens (access tokens and refresh tokens) are encrypted before being stored in the database. This applies to all 11 OAuth-based providers (7 CRMs + Google Calendar + Outlook + Zoom + Slack + Google Sheets).

**Encryption:** AES-256-GCM via `encryptToken()` from `src/lib/encryption.ts`.

**Decryption:** `decryptToken()` is called whenever tokens are needed for API calls. It is backward-compatible with plaintext tokens (for migration from pre-encryption era).

**Key:** Requires `TOKEN_ENCRYPTION_KEY` environment variable (64 hex characters = 256-bit key).

**Encrypted format:** `{iv}:{authTag}:{ciphertext}` (base64-encoded components).

---

## OAuth State Security

The `state` parameter in OAuth flows is signed with HMAC-SHA256 to prevent CSRF attacks. The state contains `user_id`, `company_id`, and `return_to`, serialized as JSON and signed with `OAUTH_STATE_SECRET`.

**Verification:** On callback, `verifySignedState()` validates the HMAC signature, then:
1. Checks that the currently authenticated user matches `user_id` (audit fix ALTA-005)
2. Checks that the user's current company matches `company_id`
3. Sanitizes `return_to` to prevent open redirects

**Library:** `src/lib/oauth-state.ts`

---

## Database Tables (Per CRM)

Each CRM has 3 associated tables:

| Table Pattern | Description |
|--------------|-------------|
| `{crm}_integrations` | Connection record: `company_id`, `access_token` (encrypted), `refresh_token` (encrypted), `is_active`, `token_expires_at`, `hub_id`/`instance_url`/etc. |
| `{crm}_sync_logs` | Sync history: `company_id`, `direction`, `contacts_synced`, `errors`, `started_at`, `completed_at` |
| `{crm}_contact_mappings` | Maps Callengo contact IDs to CRM contact IDs for bidirectional sync |

---

## Source Files

- Integration routes: `src/app/api/integrations/`
- Webhook endpoints: `src/app/api/webhooks/endpoints/`
- Integration status: `src/app/api/integrations/status/route.ts`
- CRM libraries: `src/lib/hubspot/`, `src/lib/salesforce/`, `src/lib/pipedrive/`, `src/lib/zoho/`, `src/lib/dynamics/`, `src/lib/clio/`, `src/lib/simplybook/`
- Encryption: `src/lib/encryption.ts`
- OAuth state: `src/lib/oauth-state.ts`
- Plan features: `src/config/plan-features.ts`
- Webhook dispatcher: `src/lib/webhooks.ts`
- UI component: `src/components/integrations/IntegrationsPage.tsx` (~2,300 lines)

## Related Notes

- [[API Overview]]
- [[Contact]]
- [[HubSpot]]
- [[Salesforce]]
- [[Pipedrive]]
- [[Zoho]]
- [[Dynamics 365]]
- [[Clio]]
- [[SimplyBook]]
- [[Google Sheets]]
- [[Google Calendar]]
- [[Microsoft Outlook]]
- [[Webhook]]
- [[Security & Encryption]]
- [[Pricing Model]]
