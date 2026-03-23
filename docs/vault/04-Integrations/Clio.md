---
tags: [integration, crm, oauth, legal]
aliases: [Clio CRM, Clio Integration, Legal Practice Management]
---

# Clio

Clio is a legal practice management CRM integration available on **Business+** plans (Business, Teams, Enterprise). It connects via OAuth 2.0 and is specifically designed for law firms and legal professionals. Unlike general-purpose CRMs, Clio's data model includes legal-specific entities such as Matters, Calendar Entries, and Practice Areas alongside standard Contacts.

## Plan Gating

`isPlanAllowedForIntegration(planSlug, 'clio')` returns `true` for `['business', 'teams', 'enterprise']`. Feature access via `getClioFeatureAccess(planSlug)` gates: `canConnectClio`, `canSyncContacts`, `canSyncMatters`, `canSyncCalendar`, `canViewOrgMembers`, `canInviteFromClio`.

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| Authorization URL | Clio OAuth authorize endpoint |
| Token URL | Clio OAuth token endpoint |
| Redirect URI | `{APP_URL}/api/integrations/clio/callback` |
| Grant type | `authorization_code` |
| Env vars | `CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET` |

### Flow Steps

1. `getClioAuthUrl(state)` generates the OAuth consent URL.
2. User authenticates on Clio and grants consent.
3. Clio redirects to `/api/integrations/clio/callback` with an authorization code.
4. `exchangeClioCode(code)` exchanges the code for tokens (`access_token`, `refresh_token`, `token_type`, `expires_in`).
5. `getClioUserInfo()` fetches the authenticated user's details: `id`, `name`, `first_name`, `last_name`, `email`, `enabled`, `subscription_type`, `account_owner`.
6. The firm name and firm ID are extracted from the account context.
7. Tokens are encrypted via `encryptToken()` and stored.

### Token Refresh

`refreshClioToken(integration)` refreshes the access token when expired. The `getClioClient()` function automatically triggers refresh when needed.

## Database Schema

### clio_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `access_token` | text | NOT NULL | Encrypted OAuth access token |
| `refresh_token` | text | NOT NULL | Encrypted OAuth refresh token |
| `token_expires_at` | timestamptz | NULL | When the access token expires |
| `clio_user_id` | text | NOT NULL | Clio user ID |
| `clio_user_name` | text | NULL | Clio user's full name |
| `clio_user_email` | text | NULL | Clio user's email address |
| `clio_firm_name` | text | NULL | Name of the law firm in Clio |
| `clio_firm_id` | text | NULL | Clio firm/account ID |
| `clio_subscription_type` | text | NULL | The firm's Clio subscription tier (e.g., "Boutique", "Elite") |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes |
| `raw_profile` | jsonb | NULL | Full raw profile response |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Note:** The `clio_subscription_type` field is unique to this integration -- no other CRM integration tracks the provider's subscription tier. This is useful for understanding the firm's Clio capabilities.

### clio_contact_mappings

Maps [[Contact|Callengo contacts]] to Clio Contact objects. Clio distinguishes between Person and Company contact types.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `clio_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `clio_contact_id` | text | NOT NULL | Clio Contact ID |
| `clio_contact_type` | text | NOT NULL | `'Person'` or `'Company'`. Default: `'Person'` |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Indexes:**
- UNIQUE constraint on `(integration_id, clio_contact_id)` -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### clio_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `clio_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'contacts'`, `'matters'`, `'calendar'` |
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

## Clio Data Model

Clio's API provides legal-specific entities beyond contacts:

### ClioContact

Clio contacts have a `type` field distinguishing `'Person'` from `'Company'`. They include structured arrays for `email_addresses` (with `name`, `address`, `default_email`), `phone_numbers` (with `name`, `number`, `default_number`), and `addresses` (with `street`, `city`, `province`, `postal_code`, `country`). An `etag` field enables conflict detection during updates.

### ClioMatter

Legal matters (cases) with `display_number`, `description`, `status`, `open_date`, `close_date`, linked `client`, `responsible_attorney`, and `practice_area`. While Callengo does not sync matters as contacts, they provide context for the AI agents when calling contacts associated with legal matters.

### ClioCalendarEntry

Calendar entries with `summary`, `description`, `start_at`, `end_at`, `all_day`, `location`, `recurrence_rule`, linked `matter`, `attendees`, and `calendar_owner`. These can be synced to Callengo's [[Calendar Event|calendar_events]] table for the Appointment Confirmation agent.

## Sync Mechanism

### Inbound Sync

Clio's API uses cursor-based pagination with `meta.paging.next` URLs:

- `fetchClioContacts()` and `fetchClioContactsByIds()` -- fetch Contact objects
- `fetchClioCalendarEntries()` -- fetch calendar entries for appointment context
- `fetchClioUsers()` -- fetch Clio users for org member display

`syncClioContactsToCallengo()` creates or updates Callengo contacts from Clio's Person-type contacts. The multi-valued email and phone fields are flattened to the primary (default) values.

### Outbound Sync

- `pushCallResultToClio()` -- pushes call results to Clio
- `pushContactUpdatesToClio()` -- updates Clio Contact fields with extracted data
- `createClioNote()` -- creates a note attached to a Contact or Matter. Note payload includes `subject`, `detail`, `type` (`'Contact'` or `'Matter'`), and `regarding` (object reference with `id` and `type`)

### Exported Functions

From `src/lib/clio/auth.ts`: `getClioConfig`, `getClioAuthUrl`, `exchangeClioCode`, `getClioUserInfo`, `refreshClioToken`, `getClioClient`.

From `src/lib/clio/sync.ts`: `fetchClioContacts`, `fetchClioContactsByIds`, `fetchClioCalendarEntries`, `fetchClioUsers`, `syncClioContactsToCallengo`, `syncSelectedClioContacts`, `pushCallResultToClio`, `pushContactUpdatesToClio`, `createClioNote`, `getActiveClioIntegration`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/clio/auth.ts` | OAuth flow, token management, API client |
| `src/lib/clio/sync.ts` | Inbound/outbound sync for Contacts, Calendar, Notes |
| `src/lib/clio/index.ts` | Re-exports |
| `src/types/clio.ts` | TypeScript types (264 lines) |
| `src/app/api/integrations/clio/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Call Processing Flow]] -- how call results are pushed to Clio
- [[Appointment Confirmation]] -- the agent type most relevant to legal scheduling
- [[Calendar Event]] -- Clio calendar entries can feed appointment data
- [[Plan Features]] -- feature gating configuration
