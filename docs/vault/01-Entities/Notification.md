---
tags: [entity, ux, alerts, triggers]
aliases: [In-App Notification, Alert, Usage Warning]
created: 2026-01-09
updated: 2026-03-23
---

# Notification

In-app notifications that inform users about campaign lifecycle events, usage threshold warnings, team changes, and subscription updates. Notifications are created both by PostgreSQL database triggers (for real-time campaign and usage events) and by application-level code (for team and billing events). They appear in the notification bell/dropdown in the Callengo UI, scoped to the user's [[Company]].

There are two distinct notification systems in Callengo that should not be confused:
1. **The `notifications` table** (this entity) -- general-purpose in-app notifications visible to users.
2. **The `billing_events` table** queried by `GET /api/billing/notifications` -- billing-specific alerts (`usage_alert`, `overage_alert`, `overage_budget_exceeded`) surfaced in the billing settings UI. These are separate from the `notifications` table and are documented under [[Subscription]].

---

## Database Table: `notifications`

Created in migration `add_notifications_system.sql` (2026-01-09). Functions were later hardened with `SET search_path = public` in migration `20260226000002_fix_warnings_and_team_invitations.sql` to prevent CVE-style search_path manipulation attacks.

### Full Column Specification

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NOT NULL | Primary key. |
| `company_id` | `UUID` | -- | NOT NULL | Foreign key to `companies(id)` with `ON DELETE CASCADE`. Scopes the notification to a [[Company]]. Used in all RLS policies to ensure company isolation. |
| `user_id` | `UUID` | -- | YES | Foreign key to `users(id)` with `ON DELETE CASCADE`. When set, the notification targets a specific [[User]]. When `NULL`, the notification is visible to all users in the company. Trigger-generated notifications (campaign, usage) always set `user_id` to `NULL`, making them company-wide. |
| `type` | `VARCHAR(50)` | -- | NOT NULL | The notification type identifier. Determines how the frontend renders the notification (icon, color, action link). See the full list of types below. |
| `title` | `TEXT` | -- | NOT NULL | Human-readable title displayed as the notification headline. For trigger-generated notifications, this is constructed from the event data (e.g., `'Campaign Completed'`, `'Minutes Limit Warning'`). |
| `message` | `TEXT` | -- | NOT NULL | Detailed notification body. For trigger-generated notifications, includes contextual data like campaign name, call counts, or usage percentages. |
| `read` | `BOOLEAN` | `false` | YES | Whether the user has dismissed or acknowledged the notification. The frontend toggles this via an UPDATE to mark notifications as read. The partial index `idx_notifications_company_user_unread` optimizes queries for the unread count badge. |
| `metadata` | `JSONB` | `'{}'::jsonb` | YES | Structured data associated with the notification. Used by the frontend to link to relevant resources (e.g., navigate to the campaign detail page using `metadata.campaign_id`). The schema varies by notification type; see the metadata schemas below. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOW()` | YES | When the notification was created. Used for chronological ordering in the notification feed. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | `NOW()` | YES | Last modification timestamp. Automatically updated by the `update_notifications_updated_at` trigger on any row UPDATE. |

### Indexes

| Index Name | Columns | Type | Partial | Notes |
|------------|---------|------|---------|-------|
| `notifications_pkey` | `id` | PRIMARY KEY | No | Default UUID PK index. |
| `idx_notifications_company_id` | `company_id` | B-tree | No | Fast lookup of all notifications for a company. Used in the main notification feed query. |
| `idx_notifications_user_id` | `user_id` | B-tree | No | Filter notifications targeted at a specific user. |
| `idx_notifications_read` | `read` | B-tree | No | General filter by read/unread state. |
| `idx_notifications_created_at` | `created_at DESC` | B-tree | No | Chronological ordering for the notification feed. Descending order matches the UI display (newest first). |
| `idx_notifications_company_user_unread` | `(company_id, user_id, read)` | B-tree | `WHERE read = false` | The most critical index for notification UX. Powers the unread notification count badge shown in the app header. The partial condition `WHERE read = false` keeps the index small and fast, containing only unread rows. |

### Foreign Key Relationships

| Column | References | On Delete | Purpose |
|--------|-----------|-----------|---------|
| `company_id` | `companies(id)` | `CASCADE` | When a company is deleted, all its notifications are removed. |
| `user_id` | `users(id)` | `CASCADE` | When a user is deleted, their targeted notifications are removed. Company-wide notifications (`user_id IS NULL`) are unaffected. |

### Triggers

| Trigger Name | Table | Event | Function | Description |
|-------------|-------|-------|----------|-------------|
| `update_notifications_timestamp` | `notifications` | `BEFORE UPDATE` | `update_notifications_updated_at()` | Automatically sets `updated_at = NOW()` on every row update. The function has `SET search_path = public` for security. |

### Row Level Security

RLS is enabled on `notifications`.

| Policy Name | Operation | Rule | Description |
|-------------|-----------|------|-------------|
| `Users can view notifications for their company` | `SELECT` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())` | Users can read all notifications belonging to their company, including company-wide notifications (`user_id IS NULL`) and those targeted at any user in their company. |
| `Users can update notifications for their company` | `UPDATE` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())` | Any company member can mark notifications as read. There is no role restriction (member, admin, owner all have equal access). |
| `Users can delete notifications for their company` | `DELETE` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())` | Any company member can delete notifications. In practice, the frontend typically marks as read rather than deleting. |
| `System can insert notifications` | `INSERT` | `WITH CHECK (true)` | Allows any authenticated session to insert notifications. This permissive policy exists because trigger-generated notifications fire in the context of the triggering user's session. It was flagged during the RLS audit but retained because the trigger functions use `SECURITY DEFINER` context and the insertion is controlled by PostgreSQL trigger logic, not arbitrary user input. |

### Grants

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
```

---

## Notification Types

### Trigger-Generated Types (Database-Level)

These notification types are created automatically by PostgreSQL trigger functions when specific conditions are met. They always have `user_id = NULL` (company-wide).

| Type | Source Trigger | Fires On | Condition | Title | Metadata Schema |
|------|--------------|----------|-----------|-------|-----------------|
| `campaign_completed` | `notify_campaign_completion()` via `trigger_notify_campaign_completion` | `AFTER UPDATE` on `agent_runs` | `status` changes to `'completed'` | `'Campaign Completed'` | `{ campaign_id, campaign_name, completed_calls, successful_calls, status }` |
| `campaign_failed` | `notify_campaign_completion()` via `trigger_notify_campaign_completion` | `AFTER UPDATE` on `agent_runs` | `status` changes to `'failed'` | `'Campaign Failed'` | `{ campaign_id, campaign_name, completed_calls, successful_calls, status }` |
| `high_failure_rate` | `notify_high_failure_rate()` via `trigger_notify_high_failure_rate` | `AFTER UPDATE` on `agent_runs` | `completed_calls >= 10` AND failure rate > 50% (and was previously at or below 50%) | `'High Call Failure Rate Detected'` | `{ campaign_id, campaign_name, failure_rate, total_calls, failed_calls }` |
| `minutes_warning` | `notify_minutes_limit()` via `trigger_notify_minutes_limit` | `AFTER UPDATE` on `usage_tracking` | Usage crosses 80% threshold (and was previously below 80%) | `'Minutes Limit Warning'` | `{ minutes_used, minutes_included, usage_percentage }` |
| `minutes_critical` | `notify_minutes_limit()` via `trigger_notify_minutes_limit` | `AFTER UPDATE` on `usage_tracking` | Usage crosses 90% threshold | `'Minutes Limit Critical'` | `{ minutes_used, minutes_included, usage_percentage }` |
| `minutes_exceeded` | `notify_minutes_limit()` via `trigger_notify_minutes_limit` | `AFTER UPDATE` on `usage_tracking` | Usage crosses 100% threshold | `'Minutes Limit Exceeded'` | `{ minutes_used, minutes_included, usage_percentage }` |

### Application-Generated Types

These types are inserted by application code (API routes or service functions) rather than database triggers.

| Type | Generated By | Description | Typical Metadata |
|------|-------------|-------------|-----------------|
| `call_completed` | Call processing pipeline | Individual call completion notification. | `{ call_id, contact_name, duration, outcome }` |
| `team_member_joined` | `POST /api/team/accept-invite` | A new team member accepted their invitation and joined the company. | `{ user_id, user_email, role }` |
| `subscription_updated` | Stripe webhook handler | The company's subscription plan was changed (upgrade, downgrade, or cancellation). | `{ old_plan, new_plan, action }` |

---

## Database Trigger Functions (Detailed)

### `notify_campaign_completion()`

Attached to table `agent_runs` via trigger `trigger_notify_campaign_completion` (`AFTER UPDATE`, `FOR EACH ROW`).

**Logic:** Checks if `TG_OP = 'UPDATE'` and if the `status` column changed from a non-terminal state to either `'completed'` or `'failed'`. When the condition is met, it inserts a single notification row with `company_id` taken from the updated `agent_runs` row. The message includes the campaign name (from `agent_runs.name`) and the `completed_calls` count.

**Security:** Function has `SET search_path = public` (hardened in migration `20260226000002`).

### `notify_high_failure_rate()`

Attached to table `agent_runs` via trigger `trigger_notify_high_failure_rate` (`AFTER UPDATE`, `FOR EACH ROW`).

**Logic:** Only evaluates when `completed_calls >= 10` (minimum sample size to avoid false positives). Calculates `failure_rate = ((completed_calls - successful_calls) / completed_calls) * 100`. Fires the notification only when the failure rate crosses the 50% threshold for the first time -- it checks that the old row's failure rate was at or below 50%, preventing duplicate notifications on subsequent updates. The message includes the rounded failure rate percentage and a recommendation to review agent configuration.

**Security:** Function has `SET search_path = public`.

### `notify_minutes_limit()`

Attached to table `usage_tracking` via trigger `trigger_notify_minutes_limit` (`AFTER UPDATE`, `FOR EACH ROW`).

**Logic:** Calculates `usage_percentage = (minutes_used / minutes_included) * 100`. Fires when the percentage crosses the 80% threshold from below (guards against re-firing by checking that the old `minutes_used` value was below 80%). The notification type and severity escalate based on the percentage:
- 80-89%: `minutes_warning` with informational tone
- 90-99%: `minutes_critical` with upgrade suggestion
- 100%+: `minutes_exceeded` with overage warning

**Important edge case:** The trigger uses a single threshold crossing check at 80%. If minutes jump from 70% to 95% in a single update, only one notification is generated with the `minutes_critical` type (based on the final percentage), not two separate notifications at 80% and 90%. Similarly, if minutes jump from 70% to 100%+, only a `minutes_exceeded` notification is created.

**Security:** Function has `SET search_path = public`.

---

## Users Table Integration

The `users` table has a related column:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `notifications_enabled` | `BOOLEAN` | `true` | User-level preference for receiving notifications. Added in migration `add_notifications_system.sql`. When `false`, the frontend should suppress the notification feed for this user, though trigger-generated notifications are still created in the database. |

---

## Source Code References

| File | Purpose |
|------|---------|
| `supabase/migrations/add_notifications_system.sql` | Full table creation, indexes, triggers, RLS policies, and grants. |
| `supabase/migrations/20260226000002_fix_warnings_and_team_invitations.sql` | Hardened all trigger functions with `SET search_path = public`. |
| `src/app/api/billing/notifications/route.ts` | Billing-specific notification endpoint (queries `billing_events`, NOT this table). |

---

## Related Notes

- [[Company]] -- Notifications are scoped by `company_id`; all trigger-generated notifications are company-wide
- [[User]] -- Optional `user_id` targeting; `notifications_enabled` preference on users table
- [[Campaign]] -- Campaign completion and failure triggers on `agent_runs` table
- [[Usage Tracking]] -- Minutes threshold triggers on `usage_tracking` table
- [[Subscription]] -- Subscription update notifications; billing alerts (separate system via `billing_events`)
- [[Team Invitation]] -- Team member joined notifications
- [[Admin Command Center]] -- Platform-wide notification patterns visible in monitoring
