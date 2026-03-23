---
tags: [integration, crm, legal]
---

# Clio

Legal practice management CRM integration via OAuth 2.0. Available on **Business+** plans.

## Auth
- Type: OAuth 2.0
- Source: `src/lib/clio/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `clio_integrations` — OAuth connection
- `clio_contact_mappings` — Contact ID mapping (UNIQUE on integration_id + clio_contact_id)
- `clio_sync_logs` — Sync history

## API Endpoints
`/api/integrations/clio/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
