---
tags: [entity, core, operations, campaign]
aliases: [Agent Run, Campaign Run, agent_runs]
---

# Campaign

A campaign (stored internally as `agent_runs`) represents a batch of outbound calls using an [[Agent]] against a set of [[Contact]]s. Campaigns are the primary unit of work in Callengo — users create a campaign, configure its behavior (voice, follow-ups, voicemail, calendar settings), add contacts, and start it. The system then dispatches calls through [[Bland AI]], processes results, and tracks metrics.

---

## Database Table: `agent_runs`

### Core Fields

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `uuid_generate_v4()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `agent_template_id` | UUID FK → `agent_templates` | — | NO | Agent type used |
| `name` | TEXT | — | NO | Campaign display name |
| `status` | TEXT | `'draft'` | YES | Campaign lifecycle status |
| `settings` | JSONB | — | YES | Additional campaign settings |
| `started_at` | TIMESTAMPTZ | — | YES | When campaign started running |
| `completed_at` | TIMESTAMPTZ | — | YES | When campaign finished |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |
| `updated_at` | TIMESTAMPTZ | `now()` | YES | |

### Call Metrics

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `total_contacts` | INTEGER | `0` | Total contacts in campaign |
| `completed_calls` | INTEGER | `0` | Calls that completed (any outcome) |
| `successful_calls` | INTEGER | `0` | Calls with successful outcomes |
| `failed_calls` | INTEGER | `0` | Calls that failed technically |
| `total_cost` | NUMERIC | `0` | Total Bland AI cost |
| `voicemails_detected` | INTEGER | `0` | Voicemails detected count |
| `voicemails_left` | INTEGER | `0` | Voicemail messages left count |
| `follow_ups_scheduled` | INTEGER | `0` | Follow-ups created |
| `follow_ups_completed` | INTEGER | `0` | Follow-ups finished |

### Follow-Up Configuration

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `follow_up_enabled` | BOOLEAN | `false` | Enable automatic follow-ups |
| `follow_up_max_attempts` | INTEGER | `3` | Max retry attempts |
| `follow_up_interval_hours` | INTEGER | `24` | Hours between retries |
| `follow_up_conditions` | JSONB | `{no_answer:true, busy:true, failed:false}` | Which outcomes trigger follow-ups |
| `smart_follow_up` | BOOLEAN | `false` | AI-driven follow-up scheduling |
| `callback_enabled` | BOOLEAN | `true` | Enable callback scheduling |
| `callback_max_attempts` | INTEGER | `2` | Max callback attempts |

### Voicemail Configuration

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `voicemail_enabled` | BOOLEAN | `false` | Leave voicemail messages |
| `voicemail_detection_enabled` | BOOLEAN | `true` | Detect voicemails |
| `voicemail_message` | TEXT | — | Custom voicemail message text |
| `voicemail_action` | VARCHAR | `'leave_message'` | `leave_message`, `hangup`, `ignore` |

### Calendar Configuration

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `calendar_context_enabled` | BOOLEAN | `true` | Enable calendar awareness |
| `calendar_timezone` | TEXT | `'America/New_York'` | Agent's timezone |
| `calendar_working_hours_start` | TEXT | `'09:00'` | Start of business hours |
| `calendar_working_hours_end` | TEXT | `'18:00'` | End of business hours |
| `calendar_working_days` | TEXT[] | `Mon-Fri` | Working days array |
| `calendar_exclude_holidays` | BOOLEAN | `true` | Exclude holidays |
| `preferred_video_provider` | TEXT | `'none'` | `none`, `google_meet`, `zoom`, `microsoft_teams` |
| `allow_rescheduling` | BOOLEAN | `true` | Allow contacts to reschedule |
| `no_show_auto_retry` | BOOLEAN | `true` | Auto-retry no-shows |
| `no_show_retry_delay_hours` | INTEGER | `24` | Hours before no-show retry |
| `default_meeting_duration` | INTEGER | `30` | Default meeting length in minutes |
| `connected_integrations` | TEXT[] | `[]` | CRM integrations to sync results to |

### Indexes

- `agent_runs_company_id_idx` — Company lookup
- `idx_agent_runs_agent_template_id` — Template filtering
- `idx_agent_runs_company_status` — `(company_id, status)` for dashboard queries
- `idx_agent_runs_calendar_timezone` — Timezone filtering (WHERE NOT NULL)

### RLS & Triggers

- `agent_runs_all` — Company-scoped access
- `agent_runs_service` — Service role bypass
- `trigger_notify_campaign_completion` (AFTER UPDATE) → `notify_campaign_completion()` — Creates [[Notification]] when status changes to `completed`
- `trigger_notify_high_failure_rate` (AFTER UPDATE) → `notify_high_failure_rate()` — Alerts when failure rate >50%

---

## Campaign Queue: `campaign_queue`

Individual call tasks within a campaign. Each entry represents one contact to call.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `company_id` | UUID FK → `companies` | — | CASCADE on delete |
| `campaign_id` | UUID | — | Campaign reference |
| `agent_run_id` | UUID | — | Agent run reference |
| `contact_id` | UUID | — | Contact to call |
| `phone_number` | TEXT | — | E.164 phone number |
| `contact_name` | TEXT | — | Display name |
| `call_config` | JSONB | `{}` | Call configuration (task, voice, etc.) |
| `webhook_url` | TEXT | — | Webhook URL for results |
| `dedicated_number` | TEXT | — | If using dedicated number [[Add-on]] |
| `effective_max_duration` | INTEGER | — | Plan-limited max call duration |
| `status` | TEXT | `'pending'` | `pending`, `processing`, `completed`, `failed`, `cancelled`, `skipped` |
| `priority` | INTEGER | `0` | Higher = processed first |
| `call_id` | TEXT | — | Bland AI call ID once dispatched |
| `error_message` | TEXT | — | Error details if failed |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `started_at` | TIMESTAMPTZ | — | When processing began |
| `completed_at` | TIMESTAMPTZ | — | When processing finished |

**Unique constraint:** `campaign_queue_agent_run_contact_unique` — Prevents duplicate entries for `(agent_run_id, contact_id)` WHERE status IN (`pending`, `processing`).

**Indexes:**
- `idx_campaign_queue_status_priority` — `(status, priority, created_at)` WHERE `status='pending'` — Queue processing order
- `idx_campaign_queue_company` — Company filtering

---

## Campaign Lifecycle

```
draft → running → completed
                → failed
       → paused → running (resume)
       → cancelled
```

| Status | Meaning |
|--------|---------|
| `draft` | Campaign created but not started |
| `running` | Actively dispatching calls |
| `paused` | Temporarily halted (can resume) |
| `completed` | All contacts processed |
| `failed` | Campaign-level failure |
| `cancelled` | Manually cancelled |

See [[Campaign Dispatch Flow]] for the full technical dispatch flow.

---

## Related Notes

- [[Agent]] — Campaigns use agent templates
- [[Contact]] — Campaigns call contacts
- [[Call]] — Call logs reference campaigns via `agent_run_id`
- [[Follow-Up]] — Auto-created from campaign call outcomes
- [[Voicemail]] — Voicemail logs reference campaigns
- [[Calendar Event]] — Calendar events created by campaigns
- [[Campaign Dispatch Flow]] — Technical dispatch workflow
- [[Call Processing Flow]] — Webhook processing pipeline
