---
tags: [api, calendar]
---

# Calendar API

10 endpoints for calendar integration, event management, and availability.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/events` | List calendar events (filtered by date range, type) |
| POST | `/api/calendar/events` | Create calendar event |
| PUT | `/api/calendar/events/[id]` | Update calendar event |
| DELETE | `/api/calendar/events/[id]` | Delete calendar event |
| GET | `/api/calendar/integrations` | List connected calendar providers |
| POST | `/api/calendar/integrations/connect` | Initiate OAuth for calendar provider |
| DELETE | `/api/calendar/integrations/[id]` | Disconnect calendar provider |
| POST | `/api/calendar/sync` | Trigger manual calendar sync |
| GET | `/api/calendar/availability` | Get available time slots |
| GET | `/api/calendar/team-assignments` | Get team calendar routing config |

## Supported Providers

- [[Google Calendar]] — OAuth 2.0
- [[Microsoft Outlook]] — OAuth 2.0 (Azure AD)

## Sync Types

| Type | Direction | Description |
|------|-----------|-------------|
| `full` | bidirectional | Initial full sync |
| `incremental` | bidirectional | Delta sync using sync_token |
| `push` | outbound | Push Callengo events to external calendar |
| `pull` | inbound | Pull external events into Callengo |
| `webhook` | inbound | Real-time push notification |

## Source Files

- Calendar lib: `src/lib/calendar/`
- Google Calendar: `src/lib/calendar/google.ts`
- Microsoft Outlook: `src/lib/calendar/outlook.ts`

## Related Notes

- [[Calendar Event]]
- [[Google Calendar]]
- [[Microsoft Outlook]]
- [[Appointment Confirmation]]
