---
tags: [workflow, agent, scheduling]
---

# Appointment Confirmation

AI agent workflow that calls contacts 24-48h before appointments to confirm, reschedule, or detect no-shows.

## Workflow

```
1. Campaign created with Appointment Confirmation agent
2. Contacts with upcoming appointments loaded
3. Agent calls each contact:
   a. Confirm appointment date/time
   b. If confirmed → Update confirmation_status
   c. If reschedule needed → Offer new times (from availability)
   d. If decline → Cancel and note reason
4. Post-call:
   a. Calendar event updated (confirmed/rescheduled/cancelled)
   b. Contact appointment_confirmed = true/false
   c. If no answer → Follow-up queued
5. No-show handling:
   a. After appointment time, mark as no_show
   b. Auto-retry call after configurable delay
   c. no_show_count incremented on contact
```

## Calendar Integration

- Reads availability from [[Google Calendar]] or [[Microsoft Outlook]]
- Creates/updates [[Calendar Event]]s with confirmation status
- Supports video meeting links ([[Video Providers]])
- Working hours and timezone configurable per campaign

## Campaign Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| calendar_timezone | America/New_York | |
| calendar_working_hours_start | 09:00 | |
| calendar_working_hours_end | 18:00 | |
| allow_rescheduling | true | Let contacts pick new times |
| no_show_auto_retry | true | Auto-call no-shows |
| no_show_retry_delay_hours | 24 | Hours to wait before retry |
| default_meeting_duration | 30 | Minutes |

## Contact Outcomes

- `completed` → Appointment confirmed
- `callback` → Requested reschedule
- `no_answer` → Follow-up scheduled
- Contact `no_show_count` tracked for repeat offenders

## Related Notes

- [[Agent]]
- [[Campaign]]
- [[Calendar Event]]
- [[Follow-Up]]
- [[SimplyBook]]
