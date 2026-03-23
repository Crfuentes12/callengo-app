---
tags: [entity, voice]
---

# Voicemail

Records of voicemail detection and messages left during [[Call]]s.

## Database Table: `voicemail_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| call_id | UUID FK → call_logs | CASCADE |
| agent_run_id | UUID FK → agent_runs | SET NULL |
| contact_id | UUID FK → contacts | SET NULL |
| detected_at | TIMESTAMPTZ | |
| confidence_score | DECIMAL(3,2) | 0.00 to 1.00 |
| detection_method | VARCHAR(50) | ai_analysis, beep_detection, silence_pattern |
| message_left | BOOLEAN | Default false |
| message_text | TEXT | Voicemail message content |
| message_duration | INTEGER | Seconds |
| message_audio_url | TEXT | |
| follow_up_scheduled | BOOLEAN | |
| follow_up_id | UUID FK → follow_up_queue | SET NULL |
| metadata | JSONB | |

## Detection Methods

1. **ai_analysis** — Bland AI's built-in voicemail detection
2. **beep_detection** — Audio pattern matching for voicemail beeps
3. **silence_pattern** — Extended silence after greeting

## Campaign Configuration

Voicemail behavior is configured per [[Campaign]]:
- `voicemail_enabled` — Whether to leave voicemail messages
- `voicemail_detection_enabled` — Whether to detect voicemails
- `voicemail_message` — Custom voicemail text
- `voicemail_action` — Action on detection (default: `leave_message`)

## Related Notes

- [[Call]]
- [[Campaign]]
- [[Follow-Up]]
