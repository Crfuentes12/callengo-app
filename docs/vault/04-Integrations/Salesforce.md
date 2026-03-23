---
tags: [integration, crm, oauth]
aliases: [Salesforce CRM, Salesforce Integration, SFDC]
---

# Salesforce

Salesforce is a CRM integration available on **Teams+** plans (Teams and Enterprise). It connects via OAuth 2.0 and supports syncing both **Contact** and **Lead** objects, making it the only CRM integration with dual-object support. After AI agent calls complete, call results are pushed back to Salesforce as Task records.

## Plan Gating

`isPlanAllowedForIntegration(planSlug, 'salesforce')` returns `true` only for `['teams', 'enterprise']`. Feature access is controlled by `getSalesforceFeatureAccess(planSlug)` in `src/types/salesforce.ts`, which gates: `canConnectSalesforce`, `canSyncContacts`, `canSyncLeads`, `canSyncEvents`, `canViewOrgMembers`, `canInviteFromSalesforce`.

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| Login URL | `https://login.salesforce.com` (override via `SALESFORCE_LOGIN_URL` for sandbox) |
| Authorization URL | `{loginUrl}/services/oauth2/authorize` |
| Token URL | `{loginUrl}/services/oauth2/token` |
| Redirect URI | `{APP_URL}/api/integrations/salesforce/callback` |
| Grant type | `authorization_code` |
| Prompt | `login consent` (forces both login and consent) |
| Env vars | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_LOGIN_URL` (optional) |

### Requested Scopes

```
api
refresh_token
id
full
```

### Flow Steps

1. User clicks "Connect Salesforce" in the [[Integrations Page|IntegrationsPage]].
2. `getSalesforceAuthUrl(state)` generates the authorization URL with scopes and state parameter.
3. User authenticates on Salesforce's login page and grants consent.
4. Salesforce redirects to `/api/integrations/salesforce/callback` with an authorization code.
5. `exchangeSalesforceCode(code)` exchanges the code for tokens. Salesforce's token response includes `instance_url`, `id` (identity URL), `signature`, and `issued_at` in addition to the standard token fields.
6. `getSalesforceUserInfo()` calls the identity URL to fetch `user_id`, `organization_id`, `username`, `display_name`, and `email`.
7. Tokens are encrypted via `encryptToken()` before storage.
8. A row is inserted/updated in `salesforce_integrations`.

### Token Refresh

`refreshSalesforceToken(integration)` uses the stored refresh_token to obtain a new access_token from the token endpoint. Salesforce refresh tokens do not expire by default but can be revoked by Salesforce admins.

## Database Schema

### salesforce_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `instance_url` | text | NOT NULL | Salesforce instance URL (e.g., `https://na1.salesforce.com`). Used as base URL for all API calls |
| `sf_org_id` | text | NOT NULL | Salesforce organization/org ID |
| `sf_user_id` | text | NOT NULL | Salesforce user ID of the authorizer |
| `sf_username` | text | NOT NULL | Salesforce username (email-like format) |
| `sf_display_name` | text | NULL | Display name in Salesforce |
| `sf_email` | text | NULL | Email address of the Salesforce user |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes array |
| `raw_profile` | jsonb | NULL | Full raw profile from identity endpoint |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Key difference from other CRM integrations:** The `instance_url` field is critical -- Salesforce's API runs on different instance URLs (na1, eu1, etc.) and all API calls must be made to the correct instance.

### salesforce_contact_mappings

Supports mapping to both **Contact** and **Lead** objects via the `sf_object_type` field.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `salesforce_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `sf_contact_id` | text | NULL | Salesforce Contact object ID (18-char) |
| `sf_lead_id` | text | NULL | Salesforce Lead object ID (18-char) |
| `sf_object_type` | text | NOT NULL | `'Contact'` or `'Lead'` -- determines which Salesforce object this maps to |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, or `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- UNIQUE constraint on `(integration_id, sf_contact_id)` -- prevents duplicate Contact mappings
- UNIQUE constraint on `(integration_id, sf_lead_id)` -- prevents duplicate Lead mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### salesforce_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `salesforce_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'contacts'`, `'leads'`, `'events'`, `'users'` |
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

### Dual-Object Sync

Salesforce is unique among Callengo's CRM integrations in that it syncs both Contacts and Leads:

- **Contacts** are typically existing customers or established relationships. Synced via `syncSalesforceContactsToCallengo()` and `syncSelectedSalesforceContacts()`.
- **Leads** are unqualified prospects. Synced via `syncSalesforceLeadsToCallengo()` and `syncSelectedSalesforceLeads()`.

Both object types use Salesforce's SOQL query API (`/services/data/vXX.0/query?q=...`) with standard pagination via `nextRecordsUrl`.

### Outbound Sync

After call completion, `pushCallResultToSalesforce()` creates a Salesforce Task record linked to the Contact or Lead. `pushContactUpdatesToSalesforce()` updates field values on the Salesforce object when the Data Validation agent extracts new data.

### Exported Functions

From `src/lib/salesforce/auth.ts`: `getSalesforceConfig`, `getSalesforceAuthUrl`, `exchangeSalesforceCode`, `getSalesforceUserInfo`, `refreshSalesforceToken`, `getSalesforceClient`.

From `src/lib/salesforce/sync.ts`: `fetchSalesforceContacts`, `fetchSalesforceLeads`, `fetchSalesforceEvents`, `fetchSalesforceUsers`, `fetchSalesforceContactsByIds`, `fetchSalesforceLeadsByIds`, `syncSalesforceContactsToCallengo`, `syncSalesforceLeadsToCallengo`, `syncSelectedSalesforceContacts`, `syncSelectedSalesforceLeads`, `createSalesforceTask`, `pushCallResultToSalesforce`, `pushContactUpdatesToSalesforce`, `getActiveSalesforceIntegration`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/salesforce/auth.ts` | OAuth flow, token management, API client |
| `src/lib/salesforce/sync.ts` | Inbound/outbound sync for Contacts and Leads |
| `src/lib/salesforce/index.ts` | Re-exports |
| `src/types/salesforce.ts` | TypeScript types (284 lines) |
| `src/app/api/integrations/salesforce/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Call Processing Flow]] -- how call results are pushed to Salesforce
- [[HubSpot]] -- similar CRM integration (Business+ tier)
- [[Dynamics 365]] -- the other Teams+ CRM integration
- [[Plan Features]] -- feature gating configuration
