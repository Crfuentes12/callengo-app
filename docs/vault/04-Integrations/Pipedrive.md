---
tags: [integration, crm]
---

# Pipedrive

CRM integration via OAuth 2.0. Available on **Business+** plans.

## Auth
- Type: OAuth 2.0
- Source: `src/lib/pipedrive/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `pipedrive_integrations` — OAuth connection
- `pipedrive_contact_mappings` — Contact ID mapping
- `pipedrive_sync_logs` — Sync history

## API Endpoints
`/api/integrations/pipedrive/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
