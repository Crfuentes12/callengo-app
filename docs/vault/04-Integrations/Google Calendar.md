---
tags: [integration, calendar]
---

# Google Calendar

Calendar integration via OAuth 2.0. Available on **Free+** plans.

## Auth
- Type: OAuth 2.0 (Google)
- Stored in `calendar_integrations` table with `provider = 'google_calendar'`
- Tokens encrypted via AES-256-GCM

## Capabilities
- Bi-directional sync (push Callengo events, pull Google events)
- Incremental sync via `sync_token`
- Real-time webhook notifications
- Availability checking for scheduling

## Source Files
- `src/lib/calendar/google.ts`

## Related Notes
- [[Calendar Event]]
- [[Calendar API]]
- [[Appointment Confirmation]]
- [[Video Providers]] (Google Meet)
