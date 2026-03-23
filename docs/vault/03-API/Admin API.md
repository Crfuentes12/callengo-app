---
tags: [api, admin, command-center, monitoring, finances]
created: 2026-03-23
updated: 2026-03-23
---

# Admin API

The Admin API comprises 10 endpoints that power the [[Command Center]] -- the platform owner's real-time monitoring and management dashboard. All endpoints are restricted to users with the `admin` or `owner` role. These endpoints operate across company boundaries using the Supabase service-role client (`supabaseAdmin`), bypassing Row Level Security to aggregate platform-wide data.

The endpoints live in `src/app/api/admin/` and are consumed exclusively by the `AdminCommandCenter` component (`src/components/admin/AdminCommandCenter.tsx`, approximately 1,200 lines with 6 tabs).

---

## Authentication and Authorization

Every admin endpoint follows the same access control pattern:

```typescript
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { data: userData } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();

if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

Note: Some endpoints only check for `admin` (not `owner`). The Command Center GET/POST endpoints accept both roles; other endpoints vary. This inconsistency is documented but not yet fully standardized.

---

## Endpoint Reference

### GET /api/admin/command-center

Returns the complete health dashboard data for the Command Center's Health tab. This is the most data-intensive admin endpoint, running 14+ parallel database and external API queries.

**Rate limit:** 10 requests/minute per user.

**Query flow:**
1. Reads persisted admin config from `admin_platform_config` (source of truth for Bland plan selection)
2. Identifies active companies (excludes archived and orphaned)
3. Runs 14 parallel queries via `Promise.all()`:
   - Bland AI master account info (plan, balance, limits) via `getBlandAccountInfo()`
   - Redis concurrency snapshot via `getConcurrencySnapshot()`
   - Calls today, calls this hour, active calls, calls this month
   - Minutes this month, company count
   - Recent billing events
   - Dedicated phone numbers count
   - All subscriptions with plan details (for MRR calculation)
   - Failed calls this month
   - Stripe billing history (last 30 days)
   - Call duration statistics

**Response structure:**

```json
{
  "health": {
    "callsToday": 42,
    "callsThisHour": 5,
    "activeCalls": 2,
    "callsThisMonth": 890,
    "minutesThisMonth": 1335,
    "failedCallsThisMonth": 12,
    "avgCallDuration": 1.5,
    "activeCompanies": 15
  },
  "bland": {
    "plan": "Scale",
    "balance": 234.56,
    "costPerMinute": 0.11,
    "concurrentCap": 100,
    "dailyCap": 5000,
    "hourlyCap": 1000,
    "status": "active"
  },
  "redis": {
    "connected": true,
    "snapshot": {
      "globalConcurrent": 2,
      "globalDaily": 42,
      "globalHourly": 5
    }
  },
  "subscriptions": {
    "mrr": 2847.00,
    "arr": 34164.00,
    "activeCount": 15,
    "trialingCount": 3,
    "planDistribution": { "starter": 5, "growth": 4, "business": 3, "teams": 2, "enterprise": 1 }
  },
  "revenue": {
    "stripe30d": 3200.00,
    "overageRevenue": 145.00
  },
  "dedicatedNumbers": 4,
  "adminConfig": { "bland_plan": "Scale", "bland_cost_per_minute": 0.11 }
}
```

**Source file:** `src/app/api/admin/command-center/route.ts`

---

### POST /api/admin/command-center

Saves the Bland AI plan selection and related configuration. The selected plan determines the concurrency, daily, and hourly limits that are enforced globally for all call dispatches.

**Rate limit:** 10 requests/minute per user.

**Request body:**

```json
{
  "bland_plan": "Scale",
  "bland_cost_per_minute": 0.11,
  "bland_concurrent_cap": 100,
  "bland_daily_cap": 5000,
  "bland_transfer_rate": 0.05,
  "bland_account_balance": 500.00
}
```

**Behavior:**
1. Validates admin/owner role
2. Upserts the `admin_platform_config` table (single-row table)
3. Caches the new Bland limits in Redis via `cacheBlandLimits()` (TTL 1 hour)
4. Resets stale concurrency counters via `resetStaleConcurrency()`

**Response:**

```json
{
  "success": true,
  "config": { "bland_plan": "Scale", "bland_cost_per_minute": 0.11 }
}
```

**Source file:** `src/app/api/admin/command-center/route.ts`

---

### GET /api/admin/clients

Returns a paginated list of all active companies with their subscription details, usage metrics, unit economics, add-ons, and Stripe discount information.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 50 | Items per page (10-100) |

**Query flow:**
1. Identifies active companies (those with at least one user, excluding archived)
2. Runs 3 parallel queries: subscriptions with plan info, usage tracking, active add-ons
3. Fetches Stripe discount data (subscriptions with discounts, all coupons, all promo codes) in parallel
4. Computes per-company unit economics: gross revenue, net revenue (after discounts), Bland cost, profit, margin

**Response structure:**

```json
{
  "clients": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "createdAt": "2026-01-15T10:00:00Z",
      "plan": { "slug": "growth", "name": "Growth", "priceMonthly": 179 },
      "subscription": { "status": "active", "overageEnabled": true, "overageBudget": 50 },
      "usage": {
        "minutesUsed": 450,
        "minutesIncluded": 600,
        "usagePercent": 75,
        "overageMinutes": 0,
        "periodStart": "2026-03-01T00:00:00Z",
        "periodEnd": "2026-04-01T00:00:00Z"
      },
      "economics": {
        "grossRevenue": 179.00,
        "netRevenue": 179.00,
        "subscriptionRevenue": 179.00,
        "overageRevenue": 0,
        "addonRevenue": 25,
        "discountAmount": 0,
        "blandCost": 49.50,
        "profit": 129.50,
        "marginPercent": 72
      },
      "discount": null,
      "addons": [{ "type": "dedicated_number", "quantity": 1 }]
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 50
}
```

**Add-on prices** (hardcoded source of truth, matching [[Pricing Model]] V4):
- `dedicated_number`: $25/mo
- `recording_vault`: $12/mo
- `calls_booster`: $35/mo

**Source file:** `src/app/api/admin/clients/route.ts`

---

### GET /api/admin/finances

Returns the platform P&L (profit and loss) statement, including revenue breakdown by source (subscriptions, overages), cost breakdown (Bland AI, OpenAI, Supabase), and key financial metrics.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `current` | `current` (month-to-date), `last_30`, `last_90` |

**Query flow:**
1. Fetches Bland AI master account info (plan, balance, rates) by calling the Bland API (`/v1/org` and `/v1/me` endpoints)
2. Overrides Bland info with persisted admin config if available
3. Runs 7 parallel queries: active subscriptions, all users, call logs in period, usage tracking, billing history
4. Calculates subscription MRR (handles monthly vs annual billing cycles)
5. Computes overage revenue from usage_tracking data
6. Fetches Stripe discounts to calculate actual collected revenue (gross - discounts, never negative)
7. Calculates gross margin, ARPC, overage revenue percentage

**Response structure:**

```json
{
  "finances": [{
    "bland_talk_rate": 0.11,
    "bland_plan": "Scale",
    "bland_master_balance": 500.00,
    "revenue_gross": 3200.00,
    "revenue_total": 3050.00,
    "revenue_subscriptions": 2847.00,
    "revenue_overages": 203.00,
    "total_discount_impact": 150.00,
    "cost_total": 890.00,
    "cost_bland": 890.00,
    "gross_margin": 2160.00,
    "gross_margin_percent": 70.8,
    "paying_companies": 12,
    "total_companies_active": 15,
    "avg_revenue_per_company": 254.17,
    "total_calls_made": 890,
    "total_minutes_used": 1335,
    "avg_minutes_per_call": 1.50
  }]
}
```

**Source file:** `src/app/api/admin/finances/route.ts`

---

### GET /api/admin/accounting

Full accounting endpoint providing a comprehensive P&L statement, cash flow analysis, ledger entries, chart data for visualizations, and detailed discount/promo tracking. This is a superset of the finances endpoint.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `current` | `current`, `last_30`, `last_90`, `ytd` |

**Response includes:**
- `pnl` -- Revenue (catalog MRR, actual MRR, overages, add-ons, by-plan breakdown), promotional context (foregone revenue, promo customer costs), costs (Bland paying/promo, Stripe processing), margins
- `cashFlow` -- Actual Stripe payments received, failed payments, transaction count
- `discountedSubscriptions` -- Per-company discount detail (promo code, coupon name, percent/amount off, gross/net amounts)
- `unitEconomics` -- ARPC, cost per call, LTV, paying/promo/free customer segments
- `charts` -- Pre-computed chart data (revenue waterfall, cost breakdown, subscriber segments)
- `ledger` -- Chronological debit/credit entries synthesized from billing_history and billing_events

**Source file:** `src/app/api/admin/accounting/route.ts`

---

### GET /api/admin/reconcile

Read-only endpoint that detects discrepancies between actual call minutes (from `call_logs`, the source of truth written by Bland webhooks) and tracked minutes (from `usage_tracking`, used for Stripe metered billing). This endpoint never moves money or modifies data.

**Rate limit:** 5 requests/minute per user.

**Query flow:**
1. Gets all active companies with subscriptions (excludes orphaned and archived)
2. Sums completed call durations from `call_logs` for the current month per company
3. Reads `minutes_used` from `usage_tracking` for the same period
4. Computes the difference and assigns severity:
   - `ok`: difference < 1 minute
   - `minor`: 1-4 minutes
   - `major`: 5-9 minutes
   - `critical`: 10+ minutes
5. Sorts results by severity (critical first)

**Response:**

```json
{
  "discrepancies": [
    {
      "companyId": "uuid",
      "companyName": "Acme Corp",
      "actualMinutes": 120,
      "trackedMinutes": 108,
      "difference": 12,
      "callCount": 80,
      "severity": "critical"
    }
  ],
  "summary": {
    "total": 15,
    "withIssues": 2,
    "critical": 1,
    "major": 1,
    "minor": 0,
    "ok": 13
  },
  "period": {
    "start": "2026-03-01T00:00:00.000Z",
    "end": "2026-03-23T15:30:00.000Z"
  }
}
```

**Source file:** `src/app/api/admin/reconcile/route.ts`

---

### GET /api/admin/monitor

Real-time system monitoring endpoint with 7 sectioned data sources. Supports fetching individual sections or all at once via the `section` query parameter.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `section` | string | `all` | `all`, `redis`, `companies`, `active_calls`, `cooldowns`, `bland`, `events`, `atomization` |

**Sections:**

**`redis`** -- Full Redis state: scans all `callengo:*` keys (capped at 50 keys, 5 scan iterations max), categorizes them (concurrent, daily, hourly, cooldowns, active calls), returns cached Bland limits and concurrency snapshot.

**`companies`** -- Per-company breakdown with caps, usage, and real-time data. Uses 5 batch queries in parallel (optimized from N+1 pattern): usage tracking, active calls, today's calls, company names, dedicated number add-ons. Returns plan-specific caps from `CAMPAIGN_FEATURE_ACCESS`, including booster minute additions.

**`active_calls`** -- Currently in-flight calls (status: in_progress, ringing, queued) from the last 15 minutes. Includes elapsed time, stale flag (> 10 minutes), agent name, campaign ID.

**`cooldowns`** -- Contact cooldown keys from Redis (`callengo:contact_cooldown:*`). Shows TTL remaining for each locked contact. The cooldown period is 5 minutes (300 seconds).

**`bland`** -- Bland AI account status from `getBlandAccountInfo()` and `getBlandLimits()`. Includes balance, plan, rate limits, and estimated remaining minutes/calls based on current balance.

**`events`** -- Recent billing and Stripe events from the last 24 hours. Returns up to 30 billing events and 20 Stripe events with event type summary counts.

**`atomization`** -- Call scheduling analysis over the last 5 minutes. Analyzes inter-call gaps per company, detects company interleaving patterns, and flags cooldown violations (calls to the same contact within 5 minutes).

**Source file:** `src/app/api/admin/monitor/route.ts`

---

### GET /api/admin/cleanup-orphans (Preview)

Returns a preview of orphaned companies -- companies with no associated users that were created more than 1 hour ago (to avoid race conditions with onboarding). Does not modify any data.

**Rate limit:** 1 request/minute per user.

**Response:**

```json
{
  "orphanedCompanies": [
    { "id": "uuid", "name": "Old Corp", "created_at": "2026-01-10T00:00:00Z" }
  ],
  "count": 2,
  "financialTablesKept": ["company_subscriptions", "billing_history", "billing_events", "usage_tracking", "call_logs"],
  "note": "DELETE request will clean operational data and archive these companies. Financial records are preserved."
}
```

### DELETE /api/admin/cleanup-orphans (Execute)

Cleans up orphaned companies by deleting operational data and soft-archiving the company record. Financial records are always preserved for audit purposes.

**Cleanup process:**
1. Deactivates Bland sub-accounts in parallel via `Promise.allSettled()` (non-fatal)
2. Deletes rows from 30+ operational tables (contacts, campaigns, agents, CRM integrations, etc.) for each orphaned company
3. Soft-deletes companies by prefixing their name with `[ARCHIVED] ` and adding a description with the archive date

**Tables deleted (operational):** contacts, contact_lists, campaigns, company_agents, agent_runs, call_queue, follow_up_queue, notifications, voicemail_logs, company_settings, company_addons, calendar_integrations, all CRM integration/sync/mapping tables, integration_feedback, cancellation_feedback, ai_conversations, outbound_webhooks, analysis_queue, analysis_tasks.

**Tables preserved (financial):** company_subscriptions, billing_history, billing_events, usage_tracking, call_logs.

**Response:**

```json
{
  "message": "Archived 2 orphaned companies. Operational data cleaned, financial records preserved.",
  "archived": 2,
  "orphanIds": ["uuid1", "uuid2"],
  "operationalDataDeleted": [
    { "table": "contacts", "deleted": 45 },
    { "table": "campaigns", "deleted": 3 }
  ],
  "financialRecordsKept": ["company_subscriptions", "billing_history", "billing_events", "usage_tracking", "call_logs"]
}
```

**Source file:** `src/app/api/admin/cleanup-orphans/route.ts`

---

### GET /api/admin/billing-events

Returns a paginated, filterable log of billing events. When the `billing_events` table contains data, it returns those records directly. When empty, it synthesizes events from `billing_history` and `company_subscriptions` as a fallback to ensure the admin always has visibility into subscription activity.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 100) |
| `company_id` | string | -- | Filter by company |
| `event_type` | string | -- | Filter by event type (e.g., `payment_succeeded`, `subscription_created`, `payment_failed`) |
| `date_from` | string | -- | ISO date lower bound |
| `date_to` | string | -- | ISO date upper bound |

**Response:**

```json
{
  "events": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "company_name": "Acme Corp",
      "event_type": "payment_succeeded",
      "event_data": { "invoice_id": "in_xxx", "amount": 179 },
      "minutes_consumed": 0,
      "cost_usd": 179,
      "created_at": "2026-03-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 42,
    "totalPages": 1
  }
}
```

**Source file:** `src/app/api/admin/billing-events/route.ts`

---

### GET /api/admin/promo-codes

Fetches all promotion codes, coupons, and their redemption data directly from the Stripe API. Returns active and expired promo codes with their associated coupons, plus subscriptions that currently have active discounts.

**Rate limit:** 10 requests/minute per user.

**Source file:** `src/app/api/admin/promo-codes/route.ts`

---

## Performance Optimizations (Audit Fixes)

Several admin endpoints were optimized during the March 2026 production audit:

- **Command Center GET:** The `hourly` and `daily` stats queries now run in `Promise.all()` instead of sequentially. All 14 data-fetching queries execute in parallel.
- **Monitor -- getCompanyBreakdown():** Refactored from N+1 pattern (one query per company) to 5 batch queries in parallel, using lookup maps for O(1) access by company ID.
- **Cleanup-orphans:** Uses `Promise.allSettled()` for both Bland sub-account deactivation and company archival, ensuring one failure does not block the rest.
- **Redis scanning in Monitor:** Capped at 5 scan iterations and 50 keys per request to prevent timeouts on large key spaces.

---

## Source Files

- Route directory: `src/app/api/admin/`
- Command Center component: `src/components/admin/AdminCommandCenter.tsx` (~1,200 lines, 6 tabs)
- Bland master client: `src/lib/bland/master-client.ts`
- Redis concurrency: `src/lib/redis/concurrency-manager.ts`
- Plan features: `src/config/plan-features.ts`

## Related Notes

- [[Command Center]]
- [[Platform Config]]
- [[Audit Log]]
- [[API Overview]]
- [[Upstash Redis]]
- [[Bland AI]]
- [[Pricing Model]]
