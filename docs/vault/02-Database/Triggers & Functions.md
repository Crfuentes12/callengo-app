---
tags: [database, triggers, functions, postgresql, automation]
aliases: [Database Triggers, DB Functions, RPC Functions]
---

# Triggers & Functions

Callengo's PostgreSQL database uses 40+ triggers and 15+ functions to automate timestamp management, enforce business rules, generate notifications, and provide atomic operations. This document catalogs all triggers, functions, and CHECK constraints in the schema.

---

## Timestamp Auto-Update Functions

Two generic functions handle automatic `updated_at` timestamp management:

### `handle_updated_at()` → trigger

Sets `NEW.updated_at = NOW()` on every UPDATE. Applied via `set_updated_at` trigger on:
- `companies`, `users`, `company_agents`, `contacts`, `agent_runs`, `company_settings`

### `update_updated_at_column()` → trigger

Identical behavior to `handle_updated_at()`, applied via different trigger names on:
- `calendar_integrations`, `calendar_events`, `contacts` (duplicate), `company_settings` (duplicate), `team_invitations`, `salesforce_integrations`, `salesforce_contact_mappings`, `team_calendar_assignments`

### CRM-Specific Update Functions

Each CRM integration has its own timestamp update function:

| Function | Tables |
|----------|--------|
| `update_hubspot_integrations_updated_at()` | `hubspot_integrations` |
| `update_hubspot_contact_mappings_updated_at()` | `hubspot_contact_mappings` |
| `update_pipedrive_integrations_updated_at()` | `pipedrive_integrations` |
| `update_pipedrive_contact_mappings_updated_at()` | `pipedrive_contact_mappings` |
| `update_google_sheets_integrations_updated_at()` | `google_sheets_integrations` |
| `update_google_sheets_linked_sheets_updated_at()` | `google_sheets_linked_sheets` |
| `update_clio_updated_at()` | `clio_integrations`, `clio_contact_mappings` |
| `update_zoho_updated_at()` | `zoho_integrations`, `zoho_contact_mappings` |
| `update_dynamics_updated_at()` | `dynamics_integrations`, `dynamics_contact_mappings` |
| `update_simplybook_updated_at()` | `simplybook_integrations`, `simplybook_contact_mappings` |

### Other Timestamp Functions

| Function | Table |
|----------|-------|
| `update_contact_lists_updated_at()` | `contact_lists` |
| `update_subscription_plans_updated_at()` | `subscription_plans` |
| `update_company_subscriptions_updated_at()` | `company_subscriptions` |
| `update_usage_tracking_updated_at()` | `usage_tracking` |
| `update_call_queue_updated_at()` | `call_queue` |
| `update_admin_finances_updated_at()` | `admin_finances` |
| `update_admin_platform_config_updated_at()` | `admin_platform_config` |
| `update_notifications_updated_at()` | `notifications` |
| `update_followup_updated_at()` | `follow_up_queue` |

---

## Business Logic Triggers

### `auto_create_followup()` → AFTER UPDATE on `call_logs`

Automatically creates [[Follow-Up]] entries when a call completes with specific outcomes. Logic:

1. Check if the [[Campaign]] (`agent_runs`) has `follow_up_enabled = true`
2. Check if the call's status matches one of the configured `follow_up_conditions` (e.g., `{no_answer: true, busy: true, failed: false}`)
3. Verify the contact hasn't exceeded `follow_up_max_attempts`
4. If all conditions met: INSERT into `follow_up_queue` with `next_attempt_at = NOW() + follow_up_interval_hours`

### `notify_campaign_completion()` → AFTER UPDATE on `agent_runs`

Creates a [[Notification]] when a campaign's status changes to `completed`. The notification includes campaign name, total calls, successful calls, and failure rate.

### `notify_high_failure_rate()` → AFTER UPDATE on `agent_runs`

Creates an alert [[Notification]] when a campaign's failure rate exceeds 50%. Calculated as `failed_calls / completed_calls > 0.5`. Helps operators quickly identify campaigns with connectivity or configuration issues.

### `notify_minutes_limit()` → AFTER UPDATE on `usage_tracking`

Creates [[Notification]]s at three usage thresholds:
- **80% (warning):** "You've used 80% of your included minutes"
- **90% (critical):** "You've used 90% of your included minutes"
- **100% (exceeded):** "You've exceeded your included minutes"

### `check_max_dedicated_numbers()` → BEFORE INSERT/UPDATE on `company_addons`

Enforces the maximum number of dedicated phone numbers per company (currently 3). Counts active `addon_type = 'dedicated_number'` entries and raises an exception if the limit would be exceeded.

---

## Security Triggers

### `prevent_role_self_escalation()` → BEFORE UPDATE on `users` (SECURITY DEFINER)

Prevents users from changing their own `role` field. If `OLD.id = auth.uid()` and `NEW.role != OLD.role`, the trigger raises an exception. This prevents privilege escalation attacks where a user tries to make themselves an admin via a direct database update.

### `prevent_sensitive_field_changes` (referenced in audit)

Blocks users from changing their own `company_id` or `email` fields on the `users` table. This prevents tenant-hopping attacks.

---

## RPC Functions (SECURITY DEFINER)

### `claim_analysis_job()` → SETOF `analysis_queue`

Atomically claims pending AI analysis jobs for processing. Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent workers from claiming the same job. Returns the claimed rows for processing by the analysis queue worker.

```sql
-- Pseudocode
UPDATE analysis_queue
SET status = 'processing', started_at = NOW()
WHERE id IN (
  SELECT id FROM analysis_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### `atomic_increment_usage(p_usage_id UUID, p_minutes NUMERIC)` → void

Atomically increments the `minutes_used` counter in `usage_tracking` to prevent race conditions when multiple calls complete simultaneously. Uses a single UPDATE statement to ensure atomicity.

---

## CHECK Constraints

Eight tables have CHECK constraints on status columns to prevent invalid data at the database level:

| Table | Column | Valid Values |
|-------|--------|-------------|
| `agent_runs` | `status` | `draft`, `pending`, `running`, `paused`, `completed`, `failed`, `cancelled` |
| `campaign_queue` | `status` | `pending`, `processing`, `completed`, `failed`, `cancelled`, `skipped` |
| `follow_up_queue` | `status` | `pending`, `calling`, `completed`, `failed`, `cancelled`, `scheduled` |
| `company_subscriptions` | `status` | `active`, `trialing`, `past_due`, `canceled`, `expired`, `incomplete`, `paused` |
| `calendar_events` | `status` | `scheduled`, `confirmed`, `completed`, `no_show`, `cancelled`, `rescheduled`, `pending_confirmation` |
| `calendar_events` | `type` | `call`, `follow_up`, `no_show_retry`, `meeting`, `appointment`, `callback`, `voicemail_followup` |
| `company_addons` | `status` | `active`, `canceled`, `past_due` |
| `contacts` | `status` | `Pending`, `Called`, `Completed`, `Failed`, `No Answer`, `Busy`, `Voicemail`, `Callback`, `Qualified`, `Disqualified`, `Do Not Call`, `Invalid Number` |

---

## Trigger Summary Table

| Trigger | Table | Timing | Event | Function |
|---------|-------|--------|-------|----------|
| `trigger_auto_create_followup` | `call_logs` | AFTER | UPDATE | `auto_create_followup()` |
| `trigger_notify_campaign_completion` | `agent_runs` | AFTER | UPDATE | `notify_campaign_completion()` |
| `trigger_notify_high_failure_rate` | `agent_runs` | AFTER | UPDATE | `notify_high_failure_rate()` |
| `trigger_notify_minutes_limit` | `usage_tracking` | AFTER | UPDATE | `notify_minutes_limit()` |
| `trg_check_max_dedicated_numbers` | `company_addons` | BEFORE | INSERT/UPDATE | `check_max_dedicated_numbers()` |
| `trg_prevent_role_self_escalation` | `users` | BEFORE | UPDATE | `prevent_role_self_escalation()` |
| `trg_admin_platform_config_updated_at` | `admin_platform_config` | BEFORE | UPDATE | `update_admin_platform_config_updated_at()` |
| `set_updated_at` | 6 tables | BEFORE | UPDATE | `handle_updated_at()` |
| `update_*_updated_at` | 15+ tables | BEFORE | UPDATE | Various timestamp functions |

---

## Related Notes

- [[Schema Overview]] — Complete table listing
- [[RLS Patterns]] — Row Level Security policies
- [[Migrations Timeline]] — Migration history
- [[Follow-Up]] — Auto-create follow-up trigger details
- [[Notification]] — Notification triggers
- [[Security & Encryption]] — Security triggers
