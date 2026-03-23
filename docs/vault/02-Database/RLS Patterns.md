---
tags: [database, security, rls]
aliases: [Row Level Security]
---

# RLS Patterns

All user-facing tables in Callengo use Row Level Security (RLS). Five patterns are used consistently.

## Pattern 1: Company-Scoped Access

The most common pattern. Users can only access data belonging to their company.

```sql
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
))
WITH CHECK (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
))
```

**Applied to:** contacts, call_logs, agent_runs, company_settings, company_agents, contact_lists, follow_up_queue, voicemail_logs, calendar_events, calendar_integrations, usage_tracking, webhook_endpoints, webhook_deliveries, notifications, campaign_queue, and all CRM integration tables.

## Pattern 2: Service Role Bypass

Allows API routes using the service role key to bypass RLS for webhook processing, background jobs, etc.

```sql
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role')
```

**Applied to:** All tables as an additional policy.

## Pattern 3: User Self-Access

Users can only read/modify their own record.

```sql
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()))
```

**Applied to:** `users`, `ai_conversations` (via `user_id`).

## Pattern 4: Admin/Owner Only

Restricts access to admin and owner roles.

```sql
USING (EXISTS (
  SELECT 1 FROM users
  WHERE id = auth.uid() AND role IN ('admin', 'owner')
))
```

**Applied to:** `team_invitations`, `admin_platform_config`, `admin_audit_log`, `admin_finances`.

## Pattern 5: Restricted Update (Role-Based Write)

Only specific roles can modify records.

```sql
-- UPDATE policy for company_subscriptions
USING (company_id IN (
  SELECT company_id FROM users
  WHERE id = auth.uid() AND role IN ('owner', 'admin')
))
```

**Applied to:** `company_subscriptions` (UPDATE/INSERT by owner/admin only).

## Security Triggers (Beyond RLS)

| Trigger | Table | Protection |
|---------|-------|-----------|
| `prevent_role_self_escalation` | users | Blocks self-role changes |
| `prevent_sensitive_field_changes` | users | Blocks self-changes to company_id, email |
| `check_max_dedicated_numbers` | company_addons | Max 3 dedicated numbers per company |

## Soft-Delete Protection

The `companies` table has additional RLS logic:
- Normal users see only `WHERE deleted_at IS NULL`
- Admin/owner can see soft-deleted companies within 30-day recovery window

## Related Notes

- [[Schema Overview]]
- [[User]]
- [[Company]]
