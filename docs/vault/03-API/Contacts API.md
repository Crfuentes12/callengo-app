---
tags: [api, contacts]
---

# Contacts API

CRUD endpoints for managing [[Contact]]s.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contacts` | List contacts (paginated, filterable by status, list, source) |
| POST | `/api/contacts` | Create single contact |
| PUT | `/api/contacts/[id]` | Update contact |
| DELETE | `/api/contacts/[id]` | Delete contact |
| POST | `/api/contacts/import` | Bulk CSV import |
| POST | `/api/contacts/export` | Export contacts to CSV |
| GET | `/api/contacts/lists` | List contact lists |
| POST | `/api/contacts/lists` | Create contact list |

## Related Notes

- [[Contact]]
- [[API Overview]]
