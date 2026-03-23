---
tags: [entity, core, multi-tenant]
aliases: [Tenant, Organization]
---

# Company

The top-level tenant entity. All data in Callengo is scoped to a company via `company_id` foreign keys enforced by [[RLS Patterns|RLS]].

## Database Tables

### `companies`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | Company display name |
| logo_url | TEXT | |
| website | TEXT | |
| industry | TEXT | |
| size | TEXT | |
| deleted_at | TIMESTAMPTZ | Soft-delete, 30-day recovery |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

- **Soft-delete:** `deleted_at` column with partial index `WHERE deleted_at IS NULL`
- **RLS:** Company members can SELECT/UPDATE; service_role bypass; soft-deleted companies excluded from normal queries

### `company_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| bland_subaccount_id | TEXT | Always `'master'` in v4 |
| bland_api_key | TEXT | Master key reference |
| default_agent_id | UUID | |
| agent_voice_id | TEXT | |
| call_recording_enabled | BOOLEAN | Default true |

## Relationships

```
Company
├── [[User]]s (via users.company_id)
├── [[Contact]]s (via contacts.company_id)
├── [[Agent]]s (via company_agents.company_id)
├── [[Campaign]]s (via agent_runs.company_id)
├── [[Call]]s (via call_logs.company_id)
├── [[Subscription]] (via company_subscriptions.company_id)
├── [[Add-on]]s (via company_addons.company_id)
├── [[Calendar Event]]s (via calendar_events.company_id)
├── [[Follow-Up]]s (via follow_up_queue.company_id)
├── [[Voicemail]]s (via voicemail_logs.company_id)
├── [[Notification]]s (via notifications.company_id)
├── [[Webhook]]s (via webhook_endpoints.company_id)
├── [[Team Invitation]]s (via team_invitations.company_id)
└── CRM Integrations (7 providers)
```

## Key Business Rules

- Every user belongs to exactly one company
- All data access is filtered by `company_id` via RLS
- Soft-deleted companies are excluded from queries but recoverable for 30 days
- Company settings are 1:1 with company (created during onboarding)

## Source Files

- Type: `src/types/index.ts` → `Company`, `CompanySettings`
- RLS: `supabase/migrations/20260322*.sql`
- Soft-delete: `supabase/migrations/20260323*.sql`

## Related Notes

- [[User]]
- [[Subscription]]
- [[Schema Overview]]
