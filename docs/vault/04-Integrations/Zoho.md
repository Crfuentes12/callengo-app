---
tags: [integration, crm]
---

# Zoho

CRM integration via OAuth 2.0. Available on **Business+** plans.

## Auth
- Type: OAuth 2.0
- Source: `src/lib/zoho/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `zoho_integrations` — OAuth connection
- `zoho_contact_mappings` — Contact ID mapping (UNIQUE on integration_id + zoho_contact_id)
- `zoho_sync_logs` — Sync history

## API Endpoints
`/api/integrations/zoho/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
