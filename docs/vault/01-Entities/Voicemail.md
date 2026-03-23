---
tags: [entity, voice, voicemail, detection]
aliases: [Voicemail Log, voicemail_logs]
---

# Voicemail

Records of voicemail detection and messages left during [[Call]]s. When [[Bland AI]] detects that a call has reached a voicemail system (rather than a human), it reports this in the webhook. Callengo logs the detection, optionally leaves a pre-configured message, and can automatically schedule a callback [[Follow-Up]] or create a [[Calendar Event]] for a later retry.

---

## Database Table: `voicemail_logs`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `call_id` | UUID FK → `call_logs` | — | NO | CASCADE on delete |
| `agent_run_id` | UUID FK → `agent_runs` | — | YES | SET NULL on delete |
| `contact_id` | UUID FK → `contacts` | — | YES | SET NULL on delete |
| `detected_at` | TIMESTAMPTZ | — | NO | When voicemail was detected |
| `confidence_score` | NUMERIC | — | YES | Detection confidence 0.00–1.00 |
| `detection_method` | VARCHAR | — | YES | How voicemail was detected |
| `message_left` | BOOLEAN | `false` | YES | Whether a message was recorded |
| `message_text` | TEXT | — | YES | Content of the voicemail message |
| `message_duration` | INTEGER | — | YES | Message duration in seconds |
| `message_audio_url` | TEXT | — | YES | URL to voicemail audio |
| `follow_up_scheduled` | BOOLEAN | `false` | YES | Whether a follow-up was created |
| `follow_up_id` | UUID FK → `follow_up_queue` | — | YES | SET NULL on delete |
| `metadata` | JSONB | `{}` | YES | Additional detection context |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |

### Detection Methods

| Method | Description | Confidence |
|--------|-------------|-----------|
| `ai_analysis` | Bland AI's built-in ML voicemail detection | High (0.80-0.99) |
| `beep_detection` | Audio pattern matching for voicemail beep tones | Medium (0.60-0.85) |
| `silence_pattern` | Extended silence after automated greeting | Low (0.40-0.70) |

### Indexes

| Index | Columns | Condition | Purpose |
|-------|---------|-----------|---------|
| `idx_voicemail_company_id` | `company_id` | — | Company filtering |
| `idx_voicemail_call_id` | `call_id` | — | Call lookup |
| `idx_voicemail_agent_run` | `agent_run_id` | — | Campaign filtering |
| `idx_voicemail_created_at` | `created_at DESC` | — | Recent voicemails |
| `idx_voicemail_logs_contact_id` | `contact_id` | `WHERE NOT NULL` | Contact lookup |
| `idx_voicemail_logs_follow_up_id` | `follow_up_id` | `WHERE NOT NULL` | Follow-up linking |

### RLS Policies

- `voicemail_logs_select` — Company-scoped SELECT
- `voicemail_logs_insert` — Company-scoped INSERT + service role bypass

---

## Campaign Voicemail Configuration

Voicemail behavior is configured per [[Campaign]] (on the `agent_runs` table):

| Setting | Column | Default | Description |
|---------|--------|---------|-------------|
| Enable voicemail messages | `voicemail_enabled` | `false` | Whether to leave messages on voicemail |
| Enable detection | `voicemail_detection_enabled` | `true` | Whether to detect voicemails |
| Custom message | `voicemail_message` | Template default | Text of the voicemail message (max 1,000 chars) |
| Detection action | `voicemail_action` | `'leave_message'` | `leave_message`, `hangup`, `ignore` |

The voicemail message can also be overridden per-call in the `call_config.voicemail_message` field of the `campaign_queue` entry.

---

## Post-Voicemail Actions

When a voicemail is detected during the [[Call Processing Flow]], the webhook handler performs these actions:

1. **Create voicemail_logs entry** with detection details (confidence, method, message status)
2. **Update agent_run counters:**
   - `voicemails_detected += 1`
   - `voicemails_left += 1` (if `message_left = true`)
3. **Schedule callback** (if callback_enabled on campaign):
   - Check for existing callback within last 5 minutes (idempotency)
   - Find next available slot via `getNextAvailableSlot()` respecting working hours
   - Fallback: next business day at 10:00 AM
   - Create [[Calendar Event]] of type `callback` or `voicemail_followup`
4. **Link to follow-up** — If the `auto_create_followup` trigger creates a [[Follow-Up]], the voicemail_log's `follow_up_id` is set to reference it

---

## Voicemail Detection Flow

```
Bland AI call completes
    │
    ├── answered_by = 'voicemail' ?
    │   OR status = 'voicemail' ?
    │       │
    │       YES → Create voicemail_logs entry
    │             │
    │             ├── campaign.voicemail_action = 'leave_message' ?
    │             │       YES → message_left = true, record duration/URL
    │             │       NO  → message_left = false
    │             │
    │             ├── Increment agent_run counters
    │             │
    │             └── callback_enabled ?
    │                     YES → Schedule callback calendar event
    │                     NO  → Skip
    │
    └── NO → Normal call processing (human answered)
```

---

## Plan Availability

Voicemail detection and messages are available on **Starter+** plans (not Free). The `voicemailDetection` field in `CAMPAIGN_FEATURE_ACCESS` controls this:

| Plan | Voicemail Detection |
|------|-------------------|
| Free | No |
| Starter | Yes |
| Growth | Yes |
| Business | Yes |
| Teams | Yes |
| Enterprise | Yes |

---

## Related Notes

- [[Call]] — Voicemails are logged per call
- [[Campaign]] — Voicemail config lives on campaigns
- [[Contact]] — Voicemails reference contacts
- [[Follow-Up]] — Voicemails can trigger follow-ups
- [[Calendar Event]] — Voicemails create callback events
- [[Call Processing Flow]] — Where voicemail detection happens
- [[Bland AI]] — Voicemail detection technology
