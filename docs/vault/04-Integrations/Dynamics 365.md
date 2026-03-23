---
tags: [integration, crm, oauth, microsoft]
aliases: [Microsoft Dynamics, Dynamics, Dynamics CRM, MS Dynamics]
---

# Dynamics 365

Microsoft Dynamics 365 is a CRM integration available on **Teams+** plans (Teams and Enterprise). It connects via OAuth 2.0 through Azure Active Directory (Azure AD / Microsoft Entra ID) and supports syncing both Contacts and Leads. As a Microsoft product, it shares its authentication infrastructure with [[Microsoft Outlook]], but the two integrations serve different purposes and are stored in different tables.

## Plan Gating

`isPlanAllowedForIntegration(planSlug, 'dynamics')` returns `true` only for `['teams', 'enterprise']`. Feature access via `getDynamicsFeatureAccess(planSlug)` gates: `canConnectDynamics`, `canSyncContacts`, `canSyncLeads`, `canViewOrgMembers`, `canInviteFromDynamics`.

## OAuth 2.0 Flow via Azure AD

### Configuration

| Parameter | Value |
|-----------|-------|
| Authorization URL | `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token` |
| Redirect URI | `{APP_URL}/api/integrations/dynamics/callback` |
| Grant type | `authorization_code` |
| Tenant ID | From `MICROSOFT_TENANT_ID` env var, defaults to `'common'` for multi-tenant |
| Env vars | `DYNAMICS_CLIENT_ID`, `DYNAMICS_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |

The `tenantId` parameter in the URLs determines whether the app accepts logins from a specific Azure AD tenant or from any tenant (`common`). Most Callengo deployments use `common` to support customers from different Microsoft organizations.

### Flow Steps

1. `getDynamicsAuthUrl(state)` generates the Azure AD consent URL with Dynamics-specific scopes.
2. User authenticates with their Microsoft account and grants consent.
3. Azure AD redirects to `/api/integrations/dynamics/callback` with an authorization code.
4. `exchangeDynamicsCode(code)` exchanges the code for tokens.
5. `getDynamicsUserInfo()` fetches user info from Microsoft Graph: `id`, `displayName`, `mail`, `userPrincipalName`, `jobTitle`, `officeLocation`.
6. `getDynamicsOrgInfo()` fetches Dynamics organization details: `id`, `organizationName`, `uniqueName`, `version`, `instanceUrl`, `tenantId`.
7. Tokens are encrypted and stored along with the `dynamics_instance_url` and `tenant_id`.

### Key Difference: Instance URL

Like [[Salesforce]], Dynamics 365 runs on customer-specific instance URLs (e.g., `https://myorg.crm.dynamics.com`). The `dynamics_instance_url` column stores this URL, and all Dynamics API calls (Dataverse/OData) are made against it. This is separate from the Microsoft Graph API used during the OAuth flow.

## Database Schema

### dynamics_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `token_expires_at` | timestamptz | NULL | When the access token expires |
| `dynamics_user_id` | text | NOT NULL | Dynamics/Azure AD user ID |
| `dynamics_user_name` | text | NULL | User's display name |
| `dynamics_user_email` | text | NULL | User's email address |
| `dynamics_org_name` | text | NULL | Dynamics organization name |
| `dynamics_org_id` | text | NULL | Dynamics organization ID |
| `dynamics_instance_url` | text | NOT NULL | Dynamics instance URL (e.g., `https://myorg.crm.dynamics.com`). Base URL for all Dataverse API calls |
| `tenant_id` | text | NULL | Azure AD tenant ID for the Microsoft organization |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes |
| `raw_profile` | jsonb | NULL | Full raw profile response |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

### dynamics_contact_mappings

Maps [[Contact|Callengo contacts]] to Dynamics 365 entity records (contacts or leads).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `dynamics_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `dynamics_contact_id` | text | NOT NULL | Dynamics entity ID (GUID) |
| `dynamics_entity_type` | text | NOT NULL | `'contacts'` or `'leads'`. Default: `'contacts'`. Note the lowercase plural form matching Dynamics OData entity set names |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- UNIQUE constraint on `(integration_id, dynamics_contact_id)` -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### dynamics_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `dynamics_integrations.id` |
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

### Dynamics API Specifics

Dynamics 365 uses the Dataverse Web API (OData v4). Responses follow the OData pattern with `value` arrays and `@odata.nextLink` for pagination.

Contact field names in Dynamics use lowercase with underscores: `contactid`, `firstname`, `lastname`, `fullname`, `emailaddress1`, `telephone1`, `mobilephone`, `jobtitle`, `department`, `address1_line1`, `address1_city`, `address1_stateorprovince`, `address1_postalcode`, `address1_country`. Related entities use navigation properties like `_parentcustomerid_value` and `_ownerid_value`.

Lead field names follow a similar pattern: `leadid`, `firstname`, `lastname`, `emailaddress1`, `telephone1`, `companyname`, `statuscode`, `leadsourcecode`.

### Inbound Sync

- `fetchDynamicsContacts()` and `fetchDynamicsContactsByIds()` -- fetch contact entities
- `fetchDynamicsLeads()` and `fetchDynamicsLeadsByIds()` -- fetch lead entities
- `fetchDynamicsUsers()` -- fetch system users for org member display

`syncDynamicsContactsToCallengo()` and `syncDynamicsLeadsToCallengo()` handle the contact/lead import.

### Outbound Sync

- `pushCallResultToDynamics()` -- creates a note or activity on the Dynamics contact/lead
- `pushContactUpdatesToDynamics()` -- updates entity fields with extracted data

### Exported Functions

From `src/lib/dynamics/auth.ts`: `getDynamicsConfig`, `getDynamicsAuthUrl`, `exchangeDynamicsCode`, `getDynamicsUserInfo`, `getDynamicsOrgInfo`, `refreshDynamicsToken`, `getDynamicsClient`.

From `src/lib/dynamics/sync.ts`: `fetchDynamicsContacts`, `fetchDynamicsContactsByIds`, `fetchDynamicsLeads`, `fetchDynamicsLeadsByIds`, `fetchDynamicsUsers`, `syncDynamicsContactsToCallengo`, `syncDynamicsLeadsToCallengo`, `syncSelectedDynamicsContacts`, `syncSelectedDynamicsLeads`, `pushCallResultToDynamics`, `pushContactUpdatesToDynamics`, `getActiveDynamicsIntegration`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/dynamics/auth.ts` | Azure AD OAuth flow, token management |
| `src/lib/dynamics/sync.ts` | Inbound/outbound sync for Contacts and Leads |
| `src/lib/dynamics/index.ts` | Re-exports |
| `src/types/dynamics.ts` | TypeScript types (229 lines) |
| `src/app/api/integrations/dynamics/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Microsoft Outlook]] -- shares Azure AD authentication infrastructure
- [[Salesforce]] -- the other Teams+ CRM integration
- [[Plan Features]] -- feature gating configuration
