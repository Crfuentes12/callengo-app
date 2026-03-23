---
tags: [api, integrations, crm]
---

# Integrations API

60+ endpoints covering OAuth flows, CRUD operations, and sync for 7 CRM providers + Google Sheets.

## Per-CRM Pattern

Each CRM follows the same endpoint pattern:

```
/api/integrations/{crm}/
├── auth/callback    POST  — OAuth callback (exchange code for tokens)
├── connect          POST  — Initiate OAuth connection
├── disconnect       POST  — Remove integration
├── status           GET   — Connection status
├── contacts         GET   — List CRM contacts
├── contacts/import  POST  — Import contacts from CRM
├── contacts/export  POST  — Export contacts to CRM
├── contacts/sync    POST  — Bi-directional sync
├── sync-logs        GET   — Sync history
```

## CRM Endpoints

| CRM | Path Prefix | Auth Type | Plan Required |
|-----|-------------|-----------|---------------|
| [[HubSpot]] | `/api/integrations/hubspot/` | OAuth 2.0 | Business+ |
| [[Salesforce]] | `/api/integrations/salesforce/` | OAuth 2.0 | Teams+ |
| [[Pipedrive]] | `/api/integrations/pipedrive/` | OAuth 2.0 | Business+ |
| [[Zoho]] | `/api/integrations/zoho/` | OAuth 2.0 | Business+ |
| [[Dynamics 365]] | `/api/integrations/dynamics/` | OAuth 2.0 (Azure) | Teams+ |
| [[Clio]] | `/api/integrations/clio/` | OAuth 2.0 | Business+ |
| [[SimplyBook]] | `/api/integrations/simplybook/` | API Key | Free+ |

## Google Sheets Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/google-sheets/connect` | OAuth connection |
| POST | `/api/integrations/google-sheets/disconnect` | Remove connection |
| GET | `/api/integrations/google-sheets/spreadsheets` | List spreadsheets |
| POST | `/api/integrations/google-sheets/link` | Link sheet to contacts |
| POST | `/api/integrations/google-sheets/sync` | Sync contacts |
| GET | `/api/integrations/google-sheets/status` | Connection status |

## OAuth Token Security

All OAuth tokens are encrypted with AES-256-GCM before storage:
- `encryptToken()` on save
- `decryptToken()` on read (backward-compatible with plaintext)
- Requires `TOKEN_ENCRYPTION_KEY` env var (64 hex chars)

## UI Component

`src/components/integrations/IntegrationsPage.tsx` (~2,300 lines) — handles all integration management UI.

## Related Notes

- [[API Overview]]
- [[Contact]]
- [[HubSpot]], [[Salesforce]], [[Pipedrive]], [[Zoho]], [[Dynamics 365]], [[Clio]], [[SimplyBook]]
