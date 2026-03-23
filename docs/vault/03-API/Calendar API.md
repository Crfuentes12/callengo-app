---
tags: [api, calendar, events, availability, google-calendar, microsoft-outlook, scheduling]
created: 2026-03-23
updated: 2026-03-23
---

# Calendar API

The Calendar API provides 7 endpoints for managing calendar events, checking availability, and handling team calendar routing. Calendar functionality is central to two of Callengo's three AI agents: the [[Appointment Confirmation Agent]] (which confirms, reschedules, and detects no-shows) and the [[Lead Qualification Agent]] (which schedules meetings with the sales team). Events are stored in the `calendar_events` table in Supabase and can be synchronized bidirectionally with external calendar providers.

Calendar provider integrations (Google Calendar, Microsoft Outlook) are connected via the [[Integrations API]] OAuth flow, not through this Calendar API directly.

---

## Endpoint Reference

### GET /api/calendar/events

Lists calendar events for the authenticated user's company, with flexible filtering by date range, event type, status, source, and contact.

**Authentication:** Required.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | ISO string | -- | Filter events on or after this date |
| `end_date` | ISO string | -- | Filter events on or before this date |
| `event_type` | string | -- | Filter by type (e.g., `meeting`, `callback`, `appointment`, `follow_up`) |
| `status` | string | -- | Filter by status (e.g., `confirmed`, `pending`, `cancelled`, `no_show`, `completed`) |
| `source` | string | -- | Filter by source (e.g., `agent`, `manual`, `crm`, `calendar_sync`) |
| `contact_id` | string (UUID) | -- | Filter events for a specific contact |
| `limit` | number | 500 | Maximum events to return |

**Behavior:** Delegates to `getCalendarEvents()` from `src/lib/calendar/sync.ts`, which queries `calendar_events` filtered by `company_id` and the provided parameters.

**Response:**

```json
{
  "events": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "contact_id": "uuid",
      "title": "Appointment with John Smith",
      "description": "Confirmed via AI agent call",
      "event_type": "appointment",
      "status": "confirmed",
      "start_time": "2026-03-25T14:00:00Z",
      "end_time": "2026-03-25T14:30:00Z",
      "location": "123 Main St",
      "video_link": null,
      "source": "agent",
      "assigned_to": "uuid",
      "external_event_id": "google-calendar-event-id",
      "provider": "google_calendar",
      "created_at": "2026-03-23T15:00:00Z"
    }
  ]
}
```

**Source file:** `src/app/api/calendar/events/route.ts`

---

### POST /api/calendar/events

Creates a new calendar event. Supports automatic team member assignment via `autoAssignEvent()` from `src/lib/calendar/resource-routing.ts`, which distributes events based on team availability and load balancing rules.

**Authentication:** Required.

**Request body:**

```json
{
  "title": "Follow-up call with Jane Doe",
  "description": "Discuss proposal revisions",
  "event_type": "callback",
  "start_time": "2026-03-26T10:00:00Z",
  "end_time": "2026-03-26T10:30:00Z",
  "contact_id": "uuid",
  "location": null,
  "video_provider": "zoom",
  "assigned_to": "uuid",
  "auto_assign": true
}
```

**Behavior:** Calls `createCalendarEvent()` from `src/lib/calendar/sync.ts`. If `auto_assign` is true, the event is automatically assigned to a team member based on availability. If a video provider is specified, a meeting link is generated.

**Source file:** `src/app/api/calendar/events/route.ts`

---

### PUT /api/calendar/events

Updates an existing calendar event. Supports several specialized operations via the `action` field: reschedule, confirm, mark as no-show, or general update.

**Authentication:** Required.

**Request body examples:**

General update:
```json
{
  "id": "uuid",
  "title": "Updated title",
  "start_time": "2026-03-26T11:00:00Z",
  "end_time": "2026-03-26T11:30:00Z"
}
```

Confirm appointment:
```json
{
  "id": "uuid",
  "action": "confirm"
}
```

Reschedule:
```json
{
  "id": "uuid",
  "action": "reschedule",
  "new_start_time": "2026-03-27T14:00:00Z",
  "new_end_time": "2026-03-27T14:30:00Z",
  "reason": "Client requested different time"
}
```

Mark no-show:
```json
{
  "id": "uuid",
  "action": "no_show"
}
```

**Delegates to:** `updateCalendarEvent()`, `confirmAppointment()`, `rescheduleAppointment()`, or `markEventNoShow()` from `src/lib/calendar/sync.ts`.

**Source file:** `src/app/api/calendar/events/route.ts`

---

### DELETE /api/calendar/events

Cancels a calendar event. Sets the event status to `cancelled` rather than deleting the row, preserving the audit trail.

**Authentication:** Required.

**Request body:**

```json
{
  "id": "uuid",
  "reason": "Client cancelled"
}
```

**Delegates to:** `cancelCalendarEvent()` from `src/lib/calendar/sync.ts`.

**Source file:** `src/app/api/calendar/events/route.ts`

---

### GET /api/calendar/events/personal

Returns personal (non-company) calendar events for the authenticated user. These are events synced from the user's personal calendar that may conflict with company scheduling.

**Authentication:** Required.

**Source file:** `src/app/api/calendar/events/personal/route.ts`

---

### GET /api/calendar/availability

Checks calendar availability for the company. Supports three modes of operation based on query parameters.

**Authentication:** Required.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `date` | ISO date string | Get all available slots for a specific date |
| `start_time` + `end_time` | ISO strings | Check if a specific time slot is available |
| `find_next=true` | boolean | Find the next available slot from now |
| `slot_duration` | number | Duration of each slot in minutes (default: 30) |
| `duration` | number | Duration for next-slot search in minutes (default: 30) |

**Mode 1: Check specific slot**

When both `start_time` and `end_time` are provided, calls `isSlotAvailable()` from `src/lib/calendar/availability.ts`.

```json
{ "available": true }
```

**Mode 2: Get all slots for a date**

When `date` is provided, calls `getAvailability()` with the specified slot duration.

```json
{
  "date": "2026-03-25",
  "slots": [
    { "start": "2026-03-25T09:00:00Z", "end": "2026-03-25T09:30:00Z", "available": true },
    { "start": "2026-03-25T09:30:00Z", "end": "2026-03-25T10:00:00Z", "available": false },
    { "start": "2026-03-25T10:00:00Z", "end": "2026-03-25T10:30:00Z", "available": true }
  ]
}
```

**Mode 3: Find next available slot**

When `find_next=true`, calls `getNextAvailableSlot()` which searches up to 14 days ahead.

```json
{
  "available": true,
  "slot": {
    "start": "2026-03-25T14:00:00Z",
    "end": "2026-03-25T14:30:00Z"
  }
}
```

Or if no slots found:
```json
{
  "available": false,
  "message": "No available slots found in the next 14 days"
}
```

**Source file:** `src/app/api/calendar/availability/route.ts`

---

### GET/POST /api/calendar/team

Manages team calendar routing configuration -- how events are distributed among team members.

**GET** returns the current team assignment configuration.

**POST** updates team calendar routing rules (e.g., round-robin, least-loaded, manual assignment).

**Authentication:** Required.

**Source file:** `src/app/api/calendar/team/route.ts`

---

### POST /api/calendar/contact-sync

Triggers synchronization of calendar events for a specific contact. Used to ensure a contact's appointment history is up-to-date across all connected calendar providers.

**Authentication:** Required.

**Source file:** `src/app/api/calendar/contact-sync/route.ts`

---

## Calendar Provider Integrations

Calendar providers are connected via the [[Integrations API]], not through dedicated calendar API endpoints. The connection flow uses OAuth 2.0:

| Provider | Connect Endpoint | Callback Endpoint |
|----------|-----------------|-------------------|
| [[Google Calendar]] | `POST /api/integrations/google-calendar/connect` | `GET /api/integrations/google-calendar/callback` |
| [[Microsoft Outlook]] | `POST /api/integrations/microsoft-outlook/connect` | `GET /api/integrations/microsoft-outlook/callback` |

Once connected, events can be synced bidirectionally:
- `POST /api/integrations/google-calendar/sync` -- Sync with Google Calendar
- `POST /api/integrations/microsoft-outlook/sync` -- Sync with Outlook
- Disconnect endpoints to remove the integration

---

## Sync Types

| Type | Direction | Description |
|------|-----------|-------------|
| `full` | Bidirectional | Initial full sync of all events in the configured window |
| `incremental` | Bidirectional | Delta sync using `sync_token` from the provider |
| `push` | Outbound | Push Callengo-created events to the external calendar |
| `pull` | Inbound | Pull external events into Callengo (for availability checking) |
| `webhook` | Inbound | Real-time push notifications from the calendar provider |

---

## Video Conferencing

Calendar events can include video meeting links. Supported video providers are configured via the calendar integration settings:

| Provider | Plan Requirement |
|----------|-----------------|
| Google Meet | Free+ (via Google Calendar integration) |
| Zoom | Free+ (via Zoom integration) |
| Microsoft Teams | Business+ (via Outlook integration) |

Video links are generated when creating calendar events with a `video_provider` field.

---

## How Calendar Events Are Created by AI Agents

Calendar events are created automatically during the [[Call Processing Flow]] (Bland AI webhook). Depending on the AI agent type and call outcome:

| Agent Type | Trigger | Calendar Action |
|------------|---------|----------------|
| Appointment Confirmation | Appointment confirmed | `syncConfirmAppointment()` -- updates existing event status |
| Appointment Confirmation | Reschedule requested | `syncRescheduleAppointment()` -- moves event to new time |
| Appointment Confirmation | No-show detected | `syncHandleNoShow()` -- marks event, schedules retry |
| Lead Qualification | Meeting requested | `syncScheduleMeeting()` -- creates new meeting event |
| Lead Qualification | Callback requested | `syncScheduleCallback()` -- creates callback event |
| Any | Follow-up needed | `createAgentFollowUp()` -- creates follow-up event |

---

## Source Files

- Calendar routes: `src/app/api/calendar/`
- Calendar settings: `src/app/api/settings/calendar-config/route.ts`
- Calendar sync library: `src/lib/calendar/sync.ts`
- Campaign sync: `src/lib/calendar/campaign-sync.ts`
- Availability: `src/lib/calendar/availability.ts`
- Resource routing: `src/lib/calendar/resource-routing.ts`
- Google Calendar: `src/lib/calendar/google.ts`
- Microsoft Outlook: `src/lib/calendar/outlook.ts`

## Related Notes

- [[Calendar Event]]
- [[Google Calendar]]
- [[Microsoft Outlook]]
- [[Video Providers]]
- [[Appointment Confirmation Agent]]
- [[Lead Qualification Agent]]
- [[Call Processing Flow]]
- [[Integrations API]]
- [[API Overview]]
