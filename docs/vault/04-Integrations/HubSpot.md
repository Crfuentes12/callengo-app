---
tags: [integration, crm]
---

# HubSpot

CRM integration via OAuth 2.0. Available on **Business+** plans.

## Auth
- Type: OAuth 2.0
- Source: `src/lib/hubspot/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `hubspot_integrations` — OAuth connection
- `hubspot_contact_mappings` — Contact ID mapping (UNIQUE on integration_id + hubspot_contact_id)
- `hubspot_sync_logs` — Sync history

## API Endpoints
`/api/integrations/hubspot/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
