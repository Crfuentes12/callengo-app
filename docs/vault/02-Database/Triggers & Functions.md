---
tags: [database, triggers, functions]
---

# Triggers & Functions

## Timestamp Triggers

Generic `update_updated_at_column()` function used by 20+ tables to auto-set `updated_at` on UPDATE.

## Business Logic Triggers

| Trigger | Table | Description |
|---------|-------|-------------|
| `auto_create_followup` | call_logs | Creates [[Follow-Up]] entries when call completes with retry-eligible status |
| `notify_campaign_completion` | agent_runs | Creates [[Notification]] when campaign status changes to completed/failed |
| `notify_high_failure_rate` | call_logs | Alerts when >50% failure rate in a campaign |
| `notify_minutes_limit` | usage_tracking | Alerts at 80%, 90%, 100% minute usage |
| `check_max_dedicated_numbers` | company_addons | Enforces max 3 dedicated numbers per company |
| `prevent_role_self_escalation` | users | Blocks users from changing their own role |
| `prevent_sensitive_field_changes` | users | Blocks company_id/email self-changes |

## RPC Functions

### `claim_analysis_job()`
Atomic job claiming for the [[Call|analysis queue]] using `FOR UPDATE SKIP LOCKED`:
```sql
-- Claims oldest pending job atomically
UPDATE analysis_queue
SET status = 'processing', started_at = NOW(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM analysis_queue
  WHERE status = 'pending' AND attempts < max_attempts
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

### `increment_usage_minutes(company_uuid, minutes_int)`
Atomic increment for [[Usage Tracking|usage tracking]]:
```sql
UPDATE usage_tracking
SET minutes_used = minutes_used + minutes_int
WHERE company_id = company_uuid
  AND period_start <= NOW()
  AND period_end >= NOW();
```

### `atomic_increment_usage(company_uuid, minutes_numeric)`
Fallback atomic increment with NUMERIC precision.

## CHECK Constraints

Status columns validated at DB level (not just application):

| Table | Column | Valid Values |
|-------|--------|-------------|
| company_subscriptions | status | active, trialing, past_due, canceled, expired, incomplete, paused |
| contacts | status | new, pending, called, completed, failed, no_answer, busy, voicemail, callback, qualified, disqualified, do_not_call, invalid_number |
| agent_runs | status | pending, running, paused, completed, failed, cancelled |
| follow_up_queue | status | pending, calling, completed, failed, cancelled, scheduled |
| call_queue | status | pending, processing, completed, failed, cancelled, skipped |
| campaign_queue | status | pending, processing, completed, failed, cancelled, skipped |
| team_invitations | status | pending, accepted, expired, cancelled, declined, revoked |
| company_addons | addon_type | dedicated_number, recording_vault, calls_booster |

## Related Notes

- [[Schema Overview]]
- [[RLS Patterns]]
- [[Call]]
- [[Follow-Up]]
- [[Notification]]
