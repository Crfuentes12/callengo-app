---
tags: [integration, crm]
---

# Salesforce

CRM integration via OAuth 2.0. Available on **Teams+** plans.

## Auth
- Type: OAuth 2.0
- Source: `src/lib/salesforce/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `salesforce_integrations` — OAuth connection
- `salesforce_contact_mappings` — Contact ID mapping
- `salesforce_sync_logs` — Sync history

## API Endpoints
`/api/integrations/salesforce/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
