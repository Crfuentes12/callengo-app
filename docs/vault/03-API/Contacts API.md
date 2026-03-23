---
tags: [api, contacts, import, export, csv, pagination, filtering]
created: 2026-03-23
updated: 2026-03-23
---

# Contacts API

The Contacts API provides 10 endpoints for managing the contact database -- the central data asset in Callengo. Contacts are the people who receive outbound calls from AI agents. Each contact belongs to a single [[Company]] (isolated via `company_id` and [[RLS Patterns|Row Level Security]]). Contacts can be created individually, imported in bulk from CSV/Excel files, synced from CRM integrations, or imported from Google Sheets. The API supports rich filtering, sorting, pagination, and search.

All contacts are stored in the `contacts` table in Supabase.

---

## Endpoint Reference

### GET /api/contacts

Lists contacts for the authenticated user's company with pagination, filtering, sorting, and full-text search.

**Authentication:** Required.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 50 | Items per page (10-200) |
| `sortBy` | string | `created_at` | Sort column (see allowed list below) |
| `sortOrder` | string | `desc` | `asc` or `desc` |
| `search` | string | -- | Free-text search across name, email, phone, company, city |
| `status` | string | -- | Filter by contact status |
| `listId` | string | -- | Filter by contact list ID. Use `none` for unassigned contacts |
| `source` | string | -- | Filter by source (e.g., `manual`, `csv_import`, `hubspot`, `salesforce`) |
| `tags` | string | -- | Comma-separated tag list. Uses PostgreSQL `overlaps` operator |
| `hasEmail` | string | -- | `true` to show only contacts with email |
| `hasPhone` | string | -- | `true` to show only contacts with phone |
| `dateFrom` | string | -- | ISO date lower bound on `created_at` |
| `dateTo` | string | -- | ISO date upper bound on `created_at` |

**Allowed sort columns:** `created_at`, `updated_at`, `company_name`, `contact_name`, `email`, `phone_number`, `status`, `city`, `state`, `call_attempts`, `last_call_date`, `call_duration`, `source`. Any other value falls back to `created_at` to prevent SQL injection.

**Search sanitization:** The search input is sanitized to escape PostgREST special characters (`%`, `_`, `,`, `.`, `(`, `)`) before being used in an `ilike` filter. The search is applied across `company_name`, `phone_number`, `contact_name`, `email`, and `city` fields using an `OR` clause.

**Post-processing:** After fetching from the database, contacts undergo a normalization step that merges known fields from `custom_fields` into proper database columns. For example, if a CSV import placed `city` into `custom_fields.city` instead of the `city` column, the API response will surface it in the correct place. The mapping handles multiple aliases per field (e.g., `zip`, `zip_code`, `zipcode`, `postal_code`, `codigo_postal` all map to `zip_code`).

**Response:**

```json
{
  "contacts": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "contact_name": "John Smith",
      "company_name": "Acme Corp",
      "email": "john@acme.com",
      "phone_number": "+14155551234",
      "status": "active",
      "address": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zip_code": "62701",
      "source": "csv_import",
      "list_id": "uuid",
      "tags": ["hot-lead", "enterprise"],
      "call_attempts": 2,
      "last_call_date": "2026-03-20T15:00:00Z",
      "call_duration": 93,
      "notes": "Interested in annual plan",
      "custom_fields": { "industry": "SaaS" },
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-03-20T15:01:33Z"
    }
  ],
  "total": 450,
  "page": 1,
  "pageSize": 50,
  "totalPages": 9
}
```

**Source file:** `src/app/api/contacts/route.ts`

---

### POST /api/contacts

Creates a single contact.

**Authentication:** Required.

**Request body:**

```json
{
  "contact_name": "Jane Doe",
  "company_name": "Widget Inc",
  "email": "jane@widget.com",
  "phone_number": "+14155559876",
  "address": "456 Oak Ave",
  "city": "Portland",
  "state": "OR",
  "zip_code": "97201",
  "notes": "Referred by Bob",
  "tags": ["referral"],
  "list_id": "uuid",
  "custom_fields": { "department": "Engineering" }
}
```

The `company_id` is automatically set from the authenticated user's company. The `source` field is set to `manual` for directly-created contacts.

**Source file:** `src/app/api/contacts/route.ts` (or `src/app/api/contacts/[id]/route.ts` depending on method routing)

---

### GET /api/contacts/[id]

Returns a single contact by ID. The contact must belong to the authenticated user's company (enforced by RLS).

**Authentication:** Required.

**Source file:** `src/app/api/contacts/[id]/route.ts`

---

### PUT /api/contacts/[id]

Updates a contact's fields. Only the provided fields are updated; omitted fields are left unchanged.

**Authentication:** Required.

**Request body:** Same fields as POST (all optional).

**Source file:** `src/app/api/contacts/[id]/route.ts`

---

### DELETE /api/contacts/[id]

Deletes a contact permanently.

**Authentication:** Required.

**Source file:** `src/app/api/contacts/[id]/route.ts`

---

### POST /api/contacts/import

Bulk imports contacts from a CSV or Excel file. This is a heavy operation that validates plan limits, processes field mappings, normalizes phone numbers, and inserts contacts in batches.

**Authentication:** Required.

**Rate limit:** 3 requests/minute per user.

**Request format:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | CSV or Excel file (max 10 MB) |
| `mapping` | JSON string | Yes | Column mapping configuration |
| `listId` | string | No | Contact list to assign imported contacts to |

**Plan-based contact limits:**

| Plan | Max Contacts |
|------|-------------|
| Free | 50 |
| Starter | 5,000 |
| Growth | 15,000 |
| Business | 50,000 |
| Teams | 100,000 |
| Enterprise | 500,000 |

**Validation checks:**
1. File size must not exceed 10 MB
2. File must be CSV or Excel format
3. Subscription must be active or trialing
4. Import must not exceed the plan's contact limit
5. Maximum 10,000 rows per import

**Behavior:**
1. Parses CSV using `parseCSV()` from `src/lib/call-agent-utils.ts`
2. Maps rows to contact fields using the provided `ColumnMapping`
3. Normalizes phone numbers to E.164 format
4. Inserts contacts in batches with `company_id` and `source: 'csv_import'`
5. Returns import summary with success/error counts

**Response:**

```json
{
  "imported": 245,
  "errors": 3,
  "duplicates": 12,
  "total": 260,
  "errorDetails": [
    { "row": 15, "error": "Invalid phone number format" }
  ]
}
```

**Source file:** `src/app/api/contacts/import/route.ts`

---

### POST /api/contacts/export

Exports contacts to CSV format. Supports filtering to export a subset of contacts.

**Authentication:** Required.

**Request body:**

```json
{
  "listId": "uuid",
  "status": "active",
  "format": "csv"
}
```

**Response:** CSV file download.

**Source file:** `src/app/api/contacts/export/route.ts`

---

### POST /api/contacts/parse-csv

Parses a CSV file's headers and sample rows to help the user configure field mappings before import. Does not persist any data.

**Authentication:** Required.

**Request format:** `multipart/form-data` with the CSV file.

**Response:**

```json
{
  "headers": ["Name", "Email", "Phone", "Company", "City"],
  "sampleRows": [
    ["John Smith", "john@acme.com", "4155551234", "Acme Corp", "Springfield"],
    ["Jane Doe", "jane@widget.com", "4155559876", "Widget Inc", "Portland"]
  ],
  "totalRows": 260
}
```

**Source file:** `src/app/api/contacts/parse-csv/route.ts`

---

### GET /api/contacts/stats

Returns aggregate statistics about the company's contacts: total count, counts by status, counts by source, etc.

**Authentication:** Required.

**Source file:** `src/app/api/contacts/stats/route.ts`

---

### POST /api/contacts/ai-analyze

Uses AI (GPT-4o-mini) to analyze a contact and provide insights based on available data. Can suggest call strategies, identify potential issues, or summarize call history.

**Authentication:** Required.

**Source file:** `src/app/api/contacts/ai-analyze/route.ts`

---

### POST /api/contacts/ai-segment

Uses AI to segment contacts into groups based on attributes, call history, and behavioral patterns. Useful for creating targeted campaign lists.

**Authentication:** Required.

**Source file:** `src/app/api/contacts/ai-segment/route.ts`

---

## Contact Data Model

Key fields in the `contacts` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Foreign key to companies (RLS filter) |
| `contact_name` | text | Full name |
| `company_name` | text | Contact's company/organization |
| `email` | text | Email address |
| `phone_number` | text | Phone in E.164 format |
| `status` | text | `active`, `inactive`, `do_not_call`, `invalid`, `disconnected` |
| `address` | text | Street address |
| `city` | text | City |
| `state` | text | State/province |
| `zip_code` | text | Postal code |
| `source` | text | `manual`, `csv_import`, `hubspot`, `salesforce`, `pipedrive`, etc. |
| `list_id` | UUID | Foreign key to `contact_lists` |
| `tags` | text[] | PostgreSQL array of tag strings |
| `call_attempts` | integer | Number of call attempts made |
| `last_call_date` | timestamp | When the last call was made |
| `call_duration` | integer | Duration of last call in seconds |
| `notes` | text | Free-text notes |
| `custom_fields` | jsonb | Arbitrary key-value pairs |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update time |

---

## Contact Lists

Contacts can be organized into lists via the `list_id` column. Lists are managed through the `contact_lists` table. The `listId` filter parameter in the GET endpoint supports:
- A specific UUID to show contacts in that list
- The string `none` to show contacts not assigned to any list

---

## How Contacts Are Updated by AI Agents

When a call completes (via the [[Bland AI API]] webhook), the contact record is updated automatically:
- `call_attempts` is incremented
- `last_call_date` is set to the call completion time
- `call_duration` is set to the call length
- `status` may be updated based on AI analysis (e.g., `invalid` if the number is disconnected, `do_not_call` if requested)
- Data validation results (verified email, address, company name) are written back to the contact

---

## Source Files

- Contact routes: `src/app/api/contacts/`
- CSV parsing: `src/lib/call-agent-utils.ts`
- Plan contact limits: `src/app/api/contacts/import/route.ts` (`PLAN_CONTACT_LIMITS`)

## Related Notes

- [[Contact]]
- [[Company]]
- [[API Overview]]
- [[Bland AI API]]
- [[Integrations API]]
