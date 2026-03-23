---
tags: [admin, monitoring]
aliases: [Admin Panel, Admin Dashboard]
---

# Command Center

Real-time monitoring panel at `/admin/command-center`. Access: `admin` and `owner` roles only.

## 6 Tabs

### 1. Health
- KPIs: total calls, success rate, avg duration
- **Bland AI plan selector** — Dropdown to switch Bland plan (start/build/scale/enterprise)
- **Redis concurrency panel** — Gauges for concurrent, daily, hourly calls (global + per-company)
- Active call slots list
- Usage gauge (minutes used vs included)
- Charts: 24h and 30d call trends
- Plan distribution chart

### 2. Operations
- MRR / ARR
- Stripe revenue last 30 days
- Subscription health: active, trialing, canceled, past_due counts
- Churn rate, trial conversion rate
- Bland AI burn rate + runway
- Failed calls analysis
- Unit economics: gross margin, ARPC, cost per call

### 3. Clients
- Company list with: usage, profit, Bland cost, add-ons
- Sortable and searchable

### 4. Billing Events
- Paginated log of billing events (payments, overages, credits, cancellations)

### 5. Reconciliation
- Compare actual Bland minutes vs tracked minutes
- Detect and flag discrepancies

### 6. Finances
- P&L view: revenue, costs (Bland, OpenAI, Supabase, Stripe fees)
- Gross margin calculation
- Bland master account info (balance, plan, total calls)

## API

- `GET /api/admin/command-center` — Read all data
- `POST /api/admin/command-center` — Save settings (e.g., Bland plan change)

## Source Files

- Component: `src/components/admin/AdminCommandCenter.tsx` (~1,200 lines)
- API: `src/app/api/admin/command-center/route.ts`

## Related Notes

- [[Admin API]]
- [[Platform Config]]
- [[Audit Log]]
- [[Bland AI]]
- [[Upstash Redis]]
