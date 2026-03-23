---
tags: [integration, video, conferencing, meetings]
aliases: [Video Conferencing, Meeting Links]
---

# Video Providers

Callengo supports three video conferencing providers for creating meeting links when AI agents schedule meetings or appointments. Video links are generated during call conversations (e.g., when the [[Lead Qualification]] agent schedules a demo) and stored on both the [[Calendar Event]] and the [[Contact]] record.

---

## Supported Providers

| Provider | Plan Availability | Value in Code | Link Format |
|----------|------------------|---------------|-------------|
| **Google Meet** | Free+ | `google_meet` | `https://meet.google.com/xxx-xxxx-xxx` |
| **Zoom** | Free+ | `zoom` | `https://zoom.us/j/XXXXXXXXXX` |
| **Microsoft Teams** | Business+ | `microsoft_teams` | `https://teams.microsoft.com/l/meetup-join/...` |

---

## Configuration

Video provider preference is configured **per campaign** on the [[Campaign]] (`agent_runs`) table:

| Column | Type | Default | Valid Values |
|--------|------|---------|-------------|
| `preferred_video_provider` | TEXT | `'none'` | `none`, `google_meet`, `zoom`, `microsoft_teams` |

When set to a value other than `'none'`, the AI agent will include a video meeting link when scheduling meetings.

---

## Where Video Links Are Stored

| Table | Column | Description |
|-------|--------|-------------|
| `calendar_events` | `video_link` | Meeting URL |
| `calendar_events` | `video_provider` | Provider identifier |
| `contacts` | `video_link` | Last scheduled meeting URL |

---

## Usage in Agent Workflows

### Lead Qualification Agent
When a qualified lead agrees to a meeting, the agent:
1. Checks `preferred_video_provider` on the campaign
2. Generates appropriate meeting link
3. Communicates the link during the call: "I'll send you a calendar invite with a [Google Meet/Zoom/Teams] link"
4. Creates [[Calendar Event]] with `video_link` and `video_provider` fields

### Appointment Confirmation Agent
When a contact reschedules:
1. New [[Calendar Event]] inherits the original event's video provider
2. Video link is regenerated if needed
3. Updated link synced to external calendar ([[Google Calendar]] or [[Microsoft Outlook]])

---

## Related Notes

- [[Calendar Event]] — Event storage with video fields
- [[Campaign]] — Video provider configuration per campaign
- [[Lead Qualification]] — Meeting scheduling workflow
- [[Appointment Confirmation]] — Rescheduling with video links
- [[Google Calendar]] — Calendar integration (Google Meet)
- [[Microsoft Outlook]] — Calendar integration (Teams)
- [[Plan Features]] — Provider availability by plan
