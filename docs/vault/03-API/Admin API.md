---
tags: [api, admin]
---

# Admin API

8 endpoints for the [[Command Center]] admin panel. Access restricted to `admin` and `owner` roles.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/command-center` | Read all Command Center data (KPIs, health, operations) |
| POST | `/api/admin/command-center` | Save settings (e.g., Bland AI plan selection) |
| GET | `/api/admin/clients` | List all companies with usage, profit, Bland cost |
| GET | `/api/admin/finances` | P&L data, revenue breakdown, costs |
| POST | `/api/admin/reconcile` | Compare actual vs tracked minutes, detect discrepancies |
| GET | `/api/admin/monitor` | Real-time monitoring (optimized batch queries) |
| POST | `/api/admin/cleanup-orphans` | Clean up orphaned Bland calls and archive stale data |
| GET | `/api/admin/billing-events` | Paginated billing event log |

## Performance Optimizations (Audit Fixes)

- **Command Center:** `hourly` + `daily` stats queries run in `Promise.all()` (was sequential)
- **Monitor:** `getCompanyBreakdown()` uses 5 batch queries in parallel (was N+1)
- **Cleanup-orphans:** Uses `Promise.allSettled()` for parallel processing

## Source Files

- Component: `src/components/admin/AdminCommandCenter.tsx` (~1,200 lines, 6 tabs)
- API: `src/app/api/admin/`

## Related Notes

- [[Command Center]]
- [[Platform Config]]
- [[Audit Log]]
