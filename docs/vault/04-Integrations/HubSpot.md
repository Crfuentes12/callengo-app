---
tags: [integration, crm, oauth]
aliases: [HubSpot CRM, HubSpot Integration]
---

# HubSpot

HubSpot is a CRM integration available on **Business+** plans (Business, Teams, Enterprise). It connects via OAuth 2.0 and provides bi-directional sync of contacts, companies, deals, and owners between HubSpot and [[Callengo]]. After AI agent calls complete, call results (transcripts, analysis, outcomes) are pushed back to HubSpot as notes or timeline events.

## Plan Gating

The function `isPlanAllowedForIntegration(planSlug, 'hubspot')` in [[Plan Features|plan-features.ts]] returns `true` only for plans in `['business', 'teams', 'enterprise']`. Feature access is controlled by `getHubSpotFeatureAccess(planSlug)` in `src/types/hubspot.ts`, which gates: `canConnectHubSpot`, `canSyncContacts`, `canSyncCompanies`, `canSyncDeals`, `canViewOrgMembers`, `canInviteFromHubSpot`.

On plan downgrade, the [[Stripe Integration|Stripe webhook handler]] calls `deactivateIneligibleIntegrations()` which sets `is_active = false` on all `hubspot_integrations` rows for the affected company.

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| Authorization URL | `https://app.hubspot.com/oauth/authorize` |
| Token URL | `https://api.hubapi.com/oauth/v1/token` |
| Token Info URL | `https://api.hubapi.com/oauth/v1/access-tokens` |
| Redirect URI | `{APP_URL}/api/integrations/hubspot/callback` |
| Grant type | `authorization_code` |
| Env vars | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |

### Requested Scopes

```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.deals.read
crm.objects.owners.read
crm.lists.read
oauth
```

### Flow Steps

1. User clicks "Connect HubSpot" in the [[Integrations Page|IntegrationsPage]] component.
2. Frontend calls the connect API which generates the OAuth URL via `getHubSpotAuthUrl(state)`. The `state` parameter contains the company ID and user ID for security validation.
3. User is redirected to HubSpot's consent screen.
4. HubSpot redirects back to `/api/integrations/hubspot/callback` with an authorization code.
5. `exchangeHubSpotCode(code)` exchanges the code for tokens (access_token, refresh_token, expires_in, token_type).
6. `getHubSpotTokenInfo()` fetches user/account info from the token info endpoint, returning hub_id, hub_domain, user_id, email, and scopes.
7. Tokens are encrypted via `encryptToken()` from `src/lib/encryption.ts` (AES-256-GCM) before storage.
8. A row is inserted/updated in `hubspot_integrations`.

### Token Refresh

`refreshHubSpotToken(integration)` uses the stored refresh_token to obtain a new access_token. The refresh_token itself is also updated if HubSpot returns a new one. Tokens are re-encrypted before storage. Token refresh is triggered automatically when `getHubSpotClient(integration)` detects the token has expired (based on `expires_at`).

## Database Schema

### hubspot_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `expires_at` | timestamptz | NOT NULL | When the access token expires |
| `hub_id` | text | NOT NULL | HubSpot portal/hub ID |
| `hub_domain` | text | NULL | HubSpot portal domain (e.g., "mycompany.hubspot.com") |
| `hs_user_id` | text | NOT NULL | HubSpot user ID |
| `hs_user_email` | text | NOT NULL | Email of the HubSpot user who authorized |
| `hs_display_name` | text | NULL | Display name in HubSpot |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is currently active |
| `scopes` | text[] | NULL | Granted OAuth scopes array |
| `raw_profile` | jsonb | NULL | Full raw profile response from HubSpot |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- Primary key on `id`
- UNIQUE constraint on `(company_id, user_id)` -- one integration per user per company
- Index on `company_id` for RLS queries
- Index on `is_active` for filtering active integrations

### hubspot_contact_mappings

Maps [[Contact|Callengo contacts]] to HubSpot CRM objects. This is the bi-directional mapping table that enables sync in both directions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `hubspot_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `hs_contact_id` | text | NULL | HubSpot Contact ID |
| `hs_object_type` | text | NOT NULL | HubSpot object type: `'Contact'`, `'Company'`, or `'Deal'`. Default: `'Contact'` |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | Direction: `'inbound'`, `'outbound'`, or `'bidirectional'`. Default: `'inbound'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- Primary key on `id`
- UNIQUE constraint on `(integration_id, hs_contact_id)` per object type -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### hubspot_sync_logs

Standard sync log schema tracking every sync operation for audit and debugging.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `hubspot_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'contacts'`, `'companies'`, `'deals'`, `'users'` |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `records_created` | integer | NOT NULL | Number of new records created |
| `records_updated` | integer | NOT NULL | Number of existing records updated |
| `records_skipped` | integer | NOT NULL | Number of records skipped (no changes) |
| `errors` | jsonb | NOT NULL | Array of error details |
| `started_at` | timestamptz | NOT NULL | When the sync started |
| `completed_at` | timestamptz | NULL | When the sync finished |
| `status` | text | NOT NULL | `'running'`, `'completed'`, `'completed_with_errors'`, `'failed'` |
| `error_message` | text | NULL | Summary error message |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |

## Sync Mechanism

### Inbound Sync (HubSpot to Callengo)

The `syncHubSpotContactsToCallengo()` function fetches contacts from HubSpot's CRM v3 API (`/crm/v3/objects/contacts`) and creates or updates corresponding rows in the `contacts` table. It uses pagination via the `after` cursor and requests these properties:

```
firstname, lastname, email, phone, mobilephone, jobtitle, company,
lifecyclestage, hs_lead_status, address, city, state, zip, country,
hubspot_owner_id, notes_last_updated, createdate, lastmodifieddate
```

For selective sync, `syncSelectedHubSpotContacts()` allows importing specific contacts by ID.

### Outbound Sync (Callengo to HubSpot)

After a call completes, `pushCallResultToHubSpot()` creates a note on the HubSpot contact with the call outcome, transcript summary, and analysis results. `pushContactUpdatesToHubSpot()` pushes field changes (phone, email, address updates from the Data Validation agent) back to the HubSpot contact record.

### Exported Functions

From `src/lib/hubspot/auth.ts`: `getHubSpotConfig`, `getHubSpotAuthUrl`, `exchangeHubSpotCode`, `getHubSpotTokenInfo`, `refreshHubSpotToken`, `getHubSpotClient`.

From `src/lib/hubspot/sync.ts`: `fetchHubSpotContacts`, `fetchHubSpotCompanies`, `fetchHubSpotOwners`, `fetchHubSpotContactsByIds`, `syncHubSpotContactsToCallengo`, `syncSelectedHubSpotContacts`, `createHubSpotNote`, `pushCallResultToHubSpot`, `pushContactUpdatesToHubSpot`, `getActiveHubSpotIntegration`.

## API Endpoints

All endpoints under `/api/integrations/hubspot/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/connect` | GET | Generate OAuth URL and redirect |
| `/callback` | GET | Handle OAuth callback, exchange code |
| `/disconnect` | POST | Deactivate integration |
| `/status` | GET | Check connection status |
| `/contacts` | GET | Fetch contacts from HubSpot |
| `/import` | POST | Import selected contacts to Callengo |
| `/export` | POST | Push contact updates to HubSpot |
| `/sync` | POST | Trigger full or incremental sync |

## Token Security

All OAuth tokens (access_token and refresh_token) are encrypted at rest using AES-256-GCM via `encryptToken()` from `src/lib/encryption.ts`. The `decryptToken()` function is backward-compatible with plaintext values, allowing a graceful migration from the pre-encryption era. Encryption requires the `TOKEN_ENCRYPTION_KEY` environment variable (64 hex characters = 32 bytes).

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/hubspot/auth.ts` | OAuth flow, token management, API client |
| `src/lib/hubspot/sync.ts` | Inbound/outbound sync operations |
| `src/lib/hubspot/index.ts` | Re-exports from auth and sync |
| `src/types/hubspot.ts` | TypeScript types (DB rows, API shapes, feature gating) |
| `src/app/api/integrations/hubspot/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared patterns across all CRM integrations
- [[Contact]] -- the Callengo contact model that syncs with HubSpot
- [[Call Processing Flow]] -- how call results are pushed to HubSpot
- [[Stripe Integration]] -- integration deactivation on plan downgrade
- [[Plan Features]] -- feature gating by plan tier
