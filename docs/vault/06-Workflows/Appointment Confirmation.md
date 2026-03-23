---
tags: [workflow, agent, scheduling, calendar, no-show]
aliases: [Appointment Confirmation Agent, Confirmation Workflow]
updated: 2026-03-23
---

# Appointment Confirmation

The Appointment Confirmation agent is one of Callengo's three AI [[Agent]] templates. It calls contacts 24-48 hours before scheduled appointments to confirm attendance, handle rescheduling requests, and detect no-shows. The agent is **calendar-aware**: it understands the company's working hours, time zone, and available slots, enabling it to offer concrete rescheduling alternatives during the conversation.

**Slug:** `appointment-confirmation` | **Category:** `appointment` | **Plan:** All plans (Free+)

---

## Workflow Overview

```
1. Campaign configured with appointment-confirmation agent
   │
2. Agent calls contact → opens with appointment context
   │   "Hi, I'm calling to confirm your appointment on March 25 at 2 PM."
   │
3. Conversation flow:
   ├── Contact confirms → "Great, you're all set for March 25."
   ├── Contact wants to reschedule:
   │   ├── Agent checks available slots (getNextAvailableSlot)
   │   ├── Proposes 2-3 alternatives
   │   └── Books new time if accepted
   ├── Contact cancels → Record cancellation reason
   └── No answer / voicemail → Leave message, schedule callback
   │
4. Post-call AI analysis (GPT-4o-mini):
   ├── Intent: confirmed / reschedule / cancel / no_show / callback / unclear
   ├── Confidence score (0.0-1.0)
   ├── New appointment time (if rescheduled)
   └── Patient sentiment (positive / neutral / negative / frustrated)
   │
5. Automatic actions based on intent:
   ├── confirmed (≥0.6 confidence) → syncConfirmAppointment()
   ├── reschedule → syncRescheduleAppointment()
   ├── no_show → syncHandleNoShow() (auto-retry if configured)
   └── callback → createAgentCallback()
   │
6. Calendar event updated (Google Calendar / Outlook)
   │
7. CRM sync (if connected)
```

---

## Post-Call AI Analysis

The `analyzeAppointmentIntent()` function sends the transcript to GPT-4o-mini:

**Output structure (`AppointmentIntentResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `intent` | string | `confirmed`, `reschedule`, `cancel`, `no_show`, `callback_requested`, `unclear` |
| `confidence` | number | 0.0-1.0 (≥0.6 is "high confidence") |
| `newAppointmentTime` | string (ISO) | New datetime if rescheduling |
| `patientSentiment` | string | `positive`, `neutral`, `negative`, `frustrated` |
| `extractedData` | object | Any phone, email, preferences mentioned |
| `summary` | string | One-sentence outcome |

---

## Automatic Post-Call Actions

### If Confirmed (confidence ≥ 0.6)

1. `syncConfirmAppointment()` called
2. [[Calendar Event]] updated: `status = 'confirmed'`, `confirmation_status = 'confirmed'`
3. [[Contact]] updated: `appointment_confirmed = true`
4. All pending [[Follow-Up]]s for this contact marked `completed`

### If Rescheduled

1. `syncRescheduleAppointment()` called
2. Original [[Calendar Event]] updated: `status = 'rescheduled'`, `rescheduled_count += 1`, `original_start_time` preserved
3. New calendar event created at `newAppointmentTime`
4. [[Contact]] updated: `appointment_rescheduled = true`, `appointment_date` = new time
5. [[Campaign]] stats updated

### If No-Show

1. `syncHandleNoShow()` called
2. [[Contact]] updated: `no_show_count += 1`
3. If campaign has `no_show_auto_retry = true`:
   - Schedule retry call after `no_show_retry_delay_hours` (default 24h)
   - Create [[Follow-Up]] entry
4. [[Calendar Event]] updated: `status = 'no_show'`

### If No Answer / Voicemail

1. Create callback [[Calendar Event]] at next available slot
2. Schedule [[Follow-Up]] entry (if `follow_up_enabled`)
3. If [[Voicemail]] detected: log in `voicemail_logs`, leave message if `voicemail_enabled`

---

## Calendar Configuration

These settings on the [[Campaign]] (`agent_runs`) table control calendar-aware behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| `calendar_context_enabled` | `true` | Enable calendar awareness |
| `calendar_timezone` | `'America/New_York'` | Agent's timezone |
| `calendar_working_hours_start` | `'09:00'` | Start of business hours |
| `calendar_working_hours_end` | `'18:00'` | End of business hours |
| `calendar_working_days` | `['monday'...'friday']` | Working days |
| `calendar_exclude_holidays` | `true` | Skip holidays |
| `allow_rescheduling` | `true` | Allow contacts to reschedule |
| `no_show_auto_retry` | `true` | Auto-retry no-shows |
| `no_show_retry_delay_hours` | `24` | Hours before no-show retry |
| `default_meeting_duration` | `30` | Meeting duration in minutes |
| `preferred_video_provider` | `'none'` | `google_meet`, `zoom`, `microsoft_teams` |

---

## Contact Outcomes

| Outcome | Contact Status | Calendar Event Status |
|---------|---------------|---------------------|
| Confirmed | `Completed` | `confirmed` |
| Rescheduled | `Completed` | `rescheduled` (old), `scheduled` (new) |
| Cancelled | `Completed` | `cancelled` |
| No-show | `No Answer` | `no_show` |
| Callback requested | `Callback` | `pending_confirmation` |
| Voicemail | `Voicemail` | Unchanged |

---

## Related Notes

- [[Agent]] — Agent template configuration
- [[Campaign]] — Campaign setup with calendar settings
- [[Call]] — Call log with AI analysis
- [[Contact]] — Contact appointment fields
- [[Calendar Event]] — Calendar event management
- [[Follow-Up]] — Callback and no-show retry scheduling
- [[Voicemail]] — Voicemail handling
- [[Google Calendar]] — Calendar integration
- [[Microsoft Outlook]] — Calendar integration
- [[Video Providers]] — Video meeting links
- [[OpenAI]] — AI analysis engine
