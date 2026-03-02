# Zoho CRM Integration - Comprehensive Documentation

## Overview

The Zoho CRM integration enables bidirectional sync between Callengo and Zoho CRM. This document covers the complete integration architecture, setup requirements, and deletion protection across all CRM integrations.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Environment Variables](#environment-variables)
3. [Database Schema](#database-schema)
4. [OAuth Flow](#oauth-flow)
5. [Sync Operations](#sync-operations)
6. [Deletion Protection](#deletion-protection)
7. [Feature Gating](#feature-gating)
8. [API Routes](#api-routes)
9. [Frontend Components](#frontend-components)
10. [All Integrations Comparison](#all-integrations-comparison)

---

## Architecture

### File Structure

```
src/
├── types/zoho.ts                          # TypeScript type definitions
├── lib/zoho/
│   ├── auth.ts                            # OAuth, token refresh, API client
│   ├── sync.ts                            # Inbound/outbound sync operations
│   └── index.ts                           # Public exports
├── app/api/integrations/zoho/
│   ├── connect/route.ts                   # GET  - Initiates OAuth flow
│   ├── callback/route.ts                  # GET  - Handles OAuth callback
│   ├── disconnect/route.ts                # POST - Soft-deletes integration
│   ├── sync/route.ts                      # POST - Triggers sync
│   ├── contacts/route.ts                  # GET  - Lists Zoho contacts/leads
│   └── users/route.ts                     # GET  - Lists Zoho org members
├── app/(app)/contacts/zoho/page.tsx        # Server page for /contacts/zoho
├── components/contacts/ZohoContactsPage.tsx # Client component for contacts UI
└── components/settings/ZohoOrgMembers.tsx   # Client component for team page

supabase/migrations/
└── 20260302_zoho_integration.sql           # Database tables, indexes, RLS
```

---

## Environment Variables

Add these to your `.env` or Vercel environment:

```env
ZOHO_CLIENT_ID=<your-zoho-client-id>
ZOHO_CLIENT_SECRET=<your-zoho-client-secret>
```

### How to Obtain

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a **Server-based Application**
3. Set the **Redirect URI** to: `https://your-domain.com/api/integrations/zoho/callback`
4. Note the Client ID and Client Secret
5. The integration requests these scopes:
   - `ZohoCRM.modules.ALL`
   - `ZohoCRM.settings.ALL`
   - `ZohoCRM.users.ALL`
   - `ZohoCRM.org.ALL`
   - `ZohoCRM.notifications.ALL`

---

## Database Schema

### Tables

#### `zoho_integrations`
Stores OAuth tokens and connection metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | FK to companies |
| user_id | UUID | FK to users |
| access_token | TEXT | OAuth access token |
| refresh_token | TEXT | OAuth refresh token |
| token_expires_at | TIMESTAMPTZ | Token expiration |
| zoho_user_id | TEXT | Zoho user ID |
| zoho_user_name | TEXT | Display name |
| zoho_user_email | TEXT | User email |
| zoho_org_name | TEXT | Organization name |
| zoho_org_id | TEXT | Organization ID |
| zoho_domain | TEXT | API domain (varies by data center) |
| is_active | BOOLEAN | Soft-delete flag |
| last_synced_at | TIMESTAMPTZ | Last sync timestamp |

#### `zoho_contact_mappings`
Maps Callengo contacts to Zoho contacts/leads.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | FK to companies |
| integration_id | UUID | FK to zoho_integrations |
| callengo_contact_id | UUID | FK to contacts |
| zoho_contact_id | TEXT | Zoho record ID |
| zoho_object_type | TEXT | 'Contacts' or 'Leads' |
| sync_direction | TEXT | 'inbound', 'outbound', or 'bidirectional' |
| last_synced_at | TIMESTAMPTZ | Last sync time |

#### `zoho_sync_logs`
Audit trail for all sync operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| integration_id | UUID | FK to zoho_integrations |
| sync_type | TEXT | 'full', 'selective', 'contacts', 'leads' |
| sync_direction | TEXT | 'inbound', 'outbound', 'bidirectional' |
| records_created | INT | Count of new records |
| records_updated | INT | Count of updated records |
| records_skipped | INT | Count of skipped records |
| status | TEXT | 'running', 'completed', 'completed_with_errors', 'failed' |

---

## OAuth Flow

1. **Connect**: User clicks "Connect Zoho CRM" -> redirected to Zoho OAuth consent
2. **Callback**: Zoho redirects back with auth code -> exchanged for tokens
3. **Profile**: User info and org info fetched from Zoho API
4. **Storage**: Tokens and metadata stored in `zoho_integrations`
5. **Refresh**: Tokens auto-refresh when within 5 minutes of expiry or on 401

### Token Management

- Proactive refresh: Tokens refresh before expiry (5-minute window)
- Reactive refresh: On 401 response, tokens are refreshed once
- Failure handling: If refresh fails, integration is marked `is_active = false`
- Reconnection: User can reconnect, which updates existing integration record

---

## Sync Operations

### Inbound (Zoho -> Callengo)

**Full Sync**: Fetches all contacts/leads from Zoho, deduplicates by email/phone, creates or updates in Callengo.

**Selective Sync**: Syncs specific contacts/leads by Zoho ID (used when user selects items from the UI).

**Deduplication Strategy**:
1. Check for existing mapping by Zoho ID
2. If new: check by email, then by phone in Callengo
3. Update existing contact if duplicate found
4. Create new contact if no match

### Outbound (Callengo -> Zoho)

**Notes Push**: After calls complete, call results are pushed as Notes on the Zoho contact/lead record. This includes:
- Call status and outcome
- Duration
- AI sentiment analysis
- Key points and follow-up info

**IMPORTANT**: Outbound sync only creates notes - it never modifies or deletes Zoho contact records.

---

## Deletion Protection

### CRITICAL RULE: Deleting from Callengo NEVER deletes from Zoho

This protection is built into the system at multiple levels:

1. **No DELETE API calls**: The sync code contains zero `DELETE` API calls to Zoho CRM
2. **Soft-delete on disconnect**: Disconnecting marks `is_active = false` - no data is removed
3. **Mapping preserved**: Contact mappings and sync logs persist after disconnect
4. **ON DELETE CASCADE**: The Supabase foreign key on `callengo_contact_id` only removes the mapping row when a Callengo contact is deleted - the Zoho contact remains untouched
5. **UI Warning**: The ZohoContactsPage displays a visible deletion protection notice

### Deletion Protection Audit - All Integrations

| Integration | Inbound Sync | Outbound Sync | Disconnect | Delete from Callengo | Delete from CRM |
|-------------|-------------|---------------|------------|---------------------|-----------------|
| **Salesforce** | Contacts & Leads -> Callengo | Not implemented | Soft-delete (is_active=false) | Only removes Callengo record | NEVER |
| **HubSpot** | Contacts -> Callengo | Not implemented | Soft-delete (is_active=false) | Only removes Callengo record | NEVER |
| **Pipedrive** | Persons -> Callengo | Activities + Notes push | Soft-delete (is_active=false) | Only removes Callengo record | NEVER |
| **Clio** | Contacts -> Callengo | Notes push only | Soft-delete (is_active=false) | Only removes Callengo record | NEVER |
| **Zoho CRM** | Contacts & Leads -> Callengo | Notes push | Soft-delete (is_active=false) | Only removes Callengo record | NEVER |

**Verification**: Grep across all `/src/lib/{salesforce,hubspot,pipedrive,clio,zoho}/` directories shows ZERO `.delete()` or `DELETE FROM` operations against CRM APIs.

---

## Feature Gating

Zoho CRM integration is available on **Business, Teams, and Enterprise** plans.

```typescript
const hasZohoAccess = ['business', 'teams', 'enterprise'].includes(planSlug);
```

Users on lower plans see:
- "Business+" badge in the Add Contact dropdown
- Upgrade CTA on the contacts/zoho page
- Upgrade CTA in the ZohoOrgMembers team component

---

## API Routes

### `GET /api/integrations/zoho/connect`
Initiates OAuth flow. Requires Business+ plan.
- Query params: `return_to` (redirect after auth), `return_url=json` (returns URL as JSON)

### `GET /api/integrations/zoho/callback`
Handles OAuth callback. Exchanges code for tokens, fetches user/org info, stores integration.

### `POST /api/integrations/zoho/disconnect`
Soft-deletes integration (sets `is_active = false`). Does NOT delete any Zoho data.

### `POST /api/integrations/zoho/sync`
Triggers sync operation.
- Body (optional): `{ ids: string[], type: 'contacts'|'leads'|'all', direction: 'inbound'|'outbound'|'bidirectional' }`
- No body = full inbound sync of all contacts and leads

### `GET /api/integrations/zoho/contacts`
Returns contacts and leads from Zoho CRM for the UI.
- Query params: `type` ('contacts'|'leads'|'all'), `limit` (default 200)

### `GET /api/integrations/zoho/users`
Returns Zoho org members for the Team page preview. Cross-references with Callengo users to show overlap.

---

## Frontend Components

### ZohoContactsPage (`/contacts/zoho`)
- Displays all Zoho contacts and leads in separate tabs
- Search and filter functionality
- Select individual items for selective sync
- Full sync button for complete import
- Deletion protection notice banner
- Expandable row details (title, department, location, etc.)

### ZohoOrgMembers (Team page)
- Shows Zoho CRM organization members
- Indicates which members are already in Callengo
- "Invite to Callengo" button for non-members
- Refresh button to reload member list
- Plan upgrade CTA for lower plans

### IntegrationsPage
- Zoho CRM card with connection status
- Connect/Disconnect/Sync buttons
- Shows account name, org name, last sync time when connected

### ContactsManager (Add Contact dropdown)
- Zoho CRM option in the Integrations section
- Links to /contacts/zoho when connected
- Links to OAuth connect flow when not connected
- Shows "Business+" badge when plan insufficient

---

## All Integrations Comparison

| Feature | Salesforce | HubSpot | Pipedrive | Clio | Zoho CRM |
|---------|-----------|---------|-----------|------|----------|
| **Sync Direction** | Inbound only | Inbound only | Bidirectional | Bidirectional (notes) | Bidirectional (notes) |
| **Objects Synced** | Contacts, Leads | Contacts | Persons | Contacts | Contacts, Leads |
| **Outbound Capability** | - | - | Activities, Notes | Notes | Notes |
| **Deduplication** | Email, Phone | Email, Phone | Email, Phone | Email, Phone | Email, Phone |
| **Deletion Protection** | YES | YES | YES | YES | YES |
| **OAuth Provider** | Salesforce | HubSpot | Pipedrive | Clio | Zoho |
| **Token Refresh** | Auto | Auto (5min window) | Auto | Auto (5min window) | Auto (5min window) |
| **Required Plan** | Teams+ | Business+ | Business+ | Teams+ | Business+ |
| **Team Page Integration** | Yes | Yes | Yes | Yes | Yes |
| **Selective Sync** | Yes | Yes | Yes | Yes | Yes |

---

## Troubleshooting

### Common Issues

1. **"Missing ZOHO_CLIENT_ID"**: Ensure environment variables are set
2. **"Token refresh failed"**: User needs to reconnect via OAuth
3. **"No active Zoho CRM integration"**: Integration was disconnected or deactivated
4. **API domain issues**: Zoho uses different API domains per data center (zohoapis.com, zohoapis.eu, etc.). The integration stores and uses the correct domain from the OAuth response.

### Verifying Deletion Protection

Run this command to verify no CRM integrations have delete operations:
```bash
grep -r "\.delete\(\)\|DELETE FROM" src/lib/{salesforce,hubspot,pipedrive,clio,zoho}/
# Should return: No matches found
```
