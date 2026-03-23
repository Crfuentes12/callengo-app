---
tags: [integration, calendar, microsoft, outlook, azure]
aliases: [Outlook, Microsoft Calendar, Outlook Calendar]
---

# Microsoft Outlook

Microsoft Outlook calendar integration via Azure Active Directory OAuth 2.0. Enables bi-directional calendar sync between Callengo and Outlook calendars, allowing the [[Appointment Confirmation]] agent to check availability and create events directly in a user's Outlook calendar.

**Plan availability:** Business+ | **Auth type:** OAuth 2.0 (Azure AD) | **Source:** `src/lib/calendar/outlook.ts`

---

## Storage

Outlook integrations are stored in the `calendar_integrations` table (shared with [[Google Calendar]]) with `provider = 'microsoft_outlook'`.

### Microsoft-Specific Fields

| Column | Type | Description |
|--------|------|-------------|
| `microsoft_tenant_id` | TEXT | Azure AD tenant ID |
| `microsoft_calendar_id` | TEXT | Selected Outlook calendar ID |
| `provider` | TEXT | Always `'microsoft_outlook'` |
| `access_token` | TEXT | Encrypted (AES-256-GCM via [[Security & Encryption]]) |
| `refresh_token` | TEXT | Encrypted (AES-256-GCM) |
| `token_expires_at` | TIMESTAMPTZ | Token expiration |
| `provider_email` | TEXT | Microsoft account email |
| `provider_user_id` | TEXT | Microsoft user ID |
| `provider_user_name` | TEXT | Display name |
| `scopes` | TEXT[] | Granted OAuth scopes |

**UNIQUE constraint:** `(company_id, user_id, provider)` — One Outlook connection per user.

---

## OAuth Flow

1. User clicks "Connect Outlook" → Redirect to Azure AD authorization endpoint
2. User grants permissions (Calendars.ReadWrite, User.Read, offline_access)
3. Azure AD redirects to `/api/calendar/microsoft/callback`
4. Callback exchanges code for tokens → encrypts → stores in `calendar_integrations`
5. Initial full sync pulls existing calendar events

---

## Sync Capabilities

| Sync Type | Direction | Description |
|-----------|-----------|-------------|
| Full sync | Pull | Download all events from Outlook calendar |
| Incremental | Pull | Only changes since last sync (delta queries) |
| Push | Push | Send Callengo events (meetings, callbacks) to Outlook |
| Webhook | Pull | Real-time notifications from Microsoft Graph |

Events synced from Outlook store the provider's ID in `calendar_events.external_event_id` and `external_provider = 'microsoft_outlook'`.

---

## Integration with AI Agents

When the [[Appointment Confirmation]] agent schedules callbacks or the [[Lead Qualification]] agent schedules meetings, the system:

1. Creates a [[Calendar Event]] in Callengo
2. If Outlook is connected and sync_enabled: pushes event to Outlook calendar
3. Includes attendees, location, and [[Video Providers|Microsoft Teams]] link (if configured)
4. Updates `sync_status = 'synced'` after successful push

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/microsoft/callback` | OAuth callback |
| POST | `/api/calendar/sync` | Trigger sync (type: full/incremental) |
| GET | `/api/calendar/integrations` | List connected calendars |

---

## Related Notes

- [[Calendar Event]] — Event storage and sync tracking
- [[Google Calendar]] — Alternative calendar provider (Free+)
- [[Video Providers]] — Microsoft Teams video links
- [[Appointment Confirmation]] — Primary use case for calendar integration
- [[Security & Encryption]] — Token encryption (AES-256-GCM)
- [[Plan Features]] — Available on Business+ plans
