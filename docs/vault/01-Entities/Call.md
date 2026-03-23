---
tags: [entity, core, voice, bland, call]
aliases: [Call Log, Phone Call, call_logs]
---

# Call

A record of an outbound phone call made by an AI [[Agent]], typically as part of a [[Campaign]]. Call logs are the central data artifact in Callengo — they capture the raw transcript, AI analysis, voicemail detection, recording URLs, and billing metadata for every call made through the platform.

---

## Database Table: `call_logs`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `uuid_generate_v4()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `contact_id` | UUID FK → `contacts` | — | YES | CASCADE on delete |
| `agent_template_id` | UUID FK → `agent_templates` | — | YES | Agent type used |
| `agent_run_id` | UUID FK → `agent_runs` | — | YES | SET NULL on delete |
| `call_id` | TEXT (UNIQUE) | — | NO | Bland AI external call ID |
| `status` | TEXT | — | YES | Call outcome (see below) |
| `completed` | BOOLEAN | `false` | YES | Whether webhook has been processed |
| `call_length` | INTEGER | — | YES | Duration in seconds |
| `price` | NUMERIC | — | YES | Bland AI cost for this call |
| `answered_by` | TEXT | — | YES | `human`, `voicemail`, `unknown` |
| `recording_url` | TEXT | — | YES | Bland AI recording URL (temporary) |
| `transcript` | TEXT | — | YES | Full call transcript from Bland AI |
| `summary` | TEXT | — | YES | AI-generated call summary |
| `analysis` | JSONB | — | YES | Structured AI analysis (see below) |
| `error_message` | TEXT | — | YES | Error details if call failed |
| `metadata` | JSONB | — | YES | Additional call data (see below) |
| `created_at` | TIMESTAMPTZ | `now()` | YES | When the call was initiated |
| `voicemail_detected` | BOOLEAN | `false` | YES | Whether voicemail was detected |
| `voicemail_left` | BOOLEAN | `false` | YES | Whether a message was left |
| `voicemail_message_url` | TEXT | — | YES | URL to voicemail audio |
| `voicemail_duration` | INTEGER | — | YES | Voicemail message duration in seconds |
| `recording_stored_url` | TEXT | — | YES | Supabase storage URL (permanent) |
| `recording_expires_at` | TIMESTAMPTZ | — | YES | When Bland recording expires |
| `recording_archived` | BOOLEAN | `false` | YES | Whether recording was archived |

### Call Statuses

| Status | Meaning |
|--------|---------|
| `queued` | Pre-registered, waiting for Bland dispatch |
| `in_progress` | Call is currently active |
| `completed` | Call completed successfully |
| `no-answer` | Contact didn't pick up |
| `busy` | Line was busy |
| `failed` | Technical failure |
| `voicemail` | Voicemail detected |
| `error` | System error during processing |

### Indexes

| Index | Columns | Condition | Purpose |
|-------|---------|-----------|---------|
| `call_logs_company_id_idx` | `company_id` | — | Dashboard queries |
| `call_logs_contact_id_idx` | `contact_id` | — | Contact history |
| `idx_call_logs_call_id` | `call_id` | — | Webhook lookup by Bland ID |
| `idx_call_logs_agent_template_id` | `agent_template_id` | `WHERE NOT NULL` | Agent-type filtering |
| `idx_call_logs_agent_run_id` | `agent_run_id` | `WHERE NOT NULL` | Campaign call listing |
| `idx_call_logs_contact_recent` | `(contact_id, created_at DESC)` | `WHERE contact_id NOT NULL` | Recent calls per contact |

### RLS Policies

- `call_logs_all` — Company-scoped access (SELECT/INSERT/UPDATE/DELETE)
- `call_logs_service` — Service role bypass (for webhook processing)

### Triggers

- **`auto_create_followup`** — On UPDATE, creates [[Follow-Up]] entry if campaign has `follow_up_enabled=true` and call status matches configured conditions (no_answer, busy, etc.)
- **`trigger_notify_high_failure_rate`** (AFTER UPDATE on `agent_runs`) — Creates [[Notification]] when failure rate exceeds 50%

---

## Call Lifecycle

The complete journey of a call from dispatch to final analysis:

1. **Pre-registration** — `campaign_queue` processor inserts `call_logs` record with `status=queued`, `completed=false`
2. **Redis slot acquisition** — `acquireCallSlot()` atomically increments all concurrency counters
3. **Dispatch** — `dispatchCall()` sends request to [[Bland AI]] POST `/v1/calls` with 15-second timeout
4. **Call active** — Bland AI makes the call; call_log updated to `status=in_progress`
5. **Webhook arrival** — Bland AI POSTs to `/api/bland/webhook` with call results
6. **Idempotency check** — Skip if `completed=true` (prevents duplicate processing)
7. **Atomic claim** — `UPDATE call_logs SET completed=true WHERE call_id=? AND completed=false`
8. **Data update** — Status, duration, transcript, recording, answered_by, price, summary
9. **Voicemail processing** — If `answered_by='voicemail'`, creates [[Voicemail]] log entry
10. **AI analysis** — Sync (inline, up to 10s) or async (queued to `analysis_queue`)
11. **Contact update** — Updates [[Contact]] with call_status, duration, recording, metadata
12. **Calendar events** — Creates callbacks/meetings if applicable
13. **CRM sync** — Pushes results to connected CRMs ([[HubSpot]], [[Salesforce]], [[Pipedrive]], [[Clio]])
14. **Redis release** — `releaseCallSlot()` decrements all counters
15. **Usage tracking** — `atomic_increment_usage()` increments minutes used
16. **Analytics** — [[Google Analytics 4]] server event + [[PostHog]] capture
17. **Outbound webhooks** — Fires to customer-configured [[Webhook]] endpoints

See [[Call Processing Flow]] for the complete webhook processing pipeline.

---

## AI Analysis Structure

The `analysis` JSONB field and `metadata.ai_intent_analysis` contain AI-generated intelligence from [[OpenAI]] GPT-4o-mini. The structure varies by agent type:

### Lead Qualification Analysis

```json
{
  "intent": "qualified",
  "qualificationScore": 8,
  "confidence": 0.85,
  "budget": "Yes, $50K allocated for Q2",
  "authority": "Decision maker confirmed",
  "need": "Current solution lacks automation",
  "timeline": "Looking to implement Q2 2026",
  "meetingTime": "2026-03-25T14:00:00Z",
  "extractedData": { "company_size": "150 employees" },
  "summary": "Qualified lead with strong BANT signals"
}
```

### Data Validation Analysis

```json
{
  "intent": "data_updated",
  "validatedFields": {
    "email": { "status": "confirmed", "value": "john@example.com" },
    "phone": { "status": "updated", "newValue": "+1-555-0199" },
    "address": { "status": "updated", "newValue": "456 Oak Ave" }
  },
  "newFields": { "job_title": "VP Engineering" },
  "summary": "Phone number and address updated, email confirmed"
}
```

### Appointment Confirmation Analysis

```json
{
  "intent": "confirmed",
  "confidence": 0.92,
  "newAppointmentTime": null,
  "patientSentiment": "positive",
  "extractedData": {},
  "summary": "Patient confirmed appointment for March 25 at 2 PM"
}
```

---

## Recording Storage Flow

Bland AI provides temporary recording URLs that expire after a configurable period. For companies with the [[Add-on|Recording Vault]] add-on, recordings are archived to permanent storage:

1. **Bland recording** — `recording_url` from webhook (temporary, Bland-hosted)
2. **Archive check** — If company has `addon_recording_vault` active, download and store
3. **Permanent storage** — `recording_stored_url` (Supabase storage)
4. **Expiration tracking** — `recording_expires_at` tracks when Bland URL expires
5. **Archive flag** — `recording_archived=true` after successful archival

---

## Metadata JSONB Structure

The `metadata` field stores additional call data that doesn't have dedicated columns:

```json
{
  "company_id": "uuid",
  "contact_id": "uuid",
  "agent_run_id": "uuid",
  "template_slug": "lead-qualification",
  "price": 0.23,
  "answered_by": "human",
  "summary": "Brief call summary",
  "error_message": null,
  "ai_intent_analysis": { /* see above */ },
  "analysis_job_id": "uuid"
}
```

---

## Related Notes

- [[Company]] — Calls belong to a company
- [[Contact]] — Each call is to a specific contact
- [[Campaign]] — Calls are dispatched as part of campaigns
- [[Agent]] — Calls use agent templates for behavior
- [[Follow-Up]] — Auto-created from call outcomes
- [[Voicemail]] — Voicemail detection and logging
- [[Call Processing Flow]] — Complete webhook processing pipeline
- [[Campaign Dispatch Flow]] — How calls are dispatched
- [[Bland AI]] — Voice infrastructure
- [[OpenAI]] — Post-call AI analysis
- [[Usage Tracking]] — Minutes consumed per call
