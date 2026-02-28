# Pipedrive CRM Integration - Complete Setup Guide

## Overview

This document provides a comprehensive guide to configuring and deploying the Pipedrive CRM integration for Callengo. The integration follows the same architectural pattern as the existing Salesforce and HubSpot integrations.

### What this integration provides:
- **OAuth2 Authentication** with Pipedrive (Authorization Code flow)
- **Contact Import** from Pipedrive Persons into Callengo contacts
- **Organization Data** enrichment from Pipedrive Organizations
- **Deal Tracking** metadata attached to imported contacts
- **Team Member Preview** showing Pipedrive users with invite-to-Callengo functionality
- **Selective & Full Sync** with deduplication by email/phone
- **Sync Logging** with full audit trail
- **Plan Gating** (Business, Teams, Enterprise plans only)

---

## 1. Pipedrive Developer App Setup

### Step 1: Create a Pipedrive Developer App

1. Go to [Pipedrive Developer Hub](https://developers.pipedrive.com/)
2. Log in with your Pipedrive account
3. Navigate to **Tools & Apps** > **Marketplace Manager** > **Create New App**
4. Select **"Create a Private App"** (or Public App if distributing)
5. Fill in the basic information:
   - **App Name**: `Callengo CRM Integration`
   - **Description**: `Sync contacts and CRM data between Pipedrive and Callengo`

### Step 2: Configure OAuth Settings

1. In your app settings, go to **OAuth & Access Scopes**
2. Set the **Callback URL**:
   - Production: `https://your-domain.com/api/integrations/pipedrive/callback`
   - Development: `http://localhost:3000/api/integrations/pipedrive/callback`
3. Note your **Client ID** and **Client Secret**

### Step 3: Required Scopes

Pipedrive OAuth uses implicit scopes based on the app type. The integration accesses:
- Persons (contacts) - read
- Organizations - read
- Deals - read
- Activities - read
- Users - read

No explicit scope selection is needed for Pipedrive OAuth - access is granted based on the user's permissions in their Pipedrive account.

---

## 2. Environment Variables

Add these to your `.env.local` (development) and production environment:

```env
# Pipedrive OAuth Credentials
PIPEDRIVE_CLIENT_ID=your_pipedrive_client_id_here
PIPEDRIVE_CLIENT_SECRET=your_pipedrive_client_secret_here

# Already existing (should be set)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Environment Variable Details:

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `PIPEDRIVE_CLIENT_ID` | OAuth Client ID | Pipedrive Developer Hub > Your App > OAuth & Access Scopes |
| `PIPEDRIVE_CLIENT_SECRET` | OAuth Client Secret | Same location as Client ID |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | Your deployment URL |

---

## 3. Database Migration

The migration file is at: `supabase/migrations/20260228000002_add_pipedrive_integration.sql`

### Tables Created:

#### `pipedrive_integrations`
Stores OAuth tokens and connection metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | FK to companies |
| `user_id` | UUID | FK to auth.users |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `expires_at` | TIMESTAMPTZ | Token expiry time |
| `pd_company_id` | TEXT | Pipedrive company/account ID |
| `pd_company_name` | TEXT | Pipedrive company name |
| `pd_company_domain` | TEXT | Pipedrive subdomain |
| `pd_user_id` | TEXT | Pipedrive user ID |
| `pd_user_email` | TEXT | Pipedrive user email |
| `pd_user_name` | TEXT | Pipedrive user display name |
| `api_domain` | TEXT | Pipedrive API domain (region-specific) |
| `is_active` | BOOLEAN | Whether integration is active |
| `last_synced_at` | TIMESTAMPTZ | Last sync timestamp |
| `scopes` | TEXT[] | Granted scopes |
| `raw_profile` | JSONB | Full user profile from Pipedrive |

#### `pipedrive_contact_mappings`
Maps Pipedrive Person records to Callengo contacts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | FK to companies |
| `integration_id` | UUID | FK to pipedrive_integrations |
| `callengo_contact_id` | UUID | FK to contacts |
| `pd_person_id` | TEXT | Pipedrive Person ID |
| `pd_object_type` | TEXT | 'Person' or 'Organization' |
| `sync_direction` | TEXT | 'inbound', 'outbound', 'bidirectional' |
| `last_synced_at` | TIMESTAMPTZ | Last sync for this mapping |

#### `pipedrive_sync_logs`
Audit trail of sync operations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | FK to companies |
| `integration_id` | UUID | FK to pipedrive_integrations |
| `sync_type` | TEXT | 'full', 'selective', 'persons', etc. |
| `sync_direction` | TEXT | 'inbound' |
| `records_created` | INTEGER | Count of new records |
| `records_updated` | INTEGER | Count of updated records |
| `records_skipped` | INTEGER | Count of skipped records |
| `errors` | JSONB | Array of error messages |
| `status` | TEXT | 'running', 'completed', 'failed', etc. |

### Running the Migration:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260228000002_add_pipedrive_integration.sql
```

### RLS Policies:
All three tables have Row Level Security enabled with policies that scope access to the user's company_id. The `service_role` has full access for server-side operations.

---

## 4. Files Created

### New Files (21 total):

#### Types
- `src/types/pipedrive.ts` - Complete TypeScript type definitions

#### Library
- `src/lib/pipedrive/auth.ts` - OAuth flow, token management, API client
- `src/lib/pipedrive/sync.ts` - Data fetching and sync operations
- `src/lib/pipedrive/index.ts` - Barrel exports

#### API Routes
- `src/app/api/integrations/pipedrive/connect/route.ts` - Initiates OAuth
- `src/app/api/integrations/pipedrive/callback/route.ts` - Handles OAuth callback
- `src/app/api/integrations/pipedrive/contacts/route.ts` - Returns Pipedrive persons
- `src/app/api/integrations/pipedrive/sync/route.ts` - Triggers sync (full/selective)
- `src/app/api/integrations/pipedrive/users/route.ts` - Returns org members
- `src/app/api/integrations/pipedrive/disconnect/route.ts` - Soft-disconnect

#### Pages
- `src/app/(app)/contacts/pipedrive/page.tsx` - Server page with plan gating

#### Components
- `src/components/contacts/PipedriveContactsPage.tsx` - Main contacts UI
- `src/components/contacts/PipedriveContactsBanner.tsx` - Connection status banner
- `src/components/settings/PipedriveOrgMembers.tsx` - Team page org members

#### Database
- `supabase/migrations/20260228000002_add_pipedrive_integration.sql`

### Modified Files (4 total):

- `src/app/(app)/contacts/page.tsx` - Added Pipedrive connection check + props
- `src/components/contacts/ContactsManager.tsx` - Added Pipedrive to integration dropdown
- `src/app/(app)/team/page.tsx` - Added PipedriveOrgMembers component
- `src/app/api/integrations/status/route.ts` - Added Pipedrive status to aggregated endpoint

---

## 5. Pipedrive API Reference

### Authentication Flow

1. **Initiate**: `GET /api/integrations/pipedrive/connect`
   - Generates state parameter (base64url-encoded JSON)
   - Redirects to `https://oauth.pipedrive.com/oauth/authorize`

2. **Callback**: `GET /api/integrations/pipedrive/callback`
   - Receives `code` and `state` parameters
   - Exchanges code at `https://oauth.pipedrive.com/oauth/token`
   - Uses Basic Auth (client_id:client_secret base64 encoded)
   - Fetches user info from `/api/v1/users/me`
   - Stores integration in `pipedrive_integrations`

3. **Token Refresh**: Automatic
   - Tokens expire (typically 1 hour)
   - Proactive refresh 5 minutes before expiry
   - Retry on 401 with automatic refresh
   - If refresh fails, integration is marked inactive

### Key API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/persons` | GET | List all persons (contacts) |
| `/api/v1/persons/{id}` | GET | Get specific person |
| `/api/v1/organizations` | GET | List organizations |
| `/api/v1/deals` | GET | List deals |
| `/api/v1/activities` | GET | List activities |
| `/api/v1/users` | GET | List account users |
| `/api/v1/users/me` | GET | Get current user info |

### Pagination

Pipedrive uses offset-based pagination:
```json
{
  "additional_data": {
    "pagination": {
      "start": 0,
      "limit": 100,
      "more_items_in_collection": true,
      "next_start": 100
    }
  }
}
```

### Important: API Domain

Pipedrive returns an `api_domain` in the token response (e.g., `https://api.pipedrive.com` or a region-specific domain). All API calls must use this domain. It's stored in the `api_domain` column.

---

## 6. Data Mapping

### Pipedrive Person -> Callengo Contact

| Pipedrive Field | Callengo Field |
|----------------|----------------|
| `name` | `contact_name` |
| `email[0].value` (primary) | `email` |
| `phone[0].value` (primary) | `phone_number` |
| `org_id.name` | `company_name` |
| - | `source` = 'pipedrive' |
| - | `tags` = ['pipedrive-import'] |

#### Custom Fields (stored in `custom_fields` JSONB):
- `pd_person_id` - Pipedrive Person ID
- `pd_first_name` - First name
- `pd_last_name` - Last name
- `pd_org_id` - Organization ID
- `pd_org_name` - Organization name
- `pd_owner_name` - Owner name
- `pd_open_deals` - Open deals count
- `pd_closed_deals` - Closed deals count
- `pd_label` - Person label

### Deduplication Logic

When syncing a Pipedrive Person to Callengo:
1. Check `pipedrive_contact_mappings` for existing mapping
2. If no mapping, check by email match in contacts table
3. If no email match, check by phone number match
4. If duplicate found: update existing contact
5. If no duplicate: create new contact
6. Always create/update mapping record

---

## 7. Plan Gating

The Pipedrive integration is available on **Business, Teams, and Enterprise** plans only.

Plan check is enforced at three levels:
1. **API Route** (`/api/integrations/pipedrive/connect`) - Returns 403 if plan insufficient
2. **Server Page** (`/contacts/pipedrive/page.tsx`) - Redirects to contacts with upgrade param
3. **Components** - Show upgrade CTAs when plan doesn't qualify

```typescript
const hasPipedriveAccess = ['business', 'teams', 'enterprise'].includes(planSlug);
```

---

## 8. Testing Checklist

### OAuth Flow
- [ ] Connect button redirects to Pipedrive OAuth
- [ ] Callback successfully exchanges code for tokens
- [ ] User info is fetched and stored correctly
- [ ] Reconnecting updates existing integration (upsert)
- [ ] Token refresh works when token expires
- [ ] Disconnect marks integration as inactive

### Contact Sync
- [ ] Full sync imports all persons from Pipedrive
- [ ] Selective sync imports only selected persons
- [ ] Deduplication works correctly (email, phone)
- [ ] Existing mappings are updated, not duplicated
- [ ] Sync logs are created and updated correctly
- [ ] `last_synced_at` is updated on integration

### UI
- [ ] Pipedrive appears in "Add Contacts" dropdown
- [ ] `/contacts/pipedrive` page loads correctly
- [ ] Search/filter works on persons list
- [ ] Select all / individual selection works
- [ ] Sync status badges show correctly
- [ ] Expanded row shows person details
- [ ] Toast notifications appear for sync results

### Team Page
- [ ] Pipedrive org members section appears
- [ ] Members are loaded from Pipedrive API
- [ ] Callengo overlap detection works
- [ ] Invite button sends team invitation
- [ ] Loading/error states display correctly

### Plan Gating
- [ ] Free/Starter plans see upgrade CTA
- [ ] Business+ plans can access the integration
- [ ] API routes return 403 for insufficient plans

### Integration Status
- [ ] `/api/integrations/status` includes Pipedrive
- [ ] Integrations page shows Pipedrive connection status

---

## 9. Troubleshooting

### Common Issues

**"Missing PIPEDRIVE_CLIENT_ID or PIPEDRIVE_CLIENT_SECRET"**
- Ensure environment variables are set in `.env.local` and deployed environment

**OAuth callback fails with "invalid_state"**
- The state parameter may have expired or been tampered with
- Ensure `NEXT_PUBLIC_APP_URL` matches the callback URL registered in Pipedrive

**Token refresh fails**
- The refresh token may have been revoked
- User needs to reconnect via `/api/integrations/pipedrive/connect`

**"No active Pipedrive integration found" (404)**
- Check `pipedrive_integrations` table for the user's company
- Ensure `is_active` is `true`

**API calls return 401 after reconnect**
- May be using stale token from cache
- Token is refreshed on next request automatically

**Persons not appearing in sync**
- Check Pipedrive account has persons
- Verify API domain is correct (region-specific)
- Check Pipedrive user has permission to view persons

---

## 10. Architecture Diagram

```
User clicks "Connect Pipedrive"
        |
        v
GET /api/integrations/pipedrive/connect
        |
        v (redirect)
https://oauth.pipedrive.com/oauth/authorize
        |
        v (user grants permission)
GET /api/integrations/pipedrive/callback?code=xxx&state=yyy
        |
        v
Exchange code for tokens (POST oauth.pipedrive.com/oauth/token)
        |
        v
Fetch user info (GET api.pipedrive.com/api/v1/users/me)
        |
        v
Store in pipedrive_integrations table
        |
        v (redirect)
/contacts/pipedrive?integration=pipedrive&status=connected
        |
        v
PipedriveContactsPage component loads
        |
        v
GET /api/integrations/pipedrive/contacts (fetches persons from Pipedrive API)
        |
        v
User selects contacts and clicks "Sync"
        |
        v
POST /api/integrations/pipedrive/sync
        |
        v
syncPipedrivePersonsToCallengo() / syncSelectedPipedrivePersons()
        |
        v
Creates/updates records in contacts table + pipedrive_contact_mappings
        |
        v
Updates pipedrive_sync_logs with results
```
