---
tags: [entity, core, operations]
aliases: [Agent Run, Campaign Run]
---

# Campaign

A campaign (stored as `agent_runs`) represents a batch of outbound calls using an [[Agent]] against a set of [[Contact]]s.

## Database Table: `agent_runs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| agent_id | UUID FK → company_agents | SET NULL |
| name | TEXT | Campaign name |
| status | TEXT CHECK | pending, running, paused, completed, failed, cancelled |
| scheduled_start_at | TIMESTAMPTZ | |
| scheduled_end_at | TIMESTAMPTZ | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

### Call Metrics

| Column | Type |
|--------|------|
| total_contacts | INTEGER |
| completed_calls | INTEGER |
| successful_calls | INTEGER |
| failed_calls | INTEGER |

### Follow-Up Configuration

| Column | Type | Notes |
|--------|------|-------|
| follow_up_enabled | BOOLEAN | Default false |
| follow_up_max_attempts | INTEGER | Default 3 |
| follow_up_interval_hours | INTEGER | Default 24 |
| follow_up_conditions | JSONB | `{no_answer: true, busy: true, failed: false}` |

### Voicemail Configuration

| Column | Type | Notes |
|--------|------|-------|
| voicemail_enabled | BOOLEAN | Default false |
| voicemail_detection_enabled | BOOLEAN | Default true |
| voicemail_message | TEXT | |
| voicemail_action | VARCHAR(20) | Default 'leave_message' |

### Calendar Configuration

| Column | Type | Notes |
|--------|------|-------|
| calendar_context_enabled | BOOLEAN | Default true |
| calendar_timezone | TEXT | Default 'America/New_York' |
| calendar_working_hours_start | TEXT | Default '09:00' |
| calendar_working_hours_end | TEXT | Default '18:00' |
| calendar_working_days | TEXT[] | Default Mon-Fri |
| preferred_video_provider | TEXT | none, google_meet, zoom, microsoft_teams |
| allow_rescheduling | BOOLEAN | Default true |
| no_show_auto_retry | BOOLEAN | Default true |
| no_show_retry_delay_hours | INTEGER | Default 24 |
| default_meeting_duration | INTEGER | Default 30 min |
| connected_integrations | TEXT[] | |

## Campaign Queue: `campaign_queue`

Individual call tasks within a campaign:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| campaign_id | UUID | |
| agent_run_id | UUID | |
| contact_id | UUID | |
| phone_number | TEXT | |
| status | TEXT CHECK | pending, processing, completed, failed, cancelled, skipped |
| priority | INTEGER | Default 0 |
| call_id | TEXT | Bland AI call ID once dispatched |
| dedicated_number | TEXT | If using dedicated number add-on |

**Unique constraint:** Prevents duplicate pending/processing entries for same (agent_run_id, contact_id).

## Campaign Lifecycle

```
pending → running → completed
                  → failed
         → paused → running (resume)
         → cancelled
```

See [[Campaign Dispatch Flow]] for the full technical flow.

## Related Notes

- [[Agent]]
- [[Call]]
- [[Follow-Up]]
- [[Campaign Dispatch Flow]]
- [[Call Processing Flow]]
