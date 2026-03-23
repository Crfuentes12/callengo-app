---
tags: [entity, core, voice]
aliases: [Call Log, Phone Call]
---

# Call

A record of an outbound phone call made by an AI [[Agent]], typically as part of a [[Campaign]].

## Database Table: `call_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| agent_run_id | UUID FK → agent_runs | SET NULL |
| contact_id | UUID FK → contacts | SET NULL |
| call_id | TEXT | Bland AI external call ID |
| phone_number | TEXT | |
| status | TEXT | completed, no-answer, busy, failed, etc. |
| duration_seconds | INTEGER | |
| transcript | TEXT | Full call transcript from Bland AI |
| call_analysis | JSONB | AI-generated analysis (from [[OpenAI]]) |

### Voicemail Tracking

| Column | Type |
|--------|------|
| voicemail_detected | BOOLEAN |
| voicemail_left | BOOLEAN |
| voicemail_message_url | TEXT |
| voicemail_duration | INTEGER |

### Recording Storage

| Column | Type | Notes |
|--------|------|-------|
| recording_stored_url | TEXT | Supabase storage URL |
| recording_expires_at | TIMESTAMPTZ | For retention policy |
| recording_archived | BOOLEAN | |

### Metadata

| Column | Type |
|--------|------|
| metadata | JSONB |
| created_at | TIMESTAMPTZ |

## Call Flow

1. Campaign dispatches call via [[Campaign Queue]]
2. [[Bland AI]] makes the call using master API key
3. Bland webhook (`/api/bland/webhook`) receives result
4. Call log created/updated with transcript + status
5. [[Analysis Queue]] picks up for AI analysis ([[OpenAI]])
6. [[Follow-Up]] auto-created if conditions met (via trigger)
7. Usage tracked in `usage_tracking` for [[Stripe Integration|billing]]
8. Redis call slot released

## Call Analysis (JSONB)

The `call_analysis` field contains AI-generated intelligence:

```json
{
  "summary": "Brief call summary",
  "sentiment": "positive|neutral|negative",
  "intent": "qualified|not_qualified|callback|...",
  "key_points": ["..."],
  "lead_score": 85,
  "bant": {
    "budget": true,
    "authority": true,
    "need": true,
    "timeline": "Q2 2026"
  },
  "next_steps": ["Schedule demo", "Send pricing"]
}
```

## Key Indexes

- `idx_call_logs_call_id` — Lookup by Bland AI call ID (webhook processing)
- `idx_call_logs_company_status_created` — Dashboard queries
- `idx_call_logs_contact_recent` — Contact call history

## Triggers

- **`auto_create_followup`** — On UPDATE, creates [[Follow-Up]] entries based on campaign follow-up configuration
- **`notify_high_failure_rate`** — Alerts when >50% failure rate in a campaign

## Related Notes

- [[Campaign]]
- [[Contact]]
- [[Bland AI]]
- [[OpenAI]]
- [[Call Processing Flow]]
- [[Voicemail]]
- [[Follow-Up]]
