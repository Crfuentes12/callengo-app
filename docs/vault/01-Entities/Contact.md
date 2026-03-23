---
tags: [entity, core, crm]
aliases: [Lead, Prospect]
---

# Contact

A person that AI agents call. Contacts belong to a [[Company]] and optionally to a contact list.

## Database Table: `contacts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| list_id | UUID FK → contact_lists | SET NULL |
| name | TEXT | |
| email | TEXT | Indexed (company_id, email) |
| phone_number | TEXT | Indexed (company_id, phone) |
| address, city, state, zip_code, country | TEXT | Physical address fields |
| company_name | TEXT | Contact's employer |
| job_title | TEXT | |
| source | TEXT | See sources below |
| status | TEXT CHECK | See statuses below |
| no_show_count | INTEGER | Appointment no-show tracking |
| appointment_date | TIMESTAMPTZ | Indexed |
| appointment_confirmed | BOOLEAN | |
| appointment_rescheduled | BOOLEAN | |
| meeting_scheduled | BOOLEAN | |
| video_link | TEXT | |
| notes | TEXT | |
| last_called_at | TIMESTAMPTZ | |

## Contact Sources

`manual`, `csv`, `salesforce`, `hubspot`, `pipedrive`, `zoho`, `dynamics`, `clio`, `simplybook`, `google_sheets`, `api`

## Contact Statuses

| Status | Meaning |
|--------|---------|
| `new` | Just imported, not yet called |
| `pending` | Queued for calling |
| `called` | Call attempted |
| `completed` | Successfully reached and processed |
| `failed` | Call failed (technical) |
| `no_answer` | No pickup |
| `busy` | Line busy |
| `voicemail` | Voicemail detected |
| `callback` | Requested callback |
| `qualified` | Lead qualified (hot/warm) |
| `disqualified` | Lead disqualified (cold) |
| `do_not_call` | Opted out |
| `invalid_number` | Bad phone number |

## Contact Lists: `contact_lists`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| name | TEXT | |
| description | TEXT | |
| record_count | INTEGER | Default 0 |

## CRM Contact Mappings

Each CRM has a mapping table linking Callengo contacts to CRM records:
- `hubspot_contact_mappings` → [[HubSpot]]
- `salesforce_contact_mappings` → [[Salesforce]]
- `pipedrive_contact_mappings` → [[Pipedrive]]
- `zoho_contact_mappings` → [[Zoho]]
- `dynamics_contact_mappings` → [[Dynamics 365]]
- `clio_contact_mappings` → [[Clio]]
- `simplybook_contact_mappings` → [[SimplyBook]]

## API Endpoints

- `GET /api/contacts` — List contacts (paginated, filterable)
- `POST /api/contacts` — Create contact
- `PUT /api/contacts/[id]` — Update contact
- `DELETE /api/contacts/[id]` — Delete contact
- `POST /api/contacts/import` — Bulk CSV import
- `POST /api/contacts/export` — Export contacts

See [[Contacts API]] for details.

## Related Notes

- [[Company]]
- [[Call]]
- [[Campaign]]
- [[Follow-Up]]
