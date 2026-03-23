---
tags: [entity, calendar, scheduling, events]
aliases: [Calendar, calendar_events, calendar_integrations]
---

# Calendar Event

Events synced between Callengo and external calendar providers ([[Google Calendar]], [[Microsoft Outlook]]). Calendar events are created by AI agents during calls (e.g., scheduling meetings, creating callbacks), by users manually, or by syncing from external calendars. The calendar system supports bi-directional sync, confirmation tracking, rescheduling, video meeting links, and team-based event assignment.

---

## Database Table: `calendar_events`

### Core Fields

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `company_id` | UUID FK → `companies` | — | CASCADE on delete |
| `title` | TEXT | — | Event title (NOT NULL) |
| `description` | TEXT | — | Event description |
| `location` | TEXT | — | Physical location |
| `scheduled_at` | TIMESTAMPTZ | — | Legacy scheduling field |
| `duration_minutes` | INTEGER | `15` | Event duration |
| `start_time` | TIMESTAMPTZ | — | Event start |
| `end_time` | TIMESTAMPTZ | — | Event end |
| `timezone` | TEXT | `'UTC'` | Event timezone |
| `all_day` | BOOLEAN | `false` | All-day event flag |
| `notes` | TEXT | — | Internal notes |
| `metadata` | JSONB | `{}` | Additional data |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `updated_at` | TIMESTAMPTZ | `now()` | |

### Event Classification

| Column | Type | Default | Valid Values |
|--------|------|---------|-------------|
| `type` | TEXT CHECK | `'call'` | `call`, `follow_up`, `no_show_retry`, `meeting`, `appointment`, `callback`, `voicemail_followup` |
| `status` | TEXT CHECK | `'scheduled'` | `scheduled`, `confirmed`, `completed`, `no_show`, `cancelled`, `rescheduled`, `pending_confirmation` |
| `source` | TEXT CHECK | `'manual'` | `manual`, `campaign`, `google_calendar`, `microsoft_outlook`, `ai_agent`, `follow_up_queue`, `webhook` |
| `event_type` | TEXT | — | Additional type classification |

### Contact & Agent Links

| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | UUID FK → `contacts` | SET NULL on delete |
| `contact_name` | TEXT | Denormalized contact name |
| `contact_phone` | TEXT | Denormalized phone |
| `contact_email` | TEXT | Denormalized email |
| `agent_run_id` | UUID FK → `agent_runs` | SET NULL on delete |
| `agent_name` | TEXT | Agent that created the event |
| `call_log_id` | UUID FK → `call_logs` | SET NULL on delete |
| `follow_up_id` | UUID FK → `follow_up_queue` | SET NULL on delete |
| `ai_notes` | TEXT | AI-generated notes about the event |
| `created_by_feature` | TEXT | Which feature created this event |

### Confirmation Tracking

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `confirmation_status` | TEXT | — | `unconfirmed`, `confirmed`, `declined`, `tentative`, `no_response` |
| `confirmation_attempts` | INTEGER | `0` | Number of confirmation calls made |
| `last_confirmation_at` | TIMESTAMPTZ | — | Last confirmation attempt |

### Rescheduling

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `original_start_time` | TIMESTAMPTZ | — | Original time before reschedule |
| `rescheduled_count` | INTEGER | `0` | Times rescheduled |
| `rescheduled_reason` | TEXT | — | Why it was rescheduled |
| `recurrence_rule` | TEXT | — | iCal RRULE for recurring events |
| `recurring_event_id` | TEXT | — | Parent recurring event ID |

### Video Meeting

| Column | Type | Description |
|--------|------|-------------|
| `video_link` | TEXT | Video conference URL |
| `video_provider` | TEXT | `google_meet`, `zoom`, `microsoft_teams` |

### External Sync

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `integration_id` | UUID FK | — | Calendar integration used |
| `external_event_id` | TEXT | — | Provider's event ID |
| `external_provider` | TEXT | — | Provider name |
| `external_calendar_id` | TEXT | — | Provider's calendar ID |
| `sync_status` | TEXT | `'local'` | `local`, `synced`, `pending_push`, `pending_pull`, `conflict`, `error` |
| `sync_error` | TEXT | — | Sync error details |
| `last_synced_at` | TIMESTAMPTZ | — | Last successful sync |
| `attendees` | JSONB | `[]` | Attendee list |

### Team Assignment

| Column | Type | Description |
|--------|------|-------------|
| `assigned_to` | UUID FK → `team_calendar_assignments` | Team member assignment |
| `assigned_to_name` | TEXT | Denormalized assignee name |

### Key Indexes

Over 20 indexes optimize calendar queries including: `idx_calendar_events_company`, `idx_cal_events_company_time` (compound for range queries), `idx_calendar_events_status` (partial WHERE scheduled), `idx_calendar_events_external` (partial WHERE NOT NULL), `idx_cal_events_sync` (partial WHERE not synced), `idx_cal_events_confirmation` (partial WHERE not confirmed), `idx_calendar_events_assigned`, and many more.

### RLS

- `calendar_events_all` — Company-scoped access (all operations)

---

## Calendar Integrations: `calendar_integrations`

OAuth connections to external calendar providers.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `company_id` | UUID FK → `companies` | — | CASCADE on delete |
| `user_id` | UUID | — | Connecting user |
| `provider` | TEXT | — | `google_calendar` or `microsoft_outlook` |
| `connected` | BOOLEAN | `false` | Connection status |
| `email` | TEXT | — | Provider email |
| `access_token` | TEXT | — | Encrypted (AES-256-GCM) |
| `refresh_token` | TEXT | — | Encrypted (AES-256-GCM) |
| `token_expires_at` | TIMESTAMPTZ | — | Token expiration |
| `is_active` | BOOLEAN | — | Active flag |
| `sync_enabled` | BOOLEAN | `true` | Sync enabled |
| `last_synced_at` | TIMESTAMPTZ | — | Last sync time |
| `settings` | JSONB | `{}` | Provider settings |
| `google_calendar_id` | TEXT | `'primary'` | Google Calendar ID |
| `microsoft_tenant_id` | TEXT | — | Azure tenant ID |
| `microsoft_calendar_id` | TEXT | — | Outlook calendar ID |
| `provider_email` | TEXT | — | Provider account email |
| `provider_user_id` | TEXT | — | Provider user ID |
| `provider_user_name` | TEXT | — | Provider display name |
| `sync_token` | TEXT | — | Incremental sync token |
| `scopes` | TEXT[] | — | Granted OAuth scopes |
| `raw_profile` | JSONB | — | Raw provider profile data |

**UNIQUE constraint:** `(company_id, user_id, provider)` — One connection per user per provider.

### Sync Types

| Type | Direction | Description |
|------|-----------|-------------|
| Full | Pull | Download all events from provider |
| Incremental | Pull | Only changes since `sync_token` |
| Push | Push | Send Callengo events to provider |
| Webhook | Pull | Real-time event notification from provider |

---

## Team Calendar Assignments: `team_calendar_assignments`

Routes calendar events to specific team members. Used for round-robin or skill-based assignment when AI agents schedule meetings.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `company_id` | UUID FK | — | CASCADE on delete |
| `user_id` | UUID | — | Team member |
| `display_name` | TEXT | — | Member name |
| `email` | TEXT | — | Member email |
| `role` | TEXT | `'member'` | Team role |
| `color` | TEXT | `'#3b82f6'` | Calendar display color |
| `is_active` | BOOLEAN | `true` | Active flag |
| `google_calendar_id` | TEXT | — | Google Calendar link |
| `microsoft_calendar_id` | TEXT | — | Outlook Calendar link |
| `simplybook_provider_id` | INTEGER | — | SimplyBook provider link |
| `specialties` | TEXT[] | `{}` | Skills for matching |
| `max_daily_appointments` | INTEGER | `20` | Daily capacity |

**UNIQUE:** `(company_id, user_id)`

---

## Related Notes

- [[Company]] — Events belong to companies
- [[Contact]] — Events link to contacts
- [[Campaign]] — Campaigns create events
- [[Call]] — Events reference call logs
- [[Follow-Up]] — Follow-ups create events
- [[Google Calendar]] — Google Calendar integration
- [[Microsoft Outlook]] — Outlook integration
- [[Video Providers]] — Video meeting links
- [[Appointment Confirmation]] — Confirmation workflow
- [[Calendar API]] — API endpoints
