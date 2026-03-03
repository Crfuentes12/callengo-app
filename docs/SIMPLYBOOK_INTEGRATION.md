# Callengo SimplyBook.me Integration - Comprehensive Documentation

## Overview

SimplyBook.me is a **booking and scheduling platform** (not a CRM). This integration allows Callengo users to sync their SimplyBook.me clients, view bookings, and push call results back as calendar notes. Unlike the CRM integrations, SimplyBook.me uses **credential-based authentication** (company login + user credentials) rather than OAuth.

**Key Differences from CRM Integrations:**
- **Category**: Calendar/Booking (not CRM)
- **Auth**: Token-based credentials (not OAuth redirect)
- **Required Plan**: Starter+ (lower than Business+ required by CRMs)
- **Outbound Method**: Calendar Notes on providers (not tasks/activities)
- **API**: REST API v2 at `user-api-v2.simplybook.me`

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Architecture](#architecture)
3. [Authentication Flow](#authentication-flow)
4. [Inbound Sync (SimplyBook.me → Callengo)](#inbound-sync)
5. [Outbound Sync (Callengo → SimplyBook.me)](#outbound-sync)
6. [API Routes](#api-routes)
7. [Database Schema](#database-schema)
8. [UI Components](#ui-components)
9. [Feature Gating](#feature-gating)
10. [Deletion Protection](#deletion-protection)
11. [Rate Limits & Token Management](#rate-limits--token-management)
12. [Troubleshooting](#troubleshooting)

---

## Quick Reference

| Feature | Details |
|---------|---------|
| **Platform** | SimplyBook.me (booking/scheduling) |
| **API Version** | REST API v2 |
| **Base URL** | `https://user-api-v2.simplybook.me` |
| **Auth Method** | Credential-based (company_login + user_login + password) |
| **Token Lifetime** | ~1 hour (proactive refresh at 20 hours from storage) |
| **Rate Limit** | 5,000 requests/day (common plans) |
| **Inbound Objects** | Clients, Bookings, Services, Providers |
| **Outbound Method** | Calendar Notes |
| **Deduplication** | Email, Phone |
| **Deletion Protection** | YES (zero DELETE calls to SimplyBook.me API) |
| **Required Plan** | Starter+ |
| **Selective Sync** | Yes |
| **Team Page Preview** | Yes (Providers) |

---

## Architecture

### File Structure
```
src/lib/simplybook/
├── auth.ts    # Token-based auth, refresh, API client wrapper
├── sync.ts    # Inbound + Outbound sync operations
└── index.ts   # Barrel exports

src/types/
└── simplybook.ts  # TypeScript types for all SimplyBook.me entities

src/app/api/integrations/simplybook/
├── connect/route.ts      # POST - Credential-based connect (not OAuth redirect)
├── disconnect/route.ts   # POST - Soft-delete disconnect
├── sync/route.ts         # POST - Full or selective sync
├── clients/route.ts      # GET  - Paginated client list with sync status
├── bookings/route.ts     # GET  - Paginated bookings with filters
└── providers/route.ts    # GET  - Providers cross-referenced with Callengo users

src/app/(app)/contacts/simplybook/
└── page.tsx              # Server page with plan check

src/components/contacts/
└── SimplyBookContactsPage.tsx  # Full client component

src/components/settings/
└── SimplyBookOrgMembers.tsx    # Team page providers component

supabase/migrations/
└── 20260303_simplybook_integration.sql  # Database migration
```

### Data Flow
```
┌─────────────────┐     REST API v2      ┌──────────────────┐
│                  │ ◄──────────────────► │                  │
│   SimplyBook.me  │                      │     Callengo     │
│                  │   Token Auth         │                  │
│  - Clients       │   (credentials)      │  - Contacts      │
│  - Bookings      │ ──────────────────── │  - Call Results   │
│  - Services      │                      │  - Teams         │
│  - Providers     │   Calendar Notes     │                  │
│  - Notes         │ ◄────────────────── │  - Call Logs     │
└─────────────────┘                      └──────────────────┘
```

---

## Authentication Flow

### How It Works

Unlike CRM integrations that use OAuth redirects, SimplyBook.me uses a **credential-based flow**:

1. **User enters credentials** in the connect form:
   - Company Login (SimplyBook.me subdomain)
   - User Login (admin username)
   - User Password

2. **Server authenticates** via `POST /admin/auth`:
   ```json
   {
     "company": "my-company",
     "login": "admin@example.com",
     "password": "secret"
   }
   ```

3. **Server receives tokens**:
   ```json
   {
     "token": "eyJ...",
     "refresh_token": "abc123...",
     "company": "my-company"
   }
   ```

4. **Tokens stored** in `simplybook_integrations` table (encrypted at rest via Supabase)

5. **User info fetched** via `GET /admin/user` to populate display fields

### Token Refresh

- Tokens expire in ~1 hour
- The `getSimplyBookClient()` wrapper checks `token_expires_at` before each request
- If within 20-hour window of creation, token is proactively refreshed via `POST /admin/auth/refresh-token`
- On 401/403 responses, automatic retry with refreshed token
- If refresh fails, integration is deactivated

### Key Auth Functions

| Function | Description |
|----------|-------------|
| `authenticateSimplyBook(companyLogin, userLogin, userPassword)` | Initial authentication |
| `getSimplyBookUserInfo(token, companyLogin)` | Fetches authenticated user details |
| `getSimplyBookCompanyInfo(token, companyLogin)` | Fetches company/organization info |
| `refreshSimplyBookToken(integration)` | Refreshes expired access token |
| `getSimplyBookClient(integration)` | Returns authenticated fetch wrapper with auto-refresh |

### 2FA Handling

If the SimplyBook.me account has 2FA enabled, the auth module detects it and returns an error asking the user to either disable 2FA or use a dedicated API account.

---

## Inbound Sync

### SimplyBook.me → Callengo

#### Clients Sync
- **Endpoint**: `GET /admin/clients` with pagination
- **Deduplication**: By email (primary) and phone (secondary)
- **Mapping**: SimplyBook client fields → Callengo contact fields
  - `name` → `full_name`
  - `email` → `email`
  - `phone` → `phone`
  - Source tagged as `simplybook`
- **Tracking**: `simplybook_contact_mappings` table links SB client IDs to Callengo contact IDs

#### Selective Sync
Users can choose specific clients to import rather than syncing everything.

#### Bookings View
- **Endpoint**: `GET /admin/bookings` with filters
- **Filters**: date range, status (confirmed/pending/cancelled), upcoming only
- **Read-only**: Bookings are displayed but not synced as contacts

#### Services & Providers
- **Endpoint**: `GET /admin/services`, `GET /admin/providers`
- **Usage**: Display-only, used for bookings context and team page

### Key Sync Functions

| Function | Description |
|----------|-------------|
| `fetchSimplyBookClients(client, page, pageSize)` | Paginated client fetch |
| `fetchSimplyBookClientById(client, clientId)` | Single client fetch |
| `fetchSimplyBookBookings(client, params)` | Bookings with filters |
| `fetchSimplyBookServices(client)` | All services |
| `fetchSimplyBookProviders(client)` | All providers/staff |
| `syncSimplyBookClientsToCallengo(companyId, integrationId)` | Full inbound sync |
| `syncSelectedSimplyBookClients(companyId, integrationId, clientIds)` | Selective sync |

---

## Outbound Sync

### Callengo → SimplyBook.me

#### Calendar Notes
- **Endpoint**: `POST /admin/calendar-notes`
- **What's pushed**: Call results, call summaries, call notes
- **Target**: Calendar notes are attached to a provider (staff member)
- **Format**: Note title includes call status, body includes full call details

#### Key Outbound Functions

| Function | Description |
|----------|-------------|
| `createSimplyBookCalendarNote(client, params)` | Creates a calendar note |
| `pushCallResultToSimplyBook(companyId, contactId, callResult)` | Pushes single call result as note |
| `pushContactUpdatesToSimplyBook(companyId)` | Bulk push for all mapped contacts |

---

## API Routes

### POST `/api/integrations/simplybook/connect`

Authenticates with SimplyBook.me and stores the integration.

**Request Body:**
```json
{
  "company_login": "my-company",
  "user_login": "admin@example.com",
  "user_password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "integration": {
    "id": "uuid",
    "sb_company_login": "my-company",
    "sb_user_name": "Admin User",
    "sb_user_email": "admin@example.com",
    "sb_company_name": "My Company"
  }
}
```

**Validations:**
- Requires authenticated Callengo user
- Checks plan (starter+)
- Deactivates any existing SimplyBook.me integration for the company
- Validates credentials against SimplyBook.me API

### POST `/api/integrations/simplybook/disconnect`

Soft-deletes the integration (sets `is_active = false`).

**Response:**
```json
{ "success": true }
```

### POST `/api/integrations/simplybook/sync`

Triggers client sync.

**Request Body:**
```json
{
  "type": "full"
}
```
Or for selective sync:
```json
{
  "type": "selective",
  "clientIds": [123, 456, 789]
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "synced": 25,
    "created": 20,
    "updated": 5,
    "skipped": 0,
    "errors": []
  }
}
```

### GET `/api/integrations/simplybook/clients`

Returns paginated SimplyBook.me clients with sync status.

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 50)
- `search` (optional, searches name/email/phone)

**Response:**
```json
{
  "clients": [...],
  "total": 150,
  "page": 1,
  "pageSize": 50,
  "syncedIds": [123, 456]
}
```

### GET `/api/integrations/simplybook/bookings`

Returns paginated bookings with optional filters.

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 50)
- `upcoming` (boolean, filters to future bookings)
- `status` (optional: confirmed, pending, cancelled)
- `dateFrom`, `dateTo` (optional date range)

### GET `/api/integrations/simplybook/providers`

Returns SimplyBook.me providers cross-referenced with Callengo users.

**Response:**
```json
{
  "providers": [
    {
      "sb_provider_id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "is_active": true,
      "is_visible": true,
      "services": [1, 2, 3],
      "already_in_callengo": true,
      "callengo_user_id": "uuid"
    }
  ]
}
```

---

## Database Schema

### Tables

#### `simplybook_integrations`
Primary integration record, one per company.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | FK to companies |
| `sb_company_login` | TEXT | SimplyBook.me company subdomain |
| `sb_user_login` | TEXT | Login username |
| `sb_user_name` | TEXT | Display name |
| `sb_user_email` | TEXT | User email |
| `sb_company_name` | TEXT | Company display name |
| `access_token` | TEXT | Current access token |
| `refresh_token` | TEXT | Refresh token |
| `token_expires_at` | TIMESTAMPTZ | Token expiration time |
| `is_active` | BOOLEAN | Soft-delete flag |
| `last_synced_at` | TIMESTAMPTZ | Last successful sync |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Auto-updated timestamp |

#### `simplybook_sync_logs`
Audit trail for all sync operations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `integration_id` | UUID | FK to simplybook_integrations |
| `company_id` | UUID | FK to companies |
| `sync_type` | TEXT | 'full', 'selective', 'outbound' |
| `status` | TEXT | 'started', 'completed', 'failed' |
| `records_synced` | INT | Number of records processed |
| `records_created` | INT | New contacts created |
| `records_updated` | INT | Existing contacts updated |
| `records_failed` | INT | Failed records |
| `error_details` | JSONB | Error information |
| `started_at` | TIMESTAMPTZ | Sync start time |
| `completed_at` | TIMESTAMPTZ | Sync completion time |
| `created_at` | TIMESTAMPTZ | Created timestamp |

#### `simplybook_contact_mappings`
Maps SimplyBook.me client IDs to Callengo contact IDs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `integration_id` | UUID | FK to simplybook_integrations |
| `company_id` | UUID | FK to companies |
| `sb_client_id` | BIGINT | SimplyBook.me client ID |
| `contact_id` | UUID | FK to contacts |
| `last_synced_at` | TIMESTAMPTZ | Last sync of this mapping |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Auto-updated timestamp |

### Indexes
- `simplybook_integrations`: company_id + is_active (unique active per company)
- `simplybook_sync_logs`: integration_id, company_id
- `simplybook_contact_mappings`: integration_id + sb_client_id (unique), contact_id

### RLS Policies
All tables have Row Level Security enabled. Service role access is required for all operations (handled via `supabaseAdminRaw`).

---

## UI Components

### SimplyBookContactsPage (`/contacts/simplybook`)

Full-page component with two tabs:

1. **Clients Tab**
   - Connect form (when not connected): company login, user login, password fields
   - Client list with search and pagination
   - Sync status indicators (synced/not synced)
   - Selective sync: checkbox selection + "Sync Selected" button
   - Full sync: "Sync All" button
   - Deletion protection banner

2. **Bookings Tab**
   - Upcoming bookings filter toggle
   - Booking cards with date, time, service, provider, client, status
   - Pagination

### SimplyBookOrgMembers (`/team`)

Expandable section on the team page showing SimplyBook.me providers:
- Provider name, email, phone
- Active/inactive status
- "In Callengo" badge or "Invite" button
- Invite links pre-populate the team invite form

### IntegrationsPage Entry

SimplyBook.me appears in the Calendar section of the integrations page:
- Shows connection status, user email, company name
- Connect/Disconnect/Manage/Sync buttons
- Last synced timestamp

---

## Feature Gating

### Plan Requirements

| Plan | SimplyBook.me Access |
|------|---------------------|
| Free | No |
| Starter | Yes |
| Business | Yes |
| Teams | Yes |
| Enterprise | Yes |

This is **different** from CRM integrations which require Business+. SimplyBook.me is available on Starter plans because it's a booking tool, not a CRM.

### Access Check Locations

1. **Server page** (`contacts/simplybook/page.tsx`): Redirects to upgrade if plan insufficient
2. **Connect API route**: Validates plan before accepting credentials
3. **Contacts page**: Controls visibility of SimplyBook.me in integrations dropdown
4. **Integrations page**: Controls connect/disconnect buttons

---

## Deletion Protection

**Zero DELETE API calls are made to SimplyBook.me.**

- **Disconnect**: Sets `is_active = false` in our database. Does NOT delete anything in SimplyBook.me.
- **Contact deletion in Callengo**: Only removes the local contact and mapping. The client remains in SimplyBook.me.
- **Re-sync**: If a previously synced client is re-synced, it deduplicates by email/phone and updates the existing Callengo contact.

This follows the same deletion protection philosophy as all other integrations.

---

## Rate Limits & Token Management

### API Rate Limits
- **Common plans**: 5,000 requests/day
- **Higher plans**: May have higher limits
- The sync module uses pagination (50 records per page) to stay within limits
- Full syncs process all pages sequentially to avoid burst

### Token Lifecycle
1. **Initial auth**: Token + refresh_token received, stored in DB
2. **Before each request**: `getSimplyBookClient()` checks `token_expires_at`
3. **Proactive refresh**: If token is past the 20-hour mark, refresh before request
4. **Reactive refresh**: On 401/403, attempt refresh and retry once
5. **Failure**: If refresh fails, integration is marked inactive

### Token Storage
- Access token, refresh token, and expiration are stored in `simplybook_integrations`
- Supabase encrypts data at rest
- Tokens are only accessed server-side (never exposed to client)

---

## Troubleshooting

### Common Issues

#### "2FA Required" Error
**Cause**: The SimplyBook.me account has two-factor authentication enabled.
**Solution**: Either disable 2FA on the SimplyBook.me account or create a dedicated API user without 2FA.

#### "Invalid Credentials" Error
**Cause**: Incorrect company login, username, or password.
**Solution**: Verify:
- Company login is the SimplyBook.me subdomain (e.g., `my-company` from `my-company.simplybook.me`)
- Username is the admin login, not the booking page name
- Password is correct

#### "Plan Required" Error
**Cause**: User is on Free plan.
**Solution**: Upgrade to Starter or higher.

#### "Token Expired" / Integration Disconnected
**Cause**: Token refresh failed (possibly due to password change on SimplyBook.me).
**Solution**: Disconnect and reconnect with current credentials.

#### Clients Not Syncing
**Cause**: May be rate limited or API pagination issue.
**Solution**:
1. Check sync logs in `simplybook_sync_logs` table
2. Try syncing a smaller batch using selective sync
3. Wait and retry if rate limited

#### Bookings Not Loading
**Cause**: May be a permissions issue on the SimplyBook.me account.
**Solution**: Ensure the authenticated user has admin access to view bookings.

### Sync Logs
All sync operations are logged in `simplybook_sync_logs` with:
- Sync type (full/selective/outbound)
- Status (started/completed/failed)
- Record counts (synced/created/updated/failed)
- Error details (JSON)
- Timestamps

Query recent sync logs:
```sql
SELECT * FROM simplybook_sync_logs
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Environment Variables

SimplyBook.me does **not** require any environment variables. Unlike OAuth-based integrations that need client IDs and secrets, the credential-based auth uses user-provided credentials stored in the database.

This simplifies deployment — no additional secrets to configure.

---

## Comparison with CRM Integrations

| Aspect | CRM Integrations | SimplyBook.me |
|--------|-----------------|---------------|
| **Auth** | OAuth 2.0 redirect | Credential-based (POST) |
| **Connect Flow** | Redirect → Callback → Store | Form submit → Auth → Store |
| **API Routes** | connect + callback | connect only (no callback) |
| **Required Plan** | Business+ | Starter+ |
| **Category** | CRM | Calendar/Booking |
| **Inbound Objects** | Contacts/Leads | Clients |
| **Outbound Objects** | Tasks/Notes/Activities | Calendar Notes |
| **Token Management** | OAuth refresh tokens | Credential-based refresh |
| **Env Variables** | Client ID + Secret | None required |
| **2FA Support** | N/A (OAuth handles) | Must be disabled |
