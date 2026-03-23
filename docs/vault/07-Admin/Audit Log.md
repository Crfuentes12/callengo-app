---
tags: [admin, security, audit]
---

# Audit Log

Immutable log of admin actions in `admin_audit_log` table.

## Schema

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID | Who performed the action |
| action | TEXT | e.g., bland_plan_change, company_suspension |
| entity_type | TEXT | bland_plan, company, subscription |
| entity_id | TEXT | |
| old_value | JSONB | Previous state |
| new_value | JSONB | New state |
| ip_address | TEXT | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

## Security

- **SELECT:** Admin/owner roles only
- **INSERT:** Service role only (cannot be written by regular users)
- **UPDATE/DELETE:** Not allowed (immutable)

## Tracked Actions

- Bland plan changes (via [[Command Center]])
- Company suspension/reactivation
- Subscription overrides
- Platform config changes

## Related Notes

- [[Command Center]]
- [[Platform Config]]
- [[RLS Patterns]]
