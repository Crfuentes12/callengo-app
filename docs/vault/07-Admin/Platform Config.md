---
tags: [admin, config]
---

# Platform Config

Singleton table `admin_platform_config` storing global platform settings.

## Key Fields

### Bland AI Configuration
| Field | Description |
|-------|-------------|
| bland_plan | Current Bland plan (start/build/scale/enterprise) |
| bland_cost_per_minute | Cost per minute |
| bland_daily_cap | Daily call limit |
| bland_hourly_cap | Hourly call limit |
| bland_concurrent_cap | Concurrent call limit |
| bland_voice_clones | Number of voice clones allowed |

### Bland Account Cache
| Field | Description |
|-------|-------------|
| bland_account_balance | Cached account balance |
| bland_account_plan | Account plan name |
| bland_account_total_calls | Total calls made |
| bland_last_synced_at | Last sync timestamp |

### Platform Settings
| Field | Description |
|-------|-------------|
| platform_name | 'Callengo' |
| default_landing_page | '/home' |
| maintenance_mode | Boolean |
| maintenance_message | Shown when in maintenance |

### Alert Thresholds
| Field | Description |
|-------|-------------|
| alert_balance_warning | Balance warning threshold ($) |
| alert_balance_critical | Balance critical threshold ($) |
| alert_concurrency_warning_pct | % threshold for concurrency warning |
| alert_daily_usage_warning_pct | % threshold for daily usage warning |

## Singleton Pattern

```sql
UNIQUE ((true))  -- Only one row can exist
```

## Related Notes

- [[Command Center]]
- [[Bland AI]]
- [[Audit Log]]
