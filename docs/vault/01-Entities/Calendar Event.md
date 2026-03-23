---
tags: [entity, calendar, scheduling]
---

# Calendar Event

Events synced between Callengo and external calendar providers ([[Google Calendar]], [[Microsoft Outlook]]).

## Database Table: `calendar_events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| integration_id | UUID FK → calendar_integrations | SET NULL |
| external_event_id | TEXT | Provider's event ID |
| title | TEXT | |
| description | TEXT | |
| location | TEXT | |
| start_time / end_time | TIMESTAMPTZ | |
| timezone | TEXT | Default 'UTC' |
| all_day | BOOLEAN | |

### Event Classification

| Column | Type | Values |
|--------|------|--------|
| event_type | TEXT CHECK | call, follow_up, no_show_retry, meeting, appointment, callback, voicemail_followup |
| status | TEXT CHECK | scheduled, confirmed, completed, no_show, cancelled, rescheduled, pending_confirmation |
| source | TEXT CHECK | manual, campaign, google_calendar, microsoft_outlook, ai_agent, follow_up_queue, webhook |

### Contact & Agent Links

| Column | Type |
|--------|------|
| contact_id | UUID FK → contacts |
| contact_name, contact_phone, contact_email | TEXT |
| agent_run_id | UUID FK → agent_runs |
| call_log_id | UUID FK → call_logs |
| follow_up_id | UUID FK → follow_up_queue |
| agent_name | TEXT |

### Confirmation Tracking

| Column | Type | Notes |
|--------|------|-------|
| confirmation_status | TEXT CHECK | unconfirmed, confirmed, declined, tentative, no_response |
| confirmation_attempts | INTEGER | Default 0 |
| last_confirmation_at | TIMESTAMPTZ | |

### Rescheduling

| Column | Type |
|--------|------|
| original_start_time | TIMESTAMPTZ |
| rescheduled_count | INTEGER |
| rescheduled_reason | TEXT |

### Video Meeting

| Column | Type | Values |
|--------|------|--------|
| video_link | TEXT | |
| video_provider | TEXT CHECK | google_meet, zoom, microsoft_teams |

### Sync Status

| Column | Type | Values |
|--------|------|--------|
| sync_status | TEXT CHECK | synced, pending_push, pending_pull, conflict, error |
| sync_error | TEXT | |
| last_synced_at | TIMESTAMPTZ | |

## Calendar Integrations: `calendar_integrations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| user_id | UUID FK | |
| provider | TEXT CHECK | google_calendar, microsoft_outlook |
| access_token, refresh_token | TEXT | Encrypted via [[App Identity\|AES-256-GCM]] |
| token_expires_at | TIMESTAMPTZ | |
| is_active | BOOLEAN | |
| UNIQUE | (company_id, user_id, provider) | |

## Sync Log: `calendar_sync_log`

Tracks sync operations: full, incremental, push, pull, webhook.

## Team Assignments: `team_calendar_assignments`

Routes calendar events to specific team members for round-robin or skill-based assignment.

## Related Notes

- [[Google Calendar]]
- [[Microsoft Outlook]]
- [[Appointment Confirmation]]
- [[Campaign]]
