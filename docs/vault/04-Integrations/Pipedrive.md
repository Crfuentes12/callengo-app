---
tags: [integration, crm, oauth]
aliases: [Pipedrive CRM, Pipedrive Integration]
---

# Pipedrive

Pipedrive is a CRM integration available on **Business+** plans (Business, Teams, Enterprise). It connects via OAuth 2.0 and syncs Persons (contacts), Organizations, Deals, and Activities between Pipedrive and [[Callengo]]. Pipedrive uses the concept of "Persons" rather than "Contacts," and its API returns nested objects for related entities (org_id, owner_id) rather than flat foreign keys.

## Plan Gating

`isPlanAllowedForIntegration(planSlug, 'pipedrive')` returns `true` for `['business', 'teams', 'enterprise']`. Feature access via `getPipedriveFeatureAccess(planSlug)` gates: `canConnectPipedrive`, `canSyncPersons`, `canSyncOrganizations`, `canSyncDeals`, `canSyncActivities`, `canViewOrgMembers`, `canInviteFromPipedrive`, `canPushCallResults`, `canPushContactUpdates`.

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| Authorization URL | Pipedrive OAuth authorize endpoint |
| Token URL | Pipedrive OAuth token endpoint |
| Redirect URI | `{APP_URL}/api/integrations/pipedrive/callback` |
| Grant type | `authorization_code` |
| Env vars | `PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET` |

### Token Response

Pipedrive's token response includes an `api_domain` field that specifies the API base URL for this particular Pipedrive account (e.g., `https://api.pipedrive.com`). This domain must be used for all subsequent API calls and is stored in the `api_domain` column of the integration table.

### Flow Steps

1. `getPipedriveAuthUrl(state)` generates the OAuth consent URL.
2. User authenticates and grants consent on Pipedrive.
3. Pipedrive redirects to `/api/integrations/pipedrive/callback` with an authorization code.
4. `exchangePipedriveCode(code)` exchanges the code. Response includes `access_token`, `refresh_token`, `expires_in`, `token_type`, `scope`, and `api_domain`.
5. `getPipedriveUserInfo()` fetches user and company details.
6. Tokens are encrypted via `encryptToken()` and stored.

### Token Refresh

`refreshPipedriveToken(integration)` refreshes the access token when expired. Pipedrive tokens have a relatively short lifespan, so refresh is triggered frequently via `getPipedriveClient()`.

## Database Schema

### pipedrive_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `expires_at` | timestamptz | NOT NULL | When the access token expires |
| `pd_company_id` | text | NOT NULL | Pipedrive company/account ID |
| `pd_company_name` | text | NULL | Pipedrive company name |
| `pd_company_domain` | text | NULL | Pipedrive company domain (subdomain) |
| `pd_user_id` | text | NOT NULL | Pipedrive user ID of the authorizer |
| `pd_user_email` | text | NOT NULL | Email of the Pipedrive user |
| `pd_user_name` | text | NULL | Display name in Pipedrive |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes |
| `raw_profile` | jsonb | NULL | Full raw profile response |
| `api_domain` | text | NULL | Pipedrive API domain for this account (e.g., `https://api.pipedrive.com`) |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

### pipedrive_contact_mappings

Maps [[Contact|Callengo contacts]] to Pipedrive Person objects.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `pipedrive_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `pd_person_id` | text | NULL | Pipedrive Person ID |
| `pd_object_type` | text | NOT NULL | Object type: `'Person'` or `'Organization'`. Default: `'Person'` |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- UNIQUE constraint on `(integration_id, pd_person_id)` -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### pipedrive_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `pipedrive_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'persons'`, `'organizations'`, `'deals'`, `'activities'`, `'users'` |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `records_created` | integer | NOT NULL | New records created |
| `records_updated` | integer | NOT NULL | Records updated |
| `records_skipped` | integer | NOT NULL | Records skipped |
| `errors` | jsonb | NOT NULL | Array of error details |
| `started_at` | timestamptz | NOT NULL | Sync start time |
| `completed_at` | timestamptz | NULL | Sync completion time |
| `status` | text | NOT NULL | `'running'`, `'completed'`, `'completed_with_errors'`, `'failed'` |
| `error_message` | text | NULL | Summary error message |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |

## Sync Mechanism

### Inbound Sync (Pipedrive to Callengo)

Pipedrive's REST API v1 uses offset-based pagination (`start`, `limit`, `more_items_in_collection`). The sync functions handle this automatically:

- `fetchPipedrivePersons()` -- fetches all Person objects
- `fetchPipedriveOrganizations()` -- fetches Organization objects
- `fetchPipedriveDeals()` -- fetches Deal objects
- `fetchPipedriveActivities()` -- fetches Activity objects
- `fetchPipedriveUsers()` -- fetches Pipedrive users (for org member display)

`syncPipedrivePersonsToCallengo()` creates or updates Callengo contacts from Pipedrive Persons. Pipedrive's contact data model uses arrays for email and phone fields (each with `value`, `primary`, `label` attributes), which are flattened to the primary values during sync.

### Outbound Sync (Callengo to Pipedrive)

- `pushContactToPipedrive()` -- creates or updates a Person in Pipedrive
- `pushCallResultToPipedrive()` -- creates an Activity in Pipedrive with call outcome details
- `pushContactUpdatesToPipedrive()` -- updates Person fields with data extracted by the Data Validation agent
- `createPipedriveActivity()` -- creates a custom activity (call log, follow-up, no-show)
- `createPipedriveNote()` -- creates a note attached to a Person, Organization, or Deal

### Exported Functions

From `src/lib/pipedrive/auth.ts`: `getPipedriveConfig`, `getPipedriveAuthUrl`, `exchangePipedriveCode`, `getPipedriveUserInfo`, `refreshPipedriveToken`, `getPipedriveClient`.

From `src/lib/pipedrive/sync.ts`: `fetchPipedrivePersons`, `fetchPipedriveOrganizations`, `fetchPipedriveDeals`, `fetchPipedriveActivities`, `fetchPipedriveUsers`, `fetchPipedrivePersonsByIds`, `syncPipedrivePersonsToCallengo`, `syncSelectedPipedrivePersons`, `pushContactToPipedrive`, `pushCallResultToPipedrive`, `pushContactUpdatesToPipedrive`, `createPipedriveActivity`, `createPipedriveNote`, `getActivePipedriveIntegration`, `hasScope`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/pipedrive/auth.ts` | OAuth flow, token management, API client |
| `src/lib/pipedrive/sync.ts` | Inbound/outbound sync for Persons, Activities, Notes |
| `src/lib/pipedrive/index.ts` | Re-exports |
| `src/types/pipedrive.ts` | TypeScript types (341 lines) |
| `src/app/api/integrations/pipedrive/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Call Processing Flow]] -- how call results are pushed to Pipedrive
- [[HubSpot]] -- similar Business+ CRM integration
- [[Zoho]] -- similar Business+ CRM integration
- [[Plan Features]] -- feature gating configuration
