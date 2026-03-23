---
tags: [integration, calendar]
aliases: [Outlook]
---

# Microsoft Outlook

Calendar integration via OAuth 2.0 (Azure AD). Available on **Business+** plans.

## Auth
- Type: OAuth 2.0 via Azure AD
- Stored in `calendar_integrations` table with `provider = 'microsoft_outlook'`
- Includes `microsoft_tenant_id` and `microsoft_calendar_id`
- Tokens encrypted via AES-256-GCM

## Capabilities
- Bi-directional sync
- Incremental sync via `sync_token`
- Availability checking

## Source Files
- `src/lib/calendar/outlook.ts`

## Related Notes
- [[Calendar Event]]
- [[Calendar API]]
- [[Dynamics 365]]
- [[Video Providers]] (Microsoft Teams)
