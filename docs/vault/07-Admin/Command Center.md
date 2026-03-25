---
tags: [admin, monitoring, command-center, bland-ai, redis, stripe]
aliases: [Admin Panel, Admin Dashboard, Admin Command Center]
created: 2026-03-23
updated: 2026-03-25
---

# Command Center

The Command Center is the real-time monitoring and operations panel for Callengo platform administrators. It is accessible at `/admin/command-center` and is restricted to users with the `admin` or `owner` role. The main component lives at `src/components/admin/AdminCommandCenter.tsx` (~1,200 lines) and renders seven tabs, each providing a different operational lens into the platform.

The Command Center was updated during the [[Known Issues & Audit|March 2026 production audit]] to accept the `owner` role (previously admin-only), parallelize data queries, and add the [[Upstash Redis|Redis]] concurrency panel.

---

## Access Control

Only two roles may access the Command Center:

| Role | Access | Notes |
|------|--------|-------|
| `admin` | Full read/write | Can change [[Platform Config]] settings |
| `owner` | Full read/write | Added in March 2026 audit fix |
| All others | 403 Forbidden | Middleware and API both enforce this |

Both the frontend route (`/admin/command-center`) and the backend API (`/api/admin/command-center`) independently verify the user's role. The [[Architecture Overview|Edge middleware]] at `src/middleware.ts` provides a first line of defense by redirecting unauthorized users away from `/admin/*` routes.

---

## Tab 1: Health

The Health tab provides an at-a-glance view of platform vitality. It is the default landing tab when opening the Command Center.

### KPI Cards

Three primary KPI cards are displayed at the top:

| KPI | Description | Source |
|-----|-------------|--------|
| **Total Calls** | Count of all calls in the last 24 hours and 30 days | `call_logs` table, filtered by `created_at` |
| **Success Rate** | Percentage of calls with status `completed` vs total | `call_logs` status distribution |
| **Average Duration** | Mean call duration in seconds across completed calls | `call_logs.duration` field |

### Bland AI Plan Selector

A dropdown selector allows the admin to switch the active [[Bland AI]] plan. The four available plans are:

| Plan | $/min | Concurrent | Daily | Hourly | Voice Clones |
|------|-------|-----------|-------|--------|-------------|
| **Start** | $0.14 | 10 | 100 | 100 | 1 |
| **Build** | $0.12 | 50 | 2,000 | 1,000 | 5 |
| **Scale** | $0.11 | 100 | 5,000 | 1,000 | 15 |
| **Enterprise** | $0.09 | Unlimited | Unlimited | Unlimited | 999 |

When the admin selects a new plan from the dropdown, a `POST /api/admin/command-center` request is fired. The API writes the new plan to the [[Platform Config|admin_platform_config]] singleton table and invalidates the Redis cache so that `BLAND_PLAN_LIMITS` in `src/lib/bland/master-client.ts` picks up the change within the next call dispatch cycle. The change is also recorded in the [[Audit Log|admin_audit_log]] as a `bland_plan_change` action.

### Redis Concurrency Panel

The Redis panel visualizes real-time concurrency data from [[Upstash Redis]]. It is implemented using the concurrency manager at `src/lib/redis/concurrency-manager.ts`.

**Global Gauges** -- Three circular gauge charts show current utilization as a percentage of the selected Bland plan's limits:

| Gauge | Metric | Threshold |
|-------|--------|-----------|
| Concurrent | Active calls right now vs `bland_concurrent_cap` | Warning at 80% (configurable in [[Platform Config]]) |
| Daily | Calls today vs `bland_daily_cap` | Warning at 80% |
| Hourly | Calls this hour vs `bland_hourly_cap` | Warning at 80% |

**Active Calls List** -- A real-time table showing all currently active call slots. Each entry is stored in Redis as `callengo:active_call:{callId}` with a TTL of 30 minutes. The table shows call ID, company name, agent type, contact name, and elapsed time.

**Per-Company Breakdown** -- A top-10 list of companies ranked by current concurrent call usage. Each row shows the company name, their plan's concurrent limit, current active calls, and utilization percentage. This helps identify companies that may be consuming disproportionate resources.

### Usage Gauge

A single large gauge showing total minutes consumed across all companies in the current billing cycle versus the aggregate included minutes across all active subscriptions. This is a platform-level health indicator rather than a per-company metric.

### Charts

Two time-series charts rendered with [[Architecture Overview|Recharts]]:

- **24-Hour Chart**: Calls per hour for the last 24 hours, broken down by status (completed, failed, no_answer, voicemail).
- **30-Day Chart**: Calls per day for the last 30 days, with the same status breakdown.

### Plan Distribution

A pie chart showing how many active companies are on each [[Pricing Model|subscription plan]] (Free, Starter, Growth, Business, Teams, Enterprise). This provides a quick view of the customer base composition.

---

## Tab 2: Operations

The Operations tab focuses on financial and business health metrics. It combines Stripe subscription data with Bland AI cost data to provide a complete picture of unit economics.

### Revenue Metrics

| Metric | Calculation | Source |
|--------|-------------|--------|
| **MRR** | Sum of active subscription amounts, normalized to monthly | `company_subscriptions` with status `active` |
| **ARR** | MRR x 12 | Derived |
| **Stripe Revenue 30d** | Total successful charges in the last 30 days | Stripe API via `src/lib/stripe.ts` |

### Subscription Health

A breakdown of all subscriptions by status:

| Status | Description |
|--------|-------------|
| `active` | Paying and current |
| `trialing` | In free trial period |
| `canceled` | Canceled but may still be within paid period |
| `past_due` | Payment failed, grace period active |

### Churn and Conversion

| Metric | Formula |
|--------|---------|
| **Churn Rate** | (Canceled in period / Active at start of period) x 100 |
| **Trial Conversion Rate** | (Trials that converted to paid / Total trials ended) x 100 |

### Bland AI Economics

| Metric | Description |
|--------|-------------|
| **Burn Rate** | Daily Bland cost = (total minutes today) x (cost per minute from [[Platform Config]]) |
| **Runway** | `bland_account_balance / daily_burn_rate` in days |
| **Balance** | Cached from Bland API, stored in `bland_account_balance` |

### Failed Calls Analysis

A table of recent failed calls with failure reasons, grouped by error type. Common failure categories include: number_disconnected, no_answer_timeout, api_error, concurrent_limit_reached, and daily_cap_exceeded.

### Unit Economics

| Metric | Formula |
|--------|---------|
| **Gross Margin** | `(Revenue - Bland Cost - OpenAI Cost) / Revenue x 100` |
| **ARPC** | Average Revenue Per Company = `MRR / active_companies` |
| **Cost Per Call** | `Total Bland cost / Total calls` |

---

## Tab 3: Clients

The Clients tab provides a sortable, searchable table of all companies on the platform. It is the primary tool for investigating individual customer usage and profitability.

### Table Columns

| Column | Description | Sortable |
|--------|-------------|----------|
| **Company Name** | From `companies.name` | Yes |
| **Plan** | Current subscription plan slug | Yes |
| **Status** | Subscription status (active, trialing, canceled, past_due) | Yes |
| **Minutes Used** | Total minutes consumed in current billing period | Yes |
| **Profit** | Revenue from this company minus their Bland cost | Yes |
| **Bland Cost** | Minutes x cost_per_minute for this company | Yes |
| **Add-ons** | Active add-ons (Dedicated Number, Recording Vault, Calls Booster) | No |
| **Last Activity** | Timestamp of most recent call or login | Yes |

The table supports text search across company name and plan, and all sortable columns can be sorted ascending or descending by clicking the column header.

---

## Tab 4: Billing Events

The Billing Events tab shows a paginated, filterable log of all billing-related events across the platform. Events are stored in the `billing_events` table and are displayed in reverse chronological order.

### Event Types

| Event Type | Description |
|------------|-------------|
| `payment` | Successful Stripe charge |
| `overage` | Overage charge triggered when a company exceeds included minutes |
| `credit` | Manual credit applied by admin |
| `cancellation` | Subscription canceled |
| `upgrade` | Plan upgraded (e.g., Starter to Growth) |
| `downgrade` | Plan downgraded |
| `addon_purchase` | Add-on purchased (validated against `VALID_ADDON_TYPES` whitelist) |
| `addon_cancel` | Add-on canceled |

Each event row shows the company name, event type, amount, currency, Stripe invoice ID (if applicable), and timestamp. The log supports pagination (25 events per page) and filtering by event type.

---

## Tab 5: Reconciliation

The Reconciliation tab exists to detect discrepancies between what Bland AI reports as actual usage and what Callengo has tracked internally. This is critical because all billing is based on Callengo's tracked minutes -- if tracking drifts from reality, revenue leakage or overbilling can occur.

### How It Works

1. The API fetches total minutes from Bland AI's reporting endpoint for the current billing period.
2. It compares this against the sum of `call_logs.duration` for the same period.
3. Discrepancies greater than 5% are flagged with a warning indicator.

### Display

A side-by-side comparison table showing:

| Column | Description |
|--------|-------------|
| **Period** | Billing period (current month) |
| **Bland Minutes** | Minutes reported by Bland AI API |
| **Tracked Minutes** | Minutes in Callengo's `call_logs` |
| **Difference** | Absolute difference in minutes |
| **Discrepancy %** | `abs(bland - tracked) / bland x 100` |
| **Status** | OK (<=5%) or WARNING (>5%) |

This tab is essential for the [[Usage Tracking]] system's integrity and should be checked regularly by the platform operator.

---

## Tab 6: Finances

The Finances tab provides a full P&L (Profit and Loss) view of the platform's financial position. It also embeds the OpenAI usage panel showing cost by feature, daily trend, and model breakdown (sourced from the  table via ).

### Revenue Breakdown

| Revenue Line | Source |
|-------------|--------|
| Subscriptions | Monthly/annual plan fees from [[Pricing Model]] |
| Overages | Per-minute charges above included minutes |
| Extras | One-time charges, seat add-ons ($49/seat) |
| Add-ons | Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35) |

### Cost Breakdown

| Cost Line | Source | Notes |
|-----------|--------|-------|
| Bland AI | Minutes x cost_per_minute | Configurable in [[Platform Config]] |
| OpenAI | Token usage for GPT-4o-mini analysis | Post-call intelligence via `src/lib/ai/` |
| Supabase | Monthly infrastructure cost | Fixed or usage-based |
| Infrastructure | Vercel, Upstash, domain, etc. | Fixed costs |

### Gross Margin

Calculated as `(Total Revenue - Total Costs) / Total Revenue x 100`. Displayed as a percentage with a color indicator (green >60%, yellow 40-60%, red <40%).

### Bland Master Account Info

A card showing the Bland AI master account status:

| Field | Description |
|-------|-------------|
| **Balance** | Current prepaid balance in the Bland account |
| **Plan** | Active Bland plan (from dropdown in Health tab) |
| **Total Calls** | Lifetime calls made through the master account |
| **Last Synced** | When the balance was last fetched from Bland API |

### Redis Connection Status

A simple indicator showing whether the [[Upstash Redis]] connection is healthy. Displays connected/disconnected status and latency.

---

## Tab 7: AI Costs

The AI Costs tab provides a complete view of [[OpenAI]] API spending across all feature areas. Data is sourced from the `openai_usage_logs` table via the `GET /api/admin/openai-usage` endpoint.

### Summary Cards

Four KPI cards at the top of the tab:

| Card | Description |
|------|-------------|
| **30d Total Cost** | Total OpenAI spend in the last 30 days in USD |
| **Total Requests** | Number of OpenAI API calls made in the last 30 days |
| **Total Tokens** | Sum of all input + output tokens in the last 30 days |
| **Avg Cost/Request** | Mean cost per API call (`total_cost / total_requests`) |

### Feature Breakdown

A table and/or chart showing cost and request counts grouped by `feature_key`:

| Feature Key | Description |
|-------------|-------------|
| `call_analysis` | Post-call transcript analysis (intent analyzer) |
| `contact_analysis` | Contact quality scoring, agent suggestions, web scraper |
| `cali_ai` | Cali AI in-app assistant (Cmd+K) |
| `onboarding` | Onboarding flow suggestions |
| `demo_analysis` | Demo/seed data analysis |

### Daily Cost Trend Chart

A Recharts line chart showing OpenAI spending per day for the last 30 days. Allows the platform operator to identify spending spikes correlated with campaign activity or feature changes.

### Model Breakdown Table

Token and cost breakdown grouped by model (e.g., `gpt-4o-mini` vs `gpt-4o`). Useful for understanding the cost impact of the premium model.

### Recent API Call Log

A table showing the most recent 50 entries from `openai_usage_logs`, with columns: timestamp, company_id (or name), feature_key, model, input_tokens, output_tokens, total_tokens, cost_usd.

### Data Source

All data is fetched from `GET /api/admin/openai-usage` which queries the `openai_usage_logs` table directly. The endpoint requires `admin` or `owner` role.

---

## API Endpoints

### GET /api/admin/command-center

Fetches all data needed to render the six core tabs. The endpoint runs multiple database queries and external API calls. As of the March 2026 audit, the hourly and daily call statistics queries are parallelized using `Promise.all()` to reduce response time.

**Authentication**: Requires `admin` or `owner` role (verified via Supabase session).

**Response structure**: Returns a nested JSON object with keys for each tab's data (`health`, `operations`, `clients`, `billing_events`, `reconciliation`, `finances`).

### GET /api/admin/openai-usage

Fetches OpenAI usage analytics for the AI Costs tab (Tab 7). Queries the `openai_usage_logs` table directly.

**Authentication**: Requires `admin` or `owner` role.

**Response structure:**

| Key | Description |
|-----|-------------|
| `totals` | 30d aggregate: `total_cost`, `total_requests`, `total_tokens`, `avg_cost_per_request` |
| `byFeature` | Array of `{ feature_key, total_cost, total_requests, total_tokens }` |
| `byModel` | Array of `{ model, total_cost, total_tokens, total_requests }` |
| `dailyChart` | Array of `{ date, cost, requests }` for the last 30 days |
| `recentLogs` | Most recent 50 entries from `openai_usage_logs` |

### POST /api/admin/command-center

Saves configuration changes. Currently supports saving the Bland AI plan selection.

**Authentication**: Same as GET -- `admin` or `owner` role required.

**Body**:
```json
{
  "bland_plan": "start" | "build" | "scale" | "enterprise"
}
```

**Side effects**:
1. Updates `admin_platform_config` singleton row with new plan and associated limits.
2. Invalidates Redis cache for Bland plan limits.
3. Writes an entry to [[Audit Log|admin_audit_log]] recording the change.

---

## Source Files

| File | Description |
|------|-------------|
| `src/components/admin/AdminCommandCenter.tsx` | Main component (~1,200 lines, 7 tabs) |
| `src/app/api/admin/command-center/route.ts` | GET and POST API handlers |
| `src/app/api/admin/openai-usage/route.ts` | AI Costs tab data endpoint |
| `src/app/admin/command-center/page.tsx` | Page route (protected) |
| `src/lib/bland/master-client.ts` | Bland plan limits and dispatch logic |
| `src/lib/redis/concurrency-manager.ts` | Redis concurrency tracking |
| `src/lib/stripe.ts` | Stripe SDK wrapper for revenue queries |
| `src/lib/openai/tracker.ts` | OpenAI usage tracking (source of AI Costs data) |

---

## Performance Notes

- The GET endpoint previously ran hourly and daily queries sequentially. As of the March 2026 audit, these run in parallel via `Promise.all()`, reducing load time by approximately 40%.
- The N+1 query problem in the related `/api/admin/monitor` endpoint was also fixed by refactoring `getCompanyBreakdown()` to use 5 batch queries in parallel instead of per-company sequential queries.

---

## Related Notes

- [[Platform Config]] -- Singleton configuration table managed from the Health tab
- [[Audit Log]] -- Immutable log of admin actions
- [[Bland AI]] -- Voice calling infrastructure
- [[Upstash Redis]] -- Concurrency tracking and caching
- [[Pricing Model]] -- Plan definitions and pricing
- [[Usage Tracking]] -- How minutes are tracked for billing
- [[Plan Features]] -- Feature matrix by plan
- [[Security & Encryption]] -- Access control and authentication
- [[Known Issues & Audit]] -- March 2026 audit findings and fixes
- [[OpenAI]] -- AI Costs tab data source (`openai_usage_logs`, tracker library)
