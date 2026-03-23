---
tags: [entity, ux]
---

# Notification

In-app notifications for campaign events, usage warnings, and system alerts.

## Database Table: `notifications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| user_id | UUID FK → users | CASCADE (NULL = all users) |
| type | VARCHAR(50) | See types below |
| title | TEXT | |
| message | TEXT | |
| read | BOOLEAN | Default false |
| metadata | JSONB | |

## Notification Types

| Type | Trigger |
|------|---------|
| `campaign_completed` | Campaign finishes all calls |
| `campaign_failed` | Campaign encounters critical failure |
| `high_failure_rate` | >50% failure rate in campaign (via trigger) |
| `minutes_warning` | 80% of plan minutes used |
| `minutes_critical` | 90% of plan minutes used |
| `minutes_exceeded` | 100% of plan minutes used |

## Database Triggers

- **`notify_campaign_completion`** — Fires on `agent_runs` status change to completed/failed
- **`notify_high_failure_rate`** — Fires when failure rate exceeds 50%
- **`notify_minutes_limit`** — Fires at 80%, 90%, and 100% usage thresholds

## Key Indexes

- `idx_notifications_company_user_unread WHERE read = false` — Unread badge count

## Related Notes

- [[Campaign]]
- [[Usage Tracking]]
