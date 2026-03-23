---
tags: [admin, config, database, bland-ai, singleton]
aliases: [admin_platform_config, Global Config, Platform Settings]
created: 2026-03-23
updated: 2026-03-23
---

# Platform Config

The `admin_platform_config` table is a singleton table that stores all global platform-level configuration for the Callengo system. It contains exactly one row, enforced by a `UNIQUE((true))` constraint that makes it impossible to insert a second row. This table is the authoritative source for Bland AI plan parameters, alert thresholds, maintenance mode, and other platform-wide settings.

The table is managed through the [[Command Center]] Health tab, where administrators can change the active Bland AI plan and associated limits. All changes to this table are recorded in the [[Audit Log]].

---

## Singleton Enforcement

The table uses a PostgreSQL trick to guarantee exactly one row exists:

```sql
UNIQUE ((true))
```

This creates a unique constraint on the literal boolean value `true`. Since every row would have the same value for this expression, only one row can ever exist. Any `INSERT` that would create a second row will fail with a unique constraint violation.

This pattern is preferable to application-level enforcement because it is impossible to circumvent, even from direct database access or migrations.

---

## Full Schema

### Bland AI Configuration

These columns define the operational limits for the active [[Bland AI]] plan. They are updated when the admin selects a different plan in the [[Command Center]] Health tab dropdown.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `gen_random_uuid()` | Primary key |
| `bland_plan` | TEXT | `'start'` | Active Bland plan slug: `start`, `build`, `scale`, or `enterprise` |
| `bland_cost_per_minute` | NUMERIC | `0.14` | Cost per minute charged by Bland AI. Can be overridden by `BLAND_COST_PER_MINUTE` env var |
| `bland_transfer_rate` | NUMERIC | `0.05` | Rate for call transfers ($/transfer) |
| `bland_daily_cap` | INTEGER | `100` | Maximum calls per day allowed by the Bland plan |
| `bland_hourly_cap` | INTEGER | `100` | Maximum calls per hour allowed by the Bland plan |
| `bland_concurrent_cap` | INTEGER | `10` | Maximum simultaneous active calls |
| `bland_voice_clones` | INTEGER | `1` | Number of custom voice clones allowed by the plan |

The limits stored here are applied with a 90% safety margin by the [[Upstash Redis|concurrency manager]] at `src/lib/redis/concurrency-manager.ts`. For example, if `bland_concurrent_cap` is 10, the system will start rejecting new calls at 9 concurrent calls to avoid overshooting the Bland plan limit.

### Bland Account Cache

These columns cache information fetched from the Bland AI account API. They are refreshed periodically and displayed in the [[Command Center]] Finances tab.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `bland_account_balance` | NUMERIC | `0` | Cached prepaid balance in the Bland account ($) |
| `bland_account_plan` | TEXT | NULL | Plan name as reported by Bland API (may differ from `bland_plan` if not synced) |
| `bland_account_total_calls` | INTEGER | `0` | Lifetime total calls made through the master Bland account |
| `bland_last_synced_at` | TIMESTAMPTZ | NULL | Timestamp of the last successful sync with Bland API |

### Platform Settings

General platform configuration that affects application behavior globally.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `platform_name` | TEXT | `'Callengo'` | Display name of the platform, used in emails and UI chrome |
| `default_landing_page` | TEXT | `'/home'` | Where users are redirected after login. Changed from `/dashboard` to `/home` during the March 2026 audit |
| `maintenance_mode` | BOOLEAN | `false` | When `true`, the application shows a maintenance page to all non-admin users |
| `maintenance_message` | TEXT | NULL | Custom message displayed during maintenance mode |

### Alert Thresholds

These thresholds control when warning indicators appear in the [[Command Center]] Health tab gauges and when alert notifications are triggered.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `alert_balance_warning` | NUMERIC | `5.00` | Bland account balance ($) below which a yellow warning is shown |
| `alert_balance_critical` | NUMERIC | `1.00` | Bland account balance ($) below which a red critical alert is shown |
| `alert_concurrency_warning_pct` | INTEGER | `80` | Percentage of concurrent cap at which the gauge turns yellow |
| `alert_daily_usage_warning_pct` | INTEGER | `80` | Percentage of daily cap at which the gauge turns yellow |

### Metadata

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `updated_by` | UUID FK | NULL | References `users.id` -- the admin who last modified this row |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated by trigger on any column change |
| `created_at` | TIMESTAMPTZ | `now()` | Row creation timestamp |

---

## Row Level Security

The table has RLS enabled with the following policies:

| Operation | Allowed Roles | Notes |
|-----------|--------------|-------|
| SELECT | `admin`, `owner` | Read access for Command Center rendering |
| UPDATE | `admin`, `owner` | Write access for plan changes and config updates |
| INSERT | `service_role` | Only for initial seed (singleton already exists) |
| DELETE | None | Deletion is never allowed |

---

## Trigger

A `BEFORE UPDATE` trigger automatically sets `updated_at = now()` on every modification:

```sql
CREATE TRIGGER trg_update_platform_config_timestamp
  BEFORE UPDATE ON admin_platform_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

This ensures `updated_at` is always accurate regardless of whether the application code sets it explicitly.

---

## Relationship to Bland AI Plans

When the admin selects a Bland plan in the [[Command Center]] dropdown, the following columns are updated atomically:

| Bland Plan | `bland_cost_per_minute` | `bland_concurrent_cap` | `bland_daily_cap` | `bland_hourly_cap` | `bland_voice_clones` |
|------------|------------------------|----------------------|-------------------|---------------------|---------------------|
| Start | 0.14 | 10 | 100 | 100 | 1 |
| Build | 0.12 | 50 | 2,000 | 1,000 | 5 |
| Scale | 0.11 | 100 | 5,000 | 1,000 | 15 |
| Enterprise | 0.09 | unlimited | unlimited | unlimited | 999 |

These values are defined as constants in `BLAND_PLAN_LIMITS` within `src/lib/bland/master-client.ts` and are copied into the database when the plan is changed. The database values serve as the source of truth, with Redis caching them for fast access (TTL 1 hour).

---

## Caching Strategy

The platform config is cached at two levels:

1. **Redis Cache (Upstash)**: The Bland plan limits are cached in Redis with a 1-hour TTL. The key pattern is `callengo:bland_plan_config`. When the admin changes the plan via the [[Command Center]], the cache is explicitly invalidated.

2. **In-Memory**: The `master-client.ts` module reads from Redis on each call dispatch. There is no additional in-process cache, which means plan changes take effect within at most one call dispatch cycle.

---

## Related Notes

- [[Command Center]] -- UI for managing platform config
- [[Audit Log]] -- All changes are logged here
- [[Bland AI]] -- The calling infrastructure these settings control
- [[Upstash Redis]] -- Where config values are cached
- [[Schema Overview]] -- Full database schema reference
- [[Triggers & Functions]] -- Database trigger definitions
- [[RLS Patterns]] -- Row Level Security patterns used
