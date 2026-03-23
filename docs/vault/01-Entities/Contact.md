---
tags: [entity, core, crm, contact]
aliases: [Lead, Prospect, Contact Record]
---

# Contact

A person that AI [[Agent]]s call. Contacts belong to a [[Company]] and optionally to a contact list. They are the primary data entity that flows through the entire Callengo pipeline: imported from a CRM or CSV, called by an agent, analyzed by AI, updated with results, and synced back to the originating CRM.

---

## Database Table: `contacts`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `uuid_generate_v4()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `list_id` | UUID FK → `contact_lists` | — | YES | SET NULL on delete |
| `company_name` | TEXT | — | NO | Contact's employer/company name |
| `contact_name` | TEXT | — | YES | Full name |
| `email` | TEXT | — | YES | Email address |
| `phone_number` | TEXT | — | NO | E.164 format phone number |
| `original_phone_number` | TEXT | — | YES | Pre-normalization phone number |
| `address` | TEXT | — | YES | Street address |
| `city` | TEXT | — | YES | City |
| `state` | TEXT | — | YES | State/province |
| `zip_code` | TEXT | — | YES | Postal code |
| `status` | TEXT CHECK | `'Pending'` | NO | See statuses below |
| `call_outcome` | TEXT | `'Not Called'` | YES | Last call result |
| `last_call_date` | TIMESTAMPTZ | — | YES | Last time called |
| `call_attempts` | INTEGER | `0` | YES | Total call count |
| `call_id` | TEXT | — | YES | Last Bland AI call ID |
| `call_status` | TEXT | — | YES | Last call status |
| `call_duration` | INTEGER | — | YES | Last call duration (seconds) |
| `recording_url` | TEXT | — | YES | Last call recording |
| `transcript_text` | TEXT | — | YES | Last call transcript |
| `transcripts` | JSONB | — | YES | All transcripts history |
| `analysis` | JSONB | — | YES | AI analysis results |
| `call_metadata` | JSONB | — | YES | Additional call data |
| `notes` | TEXT | — | YES | Free-text notes |
| `is_test_call` | BOOLEAN | `false` | YES | Test call flag |
| `tags` | TEXT[] | — | YES | Tag array for segmentation |
| `custom_fields` | JSONB | — | YES | Extensible custom data |
| `appointment_date` | TIMESTAMPTZ | — | YES | Scheduled appointment |
| `appointment_confirmed` | BOOLEAN | `false` | YES | Confirmation status |
| `appointment_rescheduled` | BOOLEAN | `false` | YES | Rescheduling flag |
| `meeting_scheduled` | BOOLEAN | `false` | YES | Meeting scheduled flag |
| `video_link` | TEXT | — | YES | Video meeting URL |
| `no_show_count` | INTEGER | `0` | YES | No-show tracking |
| `source` | TEXT | `'manual'` | YES | Import source (see below) |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |
| `updated_at` | TIMESTAMPTZ | `now()` | YES | |

### Contact Sources

| Source | Description |
|--------|-------------|
| `manual` | Created manually in the UI |
| `csv` | Imported via CSV/Excel upload |
| `google_sheets` | Imported from [[Google Sheets]] |
| `hubspot` | Synced from [[HubSpot]] |
| `salesforce` | Synced from [[Salesforce]] |
| `pipedrive` | Synced from [[Pipedrive]] |
| `zoho` | Synced from [[Zoho]] |
| `dynamics` | Synced from [[Dynamics 365]] |
| `clio` | Synced from [[Clio]] |
| `simplybook` | Synced from [[SimplyBook]] |
| `api` | Created via API/webhook |

### Contact Statuses (CHECK constraint)

| Status | Meaning | Set By |
|--------|---------|--------|
| `Pending` | Imported, not yet called | Import/creation |
| `Called` | Call attempted | Dispatch |
| `Completed` | Successfully reached and processed | Webhook |
| `Failed` | Call failed (technical) | Webhook |
| `No Answer` | No pickup | Webhook |
| `Busy` | Line busy | Webhook |
| `Voicemail` | Voicemail detected | Webhook |
| `Callback` | Requested callback | AI analysis |
| `Qualified` | Lead qualified (hot/warm) | AI analysis |
| `Disqualified` | Lead disqualified (cold) | AI analysis |
| `Do Not Call` | Contact opted out | AI analysis / manual |
| `Invalid Number` | Bad phone number | Webhook |

### Indexes

| Index | Columns | Condition | Purpose |
|-------|---------|-----------|---------|
| `contacts_company_id_idx` | `company_id` | — | Company filtering |
| `contacts_status_idx` | `status` | — | Status filtering |
| `contacts_phone_idx` | `phone_number` | — | Phone lookup |
| `idx_contacts_appointment_date` | `appointment_date` | `WHERE NOT NULL` | Appointment queries |
| `idx_contacts_list_id` | `list_id` | `WHERE NOT NULL` | List filtering |
| `idx_contacts_company_status` | `(company_id, status)` | — | Dashboard queries |
| `idx_contacts_source` | `(company_id, source)` | `WHERE source != 'manual'` | CRM source filtering |
| `idx_contacts_company_email` | `(company_id, email)` | `WHERE NOT NULL` | Email deduplication |
| `idx_contacts_company_phone` | `(company_id, phone_number)` | `WHERE NOT NULL` | Phone deduplication |

### RLS Policies

- `contacts_all` — Company-scoped access (all operations)
- `contacts_service` — Service role bypass

### Triggers

- `set_updated_at` → `handle_updated_at()` — Auto-update `updated_at` on changes
- `update_contacts_updated_at` → `update_updated_at_column()` — Additional timestamp trigger

---

## Contact Lists: `contact_lists`

Contact lists allow grouping contacts for organizational purposes. A contact can belong to at most one list.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `company_id` | UUID FK → `companies` | — | CASCADE on delete |
| `name` | TEXT | — | List name |
| `description` | TEXT | — | Optional description |
| `color` | TEXT | `'#3b82f6'` | Display color (hex) |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `updated_at` | TIMESTAMPTZ | `now()` | |

**RLS:** `contact_lists_all` (company-scoped) + `contact_lists_service` (service role bypass)

---

## CRM Contact Mappings

Each CRM integration maintains a mapping table that links Callengo contacts to their CRM counterparts. This enables bi-directional sync: changes in Callengo can be pushed to the CRM, and vice versa. All mapping tables follow the same pattern with CRM-specific ID fields:

| CRM | Mapping Table | CRM ID Field | See |
|-----|--------------|-------------|-----|
| [[HubSpot]] | `hubspot_contact_mappings` | `hs_contact_id`, `hs_object_type` | [[HubSpot]] |
| [[Salesforce]] | `salesforce_contact_mappings` | `sf_contact_id`, `sf_lead_id`, `sf_object_type` | [[Salesforce]] |
| [[Pipedrive]] | `pipedrive_contact_mappings` | `pd_person_id`, `pd_object_type` | [[Pipedrive]] |
| [[Zoho]] | `zoho_contact_mappings` | `zoho_contact_id`, `zoho_object_type` | [[Zoho]] |
| [[Dynamics 365]] | `dynamics_contact_mappings` | `dynamics_contact_id`, `dynamics_entity_type` | [[Dynamics 365]] |
| [[Clio]] | `clio_contact_mappings` | `clio_contact_id`, `clio_contact_type` | [[Clio]] |
| [[SimplyBook]] | `simplybook_contact_mappings` | `sb_client_id` | [[SimplyBook]] |

Each mapping table has: `company_id`, `integration_id` (FK to CRM integration), `callengo_contact_id` (FK to contacts), `last_synced_at`, `sync_direction` (inbound/outbound/bidirectional), and UNIQUE constraint on `(integration_id, crm_id)`.

---

## API Endpoints

See [[Contacts API]] for full documentation.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts (paginated, filterable by status, source, list_id, search) |
| POST | `/api/contacts` | Create single contact |
| PUT | `/api/contacts/[id]` | Update contact |
| DELETE | `/api/contacts/[id]` | Delete contact |
| POST | `/api/contacts/import` | Bulk CSV/Excel import with phone normalization |
| POST | `/api/contacts/export` | Export contacts to CSV |
| GET/POST/DELETE | `/api/contacts/lists` | Contact list management |

---

## Related Notes

- [[Company]] — Contacts belong to companies
- [[Call]] — Calls target contacts
- [[Campaign]] — Campaigns dispatch calls to contact sets
- [[Follow-Up]] — Follow-ups reference contacts
- [[Voicemail]] — Voicemail logs reference contacts
- [[Calendar Event]] — Calendar events link to contacts
- [[Contacts API]] — API endpoints
