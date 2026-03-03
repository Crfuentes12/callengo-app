# Callengo CRM Integrations - Comprehensive Documentation

## Overview

Callengo integrates with 5 CRM platforms, all with **bidirectional sync** and **deletion protection**. This document covers the complete architecture, setup, and behavior of every integration.

> **Note**: SimplyBook.me (booking/scheduling platform) is documented separately in [SIMPLYBOOK_INTEGRATION.md](./SIMPLYBOOK_INTEGRATION.md) as it uses credential-based auth rather than OAuth and serves a different purpose (calendar/booking vs CRM).

---

## Table of Contents

1. [Quick Comparison](#quick-comparison)
2. [Salesforce](#salesforce)
3. [HubSpot](#hubspot)
4. [Pipedrive](#pipedrive)
5. [Clio](#clio)
6. [Zoho CRM](#zoho-crm)
7. [Deletion Protection](#deletion-protection)
8. [Bidirectional Sync Architecture](#bidirectional-sync-architecture)
9. [Environment Variables](#environment-variables)
10. [Database Schema Pattern](#database-schema-pattern)
11. [Troubleshooting](#troubleshooting)

---

## Quick Comparison

| Feature | Salesforce | HubSpot | Pipedrive | Clio | Zoho CRM |
|---------|-----------|---------|-----------|------|----------|
| **Bidirectional** | YES | YES | YES | YES | YES |
| **Inbound Objects** | Contacts, Leads | Contacts | Persons | Contacts | Contacts, Leads |
| **Outbound Method** | Tasks (Call Log) | Notes (CRM v3) | Activities + Notes | Notes | Notes |
| **Deduplication** | Email, Phone | Email, Phone | Email, Phone | Email, Phone | Email, Phone |
| **Deletion Protection** | YES | YES | YES | YES | YES |
| **OAuth Provider** | Salesforce | HubSpot | Pipedrive | Clio | Zoho |
| **Token Refresh** | Auto (on 401) | Auto (5min window) | Auto | Auto (5min window) | Auto (5min window) |
| **Required Plan** | Teams+ | Business+ | Business+ | Teams+ | Business+ |
| **Team Page Preview** | Yes | Yes | Yes | Yes | Yes |
| **Selective Sync** | Yes | Yes | Yes | Yes | Yes |
| **Org Members View** | Yes | Yes (Owners) | Yes | Yes (Firm Users) | Yes |

---

## Salesforce

### Architecture
```
src/lib/salesforce/
├── auth.ts    # OAuth, token refresh, API client
├── sync.ts    # Inbound + Outbound sync
└── index.ts   # Public exports

src/app/api/integrations/salesforce/
├── connect/route.ts
├── callback/route.ts
├── disconnect/route.ts
├── sync/route.ts
├── contacts/route.ts
└── users/route.ts
```

### OAuth Scopes
```
api, refresh_token, id, full
```
The `full` scope grants complete API access including read AND write.

### Inbound Sync (Salesforce -> Callengo)
- **Contacts**: Fetches via SOQL query, maps to Callengo contacts
- **Leads**: Fetches via SOQL query, maps to Callengo contacts with `salesforce-lead` tag
- **Events**: Calendar events from Salesforce
- **Users**: Org users for Team page preview

### Outbound Sync (Callengo -> Salesforce)
- **Tasks**: Creates Salesforce Task records for call results
  - Endpoint: `POST /services/data/v59.0/sobjects/Task`
  - Includes: subject, description (full call log), WhoId (Contact/Lead), status, activity date
  - Maps call status to task status (completed calls -> "Completed", pending -> "Not Started")
- **Bulk Outbound**: `pushContactUpdatesToSalesforce()` iterates all mapped contacts, pushes tasks for recently updated ones

### Key Functions
| Function | Direction | Description |
|----------|-----------|-------------|
| `syncSalesforceContactsToCallengo()` | Inbound | Full contact sync |
| `syncSalesforceLeadsToCallengo()` | Inbound | Full lead sync |
| `syncSelectedSalesforceContacts()` | Inbound | Selective contact sync by IDs |
| `syncSelectedSalesforceLeads()` | Inbound | Selective lead sync by IDs |
| `createSalesforceTask()` | Outbound | Creates a Task on Contact/Lead |
| `pushCallResultToSalesforce()` | Outbound | Full call result -> Task |
| `pushContactUpdatesToSalesforce()` | Outbound | Bulk outbound sync |

---

## HubSpot

### Architecture
```
src/lib/hubspot/
├── auth.ts    # OAuth, token refresh, API client
├── sync.ts    # Inbound + Outbound sync
└── index.ts   # Public exports

src/app/api/integrations/hubspot/
├── connect/route.ts
├── callback/route.ts
├── disconnect/route.ts
├── sync/route.ts
├── contacts/route.ts
└── users/route.ts
```

### OAuth Scopes
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.deals.read
crm.objects.owners.read
crm.lists.read
oauth
```
Note: `contacts.write` scope is required for outbound sync.

### Inbound Sync (HubSpot -> Callengo)
- **Contacts**: Fetches via CRM v3 API with properties, pagination
- **Companies**: Reference data for contact enrichment
- **Owners**: For Team page org member preview

### Outbound Sync (Callengo -> HubSpot)
- **Notes**: Creates Note objects associated to HubSpot Contacts
  - Endpoint: `POST /crm/v3/objects/notes`
  - Uses association type 202 (Note to Contact)
  - Includes: timestamp, note body with full call details
- **Bulk Outbound**: `pushContactUpdatesToHubSpot()` iterates all mapped contacts

### Key Functions
| Function | Direction | Description |
|----------|-----------|-------------|
| `syncHubSpotContactsToCallengo()` | Inbound | Full contact sync |
| `syncSelectedHubSpotContacts()` | Inbound | Selective sync by IDs |
| `createHubSpotNote()` | Outbound | Creates a Note on Contact |
| `pushCallResultToHubSpot()` | Outbound | Full call result -> Note |
| `pushContactUpdatesToHubSpot()` | Outbound | Bulk outbound sync |

---

## Pipedrive

### Architecture
```
src/lib/pipedrive/
├── auth.ts    # OAuth, token refresh, API client
├── sync.ts    # Inbound + Outbound sync (most complete)
└── index.ts   # Public exports
```

### Inbound Sync (Pipedrive -> Callengo)
- **Persons**: Maps to Callengo contacts (name, email, phone, org)

### Outbound Sync (Callengo -> Pipedrive)
- **Contact Updates**: `PUT /api/v1/persons/{id}` - Updates Person with latest data
- **Activities**: `POST /api/v1/activities` - Creates call activities with duration, date, type
- **Notes**: `POST /api/v1/notes` - Creates HTML-formatted notes with call details
- **Call Results**: Full pipeline: Activity + Note + Person update per call
- **Scope Check**: Verifies `persons_write` and `activities_write` scopes before writing

### Key Functions
| Function | Direction | Description |
|----------|-----------|-------------|
| `syncPipedrivePersonsToCallengo()` | Inbound | Full person sync |
| `syncSelectedPipedrivePersons()` | Inbound | Selective sync by IDs |
| `pushContactToPipedrive()` | Outbound | Updates Person record |
| `createPipedriveActivity()` | Outbound | Creates call Activity |
| `createPipedriveNote()` | Outbound | Creates Note on Person |
| `pushCallResultToPipedrive()` | Outbound | Full call -> Activity+Note |
| `pushContactUpdatesToPipedrive()` | Outbound | Bulk outbound sync |

---

## Clio

### Architecture
```
src/lib/clio/
├── auth.ts    # OAuth, token refresh, API client
├── sync.ts    # Inbound + Outbound sync
└── index.ts   # Public exports
```

### Inbound Sync (Clio -> Callengo)
- **Contacts**: Person and Company types from Clio
- **Calendar Entries**: Events from Clio
- **Users**: Firm users for Team page preview

### Outbound Sync (Callengo -> Clio)
- **Notes**: Creates Contact Notes in Clio
  - Endpoint: `POST /notes.json`
  - Uses HTML-formatted content with full call details
  - Note: Clio's OAuth scopes don't include contacts:write, so only notes can be pushed
- **Call Results**: Maps call status to note subject, pushes full call details

### Key Functions
| Function | Direction | Description |
|----------|-----------|-------------|
| `syncClioContactsToCallengo()` | Inbound | Full contact sync |
| `syncSelectedClioContacts()` | Inbound | Selective sync by IDs |
| `createClioNote()` | Outbound | Creates Note on Contact |
| `pushCallResultToClio()` | Outbound | Full call -> Note |
| `pushContactUpdatesToClio()` | Outbound | Bulk outbound sync |

---

## Zoho CRM

### Architecture
```
src/lib/zoho/
├── auth.ts    # OAuth, token refresh, API client
├── sync.ts    # Inbound + Outbound sync
└── index.ts   # Public exports

src/app/api/integrations/zoho/
├── connect/route.ts
├── callback/route.ts
├── disconnect/route.ts
├── sync/route.ts
├── contacts/route.ts
└── users/route.ts
```

### OAuth Setup (Zoho API Console)
1. Go to https://api-console.zoho.com/
2. Create a **Server-based Application**
3. Set Redirect URI: `https://your-domain.com/api/integrations/zoho/callback`
4. Get Client ID and Client Secret
5. **IMPORTANT**: Scopes are NOT configured during app creation. They are specified in the authorization URL during the OAuth consent flow.

### OAuth Scopes (specified in auth URL)
```
ZohoCRM.modules.ALL
ZohoCRM.settings.ALL
ZohoCRM.users.ALL
ZohoCRM.org.ALL
ZohoCRM.notifications.ALL
```
These scopes are sent during authorization. The user will see these permissions and grant access. If you get `OAUTH_SCOPE_MISMATCH` or `INSUFFICIENT_PRIVILEGE`, the user needs to re-authorize.

### Zoho Data Centers
Zoho uses region-specific API domains. The correct domain is returned in the OAuth token response (`api_domain` field) and stored in `zoho_domain`. This is handled automatically.

| Region | Auth URL | API Domain |
|--------|----------|------------|
| US | accounts.zoho.com | www.zohoapis.com |
| EU | accounts.zoho.eu | www.zohoapis.eu |
| IN | accounts.zoho.in | www.zohoapis.in |
| AU | accounts.zoho.com.au | www.zohoapis.com.au |
| JP | accounts.zoho.jp | www.zohoapis.jp |

### Inbound Sync (Zoho -> Callengo)
- **Contacts**: Full contact sync with all fields (name, email, phone, title, department, account, address)
- **Leads**: Lead sync with status and source tracking
- **Users**: Org users for Team page preview and invitations
- **Incremental**: Uses `If-Modified-Since` header for delta syncs

### Outbound Sync (Callengo -> Zoho)
- **Notes**: Creates Note records in Zoho CRM
  - Endpoint: `POST /crm/v5/Notes`
  - Associated to Contact or Lead via `Parent_Id` and `se_module`
  - Includes: Note_Title, Note_Content with full call details

### Key Functions
| Function | Direction | Description |
|----------|-----------|-------------|
| `syncZohoContactsToCallengo()` | Inbound | Full contact sync |
| `syncZohoLeadsToCallengo()` | Inbound | Full lead sync |
| `syncSelectedZohoContacts()` | Inbound | Selective contact sync |
| `syncSelectedZohoLeads()` | Inbound | Selective lead sync |
| `pushCallResultToZoho()` | Outbound | Full call -> Note |
| `pushContactUpdatesToZoho()` | Outbound | Bulk outbound sync |

---

## Deletion Protection

### CRITICAL RULE: Deleting from Callengo NEVER deletes from ANY CRM

This protection is **universal across all 5 integrations** and enforced at multiple levels:

#### Level 1: No DELETE API Calls
Zero `DELETE` API calls exist in any integration code. Verified:
```bash
grep -r "\.delete\(\)\|DELETE FROM\|method.*DELETE" src/lib/{salesforce,hubspot,pipedrive,clio,zoho}/
# Returns: No matches
```

#### Level 2: Soft-Delete on Disconnect
Disconnecting any integration sets `is_active = false`. No data is removed from the CRM.

#### Level 3: Mapping Preservation
Contact mappings and sync logs persist after disconnect. If the user reconnects, previous mappings are still valid.

#### Level 4: Cascade Only on Callengo Side
The `ON DELETE CASCADE` on `callengo_contact_id` foreign key only removes the mapping row when a Callengo contact is deleted. The CRM record is untouched.

#### Level 5: UI Warning (Zoho)
The ZohoContactsPage displays a visible amber banner:
> "Deleting a contact from Callengo will **never** delete it from Zoho CRM. Your Zoho data is always safe."

### Per-Integration Verification

| Integration | DELETE API Calls | Disconnect Behavior | On Callengo Delete |
|-------------|-----------------|--------------------|--------------------|
| Salesforce | ZERO | `is_active = false` | Only removes mapping |
| HubSpot | ZERO | `is_active = false` | Only removes mapping |
| Pipedrive | ZERO | `is_active = false` | Only removes mapping |
| Clio | ZERO | `is_active = false` | Only removes mapping |
| Zoho CRM | ZERO | `is_active = false` | Only removes mapping |

---

## Bidirectional Sync Architecture

### How Outbound Sync Works

All integrations follow the same pattern for outbound sync:

1. **Webhook Trigger**: After a call completes (Bland webhook), the system checks for active CRM integrations
2. **Mapping Lookup**: Finds the CRM record ID from the contact mapping table
3. **Contact Data**: Loads the full Callengo contact with call results and AI analysis
4. **Push**: Creates a Task/Note/Activity in the CRM with formatted call data
5. **Direction Update**: Updates the mapping's `sync_direction` to `'bidirectional'`

### What Gets Pushed Outbound

Every outbound push includes (when available):
- Call status (completed, no_answer, voicemail, busy, failed)
- Call outcome
- Call duration
- AI Sentiment analysis
- Customer interest level
- Call category
- Outcome notes
- Key points (bullet list)
- Follow-up requirements
- AI Summary
- Answered by (human/voicemail)
- Manual notes

### Outbound Method Per CRM

| CRM | Method | API Endpoint | Object Type |
|-----|--------|-------------|-------------|
| Salesforce | Task | `POST /services/data/v59.0/sobjects/Task` | Task (Call type) |
| HubSpot | Note | `POST /crm/v3/objects/notes` | Note (assoc 202) |
| Pipedrive | Activity + Note | `POST /api/v1/activities` + `POST /api/v1/notes` | Activity + Note |
| Clio | Note | `POST /notes.json` | Contact Note |
| Zoho CRM | Note | `POST /crm/v5/Notes` | Note |

---

## Environment Variables

```env
# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_LOGIN_URL=https://login.salesforce.com  # Optional, for sandbox use test.salesforce.com

# HubSpot
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=

# Pipedrive
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=

# Clio
CLIO_CLIENT_ID=
CLIO_CLIENT_SECRET=

# Zoho CRM
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=

# App URL (used for OAuth redirect URIs)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Database Schema Pattern

All integrations follow the same 3-table pattern:

### `[provider]_integrations`
OAuth tokens, connection metadata, user/org info. Key columns:
- `company_id`, `user_id` (multi-tenant)
- `access_token`, `refresh_token`, `token_expires_at`
- Provider-specific fields (org name, user email, etc.)
- `is_active` (soft-delete flag)
- `last_synced_at`, `sync_token`

### `[provider]_contact_mappings`
Maps Callengo contacts to CRM records. Key columns:
- `callengo_contact_id` -> CRM record ID
- `sync_direction` ('inbound', 'outbound', 'bidirectional')
- `last_synced_at`
- Provider-specific object type field

### `[provider]_sync_logs`
Audit trail. Key columns:
- `sync_type`, `sync_direction`
- `records_created`, `records_updated`, `records_skipped`
- `status` ('running', 'completed', 'completed_with_errors', 'failed')
- `errors` (JSONB array)

---

## Troubleshooting

### Common Across All Integrations

| Error | Cause | Solution |
|-------|-------|----------|
| Token refresh failed | Refresh token revoked/expired | User needs to reconnect via OAuth |
| No active integration | Integration was disconnected | Reconnect from Integrations page |
| Missing env variables | Client ID/Secret not set | Add to `.env` or Vercel env |

### Salesforce-Specific
- **INVALID_SESSION_ID**: Token expired, should auto-refresh. If persistent, reconnect.
- **Sandbox vs Production**: Set `SALESFORCE_LOGIN_URL=https://test.salesforce.com` for sandbox.

### HubSpot-Specific
- **403 Forbidden**: Missing OAuth scopes. Ensure `crm.objects.contacts.write` is in the scope list.
- **Association Type 202**: This is the standard HubSpot-defined association for Note->Contact.

### Zoho-Specific
- **OAUTH_SCOPE_MISMATCH**: Scopes in the auth URL don't match what was granted. User must re-authorize.
- **API Domain mismatch**: Ensure you're using the domain from the token response, not hardcoded. Our code handles this automatically.
- **Data Center routing**: Zoho uses different endpoints per region. The `api_domain` from OAuth handles this.

### Pipedrive-Specific
- **Scope check failures**: The code checks for `persons_write` and `activities_write` scopes before attempting outbound sync. If scopes are missing, reconnect with full permissions.

### Clio-Specific
- **No contact write**: Clio's OAuth doesn't provide contacts:write scope for most apps. Outbound is limited to Notes only.

---

## Sources

- [Zoho CRM API Scopes](https://www.zoho.com/crm/developer/docs/api/v8/scopes.html)
- [Zoho OAuth Server-based Apps](https://www.zoho.com/accounts/protocol/oauth/web-server-applications.html)
- [HubSpot CRM v3 API](https://developers.hubspot.com/docs/api/crm/contacts)
- [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Pipedrive API v1](https://developers.pipedrive.com/docs/api/v1)
- [Clio API](https://app.clio.com/api/v4/documentation)
