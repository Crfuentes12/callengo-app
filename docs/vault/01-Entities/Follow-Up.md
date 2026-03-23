---
tags: [entity, automation, queue, retry]
aliases: [Follow Up, Retry, follow_up_queue]
---

# Follow-Up

Automatic retry calls for contacts that weren't successfully reached on the first attempt. Follow-ups are created automatically by a database trigger when a call completes with certain outcomes (no-answer, busy, voicemail), and are processed by a background queue that re-dispatches the call after a configurable delay.

Follow-ups are one of Callengo's key differentiators: instead of giving up after one failed call attempt, the system automatically schedules retries with exponential backoff, ensuring maximum contact reach rates.

---

## Database Table: `follow_up_queue`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `agent_run_id` | UUID FK → `agent_runs` | — | NO | CASCADE on delete |
| `contact_id` | UUID FK → `contacts` | — | NO | CASCADE on delete |
| `original_call_id` | UUID FK → `call_logs` | — | YES | SET NULL on delete |
| `attempt_number` | INTEGER | `1` | YES | Current attempt (1-based) |
| `max_attempts` | INTEGER | `3` | YES | Maximum retry attempts |
| `next_attempt_at` | TIMESTAMPTZ | — | NO | When to retry |
| `last_attempt_at` | TIMESTAMPTZ | — | YES | Last retry timestamp |
| `status` | VARCHAR CHECK | `'pending'` | YES | See statuses below |
| `reason` | VARCHAR | — | YES | See reasons below |
| `metadata` | JSONB | `{}` | YES | Additional context |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |
| `updated_at` | TIMESTAMPTZ | `now()` | YES | |

### Follow-Up Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for `next_attempt_at` to arrive |
| `calling` | Currently being processed/dispatched |
| `completed` | Contact successfully reached |
| `failed` | All attempts exhausted or permanent failure |
| `cancelled` | Manually cancelled by user |
| `scheduled` | Scheduled for a specific time |

### Follow-Up Reasons

| Reason | Description |
|--------|-------------|
| `no_answer` | Contact didn't pick up |
| `busy` | Line was busy |
| `voicemail_left` | Voicemail was detected and message left |
| `answered` | Contact answered (follow-up completed) |
| `max_attempts_reached` | All retries exhausted |

### Indexes

| Index | Columns | Condition | Purpose |
|-------|---------|-----------|---------|
| `idx_followup_company_id` | `company_id` | — | Company filtering |
| `idx_followup_agent_run_id` | `agent_run_id` | — | Campaign filtering |
| `idx_followup_contact_id` | `contact_id` | — | Contact filtering |
| `idx_followup_next_attempt` | `next_attempt_at` | `WHERE status='pending'` | Queue processing |
| `idx_followup_status` | `status` | — | Status filtering |
| `idx_follow_up_queue_original_call_id` | `original_call_id` | `WHERE NOT NULL` | Original call lookup |

### RLS

- `follow_up_queue_all` — Company-scoped access (all operations)

### Triggers

- `update_followup_timestamp` → `update_followup_updated_at()` — Auto-update `updated_at`

---

## Auto-Creation Trigger: `auto_create_followup`

The `auto_create_followup` trigger fires on `call_logs` UPDATE and automatically creates follow-up entries when all conditions are met:

1. The [[Campaign]] has `follow_up_enabled = true`
2. The call status matches one of the configured `follow_up_conditions` (e.g., `{no_answer: true, busy: true, failed: false}`)
3. The contact hasn't already reached `max_attempts` for this campaign
4. The contact status isn't already terminal (e.g., `qualified`, `do_not_call`, `Completed`)

When triggered, it creates a `follow_up_queue` entry with:
- `next_attempt_at` = `NOW()` + `follow_up_interval_hours`
- `attempt_number` = previous attempt + 1
- `max_attempts` = campaign's `follow_up_max_attempts`

---

## Processing Flow

The follow-up queue processor (`src/lib/queue/followup-queue.ts`) runs periodically and processes pending follow-ups:

1. **Claim entries** — Atomically SELECT entries WHERE `status='pending'` AND `next_attempt_at <= NOW()`, ordered by `next_attempt_at ASC`, LIMIT 10
2. **Per entry:**
   a. Verify contact hasn't been reached since (skip if status is `completed`, `qualified`, etc.)
   b. Fetch [[Campaign]] settings for call configuration
   c. Check `checkCallAllowed()` — if throttled, reschedule 24h later
   d. INSERT to `campaign_queue` with `priority=1` (higher than regular dispatch, ensuring follow-ups get priority)
   e. Mark follow-up as `calling`
3. **Webhook completion** — When the follow-up call completes, the webhook updates both the call_log and the follow-up status

### Exponential Backoff

Follow-up intervals increase with each attempt using exponential backoff, capped at 7 days:

| Attempt | Delay Formula | Actual Delay |
|---------|--------------|-------------|
| 1 | 2^1 hours | 2 hours |
| 2 | 2^2 hours | 4 hours |
| 3 | 2^3 hours | 8 hours |
| 4 | 2^4 hours | 16 hours |
| 5 | 2^5 hours | 32 hours |
| 6+ | Capped | 168 hours (7 days) |

### Plan Limits for Follow-Ups

Follow-up capabilities vary by plan, configured in `src/config/plan-features.ts`:

| Plan | Follow-Ups Enabled | Max Attempts | Smart Follow-Up |
|------|-------------------|-------------|----------------|
| Free | No | 0 | No |
| Starter | Yes | 2 | No |
| Growth | Yes | 5 | Yes |
| Business | Yes | 10 | Yes |
| Teams | Yes | 15 | Yes |
| Enterprise | Yes | Unlimited (-1) | Yes |

---

## Follow-Up Lifecycle

```
pending → scheduled → calling → completed (contact reached)
                              → failed (max attempts or permanent failure)
                    → cancelled (manual cancellation)
       → calling (direct from pending if next_attempt_at passed)
```

---

## Related Notes

- [[Call]] — Follow-ups reference original calls
- [[Campaign]] — Follow-up config lives on campaigns
- [[Contact]] — Follow-ups target contacts
- [[Voicemail]] — Voicemails can trigger follow-ups
- [[Calendar Event]] — Follow-ups can create callback events
- [[Campaign Dispatch Flow]] — Follow-ups re-enter the dispatch pipeline
- [[Plan Features]] — Plan-specific follow-up limits
