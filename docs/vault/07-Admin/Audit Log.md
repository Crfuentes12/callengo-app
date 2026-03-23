---
tags: [admin, security, audit, database, immutable]
aliases: [admin_audit_log, Admin Audit Trail, Audit Trail]
created: 2026-03-23
updated: 2026-03-23
---

# Audit Log

The `admin_audit_log` table is an append-only, immutable log of all administrative actions performed on the Callengo platform. It captures who did what, when, from where, and preserves both the old and new state of any changed entity. This table is central to the platform's security posture and operational accountability.

The audit log is designed to be tamper-proof: regular users cannot write to it (only `service_role`), and no one can update or delete records. Even platform admins can only read entries, never modify them.

---

## Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID PK | `gen_random_uuid()` | Unique identifier for the audit entry |
| `user_id` | UUID | NOT NULL, FK to `users.id` | The admin or owner who performed the action |
| `action` | TEXT | NOT NULL | Machine-readable action identifier (see Tracked Actions below) |
| `entity_type` | TEXT | nullable | The type of entity affected (e.g., `bland_plan`, `company`, `subscription`) |
| `entity_id` | TEXT | nullable | The ID of the specific entity affected |
| `old_value` | JSONB | nullable | Complete previous state of the entity before the action |
| `new_value` | JSONB | nullable | Complete new state of the entity after the action |
| `ip_address` | TEXT | nullable | IP address of the request that triggered the action |
| `user_agent` | TEXT | nullable | Browser/client user agent string |
| `created_at` | TIMESTAMPTZ | `now()` | Timestamp of when the action occurred |

The `old_value` and `new_value` columns use JSONB to store arbitrary structured data. This makes the audit log flexible enough to record any kind of state change without requiring schema modifications for new entity types.

---

## Row Level Security

The RLS policies on this table are the most restrictive in the entire database, reflecting its role as a security artifact.

| Operation | Allowed | Enforcement | Rationale |
|-----------|---------|-------------|-----------|
| **SELECT** | `admin`, `owner` | RLS policy checks `role` in `users` table | Admins need to review the audit trail |
| **INSERT** | `service_role` only | RLS policy rejects all authenticated users | Only server-side API code (using the Supabase service role key) can write entries. This prevents any client-side manipulation. |
| **UPDATE** | Nobody | No UPDATE policy exists | Audit entries are immutable once written |
| **DELETE** | Nobody | No DELETE policy exists | Audit entries can never be removed |

This design means that even if an admin account is compromised, the attacker cannot cover their tracks by modifying or deleting audit log entries. The only way to write to this table is through server-side code that uses the `SUPABASE_SERVICE_ROLE_KEY`, which is never exposed to the client.

---

## Tracked Actions

The following actions are currently recorded in the audit log:

### bland_plan_change

Recorded when an admin changes the active Bland AI plan via the [[Command Center]] Health tab dropdown.

| Field | Example |
|-------|---------|
| `action` | `bland_plan_change` |
| `entity_type` | `bland_plan` |
| `entity_id` | `admin_platform_config` row ID |
| `old_value` | `{"plan": "start", "cost_per_minute": 0.14, "concurrent_cap": 10, "daily_cap": 100, "hourly_cap": 100}` |
| `new_value` | `{"plan": "scale", "cost_per_minute": 0.11, "concurrent_cap": 100, "daily_cap": 5000, "hourly_cap": 1000}` |

### company_suspension

Recorded when an admin suspends or reactivates a company account.

| Field | Example |
|-------|---------|
| `action` | `company_suspension` |
| `entity_type` | `company` |
| `entity_id` | Company UUID |
| `old_value` | `{"status": "active"}` |
| `new_value` | `{"status": "suspended", "reason": "payment_failure"}` |

### subscription_override

Recorded when an admin manually modifies a company's subscription (e.g., granting a free upgrade, extending a trial, adjusting limits).

| Field | Example |
|-------|---------|
| `action` | `subscription_override` |
| `entity_type` | `subscription` |
| `entity_id` | Subscription UUID |
| `old_value` | `{"plan_slug": "starter", "status": "active"}` |
| `new_value` | `{"plan_slug": "business", "status": "active", "override_reason": "strategic_partner"}` |

### platform_config_update

Recorded when any field in [[Platform Config|admin_platform_config]] is changed, except for Bland plan changes (which have their own action type).

| Field | Example |
|-------|---------|
| `action` | `platform_config_update` |
| `entity_type` | `platform_config` |
| `entity_id` | `admin_platform_config` row ID |
| `old_value` | `{"maintenance_mode": false}` |
| `new_value` | `{"maintenance_mode": true, "maintenance_message": "Scheduled maintenance 2-4 AM UTC"}` |

### manual_usage_adjustment

Recorded when an admin manually adjusts a company's tracked usage (e.g., crediting minutes after a Bland AI outage).

| Field | Example |
|-------|---------|
| `action` | `manual_usage_adjustment` |
| `entity_type` | `usage_tracking` |
| `entity_id` | Company UUID |
| `old_value` | `{"minutes_used": 450}` |
| `new_value` | `{"minutes_used": 420, "adjustment_reason": "bland_outage_20260315"}` |

---

## Indexes

Three indexes optimize the most common query patterns:

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_audit_log_created_at` | `created_at DESC` | Supports reverse chronological listing (most recent first) |
| `idx_audit_log_action` | `action` | Supports filtering by action type |
| `idx_audit_log_user_id` | `user_id` | Supports filtering by who performed the action |

The `created_at DESC` index is particularly important because the [[Command Center]] always displays audit entries in reverse chronological order, and without this index, every query would require a full table sort.

---

## How Entries Are Written

Audit entries are written exclusively from API route handlers using the Supabase service role client (`createServiceSupabaseClient()` from `src/lib/supabase/service.ts`). The pattern is:

1. The API handler authenticates the user and verifies their admin/owner role.
2. The handler reads the current state of the entity being modified (`old_value`).
3. The handler performs the modification.
4. The handler inserts an audit log entry with both old and new values.
5. The request headers are used to extract `ip_address` (from `x-forwarded-for` or `x-real-ip`) and `user_agent`.

This happens within the same request but not within a database transaction, so it is theoretically possible (though unlikely) for the audit write to fail while the main operation succeeds. A failed audit write does not roll back the main operation -- this is a deliberate trade-off to avoid blocking legitimate admin actions due to audit infrastructure issues.

---

## Retention

There is currently no automatic retention policy or archival process for audit log entries. All entries are retained indefinitely. For a high-volume platform, a retention policy should be considered in the future, potentially archiving entries older than 12 months to cold storage while keeping recent entries in the hot table.

---

## Querying the Audit Log

The audit log is currently only accessible through the [[Command Center]] UI. There is no dedicated API endpoint for querying the audit log independently. The Command Center fetches recent audit entries as part of the `GET /api/admin/command-center` response.

Common query patterns:

```sql
-- Recent actions by a specific admin
SELECT * FROM admin_audit_log
WHERE user_id = '{admin_uuid}'
ORDER BY created_at DESC
LIMIT 50;

-- All Bland plan changes
SELECT * FROM admin_audit_log
WHERE action = 'bland_plan_change'
ORDER BY created_at DESC;

-- Actions affecting a specific company
SELECT * FROM admin_audit_log
WHERE entity_id = '{company_uuid}'
ORDER BY created_at DESC;
```

---

## Related Notes

- [[Command Center]] -- Primary UI for viewing and triggering audit entries
- [[Platform Config]] -- Configuration changes are audited
- [[RLS Patterns]] -- The most restrictive RLS pattern in the system
- [[Security & Encryption]] -- Overall security architecture
- [[Triggers & Functions]] -- Database-level enforcement
- [[Schema Overview]] -- Full database schema
