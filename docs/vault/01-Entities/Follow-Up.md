---
tags: [entity, automation]
aliases: [Follow Up, Retry]
---

# Follow-Up

Automatic retry calls for contacts that weren't successfully reached. Created by database trigger when a call completes with certain outcomes.

## Database Table: `follow_up_queue`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| agent_run_id | UUID FK → agent_runs | CASCADE |
| contact_id | UUID FK → contacts | CASCADE |
| original_call_id | UUID FK → call_logs | SET NULL |
| attempt_number | INTEGER | Default 1 |
| max_attempts | INTEGER | Default 3 |
| next_attempt_at | TIMESTAMPTZ | When to retry |
| last_attempt_at | TIMESTAMPTZ | |
| status | TEXT CHECK | pending, calling, completed, failed, cancelled, scheduled |
| reason | VARCHAR(50) | no_answer, busy, voicemail_left, answered, max_attempts_reached |
| metadata | JSONB | |

## Auto-Creation Trigger

The `auto_create_followup` trigger fires on `call_logs` UPDATE and creates a follow-up when:
- The campaign has `follow_up_enabled = true`
- Call status matches configured conditions (e.g., `no_answer`, `busy`)
- Max attempts not yet reached
- `next_attempt_at` = NOW + `follow_up_interval_hours`

## Follow-Up Lifecycle

```
pending → scheduled → calling → completed
                              → failed
                    → cancelled
```

## Key Indexes

- `idx_followup_next_attempt WHERE status = 'pending'` — Queue processing
- `idx_followup_status` — Status filtering

## Related Notes

- [[Call]]
- [[Campaign]]
- [[Contact]]
- [[Campaign Dispatch Flow]]
