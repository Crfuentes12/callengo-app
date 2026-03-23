---
tags: [integration, crm]
aliases: [Microsoft Dynamics, Dynamics]
---

# Dynamics 365

Microsoft Dynamics 365 CRM integration via OAuth 2.0 (Azure AD). Available on **Teams+** plans.

## Auth
- Type: OAuth 2.0 via Azure AD
- Source: `src/lib/dynamics/`
- Tokens encrypted via AES-256-GCM

## Database Tables
- `dynamics_integrations` — OAuth connection (includes `azure_tenant_id`)
- `dynamics_contact_mappings` — Contact ID mapping (UNIQUE on integration_id + dynamics_contact_id)
- `dynamics_sync_logs` — Sync history

## API Endpoints
`/api/integrations/dynamics/` — connect, disconnect, status, contacts, import, export, sync

## Related Notes
- [[Integrations API]]
- [[Contact]]
- [[Microsoft Outlook]]
