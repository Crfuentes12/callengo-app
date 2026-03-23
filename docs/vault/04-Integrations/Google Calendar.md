---
tags: [integration, calendar, oauth, google]
aliases: [Google Cal, GCal, Google Calendar Integration]
---

# Google Calendar

Google Calendar is a calendar integration available on **Free+** plans (all plans). It connects via OAuth 2.0 using Google's `googleapis` npm package and provides bi-directional sync of calendar events between Google Calendar and [[Callengo]]. It is the most widely available calendar integration and the foundation for the [[Appointment Confirmation]] agent's scheduling capabilities.

## Plan Availability

Google Calendar is ungated -- available to all plans including Free. The `isPlanAllowedForIntegration()` function returns `true` for any plan because `'google_calendar'` is not in the `INTEGRATION_PLAN_REQUIREMENTS` map. Per `getCalendarFeatureAccess()`:

| Feature | Free | Starter | Business+ |
|---------|------|---------|-----------|
| Connect Google Calendar | Yes | Yes | Yes |
| Sync appointments | Yes | Yes | Yes |
| Bi-directional sync | No | Yes | Yes |
| Availability checking | Yes | Yes | Yes |
| Google Meet links | Yes | Yes | Yes |
| Max calendar integrations | 1 | 2 | 5--999 |

## OAuth 2.0 Flow

### Configuration

| Parameter | Value |
|-----------|-------|
| SDK | `googleapis` npm package (`google.auth.OAuth2`) |
| Redirect URI | `{APP_URL}/api/integrations/google-calendar/callback` |
| Grant type | `authorization_code` |
| Access type | `offline` (to receive refresh_token) |
| Prompt | `consent` (forced to always get refresh_token) |
| Env vars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

### Requested Scopes

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### Flow Steps

1. `getGoogleAuthUrl(state)` generates the consent URL via `oauth2Client.generateAuthUrl()` with `access_type: 'offline'`, `prompt: 'consent'`, and `include_granted_scopes: true`.
2. User authenticates with their Google account and grants calendar permissions.
3. Google redirects to `/api/integrations/google-calendar/callback` with an authorization code.
4. `exchangeGoogleCode(code)` calls `oauth2Client.getToken(code)` to get tokens. Returns a `GoogleTokenResponse` with `access_token`, `refresh_token`, `expires_in`, `token_type`, `scope`.
5. User profile info (email, name) is fetched via Google's userinfo endpoint.
6. Tokens are encrypted via `encryptToken()`.
7. A row is inserted in the `calendar_integrations` table with `provider = 'google_calendar'`.

## Database Schema

Google Calendar integrations are stored in the shared `calendar_integrations` table (not a provider-specific table). This table is shared with [[Microsoft Outlook]].

### calendar_integrations (provider = 'google_calendar')

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Integration record ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `user_id` | uuid | NOT NULL | The Callengo user who connected |
| `provider` | text | NOT NULL | `'google_calendar'` for this integration |
| `access_token` | text | NOT NULL | Encrypted Google OAuth access token |
| `refresh_token` | text | NULL | Encrypted OAuth refresh token |
| `token_expires_at` | timestamptz | NULL | When the access token expires |
| `provider_email` | text | NULL | Google account email |
| `provider_user_id` | text | NULL | Google user ID |
| `provider_user_name` | text | NULL | Google display name |
| `google_calendar_id` | text | NOT NULL | Google Calendar ID. Default: `'primary'` |
| `microsoft_tenant_id` | text | NULL | Not used for Google (NULL) |
| `microsoft_calendar_id` | text | NULL | Not used for Google (NULL) |
| `last_synced_at` | timestamptz | NULL | Last successful sync timestamp |
| `sync_token` | text | NULL | Google Calendar incremental sync token (for delta sync) |
| `is_active` | boolean | NOT NULL | Whether the integration is active |
| `scopes` | text[] | NULL | Granted OAuth scopes |
| `raw_profile` | jsonb | NULL | Full raw Google profile |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

### calendar_events

Events synced from Google Calendar are stored in the shared `calendar_events` table. See [[Calendar Event]] for the full schema. Key fields for Google Calendar events:

| Field | Google Calendar Mapping |
|-------|----------------------|
| `external_event_id` | Google event `id` |
| `external_calendar_id` | The Google Calendar ID |
| `title` | `summary` |
| `description` | `description` |
| `start_time` / `end_time` | `start.dateTime` or `start.date` (all-day) |
| `timezone` | `start.timeZone` |
| `all_day` | Derived from presence of `start.date` vs `start.dateTime` |
| `video_link` | Extracted from `conferenceData.entryPoints[].uri` |
| `video_provider` | `'google_meet'` if conference data present |
| `attendees` | Mapped from Google's attendees array |
| `recurrence_rule` | From `recurrence[]` |
| `recurring_event_id` | From `recurringEventId` |

### calendar_sync_logs

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | PK | Log entry ID |
| `company_id` | uuid | FK NOT NULL | Reference to `companies.id` |
| `integration_id` | uuid | FK NOT NULL | Reference to `calendar_integrations.id` |
| `sync_type` | text | NOT NULL | `'full'`, `'incremental'`, `'push'`, `'pull'`, `'webhook'` |
| `sync_direction` | text | NOT NULL | `'inbound'`, `'outbound'`, `'bidirectional'` |
| `events_created` | integer | NOT NULL | Events created |
| `events_updated` | integer | NOT NULL | Events updated |
| `events_deleted` | integer | NOT NULL | Events deleted |
| `errors` | jsonb | NOT NULL | Array of errors |
| `started_at` | timestamptz | NOT NULL | Sync start time |
| `completed_at` | timestamptz | NULL | Sync completion time |
| `status` | text | NOT NULL | `'running'`, `'completed'`, `'failed'` |
| `error_message` | text | NULL | Summary error |
| `created_at` | timestamptz | NOT NULL | Row creation timestamp |

## Sync Mechanism

### Sync Types

| Type | Description |
|------|-------------|
| `full` | Complete re-sync of all events from Google Calendar. Used on first connection or manual refresh |
| `incremental` | Delta sync using Google's `syncToken`. Only fetches events changed since the last sync. The `sync_token` is stored on the integration row and updated after each successful incremental sync |
| `push` | Push a Callengo event to Google Calendar (outbound) |
| `pull` | Pull events from Google Calendar (inbound) |
| `webhook` | Sync triggered by a Google Calendar push notification |

### Incremental Sync via sync_token

Google Calendar's sync mechanism uses opaque tokens:

1. First sync: call `events.list()` without a sync token to get all events. The response includes a `nextSyncToken`.
2. Store `nextSyncToken` in the `sync_token` column.
3. Subsequent syncs: call `events.list()` with the stored `syncToken`. Google returns only events that changed since the token was issued.
4. If Google returns a `410 Gone`, the sync token has expired and a full sync is required.

### Google Meet Integration

When creating events via Callengo (e.g., when the Lead Qualification agent schedules a meeting), a Google Meet link can be automatically attached using the `conferenceData` field with `createRequest` and a unique `requestId` prefixed with `callengo-meet-`. This requires the `calendar.events` scope.

The generated Meet link is stored in `calendar_events.video_link` with `video_provider = 'google_meet'`.

### Bi-directional Operations

From `src/lib/calendar/google.ts`:
- `syncGoogleCalendarToCallengo()` -- pull events from Google to Callengo
- `pushEventToGoogle()` -- create a new event in Google Calendar
- `updateGoogleEvent()` -- update an existing Google Calendar event
- `deleteGoogleEvent()` -- delete a Google Calendar event

### Availability Checking

The `src/lib/calendar/availability.ts` module uses Google Calendar's free/busy API to check availability before scheduling meetings. This is used by the AI agents to find open time slots when a contact requests a meeting.

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/calendar/google.ts` | OAuth flow, event CRUD, sync |
| `src/lib/calendar/sync.ts` | Sync orchestration across providers |
| `src/lib/calendar/availability.ts` | Availability checking |
| `src/lib/calendar/index.ts` | Re-exports all calendar modules |
| `src/types/calendar.ts` | TypeScript types (616 lines) |
| `src/app/api/integrations/google-calendar/` | API route handlers |

## Related Notes

- [[Calendar Event]] -- the unified event model in Callengo
- [[Microsoft Outlook]] -- the other calendar provider (Business+)
- [[Video Providers]] -- Google Meet integration
- [[Appointment Confirmation]] -- agent that uses calendar data
- [[Campaign]] -- campaigns configure calendar sync and video provider preferences
- [[Plan Features]] -- calendar feature gating by plan
