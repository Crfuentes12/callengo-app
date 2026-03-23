---
tags: [integration, video]
---

# Video Providers

Video meeting links can be attached to [[Calendar Event]]s for scheduled meetings.

## Supported Providers

| Provider | Value in DB | Available On |
|----------|-------------|-------------|
| Google Meet | `google_meet` | Free+ |
| Zoom | `zoom` | Free+ |
| Microsoft Teams | `microsoft_teams` | Business+ |

## Configuration

Set per [[Campaign]] via `preferred_video_provider`:
- `'none'` — No video link (default)
- `'google_meet'` — Attach Google Meet link
- `'zoom'` — Attach Zoom link
- `'microsoft_teams'` — Attach Teams link

Video links stored in `calendar_events.video_link` and `contacts.video_link`.

## Related Notes
- [[Calendar Event]]
- [[Google Calendar]]
- [[Microsoft Outlook]]
- [[Campaign]]
