---
tags: [integration, scheduling, appointments]
aliases: [SimplyBook.me, SimplyBook Integration, Appointment Scheduling]
---

# SimplyBook

SimplyBook.me is an appointment scheduling platform integration available on **Starter+** plans (Starter, Growth, Business, Teams, Enterprise). Unlike all other CRM integrations in [[Callengo]], SimplyBook uses **API Key + Secret authentication** rather than OAuth 2.0. It is the only non-OAuth integration in the platform.

SimplyBook is particularly relevant for the [[Appointment Confirmation]] agent, as it provides the appointment data that drives confirmation calls.

## Plan Gating

SimplyBook is NOT in the `INTEGRATION_PLAN_REQUIREMENTS` map in [[Plan Features|plan-features.ts]], meaning `isPlanAllowedForIntegration()` returns `true` for all plans. However, `getSimplyBookFeatureAccess(planSlug)` in `src/types/simplybook.ts` restricts access to `['starter', 'business', 'teams', 'enterprise']` -- Free plan users cannot connect SimplyBook.

## Authentication Flow (API Key + Secret)

### Configuration

| Parameter | Value |
|-----------|-------|
| Auth method | REST API v2 token-based authentication |
| Auth endpoint | SimplyBook admin login endpoint |
| Env vars | None required (credentials are per-user, not platform-level) |

### Flow Steps

Unlike OAuth integrations, SimplyBook requires the user to enter their credentials directly:

1. User enters their SimplyBook company login, user login, and password in the Callengo UI.
2. `authenticateSimplyBook({ company, login, password })` sends these credentials to SimplyBook's admin auth endpoint.
3. SimplyBook returns a `SimplyBookTokenResponse` containing: `token`, `company`, `login`, `refresh_token`, `domain`, `require2fa`, `allowed2fa_providers`, `auth_session_id`.
4. `getSimplyBookUserInfo()` fetches the user profile: `id`, `login`, `firstname`, `lastname`, `email`, `phone`, and nested `company` object with `login`, `name`, `dashboard_url`, `public_url`.
5. `getSimplyBookCompanyInfo()` fetches company details.
6. Tokens (both `sb_token` and `sb_refresh_token`) are encrypted via `encryptToken()` before storage.
7. A row is inserted in `simplybook_integrations`.

### Token Refresh

`refreshSimplyBookToken(integration)` uses the stored `sb_refresh_token` and `sb_company_login` to obtain a new token. The refresh endpoint takes `company`, `refresh_token`, and an optional `device_token`.

## Database Schema

### simplybook_integrations

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `sb_company_login` | text | NOT NULL | SimplyBook company login identifier |
| `sb_user_login` | text | NOT NULL | SimplyBook user login |
| `sb_token` | text | NOT NULL | Encrypted SimplyBook API token |
| `sb_refresh_token` | text | NULL | Encrypted refresh token |
| `token_expires_at` | timestamptz | NULL | When the token expires |
| `sb_user_id` | text | NULL | SimplyBook user ID |
| `sb_user_name` | text | NULL | User's display name |
| `sb_user_email` | text | NULL | User's email address |
| `sb_company_name` | text | NULL | SimplyBook company name |
| `sb_domain` | text | NULL | SimplyBook domain/URL for this account |
| `token_issued_at` | timestamptz | NULL | When the current token was issued |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Incremental sync cursor |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `raw_profile` | jsonb | NULL | Full raw profile response |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Note:** Unlike OAuth integrations, there are no `scopes` or `access_token`/`refresh_token` columns (standard OAuth names). Instead, `sb_token` and `sb_refresh_token` hold the SimplyBook-specific tokens. The `sb_company_login` and `sb_user_login` fields are required for token refresh.

### simplybook_contact_mappings

Maps [[Contact|Callengo contacts]] to SimplyBook Client objects.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Mapping record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `simplybook_integrations.id` |
| `callengo_contact_id` | uuid | FK NOT NULL | Reference to `contacts.id` |
| `sb_client_id` | text | NOT NULL | SimplyBook Client ID |
| `last_synced_at` | timestamptz | NULL | When this mapping was last synced |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Note:** Unlike other CRM mappings, there is no `object_type` field because SimplyBook only has one contact entity type (Client).

**Indexes:**
- UNIQUE constraint on `(integration_id, sb_client_id)` -- prevents duplicate mappings
- Index on `callengo_contact_id` for reverse lookups
- Index on `company_id` for RLS queries

### simplybook_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `simplybook_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'selective'`, `'clients'`, `'bookings'`, `'services'`, `'providers'` |
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

### simplybook_webhook_logs

SimplyBook is the only integration with a dedicated webhook log table for incoming events.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `simplybook_integrations.id` |
| `event_type` | text | NOT NULL | SimplyBook webhook event type |
| `payload` | jsonb | NOT NULL | Full webhook payload |
| `processed` | boolean | NOT NULL | Whether the event has been processed |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |

## SimplyBook Data Model

### SimplyBookClient

Clients are simple objects with `id`, `name`, `email`, `phone`. Client details can be extended with custom fields via `SimplyBookClientFieldValue` objects.

### SimplyBookBooking

Bookings are the core appointment entity: `id`, `code`, `is_confirmed`, `start_datetime`, `end_datetime`, linked `service_id`, `provider_id`, `client_id`, `duration`. Booking details extend with `status`, `comment`, invoice information, and cancellation flags.

### SimplyBookService

Services define what can be booked: `id`, `name`, `description`, `price`, `currency`, `duration`, `buffer_time_after`, `is_active`, `is_visible`. Supports recurring settings.

### SimplyBookProvider

Providers are the people who deliver services: `id`, `name`, `email`, `phone`, `description`, `is_active`, `is_visible`, linked `services` array.

## Sync Mechanism

### Inbound Sync

SimplyBook's API uses page-based pagination with `metadata.items_count`, `pages_count`, `page`, `on_page`:

- `fetchSimplyBookClients()` and `fetchSimplyBookClientById()` -- fetch Client objects
- `fetchSimplyBookBookings()` -- fetch bookings (appointments)
- `fetchSimplyBookServices()` -- fetch available services
- `fetchSimplyBookProviders()` -- fetch service providers

`syncSimplyBookClientsToCallengo()` creates or updates Callengo contacts from SimplyBook Clients. `syncSelectedSimplyBookClients()` handles selective import.

### Outbound Sync

- `pushCallResultToSimplyBook()` -- pushes call results back to SimplyBook
- `pushContactUpdatesToSimplyBook()` -- updates Client fields
- `createSimplyBookCalendarNote()` -- creates a calendar note in SimplyBook (with `provider_id`, `start_date_time`, `end_date_time`, `note`, `time_blocked`)

### Exported Functions

From `src/lib/simplybook/auth.ts`: `getSimplyBookConfig`, `authenticateSimplyBook`, `getSimplyBookUserInfo`, `getSimplyBookCompanyInfo`, `refreshSimplyBookToken`, `getSimplyBookClient`.

From `src/lib/simplybook/sync.ts`: `fetchSimplyBookClients`, `fetchSimplyBookClientById`, `fetchSimplyBookBookings`, `fetchSimplyBookServices`, `fetchSimplyBookProviders`, `syncSimplyBookClientsToCallengo`, `syncSelectedSimplyBookClients`, `createSimplyBookCalendarNote`, `pushCallResultToSimplyBook`, `pushContactUpdatesToSimplyBook`, `getActiveSimplyBookIntegration`.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/simplybook/auth.ts` | API key authentication, token management |
| `src/lib/simplybook/sync.ts` | Inbound/outbound sync for Clients, Bookings, Notes |
| `src/lib/simplybook/index.ts` | Re-exports |
| `src/types/simplybook.ts` | TypeScript types (383 lines) |
| `src/app/api/integrations/simplybook/` | API route handlers |

## Related Notes

- [[Integrations API]] -- shared integration patterns
- [[Contact]] -- Callengo contact model
- [[Appointment Confirmation]] -- the agent type that benefits most from SimplyBook data
- [[Calendar Event]] -- SimplyBook bookings can feed appointment data
- [[Plan Features]] -- feature gating configuration
