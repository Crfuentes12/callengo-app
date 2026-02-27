# HubSpot Integration - Complete Setup Guide

## Overview

The HubSpot integration allows Callengo users on **Business plan and above** to:
- Connect their HubSpot account via OAuth 2.0
- Import contacts from HubSpot into Callengo
- View and selectively sync HubSpot contacts
- Preview HubSpot org members (owners) on the Team page
- Invite HubSpot team members to Callengo directly

The integration mirrors the existing Salesforce integration architecture.

---

## 1. HubSpot Developer App Setup

### Create a HubSpot App

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new **App** (or use an existing one)
3. Navigate to **Auth** tab in your app settings
4. Configure the following:

### OAuth Settings

| Setting | Value |
|---------|-------|
| **Redirect URL** | `https://app.callengo.com/api/integrations/hubspot/callback` |
| **Redirect URL (dev)** | `http://localhost:3000/api/integrations/hubspot/callback` |

### Required Scopes

Add these scopes to your HubSpot app:

| Scope | Description |
|-------|-------------|
| `crm.objects.contacts.read` | Read contacts |
| `crm.objects.contacts.write` | Write contacts (for future bidirectional sync) |
| `crm.objects.companies.read` | Read companies |
| `crm.objects.deals.read` | Read deals |
| `crm.objects.owners.read` | Read owners (org members) |
| `crm.lists.read` | Read contact lists |
| `oauth` | Required for OAuth flow |

### Get Credentials

From your HubSpot app settings, copy:
- **Client ID** (App ID)
- **Client Secret**

---

## 2. Environment Variables

Add these to your `.env.local`:

```env
# HubSpot OAuth
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret

# Existing (ensure these are set)
NEXT_PUBLIC_APP_URL=https://app.callengo.com  # or http://localhost:3000 for dev
```

---

## 3. Database Migration

Run the Supabase migration to create the HubSpot tables:

```bash
supabase db push
```

Or apply manually in Supabase SQL Editor:

**File:** `supabase/migrations/20260227000002_add_hubspot_integration.sql`

This creates 3 tables:

| Table | Purpose |
|-------|---------|
| `hubspot_integrations` | OAuth tokens, HubSpot account info, connection status |
| `hubspot_contact_mappings` | Maps HubSpot Contact IDs to Callengo contact IDs |
| `hubspot_sync_logs` | Audit trail of sync operations |

All tables have:
- RLS policies (company-scoped access)
- Auto-update triggers for `updated_at`
- Service role grants for server-side operations
- Proper indexes for performance

---

## 4. Architecture

### Files Created

```
src/
  types/
    hubspot.ts                          # TypeScript type definitions
  lib/
    hubspot/
      auth.ts                           # OAuth flow, token management, API client
      sync.ts                           # Contact fetch & sync operations
      index.ts                          # Barrel exports
  app/
    api/
      integrations/
        hubspot/
          connect/route.ts              # Initiate OAuth flow
          callback/route.ts             # Handle OAuth callback
          disconnect/route.ts           # Disconnect integration
          contacts/route.ts             # Fetch HubSpot contacts
          sync/route.ts                 # Trigger contact sync
          users/route.ts                # Fetch HubSpot org members
    (app)/
      contacts/
        hubspot/page.tsx                # HubSpot contacts sub-page (server)
  components/
    contacts/
      HubSpotContactsPage.tsx           # HubSpot contacts UI (client)
      HubSpotContactsBanner.tsx         # Banner for contacts page
    settings/
      HubSpotOrgMembers.tsx             # Org members for team page
supabase/
  migrations/
    20260227000002_add_hubspot_integration.sql
```

### Files Modified

```
src/
  app/
    (app)/
      contacts/page.tsx                 # Added HubSpot connection check + props
      team/page.tsx                     # Added HubSpotOrgMembers component
    api/
      integrations/
        status/route.ts                 # Added HubSpot status to integrations API
  components/
    contacts/
      ContactsManager.tsx               # Added HubSpot to "Add Contacts" dropdown
```

---

## 5. OAuth Flow

```
User clicks "Connect HubSpot"
  → GET /api/integrations/hubspot/connect
    → Checks auth + plan access (business+)
    → Encodes state (user_id, company_id, return_to) as base64url
    → Redirects to HubSpot OAuth consent page

User grants access on HubSpot
  → GET /api/integrations/hubspot/callback?code=xxx&state=xxx
    → Decodes state parameter
    → Exchanges code for tokens (access_token + refresh_token)
    → Fetches token info (hub_id, user email, scopes)
    → Upserts hubspot_integrations row
    → Redirects to return_to URL
```

### Token Refresh

- HubSpot access tokens expire (typically 30 minutes)
- The `getHubSpotClient()` wrapper automatically checks `expires_at`
- If token is about to expire (within 5 minutes), it refreshes proactively
- If a 401 is received, it refreshes and retries once
- If refresh fails, the integration is marked `is_active = false`

---

## 6. API Routes

### GET /api/integrations/hubspot/connect
Initiates OAuth flow. Query params:
- `return_to` - URL to redirect to after auth (default: `/integrations`)
- `return_url=json` - Returns JSON with `{ url: authUrl }` instead of redirect

### GET /api/integrations/hubspot/callback
Handles OAuth callback from HubSpot. Automatically called by HubSpot.

### POST /api/integrations/hubspot/disconnect
Soft-deletes the integration (marks `is_active = false`).

### GET /api/integrations/hubspot/contacts
Fetches contacts from HubSpot API. Query params:
- `limit` - Number of contacts to fetch (default: 200)

Returns: `{ contacts, mappings, hub_domain, hub_id }`

### POST /api/integrations/hubspot/sync
Triggers contact sync. Body (optional):
- `{ ids: ["123", "456"] }` - Selective sync by HubSpot contact IDs
- No body = full sync

Returns: `{ success, contacts: { created, updated, skipped }, errors }`

### GET /api/integrations/hubspot/users
Fetches HubSpot owners (org members) with Callengo overlap detection.

Returns: `{ members, total, already_connected }`

### GET /api/integrations/status
Updated to include HubSpot in the `all` object:
```json
{
  "all": {
    "hubspot": {
      "connected": true,
      "email": "user@company.com",
      "hubDomain": "company.hubspot.com",
      "hubId": "12345678",
      "lastSynced": "2026-02-27T...",
      "integrationId": "uuid"
    }
  }
}
```

---

## 7. Contact Sync Logic

### Deduplication Strategy
1. Check `hubspot_contact_mappings` for existing mapping by HubSpot contact ID
2. If no mapping, check `contacts` table by email (same company)
3. If no email match, check by phone number (same company)
4. If duplicate found: update existing contact
5. If no duplicate: create new contact

### Contact Data Mapping

| HubSpot Field | Callengo Field |
|---------------|----------------|
| `firstname + lastname` | `contact_name` |
| `email` | `email` |
| `phone / mobilephone` | `phone_number` |
| `company` | `company_name` |
| - | `source: 'hubspot'` |
| - | `tags: ['hubspot-import']` |
| All HubSpot fields | `custom_fields: { hs_contact_id, hs_firstname, ... }` |

---

## 8. Feature Gating

Access is controlled by subscription plan:

| Plan | HubSpot Access |
|------|---------------|
| Free | No |
| Starter | No |
| Business | Yes |
| Teams | Yes |
| Enterprise | Yes |

Controlled by `getHubSpotFeatureAccess(planSlug)` in `types/hubspot.ts`.

---

## 9. UI Components

### /contacts/hubspot (HubSpot Contacts Page)
- Server component checks auth, plan, and HubSpot connection
- Shows "Connect HubSpot" CTA if not connected
- Shows contacts table with search, select, and sync functionality
- Expandable rows with detailed contact info
- Bulk sync and selective sync support

### HubSpotContactsBanner
- Shows on main contacts page
- Three states: connected (link to sub-page), not connected (connect CTA), no access (upgrade CTA)

### HubSpotOrgMembers (Team Page)
- Lists HubSpot owners/users
- Shows which members are already in Callengo
- "Invite to Callengo" button for non-members
- Three states: no access, not connected, connected with member list

### ContactsManager (Add Contacts Dropdown)
- HubSpot added to Integrations section after Salesforce
- Shows "Business+" badge if plan doesn't have access
- Links to `/contacts/hubspot` if connected, or connects if not

---

## 10. Testing Checklist

- [ ] Set `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` in `.env.local`
- [ ] Run database migration (`supabase db push`)
- [ ] Verify OAuth redirect URL matches in HubSpot app settings
- [ ] Test OAuth flow: Connect HubSpot from `/contacts/hubspot`
- [ ] Verify token storage in `hubspot_integrations` table
- [ ] Test contact fetch on HubSpot contacts page
- [ ] Test full sync (Sync to Callengo button)
- [ ] Test selective sync (select contacts, then sync)
- [ ] Verify deduplication by email/phone
- [ ] Test HubSpot org members on Team page
- [ ] Test invite functionality from Team page
- [ ] Test disconnect functionality
- [ ] Verify integration status API returns HubSpot data
- [ ] Test with non-Business plan (should show upgrade CTA)
- [ ] Test token refresh (wait for token to expire, then use)

---

## 11. HubSpot API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://app.hubspot.com/oauth/authorize` | GET | OAuth consent |
| `https://api.hubapi.com/oauth/v1/token` | POST | Token exchange/refresh |
| `https://api.hubapi.com/oauth/v1/access-tokens/{token}` | GET | Token info |
| `https://api.hubapi.com/crm/v3/objects/contacts` | GET | List contacts |
| `https://api.hubapi.com/crm/v3/objects/contacts/batch/read` | POST | Batch read contacts |
| `https://api.hubapi.com/crm/v3/objects/companies` | GET | List companies |
| `https://api.hubapi.com/crm/v3/owners` | GET | List owners |

---

## 12. Troubleshooting

### "Missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET"
Ensure the environment variables are set in `.env.local` and the server has been restarted.

### "HubSpot token refresh failed. Please reconnect."
The refresh token is invalid. User needs to disconnect and reconnect HubSpot.

### "No active HubSpot integration found"
The integration was disconnected or the `is_active` flag is false. Reconnect from the UI.

### OAuth callback fails with "invalid_state"
The state parameter was corrupted. Retry the connection flow.

### Contacts not appearing
- Check that the HubSpot account has contacts
- Verify the scopes include `crm.objects.contacts.read`
- Check browser console for API errors
- Check server logs for HubSpot API response errors
