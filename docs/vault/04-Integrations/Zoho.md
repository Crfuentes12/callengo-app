---
tags: [integration, crm, oauth]
aliases: [Zoho CRM, Zoho Integration]
---

# Zoho

Zoho CRM is a CRM integration available on **Business+** plans (Business, Teams, Enterprise). It connects via OAuth 2.0 and supports syncing both Contacts and Leads. Zoho's API uses a region-specific domain (`https://www.zohoapis.com` by default) and provides detailed organization info alongside user data.

## Plan Gating

`isPlanAllowedForIntegration(planSlug, 'zoho')` returns `true` for `['business', 'teams', 'enterprise']`. Feature access via `getZohoFeatureAccess(planSlug)` gates: `canConnectZoho`, `canSyncContacts`, `canSyncLeads`, `canViewOrgMembers`, `canInviteFromZoho`.

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| Authorization URL | Zoho OAuth authorize endpoint |
| Token URL | Zoho OAuth token endpoint |
| Redirect URI | `{APP_URL}/api/integrations/zoho/callback` |
| Grant type | `authorization_code` |
| Env vars | `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` |

### Token Response

Zoho's token response includes an `api_domain` field indicating the region-specific API domain. The `zoho_domain` column in the integration table defaults to `'https://www.zohoapis.com'` but is set from the token response to match the user's data center region.

### Flow Steps

1. `getZohoAuthUrl(state)` generates the OAuth consent URL.
2. User authenticates on Zoho and grants consent.
3. Zoho redirects to `/api/integrations/zoho/callback` with an authorization code.
4. `exchangeZohoCode(code)` exchanges the code for tokens.
5. `getZohoUserInfo()` fetches user details: `id`, `first_name`, `last_name`, `full_name`, `email`, `status`, `role`, `profile`.
6. `getZohoOrgInfo()` fetches organization details: `id`, `company_name`, `alias`, `primary_email`, `domain_name`, `time_zone`, `currency`, `country_code`.
7. Tokens are encrypted and stored.

## Database Schema

### zoho_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `token_expires_at` | timestamptz | NULL | When the access token expires |
| `zoho_user_id` | text | NOT NULL | Zoho CRM user ID |
| `zoho_user_name` | text | NULL | Zoho user's full name |
| `zoho_user_email` | text | NULL | Zoho user's email |
| `zoho_org_name` | text | NULL | Zoho organization/company name |
| `zoho_org_id` | text | NULL | Zoho organization ID |
| `zoho_domain` | text | NOT NULL | Zoho API domain. Default: `'https://www.zohoapis.com'`. Set per-region from token response |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes |
| `raw_profile` | jsonb | NULL | Full raw profile response |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

### zoho_contact_mappings

Maps [[Contact|Callengo contacts]] to Zoho CRM objects (Contacts or Leads).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `zoho_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `zoho_contact_id` | text | NOT NULL | Zoho Contact or Lead ID |
| `zoho_object_type` | text | NOT NULL | `'Contacts'` or `'Leads'`. Default: `'Contacts'`. Note the plural form matching Zoho's API module naming |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- UNIQUE constraint on `(integration_id, zoho_contact_id)` -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### zoho_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `zoho_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'contacts'`, `'leads'` |
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

### Inbound Sync

Zoho's API uses page-based pagination with `per_page`, `page`, and `more_records` fields. The sync functions handle this:

- `fetchZohoContacts()` and `fetchZohoContactsByIds()` -- fetch Contact module records
- `fetchZohoLeads()` and `fetchZohoLeadsByIds()` -- fetch Lead module records
- `fetchZohoUsers()` -- fetch Zoho CRM users for org member display

`syncZohoContactsToCallengo()` and `syncZohoLeadsToCallengo()` create or update Callengo contacts. Zoho uses Pascal_Snake_Case field names (e.g., `First_Name`, `Last_Name`, `Mailing_City`) and nested objects for related records (e.g., `Account_Name: { name, id }`, `Owner: { name, id, email }`).

### Outbound Sync

- `pushCallResultToZoho()` -- pushes call outcome data to Zoho
- `pushContactUpdatesToZoho()` -- updates Contact or Lead fields with extracted data

### Exported Functions

From `src/lib/zoho/auth.ts`: `getZohoConfig`, `getZohoAuthUrl`, `exchangeZohoCode`, `getZohoUserInfo`, `getZohoOrgInfo`, `refreshZohoToken`, `getZohoClient`.

From `src/lib/zoho/sync.ts`: `fetchZohoContacts`, `fetchZohoContactsByIds`, `fetchZohoLeads`, `fetchZohoLeadsByIds`, `fetchZohoUsers`, `syncZohoContactsToCallengo`, `syncZohoLeadsToCallengo`, `syncSelectedZohoContacts`, `syncSelectedZohoLeads`, `pushCallResultToZoho`, `pushContactUpdatesToZoho`, `getActiveZohoIntegration`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/zoho/auth.ts` | OAuth flow, token management, API client |
| `src/lib/zoho/sync.ts` | Inbound/outbound sync for Contacts and Leads |
| `src/lib/zoho/index.ts` | Re-exports |
| `src/types/zoho.ts` | TypeScript types (240 lines) |
| `src/app/api/integrations/zoho/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Call Processing Flow]] -- how call results are pushed to Zoho
- [[HubSpot]] -- similar Business+ CRM integration
- [[Pipedrive]] -- similar Business+ CRM integration
- [[Plan Features]] -- feature gating configuration
