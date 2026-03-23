---
tags: [integration, scheduling]
aliases: [SimplyBook.me]
---

# SimplyBook

Appointment scheduling integration via API Key + Secret. Available on **Free+** plans.

## Auth
- Type: API Key + Secret (not OAuth)
- Source: `src/lib/simplybook/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `simplybook_integrations` — API credentials
- `simplybook_contact_mappings` — Contact mapping (UNIQUE on integration_id + sb_client_id)
- `simplybook_sync_logs` — Sync history
- `simplybook_webhook_logs` — Inbound webhook log

## API Endpoints
`/api/integrations/simplybook/` — connect, disconnect, status, contacts, import, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
- [[Appointment Confirmation]]
