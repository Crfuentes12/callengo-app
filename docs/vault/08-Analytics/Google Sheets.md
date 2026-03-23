---
tags: [analytics, integrations, google-sheets, contacts, sync, oauth]
aliases: [Google Sheets Integration, Sheets Import, Spreadsheet Sync]
created: 2026-03-23
updated: 2026-03-23
---

# Google Sheets

The Google Sheets integration allows Callengo users to import contacts from Google Sheets spreadsheets and optionally maintain bidirectional sync between the spreadsheet and the Callengo contacts database. This is particularly useful for teams that manage their contact lists in spreadsheets before migrating to a CRM, or for teams that want to maintain a spreadsheet as a parallel data source.

The integration is available on all plans (Free and above) and uses OAuth 2.0 with Google for authentication.

---

## Database Tables

The integration uses two tables in Supabase, both with RLS enabled and scoped to `company_id`.

### google_sheets_integrations

This table stores the OAuth connection between a Callengo user and their Google account. Each company can have one integration per user, enforced by a unique constraint.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | UUID PK | `gen_random_uuid()` | PRIMARY KEY | Unique identifier |
| `company_id` | UUID | -- | NOT NULL, FK to `companies.id` | Company that owns this integration |
| `user_id` | UUID | -- | NOT NULL | User who connected the integration |
| `access_token` | TEXT | -- | -- | OAuth 2.0 access token (encrypted via [[Security & Encryption\|encryptToken()]]) |
| `refresh_token` | TEXT | -- | -- | OAuth 2.0 refresh token (encrypted via [[Security & Encryption\|encryptToken()]]) |
| `token_expires_at` | TIMESTAMPTZ | -- | -- | When the access token expires (typically 1 hour) |
| `google_email` | TEXT | -- | -- | Google account email used for OAuth |
| `google_user_id` | TEXT | -- | -- | Google account unique identifier |
| `google_user_name` | TEXT | -- | -- | Google account display name |
| `is_active` | BOOLEAN | `true` | -- | Whether the integration is currently active |
| `scopes` | TEXT | -- | -- | OAuth scopes granted (e.g., `spreadsheets.readonly`, `drive.readonly`) |
| `last_used_at` | TIMESTAMPTZ | -- | -- | Timestamp of the most recent API call using this integration |
| `created_at` | TIMESTAMPTZ | `now()` | -- | When the integration was created |
| `updated_at` | TIMESTAMPTZ | `now()` | -- | When the integration was last modified |

**Unique constraint**: `UNIQUE (company_id, user_id)` -- A user within a company can have only one Google Sheets connection. Reconnecting replaces the existing tokens.

**Indexes**:
- `idx_google_sheets_integrations_company` on `(company_id)` -- for listing integrations within a company
- `idx_google_sheets_integrations_active` on `(company_id, is_active)` -- for filtering active integrations

### google_sheets_linked_sheets

This table stores the specific spreadsheets and sheet tabs that have been linked to Callengo for contact import or sync. A single Google Sheets integration can have multiple linked sheets.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | UUID PK | `gen_random_uuid()` | PRIMARY KEY | Unique identifier |
| `company_id` | UUID | -- | NOT NULL, FK to `companies.id` | Company that owns this linked sheet |
| `integration_id` | UUID | -- | NOT NULL, FK to `google_sheets_integrations.id` | Parent integration |
| `spreadsheet_id` | TEXT | -- | NOT NULL | Google Sheets spreadsheet ID (from the URL) |
| `spreadsheet_name` | TEXT | -- | -- | Human-readable spreadsheet title |
| `sheet_tab_title` | TEXT | -- | NOT NULL | Name of the specific sheet tab within the spreadsheet |
| `sheet_tab_id` | INTEGER | `0` | -- | Numeric ID of the sheet tab (0 = first tab) |
| `column_mapping` | JSONB | -- | -- | Maps spreadsheet columns to Callengo contact fields (see Column Mapping below) |
| `sync_direction` | TEXT | `'bidirectional'` | -- | Sync mode: `import_only`, `export_only`, or `bidirectional` |
| `last_synced_at` | TIMESTAMPTZ | -- | -- | Timestamp of the most recent sync operation |
| `last_sync_row_count` | INTEGER | `0` | -- | Number of rows processed in the last sync |
| `is_active` | BOOLEAN | `true` | -- | Whether this linked sheet is actively syncing |
| `created_at` | TIMESTAMPTZ | `now()` | -- | When the link was created |
| `updated_at` | TIMESTAMPTZ | `now()` | -- | When the link was last modified |

**Unique constraint**: `UNIQUE (company_id, spreadsheet_id, sheet_tab_title)` -- A company cannot link the same sheet tab twice. This prevents duplicate imports and conflicting sync configurations.

---

## Row Level Security

Both tables have RLS enabled with company-scoped policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `google_sheets_integrations` | Own company only | Own company only | Own company only | Own company only |
| `google_sheets_linked_sheets` | Own company only | Own company only | Own company only | Own company only |

All policies filter by `company_id` matching the authenticated user's company, following the standard [[RLS Patterns|company-scoped RLS pattern]] used throughout Callengo.

---

## OAuth 2.0 Flow

The integration uses the standard Google OAuth 2.0 authorization code flow:

1. **Initiate**: User clicks "Connect Google Sheets" in the [[Architecture Overview|Integrations page]]. The frontend redirects to Google's OAuth consent screen with the required scopes.

2. **Consent**: User grants Callengo access to their Google Sheets (read and/or write, depending on the requested scopes).

3. **Callback**: Google redirects back to Callengo's OAuth callback endpoint with an authorization code.

4. **Token Exchange**: The API route exchanges the authorization code for an access token and refresh token.

5. **Storage**: Both tokens are encrypted using [[Security & Encryption|encryptToken()]] (AES-256-GCM) before being stored in `google_sheets_integrations`. The `token_expires_at` is set based on the token's expiry time (typically 1 hour).

6. **Refresh**: When the access token expires, the system uses the refresh token to obtain a new access token. The new token is encrypted and stored, updating `token_expires_at`.

---

## Column Mapping

The `column_mapping` JSONB column in `google_sheets_linked_sheets` defines how spreadsheet columns map to Callengo contact fields. The user configures this mapping through the UI when linking a sheet.

### Mapping Format

```json
{
  "A": "first_name",
  "B": "last_name",
  "C": "email",
  "D": "phone",
  "E": "company",
  "F": "job_title",
  "G": "address",
  "H": "city",
  "I": "state",
  "J": "country",
  "K": "notes"
}
```

The keys are spreadsheet column letters (A, B, C, ...) and the values are Callengo contact field names. Unmapped columns are ignored during import. The mapping is configured once when linking the sheet and can be updated later.

### Available Contact Fields

The following Callengo contact fields can be mapped to spreadsheet columns:

| Field | Type | Description |
|-------|------|-------------|
| `first_name` | TEXT | Contact's first name |
| `last_name` | TEXT | Contact's last name |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone number (E.164 format preferred) |
| `company` | TEXT | Company/organization name |
| `job_title` | TEXT | Job title or position |
| `address` | TEXT | Street address |
| `city` | TEXT | City |
| `state` | TEXT | State or province |
| `country` | TEXT | Country |
| `zip_code` | TEXT | Postal/ZIP code |
| `notes` | TEXT | Free-text notes |
| `custom_field_1` through `custom_field_5` | TEXT | Custom fields |

---

## Sync Directions

Three sync modes are supported:

| Mode | Direction | Description |
|------|-----------|-------------|
| `import_only` | Sheet --> Callengo | Contacts are imported from the sheet into Callengo. Changes in Callengo are not reflected back to the sheet. |
| `export_only` | Callengo --> Sheet | Callengo contact data is written to the sheet. Changes in the sheet are not imported. |
| `bidirectional` | Sheet <--> Callengo | Changes flow in both directions. Conflict resolution favors the most recently modified record. This is the default mode. |

---

## Plan Availability

The Google Sheets integration is available on all plans, including Free:

| Plan | Google Sheets Access |
|------|---------------------|
| Free | Yes |
| Starter | Yes |
| Growth | Yes |
| Business | Yes |
| Teams | Yes |
| Enterprise | Yes |

This broad availability reflects the fact that Google Sheets import is often the first way new users get contacts into Callengo, making it an important part of the activation funnel. See [[Plan Features]] for the complete feature matrix by plan.

---

## Migration

The tables were created in migration `20260228000003_add_google_sheets_integration.sql`. This migration:

1. Creates the `google_sheets_integrations` table with all columns and constraints
2. Creates the `google_sheets_linked_sheets` table with all columns and constraints
3. Creates indexes for performance
4. Enables RLS on both tables
5. Creates company-scoped RLS policies

See [[Migrations Timeline]] for the full migration history.

---

## Related Notes

- [[Security & Encryption]] -- OAuth token encryption with AES-256-GCM
- [[RLS Patterns]] -- Company-scoped row level security
- [[Schema Overview]] -- Full database schema reference
- [[Plan Features]] -- Feature availability by plan
- [[Migrations Timeline]] -- Database migration history
- [[Google Analytics 4]] -- Tracks `integration_connected` and `integration_sync_completed` events
- [[PostHog]] -- Tracks `phIntegrationEvents` for Sheets connections
