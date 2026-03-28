# CALLENGO - FULL SOFTWARE ARCHITECTURE ANALYSIS
## Deep Audit Report — March 2026

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Frontend Analysis (329 files)](#3-frontend-analysis)
4. [Backend / API Analysis](#4-backend-api-analysis)
5. [Database Schema Deep Analysis](#5-database-schema-deep-analysis)
6. [Pricing, Plans & Billing Coherence](#6-pricing-plans--billing-coherence)
7. [Agent System Analysis](#7-agent-system-analysis)
8. [Integrations Audit](#8-integrations-audit)
9. [Security & Vulnerability Audit](#9-security--vulnerability-audit)
10. [Bugs, Errors & Issues Found](#10-bugs-errors--issues-found)
11. [Scenario 1: Payment Processing Company — Data Validation Agent](#11-scenario-1-payment-processing-company)
12. [Scenario 2: Clinic — Appointment Confirmation Agent](#12-scenario-2-clinic--appointment-confirmation-agent)
13. [Scenario 3: Cold Outreach Company — Lead Qualification Agent](#13-scenario-3-cold-outreach--lead-qualification-agent)
14. [Product Viability Assessment](#14-product-viability-assessment)
15. [Critical Recommendations](#15-critical-recommendations)

---

## 1. EXECUTIVE SUMMARY

**Callengo** is a B2B SaaS platform for AI-powered outbound phone calls using Bland AI as the telephony backbone and OpenAI GPT-4o-mini for post-call intelligence analysis. The software offers three specialized AI agent types: Data Validation, Appointment Confirmation, and Lead Qualification.

**Tech Stack:**
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Next.js API Routes (serverless), Supabase Edge Functions
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Payments**: Stripe (subscriptions, metered billing, multi-currency)
- **AI Calls**: Bland AI (telephony) + OpenAI GPT-4o-mini (analysis)
- **Integrations**: 11 CRM/calendar/productivity integrations
- **Deployment**: Vercel

**Overall Assessment**: The software is **well-architected** and **production-viable** with a clear value proposition. The codebase shows maturity — proper input validation (Zod), atomic idempotency, timing-safe signature verification, rate limiting, and comprehensive RLS policies. However, there are **17 issues** ranging from critical to minor that need attention before production launch.

---

## 2. ARCHITECTURE OVERVIEW

### Directory Structure (329 source files)
```
callengo-app/
├── src/
│   ├── app/
│   │   ├── (app)/          # Authenticated app pages (15 routes)
│   │   ├── api/            # API routes (~80 route handlers)
│   │   ├── auth/           # Auth pages (login, signup, forgot-password, etc.)
│   │   ├── admin/          # Admin panel
│   │   └── onboarding/     # Onboarding flow
│   ├── components/         # UI components (~60 components)
│   ├── config/             # Plan features configuration
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   ├── i18n/               # Internationalization
│   ├── lib/                # Business logic (~50 modules)
│   │   ├── ai/             # OpenAI intent analysis
│   │   ├── billing/        # Overage manager, usage tracker
│   │   ├── calendar/       # Calendar sync, availability, Zoom, Slack
│   │   ├── clio/           # Clio integration
│   │   ├── dynamics/       # Microsoft Dynamics integration
│   │   ├── hubspot/        # HubSpot integration
│   │   ├── pipedrive/      # Pipedrive integration
│   │   ├── salesforce/     # Salesforce integration
│   │   ├── simplybook/     # SimplyBook integration
│   │   ├── zoho/           # Zoho integration
│   │   ├── queue/          # Analysis queue processor
│   │   └── supabase/       # Client, server, service role clients
│   └── types/              # TypeScript type definitions
├── scripts/                # Stripe sync, migrations
├── supabase/               # Supabase config
├── middleware.ts            # Auth middleware
└── docs/                   # Documentation
```

### Data Flow Architecture
```
User → Frontend (Next.js) → API Routes → Bland AI (makes call)
                                      → Supabase (stores data)
                                      → Stripe (billing)

Bland AI → Webhook → API Route → OpenAI (analysis)
                              → Supabase (update results)
                              → CRM Sync (HubSpot, Salesforce, etc.)
                              → Calendar Sync
                              → Webhook Dispatch (user endpoints)
                              → Usage Tracking → Stripe Metered Billing
```

---

## 3. FRONTEND ANALYSIS

### Pages & Routes (15 authenticated routes)
| Route | Purpose | Status |
|-------|---------|--------|
| `/dashboard` | Main overview, stats, agent selection | OK |
| `/agents` | Agent template browser | OK |
| `/campaigns` | Campaign list and management | OK |
| `/campaigns/[id]` | Campaign detail and execution | OK |
| `/contacts` | Contact management, lists, import/export | OK |
| `/calls` | Call history and logs | OK |
| `/voicemails` | Voicemail detection logs | OK |
| `/follow-ups` | Follow-up queue management | OK |
| `/calendar` | Calendar events and integrations | OK |
| `/analytics` | Usage analytics | OK |
| `/reports` | Campaign reports | OK |
| `/integrations` | CRM and tool integrations hub | OK |
| `/billing` | Subscription and billing management | OK |
| `/subscription` | Plan upgrade/downgrade | OK |
| `/settings` | Company and user settings | OK |
| `/team` | Team management and invitations | OK |
| `/admin` | Admin panel (finances) | OK |

### Internationalization (i18n)
- Present in `src/i18n/translations/` — supports multiple languages
- This is a strong differentiator for the European market (EUR/GBP pricing)

### Component Architecture
- Clean separation: `components/` organized by domain (agents, billing, calendar, campaigns, contacts, etc.)
- Skeleton loading components in `components/skeletons/`
- AI chat panel (`components/ai/AIChatPanel.tsx`) — embedded AI assistant

### Frontend Observations
1. **Good**: Consistent use of TypeScript, Tailwind, and clean component structure
2. **Good**: i18n support ready for internationalization
3. **Good**: Skeleton loading for better UX
4. **Concern**: The contacts integration pages (hubspot, salesforce, clio, etc.) under `(app)/contacts/` may create navigation confusion with the CRM integration pages under `(app)/integrations/`

---

## 4. BACKEND / API ANALYSIS

### API Routes (80+ handlers organized by domain)

#### Billing (13 routes)
| Route | Method | Purpose | Issues |
|-------|--------|---------|--------|
| `/api/billing/plans` | GET | List active plans | OK |
| `/api/billing/subscription` | GET | Get company subscription | OK |
| `/api/billing/create-checkout-session` | POST | Stripe checkout | OK |
| `/api/billing/verify-session` | POST | Verify checkout session | OK |
| `/api/billing/create-portal-session` | POST | Stripe customer portal | OK |
| `/api/billing/change-plan` | POST | Upgrade/downgrade | OK |
| `/api/billing/update-overage` | POST | Toggle overage | OK |
| `/api/billing/report-usage` | POST | Track call minutes | **ISSUE-01** |
| `/api/billing/check-usage-limit` | GET | Pre-call check | OK |
| `/api/billing/history` | GET | Billing history | OK |
| `/api/billing/ensure-free-plan` | POST | Create free plan record | OK |
| `/api/billing/cancellation-feedback` | POST | Cancellation flow | OK |
| `/api/billing/check-retention` | POST | Retention offer check | OK |
| `/api/billing/seat-checkout` | POST | Extra seat purchase | OK |
| `/api/billing/addon-checkout` | POST | Add-on purchase | OK |

#### Bland AI (4 routes)
| Route | Method | Purpose | Issues |
|-------|--------|---------|--------|
| `/api/bland/send-call` | POST | Initiate AI call | OK - Has Zod validation |
| `/api/bland/get-call/[callId]` | GET | Get call details | OK |
| `/api/bland/analyze-call` | POST | OpenAI analysis | OK |
| `/api/bland/webhook` | POST | Bland callback | **CRITICAL** - See below |

#### Integrations (66+ routes across 11 integrations)
Each integration follows the pattern: `connect → callback → sync → contacts → disconnect → users`
- Salesforce, HubSpot, Pipedrive, Clio, Zoho, Microsoft Dynamics
- Google Calendar, Microsoft Outlook, Google Sheets
- SimplyBook.me, Slack, Zoom

### Critical Backend Observations

**ISSUE-01: Usage Tracking Race Condition**
`trackCallUsage()` in `src/lib/billing/usage-tracker.ts` calls the `/api/billing/report-usage` endpoint via HTTP fetch using `getAppUrl()`. This creates a self-referential HTTP call that:
- Adds latency (network round-trip to yourself)
- Can fail if the deployment has cold starts
- Creates a circular dependency
**Recommendation**: Call the usage tracking logic directly instead of making an HTTP call to yourself.

**ISSUE-02: Bland Webhook — Massive Handler**
The `/api/bland/webhook/route.ts` is **874 lines** and handles ALL post-call logic in a single function:
- Call log creation
- Contact updates with field locking
- Calendar event creation
- AI intent analysis (sync or async)
- Appointment confirmation logic
- Lead qualification logic
- Data validation logic
- CRM sync (Pipedrive, Clio, HubSpot, Salesforce)
- Outbound webhook dispatch
- Usage tracking

While each section has proper try/catch with "non-fatal" error handling (good), this monolith will be:
- Hard to test
- Hard to debug
- Subject to timeout issues on serverless (Vercel default 10s, max 300s)
**Recommendation**: Break into separate queue-based workers or at minimum extract into service functions.

**ISSUE-03: Queue Processor Authentication**
`/api/queue/process/route.ts` uses `QUEUE_PROCESSING_SECRET` or `CRON_SECRET` for authentication. This is fine for cron-based processing, but there's no automated cron configured in the visible codebase. The analysis queue processor may not be running automatically.

---

## 5. DATABASE SCHEMA DEEP ANALYSIS

### Tables (57 tables total)

#### Core Tables (12)
| Table | Purpose | PK | Issues |
|-------|---------|----|----|
| `companies` | Multi-tenant root | uuid | OK |
| `users` | User accounts | uuid (auth.uid) | OK |
| `subscription_plans` | Plan definitions | uuid | OK |
| `company_subscriptions` | Active subscriptions | uuid | **UNIQUE on company_id** |
| `usage_tracking` | Monthly usage | uuid | OK |
| `billing_history` | Payment records | uuid | OK |
| `billing_events` | Billing event log | uuid | OK |
| `company_settings` | Company config | company_id (PK) | OK |
| `contact_lists` | Contact groups | uuid | OK |
| `contacts` | Contact records | uuid | OK |
| `company_agents` | Agent instances | uuid | OK |
| `agent_templates` | Agent types | uuid | OK |

#### Execution Tables (7)
| Table | Purpose | Issues |
|-------|---------|--------|
| `agent_runs` | Campaign executions | OK - Rich schema |
| `call_logs` | Individual call records | OK |
| `call_queue` | Pending calls | OK |
| `follow_up_queue` | Retry scheduling | OK |
| `voicemail_logs` | Voicemail detection | OK |
| `analysis_queue` | Async AI processing | OK |
| `calendar_events` | Calendar entries | **ISSUE-04**: Very wide table (50+ columns) |

#### Integration Tables (30+)
Every CRM integration has 3 tables: `{crm}_integrations`, `{crm}_contact_mappings`, `{crm}_sync_logs`
- Salesforce (3), HubSpot (3), Pipedrive (3), Clio (3), Zoho (3), Dynamics (3), SimplyBook (4)
- Google Sheets (2), Calendar (3), Webhooks (2)

#### Admin/System Tables (5)
| Table | Purpose |
|-------|---------|
| `admin_finances` | Platform financial tracking |
| `stripe_events` | Idempotent webhook storage |
| `notifications` | User notifications |
| `ai_conversations` / `ai_messages` | AI chat history |
| `company_addons` | Add-on subscriptions |

### Foreign Key Analysis

**Total FKs**: 98 foreign keys across all tables

**Cascade Strategy**:
- `ON DELETE CASCADE` on `company_id` references: Correct — deleting a company removes all related data
- `ON DELETE SET NULL` on optional references (contact_id, subscription_id, agent_run_id, call_log_id): Correct — preserves orphan records for audit
- `ON DELETE CASCADE` on required references (agent_run_id in call_queue): Correct — queue items are useless without the parent run

**ISSUE-04: calendar_events Table Bloat**
The `calendar_events` table has **50+ columns** including duplicated data:
- Both `scheduled_at` AND `start_time`/`end_time` (redundant)
- Both `contact_id` AND `contact_name`/`contact_phone`/`contact_email` (denormalized)
- `follow_up_id`, `agent_run_id`, `call_log_id`, `assigned_to` (4 optional FKs)
- `video_link`, `video_provider`, `recurrence_rule`, `recurring_event_id`
- `sync_status`, `sync_error`, `external_event_id`, `external_calendar_id`, `external_provider`

This isn't necessarily wrong (denormalization for performance), but creates maintenance burden.

### Row Level Security (RLS) Analysis

**RLS Status**: Enabled on ALL tables (verified in schema)

**Policy Pattern**: Consistent company-based isolation:
```sql
-- Standard pattern (correct):
company_id IN (SELECT users.company_id FROM users WHERE users.id = auth.uid())
```

**ISSUE-05: companies table has an overly permissive policy**
```sql
"authenticated_can_view_companies" — using: "true"
```
This means ANY authenticated user can see ALL companies. While the `view_own_company` policy also exists (correct), the permissive `true` policy overrides it because Supabase RLS uses OR logic for PERMISSIVE policies. **This is a data leak vulnerability** — any logged-in user can query all company records.

**ISSUE-06: Duplicate RLS Policies**
Several tables have duplicate/overlapping policies:
- `call_logs`: Has both `"Company members can manage call logs"` (ALL) AND separate `"users_can_insert_call_logs"` (INSERT) and `"users_can_view_call_logs"` (SELECT). The ALL policy already covers these.
- `contacts`: Same pattern — ALL + separate INSERT/UPDATE/DELETE/SELECT
- `company_agents`: Same
- `agent_runs`: Same
- `company_settings`: Same
- `contact_lists`: Same

While not a bug (redundant policies don't break anything), they add confusion and should be cleaned up.

**ISSUE-07: admin_finances Access Control**
```sql
"Only admins can manage finances" — using: users.role = 'admin'
```
The check is `role = 'admin'`, but the user roles used elsewhere are `'owner'`, `'admin'`, and `'member'`. If the admin panel user has role `'owner'`, they cannot access finances. Verify that the admin user actually has `role = 'admin'`.

**Service Role Bypass**: Correctly implemented on tables that need backend-only access (`stripe_events`, `call_logs`, `contacts`, `company_agents`, `agent_runs`, `company_settings`, `contact_lists`, `salesforce_*`, `company_addons`).

### Index Analysis

**Total Indexes**: 130+ indexes

Good coverage on:
- All foreign keys
- Status fields with partial indexes (`WHERE status = 'pending'`)
- Lookup patterns (`company_id, status`)
- Stripe IDs
- Timestamps for sorting

**ISSUE-08: Missing composite index for usage_tracking**
The query pattern `eq('company_id', x).eq('subscription_id', y).order('period_start', desc).limit(1)` is used frequently but the existing index `idx_usage_tracking_period_lookup` covers `(company_id, subscription_id, period_start, period_end)` which should work. However, since `period_start` ordering is DESC in queries but the index is ASC, PostgreSQL may not use it efficiently. Consider adding a DESC index.

### Trigger Analysis

**Total Triggers**: 36 triggers

Proper `updated_at` triggers on all tables with `updated_at` columns. Business logic triggers:
- `trigger_notify_campaign_completion` — Notifies when agent_run completes
- `trigger_notify_high_failure_rate` — Alerts on high failure rates
- `trigger_notify_minutes_limit` — Usage alerts
- `trigger_auto_create_followup` — Auto-schedules follow-ups on call completion

**ISSUE-09: Duplicate updated_at triggers on some tables**
- `contacts` has both `set_updated_at` (→ `handle_updated_at()`) and `update_contacts_updated_at` (→ `update_updated_at_column()`)
- `company_settings` has both `set_updated_at` and `update_company_settings_updated_at`

While both functions likely do the same thing (`NEW.updated_at = NOW()`), having two triggers on the same event is wasteful and could cause unexpected double-execution.

---

## 6. PRICING, PLANS & BILLING COHERENCE

### Plan Structure

| Plan | Monthly | Annual | Calls/mo | Minutes | Max Duration | Concurrent | Users | Overage/min |
|------|---------|--------|----------|---------|-------------|------------|-------|-------------|
| Free | $0 | $0 | 10 (trial) | 15 | 3 min | 1 | 1 | N/A |
| Starter | $99 | ~$1,069 | 200 | ~300 | 3 min | 2 | 1 | $0.29 |
| Growth | $179 | ~$1,918 | 400 | ~600 | 4 min | 3 | 1 | $0.26 |
| Business | $299 | ~$3,228 | 800 | ~1,200 | 5 min | 5 | 3 | $0.23 |
| Teams | $649 | ~$6,948 | 1,500 | ~2,250 | 6 min | 10 | 5 | $0.20 |
| Enterprise | $1,499 | ~$16,189 | 4,000+ | ~6,000 | Unlimited | Unlimited | Unlimited | $0.17 |

### Add-Ons
| Add-On | Price | Description |
|--------|-------|-------------|
| Dedicated Phone Number | $15/mo | Own caller ID via Bland |
| Recording Vault | $12/mo | 12-month retention (default 30 days) |
| Calls Booster | $35/mo | +150 calls / +225 minutes (stackable) |

### Coupon Codes
| Code | Discount | Duration | Max Uses | Target |
|------|----------|----------|----------|--------|
| ADMIN100 | 100% | Forever | ∞ | Admin |
| TESTER_100 | 100% | 3 months | 10 | QA team |
| LAUNCH50 | 50% | 3 months | 100 | Launch |
| EARLY25 | 25% | 1 month | 500 | Early bird |
| ANNUAL20 | 20% | Forever | ∞ | Annual incentive |
| CALLENGO30 | 30% | 2 months | 250 | Marketing |
| WELCOME15 | 15% | 1 month | 1000 | New users |
| PARTNER40 | 40% | 6 months | 50 | Partners |
| LEGAL20 | 20% | 12 months | 200 | Law firms |

### Coherence Check

**plan-features.ts ↔ stripe-sync.ts ↔ Database**:
- Feature lists match across all three sources
- Pricing tiers are consistent
- Overage rates match the descending ladder ($0.29 → $0.26 → $0.23 → $0.20 → $0.17)
- Multi-currency conversion rates (EUR: 0.92, GBP: 0.79) are applied consistently

**ISSUE-10: Annual Price Display Bug in Stripe Logs**
The Stripe sync output shows:
```
EUR Annual: €960.48/yr = €960.48/mo, save 12%
```
The "€960.48/mo" should say "€80.04/mo" (the monthly equivalent). The `monthly_equivalent` metadata field in the code stores `priceAnnual * currency.multiplier * 100` which is the total annual amount in cents, NOT the monthly equivalent. This is a metadata calculation bug in `syncPricesForCurrency()`.

**ISSUE-11: Calls Booster Minutes Calculation**
In `usage-tracker.ts:145`:
```typescript
boosterMinutes = activeAddons.reduce((sum, addon) => sum + ((addon.quantity || 1) * 225), 0);
```
But in `stripe-sync.ts` metadata: `extra_minutes: '225'`. The booster says "+150 calls / +225 min" which uses the 1.5 min average. This is consistent, but the 225 minutes could be misleading to customers who make shorter or longer calls.

### Billing Flow Assessment

1. **Checkout** → Stripe Checkout Session → Webhook → `handleCheckoutSessionCompleted` → Updates `company_subscriptions` + `usage_tracking` ✅
2. **Recurring Payment** → Stripe Invoice → `handleInvoicePaymentSucceeded` → Creates `billing_history` entry ✅
3. **Overage** → `enableOverage()` → Adds metered price item to Stripe subscription → `reportUsage()` reports minutes → Stripe charges at period end ✅
4. **Cancellation** → Frontend → `handleSubscriptionDeleted` → Sets status = 'canceled' ✅
5. **Plan Change** → `/api/billing/change-plan` → Stripe proration ✅

**The billing system is well-implemented and coherent.**

---

## 7. AGENT SYSTEM ANALYSIS

### Agent Templates

Three core agent types stored in `agent_templates`:

#### 1. Data Validation Agent (`data-validation`)
- **Purpose**: Call contacts to verify/update their business information
- **Use Cases**: Old CRM database cleanup, address verification, contact info update
- **AI Analysis**: Extracts validated fields, new fields, marks data as confirmed/updated
- **Post-Call**: Auto-updates contact records with verified data

#### 2. Appointment Confirmation Agent (`appointment-confirmation`)
- **Purpose**: Call patients/clients to confirm upcoming appointments
- **Use Cases**: Medical clinics, dental offices, service providers
- **AI Analysis**: Detects confirm/reschedule/cancel/no-show intent
- **Post-Call**: Updates calendar events, schedules reschedules, handles no-shows

#### 3. Lead Qualification Agent (`lead-qualification`)
- **Purpose**: Call leads to qualify them using BANT framework
- **Use Cases**: B2B sales, SaaS demos, real estate
- **AI Analysis**: Scores leads 1-10, extracts BANT data
- **Post-Call**: Schedules meetings, stores qualification data

### Agent Execution Lifecycle

```
1. CREATE CAMPAIGN (agent_runs)
   ├── Select agent template
   ├── Select contacts / contact list
   ├── Configure settings (voice, follow-ups, calendar, integrations)
   └── Save as 'draft'

2. LAUNCH CAMPAIGN
   ├── Status → 'running'
   ├── Contacts queued in call_queue
   └── Calls dispatched via Bland AI (rate-limited by concurrent limits)

3. CALL EXECUTION
   ├── Bland AI makes the call
   ├── Call recorded and transcribed
   └── Webhook received at /api/bland/webhook

4. POST-CALL PROCESSING (webhook handler)
   ├── Create call_log entry
   ├── Lock contact (prevent concurrent edits)
   ├── AI Intent Analysis (OpenAI GPT-4o-mini)
   ├── Agent-specific logic (confirm/qualify/validate)
   ├── Calendar event creation/update
   ├── CRM sync (all active integrations)
   ├── Outbound webhook dispatch
   ├── Usage tracking (billing)
   └── Unlock contact

5. FOLLOW-UP (if configured)
   ├── Auto-create follow-up in follow_up_queue
   ├── Trigger: auto_create_followup (database trigger)
   ├── Conditions: no_answer, busy, voicemail
   └── Scheduled retry after interval_hours
```

### Agent Run Configuration Options
The `agent_runs` table stores rich configuration:
- Follow-up settings: enabled, max_attempts, interval_hours, conditions (busy, no_answer, failed)
- Voicemail settings: enabled, detection_enabled, message, action (leave_message/hangup/ignore)
- Calendar context: timezone, working_hours_start/end, working_days, exclude_holidays
- Callback settings: enabled, max_attempts
- Smart features: smart_follow_up, allow_rescheduling, no_show_auto_retry
- Video: preferred_video_provider (none/zoom/meet/teams)
- Meeting: default_meeting_duration
- Connected integrations array

**The agent system is comprehensive and well-designed.**

---

## 8. INTEGRATIONS AUDIT

### Integration Status Matrix

| Integration | OAuth | Sync In | Sync Out | Contact Mapping | Sync Logs | Status |
|-------------|-------|---------|----------|----------------|-----------|--------|
| Salesforce | ✅ | ✅ | ✅ | ✅ | ✅ | Complete |
| HubSpot | ✅ | ✅ | ✅ | ✅ | ✅ | Complete |
| Pipedrive | ✅ | ✅ | ✅ | ✅ | ✅ | Complete |
| Clio | ✅ | ✅ | ✅ | ✅ | ✅ | Complete |
| Zoho CRM | ✅ | ✅ | ❓ | ✅ | ✅ | Verify outbound |
| Dynamics 365 | ✅ | ✅ | ❓ | ✅ | ✅ | Verify outbound |
| Google Calendar | ✅ | ✅ | ✅ | N/A | ✅ | Complete |
| Microsoft Outlook | ✅ | ✅ | ✅ | N/A | ✅ | Complete |
| Google Sheets | ✅ | ✅ | ❌ (import-only) | N/A | N/A | Complete |
| SimplyBook.me | ✅ | ✅ | N/A | ✅ | ✅ | Complete + Webhooks |
| Slack | ✅ | N/A | ✅ (notifications) | N/A | N/A | Complete |
| Zoom | ✅ | N/A | ✅ (meeting links) | N/A | N/A | Complete |

### Integration Observations

**ISSUE-12: Zoho and Dynamics Outbound Push Missing from Webhook**
In `/api/bland/webhook/route.ts`, the post-call CRM sync pushes to:
- Pipedrive ✅
- Clio ✅
- HubSpot ✅
- Salesforce ✅
- Zoho ❌ (missing)
- Dynamics ❌ (missing)

Even though the `zoho/sync.ts` and `dynamics/sync.ts` libraries exist with sync functions, they are NOT called from the webhook handler. This means call results will NOT sync back to Zoho CRM or Dynamics 365 after calls complete.

**ISSUE-13: Google Sheets is Import-Only**
The code explicitly comments "Google Sheets is import-only — no outbound push from webhooks". While this is intentional, customers expecting bidirectional sync may be disappointed. The marketing should clarify this.

### Plan-Gated Integration Access
| Integration | Available From |
|-------------|---------------|
| Google Calendar + Meet | Free |
| Zoom | Free |
| Slack | Starter |
| SimplyBook.me | Starter |
| Webhooks | Starter |
| Microsoft Outlook + Teams | Business |
| HubSpot | Business |
| Pipedrive | Business |
| Zoho | Business |
| Clio | Business |
| Salesforce | Teams |
| Microsoft Dynamics | Teams |

This gating is coherent with the pricing strategy — enterprise CRMs at higher tiers.

---

## 9. SECURITY & VULNERABILITY AUDIT

### Positive Security Findings

1. **Webhook Signature Verification**: Both Stripe and Bland webhooks verify signatures using timing-safe comparison (`crypto.timingSafeEqual`)
2. **Atomic Idempotency**: Stripe events use INSERT + unique constraint (code `23505`) to prevent duplicate processing
3. **Input Validation**: Send-call endpoint uses Zod schema validation with E.164 phone format, URL HTTPS enforcement
4. **Rate Limiting**: In-memory LRU cache-based rate limiter with three tiers (api, expensive, auth)
5. **RLS Everywhere**: All 57 tables have Row Level Security enabled
6. **Middleware Auth**: All API routes require authentication except whitelisted webhooks/callbacks
7. **Service Role Isolation**: Server-side operations use service role client, separated from browser client
8. **CSRF Protection**: Supabase Auth handles CSRF via server-side session validation
9. **Contact Locking**: Concurrent edit protection during webhook processing

### VULNERABILITIES FOUND

**CRITICAL — ISSUE-05 (Repeated): Company Data Exposure via Permissive RLS**
```sql
-- Policy on companies table:
"authenticated_can_view_companies" — using: "true"
```
Any authenticated user can read ALL company records. This leaks:
- Company names, websites, descriptions
- Industry information
- Logo/favicon URLs
- Context data and summaries
**Severity**: HIGH
**Fix**: Remove the `authenticated_can_view_companies` policy.

**HIGH — ISSUE-14: Seed Endpoint Accessible Without Auth in Development**
`/api/seed/route.ts` checks `NODE_ENV === 'production'` to block access, but:
- If deployed to a staging environment where `NODE_ENV !== 'production'`, the endpoint is accessible
- The `SEED_ENDPOINT_SECRET` check is optional — if the env var isn't set, no auth is required
- The endpoint deletes ALL data for the demo user's company and recreates it
**Severity**: HIGH for staging environments
**Fix**: Always require the secret, regardless of environment.

**MEDIUM — ISSUE-15: Bland Webhook Signature Optional in Development**
```typescript
if (!webhookSecret && process.env.NODE_ENV === 'production') {
  // Only fails in production
}
// In dev: body = await request.json(); // No verification
```
In any non-production deployment (staging, preview), the webhook accepts unsigned requests. An attacker could forge webhook payloads to:
- Create fake call logs
- Modify contact data
- Trigger CRM syncs with fabricated data
**Severity**: MEDIUM (staging exposure only)
**Fix**: Require signature verification in all environments, or use a separate dev secret.

**MEDIUM — Rate Limiter is In-Memory Only**
The LRU cache rate limiter in `rate-limit.ts` is per-process. On Vercel serverless:
- Each function invocation may use a different process
- The rate limiter resets on cold starts
- It provides no protection against distributed attacks
**Severity**: MEDIUM
**Recommendation**: Use Vercel KV, Upstash Redis, or Supabase-based rate limiting for production.

**LOW — Access Tokens Stored in Database**
OAuth access/refresh tokens for all CRM integrations are stored as plain text in the database:
- `hubspot_integrations.access_token`, `refresh_token`
- `salesforce_integrations.access_token`, `refresh_token`
- `clio_integrations.access_token`, `refresh_token`
- (same for Zoho, Dynamics, Pipedrive, SimplyBook, Google Sheets, Calendar)

While Supabase encrypts data at rest, the tokens are accessible via the service role key. Consider using Supabase Vault or an encryption layer.

**LOW — Bland API Key in company_settings**
`company_settings.bland_api_key` stores the API key as plain text. The send-call endpoint falls back to the global `BLAND_API_KEY` env var if not set. This means sub-account API keys are stored in the database without encryption.

---

## 10. BUGS, ERRORS & ISSUES FOUND

### Summary of All Issues

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| ISSUE-01 | Medium | Performance | Usage tracker makes self-referential HTTP call |
| ISSUE-02 | Medium | Maintainability | Bland webhook handler is 874 lines |
| ISSUE-03 | Medium | Operations | Analysis queue processor may not auto-run |
| ISSUE-04 | Low | Schema | calendar_events has 50+ columns |
| ISSUE-05 | **CRITICAL** | Security | companies table has `USING true` RLS policy |
| ISSUE-06 | Low | Schema | Duplicate RLS policies on 6 tables |
| ISSUE-07 | Medium | Access Control | admin_finances role check may not match |
| ISSUE-08 | Low | Performance | Missing DESC index for usage_tracking |
| ISSUE-09 | Low | Schema | Duplicate updated_at triggers on contacts, company_settings |
| ISSUE-10 | Low | Display | Annual price monthly_equivalent metadata bug |
| ISSUE-11 | Low | UX | Calls Booster "225 minutes" may mislead |
| ISSUE-12 | **HIGH** | Feature Gap | Zoho/Dynamics outbound push missing from webhook |
| ISSUE-13 | Low | Documentation | Google Sheets import-only not clearly communicated |
| ISSUE-14 | High | Security | Seed endpoint accessible without auth in staging |
| ISSUE-15 | Medium | Security | Bland webhook unsigned in non-production |
| ISSUE-16 | Medium | Security | In-memory rate limiter ineffective on serverless |
| ISSUE-17 | Low | Security | OAuth tokens stored as plain text |

---

## 11. SCENARIO 1: PAYMENT PROCESSING COMPANY — DATA VALIDATION AGENT

### Company Profile
**Acme Payment Solutions** — A payment processing company with a 5-year-old CRM containing 15,000 business contacts. They need to verify and update contact information (addresses, phone numbers, decision-maker names, corporate emails) to comply with KYC/AML requirements and reduce payment disputes.

### Plan Selection: Business ($299/mo)
- 800 calls/month (enough for ~53 contacts/day over a month)
- 5 concurrent calls (can process ~250 contacts/hour at peak)
- CRM integration needed: HubSpot (where their old data lives)
- Overage enabled at $0.23/min with $200 budget

### Setup Flow

**Step 1: Onboarding**
1. Sign up → Verify email → Create company "Acme Payment Solutions"
2. Free plan auto-assigned (10 calls / 15 min trial)
3. Onboarding wizard → Select industry, set company context
4. Website scraping extracts business context for AI agent

**Step 2: Import Old Database**
1. Navigate to Contacts → Import
2. Upload CSV/Excel from old CRM with columns: company_name, contact_name, phone_number, address, city, state, zip_code, email
3. Phone numbers normalized to E.164 format automatically
4. Contacts deduplicated (phone + email matching)
5. Create contact list "KYC Validation Q1 2026" for organization

**Step 3: Connect HubSpot**
1. Navigate to Integrations → HubSpot → Connect
2. OAuth flow: `connect → callback → token stored`
3. Sync contacts from HubSpot → Creates `hubspot_contact_mappings`
4. Contact source marked as `hubspot`

**Step 4: Upgrade to Business Plan**
1. Navigate to Subscription → Select Business
2. Stripe checkout → `checkout.session.completed` webhook
3. `company_subscriptions` updated: plan_id=Business, status=active
4. `usage_tracking` created: minutes_used=0, minutes_included=1200
5. Enable overage: $200 budget → Metered price added to Stripe subscription

**Step 5: Configure Data Validation Agent**
1. Navigate to Agents → Select "Data Validation Agent"
2. System creates `company_agents` record linked to `data-validation` template
3. Customize task prompt with KYC-specific instructions
4. Set voice (51 curated voices available — see `docs/VOICES.md`), max_duration=5min

**Step 6: Create Campaign**
1. Navigate to Campaigns → New Campaign
2. Select Data Validation agent
3. Select contact list "KYC Validation Q1 2026" (batch of 200 contacts)
4. Configure:
   - Follow-ups: enabled, max 3 attempts, 24h interval, conditions: {no_answer: true, busy: true}
   - Voicemail: detection enabled, action=leave_message
   - Calendar: timezone=America/New_York, 9am-6pm, Mon-Fri
   - Connect HubSpot integration
5. Creates `agent_runs` record with all settings

**Step 7: Launch & Monitor**
1. Start campaign → Status changes to 'running'
2. Contacts queued in `call_queue` (respecting 5 concurrent limit)
3. Each call → Bland AI → Webhook → AI Analysis → Data updates

### What Happens During a Call

**Successful Validation Call:**
```
Bland AI calls → Contact answers → AI verifies info →
Webhook fires → AI Analysis (data-validation):
  intent: "data_updated"
  validatedFields: {
    "address": { status: "updated", newValue: "456 New St" },
    "email": { status: "confirmed" }
  }
  newFields: { "decision_maker_name": "John Smith" }
→ Contact updated in Supabase
→ HubSpot sync pushes updated data
→ Calendar event: "Call Completed: Acme Corp"
→ Webhook dispatched to customer endpoint: call.completed
→ Usage tracked: 3 minutes → billing
```

**Voicemail Call:**
```
Bland AI calls → Voicemail detected →
Message left: "Hi, this is calling from Acme Payment Solutions..."
→ voicemail_logs entry created
→ Follow-up scheduled: 24h later
→ Calendar event: "Callback: Contact Name (voicemail)"
```

**No Answer → Follow-up Chain:**
```
Attempt 1: No answer → follow_up_queue entry (next_attempt_at: +24h)
Attempt 2: No answer → follow_up_queue updated (attempt_number: 2)
Attempt 3: Busy → follow_up_queue: status='exhausted'
→ Contact status remains "Pending"
→ Manual review needed
```

### Billing Impact (Scenario)
- 200 contacts × ~1.5 min avg = ~300 minutes
- 300 min < 1,200 min included → No overage
- Monthly cost: $299 (base) + $0 (overage) = **$299**
- With HubSpot integration active, data flows back automatically

### Issues Encountered in This Scenario
1. **Usage tracking works correctly** — minutes tracked per call via webhook
2. **HubSpot sync works** — call results pushed after each call
3. **Follow-up system works** — auto-schedules retries for no-answer/busy
4. **Potential issue**: If processing 15,000 contacts, they'd need 19 months at 800 calls/month. They should consider the Teams plan (1,500 calls) or Calls Booster add-ons
5. **The Data Validation agent correctly updates contact fields** in the database based on AI analysis

---

## 12. SCENARIO 2: CLINIC — APPOINTMENT CONFIRMATION AGENT

### Company Profile
**Sunshine Dental Clinic** — A dental clinic with 40 appointments/day. They experience 20% no-show rate (8 no-shows/day = $160/day lost revenue at $100/appointment). They want to call patients 24-48h before appointments to confirm, offer rescheduling, and reduce no-shows.

### Plan Selection: Growth ($179/mo)
- 400 calls/month (enough for ~1,000 confirmations, accounting for follow-ups)
- 3 concurrent calls
- Smart follow-ups (5 attempts)
- No-show auto-retry enabled
- SimplyBook.me integration (where they manage appointments)

### Setup Flow

**Step 1: Sign Up & Import**
1. Create account, verify, onboard as "Sunshine Dental"
2. Import patient list from CSV or connect SimplyBook.me
3. SimplyBook.me: OAuth connect → `simplybook_integrations` record → Sync bookings/clients

**Step 2: Upgrade to Growth**
1. Select Growth plan ($179/mo)
2. Checkout → Subscription active
3. 600 minutes included, $0.26/min overage

**Step 3: Configure Appointment Confirmation Agent**
1. Select "Appointment Confirmation" template
2. Customize greeting: "Hi {contact_name}, this is Sunshine Dental calling to confirm your appointment on {appointment_date}..."
3. Configure voicemail: "Hi, we're calling from Sunshine Dental to confirm your upcoming appointment. Please call us back at..."
4. Calendar settings:
   - timezone: America/Los_Angeles
   - Working hours: 8am-5pm
   - Working days: Mon-Sat
   - no_show_auto_retry: true
   - allow_rescheduling: true
   - default_meeting_duration: 30
   - preferred_video_provider: none (in-person appointments)

**Step 4: Daily Campaign Creation**
1. Filter contacts by `appointment_date` = tomorrow
2. Create campaign targeting these contacts
3. Launch → Calls go out to all patients

### What Happens During Calls

**Patient Confirms:**
```
AI calls → Patient says "Yes, I'll be there at 2pm"
→ AI Analysis:
  intent: "confirmed", confidence: 0.95
  patientSentiment: "positive"
→ Calendar event updated: confirmation_status = "confirmed"
  title changed to "Confirmed: Jane Doe"
→ Contact updated: appointment_confirmed = true
→ Webhook: appointment.confirmed
→ SimplyBook.me: booking status updated (if sync configured)
```

**Patient Reschedules:**
```
AI calls → "Can we move it to Thursday at 3pm instead?"
→ AI Analysis:
  intent: "reschedule", confidence: 0.88
  newAppointmentTime: "2026-03-12T15:00:00"
  rescheduleReason: "scheduling conflict"
→ syncRescheduleAppointment():
  - Original event updated: title = "Rescheduled: Jane Doe"
  - New event created at Thursday 3pm
  - rescheduled_count incremented
→ Contact updated: appointment_rescheduled = true
→ Webhook: appointment.rescheduled
```

**No-Show Auto-Retry:**
```
AI calls → No answer (status: no_answer)
→ no_show_auto_retry = true
→ syncHandleNoShow():
  - Calendar event: title = "No-Show: Jane Doe"
  - confirmation_status = "no_response"
  - Follow-up scheduled: 24h later
→ Contact: no_show_count incremented
→ Webhook: appointment.no_show
```

**Callback Requested:**
```
AI calls → "I'm busy right now, can you call back in an hour?"
→ AI Analysis:
  intent: "callback_requested", confidence: 0.85
→ syncScheduleCallback():
  - Calendar event: "Callback: Jane Doe" at +1 hour
  - Follow-up in queue
```

### Monthly Impact Calculation
- 40 appointments/day × 22 working days = 880 appointments/month
- With follow-ups: ~880 × 1.3 avg attempts = ~1,144 calls
- At 1.5 min avg: ~1,716 minutes
- Growth plan includes 600 minutes
- Overage: 1,116 minutes × $0.26 = **$290.16**
- Total monthly: $179 + $290 = **$469/month**

**Alternative**: Upgrade to Business ($299/mo, 1,200 min included):
- Overage: 516 minutes × $0.23 = $118.68
- Total: $299 + $119 = **$418/month** — saves $51/month!

**Or with Calls Booster** (+$35 for 225 min):
- Growth + 2 Boosters: $179 + $70 = $249, total minutes: 600 + 450 = 1,050
- Overage: 666 × $0.26 = $173
- Total: **$422/month** — similar to Business but without CRM integrations

**ROI**: If reducing no-shows from 20% to 8%:
- Saved: 12% × 880 = 105.6 appointments × $100 = **$10,560/month saved**
- Cost: ~$450/month
- **ROI: 23.4x** — extremely strong value proposition

### Issues in This Scenario
1. **SimplyBook.me webhook integration** works but the sync back to SimplyBook after confirmation depends on the `simplybook/sync.ts` implementation
2. **The 880 calls exceed Growth's 400 calls/month** — the clinic needs to either:
   - Use Business plan (800 calls), or
   - Add Calls Boosters
3. **Calendar event denormalization** (`contact_name`, `contact_phone` in calendar_events) means confirmed appointments always show correct info even if the original contact record changes
4. **The no-show auto-retry system works** via `trigger_auto_create_followup` database trigger

---

## 13. SCENARIO 3: COLD OUTREACH — LEAD QUALIFICATION AGENT

### Company Profile
**TechScale Solutions** — A B2B SaaS company selling enterprise project management software. They have a database of 5,000 leads from trade shows, website forms, and purchased lists. They need to qualify leads using BANT (Budget, Authority, Need, Timeline) before handing qualified leads to their sales team.

### Plan Selection: Teams ($649/mo)
- 1,500 calls/month
- 10 concurrent calls (fast throughput)
- 5 users (sales team access)
- Salesforce CRM integration (where their pipeline lives)
- Microsoft Dynamics 365 (their enterprise system)
- Advanced follow-ups (10 attempts max)

### Setup Flow

**Step 1: Onboarding & Data Import**
1. Create company "TechScale Solutions"
2. Import 5,000 leads from CSV
3. Phone normalization + deduplication

**Step 2: Connect Salesforce**
1. Integrations → Salesforce → Connect
2. OAuth flow → `salesforce_integrations` record
3. Sync leads from Salesforce → `salesforce_contact_mappings`
4. Bi-directional: Salesforce leads → Callengo contacts

**Step 3: Upgrade to Teams ($649/mo)**
1. Stripe checkout for Teams plan
2. 2,250 minutes included, $0.20/min overage
3. 5 users: Owner + 4 sales reps
4. Enable overage: $500 budget

**Step 4: Invite Sales Team**
1. Settings → Team → Invite
2. Send 4 invitations → `team_invitations` records
3. Each accepts → Creates `users` record with role='member'
4. Team members can view campaigns, contacts, call logs, analytics
5. Admins can manage settings, agents, billing

**Step 5: Configure Lead Qualification Agent**
1. Select "Lead Qualification" template
2. Customize BANT-specific task prompt
3. Set voice, tone, greeting
4. Configure:
   - Follow-ups: enabled, max 5 attempts, 48h interval
   - Smart follow-up: enabled (AI decides best retry time)
   - Calendar context: Mon-Fri, 9am-6pm EST
   - Default meeting duration: 45 min (demo meetings)
   - Preferred video provider: zoom
   - Connected integrations: ['salesforce']

**Step 6: Create Segmented Campaigns**
1. **Campaign A**: "Trade Show Leads" — 500 hot leads, priority
2. **Campaign B**: "Website Signups" — 2,000 warm leads
3. **Campaign C**: "Cold List" — 2,500 cold contacts

### What Happens During Calls

**Qualified Lead (Meeting Booked):**
```
AI calls → Prospect engages → Discusses budget, authority, need, timeline
→ AI Analysis:
  intent: "meeting_requested", confidence: 0.9
  qualificationScore: 8/10
  budget: "$50k-100k annual"
  authority: "VP of Engineering, final decision maker"
  need: "Current PM tool doesn't scale past 50 users"
  timeline: "Evaluating tools this quarter"
  meetingTime: "2026-03-12T14:00:00"
→ syncScheduleMeeting():
  - Calendar event: "Meeting: TechScale Demo — VP John Smith"
  - Duration: 45 min
  - Video link: Zoom meeting created automatically
  - description: "Qualified lead meeting with John Smith"
→ Contact updated:
  - meeting_scheduled = true
  - video_link = "https://zoom.us/..."
  - custom_fields: { qualification_score: 8, budget: "$50k-100k", ... }
→ Salesforce sync: Lead updated with qualification data, activity logged
→ Webhook: appointment.scheduled
```

**Needs Nurturing:**
```
AI calls → Prospect is interested but not ready
→ AI Analysis:
  intent: "needs_nurturing", confidence: 0.75
  qualificationScore: 4/10
  budget: "Not allocated yet"
  authority: "Manager, needs VP approval"
  need: "Acknowledged pain point"
  timeline: "Maybe next year"
→ Contact updated:
  - custom_fields: { qualification_score: 4, needs_nurturing: true, ... }
→ Follow-up scheduled: 2 weeks
→ Salesforce: Lead stage updated to "Nurturing"
```

**Not Qualified:**
```
AI calls → Prospect not interested / wrong fit
→ AI Analysis:
  intent: "not_qualified", confidence: 0.85
  qualificationScore: 2/10
→ Contact: call_outcome = "Not Qualified"
→ Salesforce: Lead marked as "Closed - Not Qualified"
→ No follow-up scheduled
```

### Throughput Calculation
- 5,000 total leads
- 10 concurrent calls × ~2 min avg = ~300 calls/hour
- 1,500 calls/month (Teams limit) → ~50 calls/day
- At 50 calls/day: 100 days to process all 5,000
- **This is too slow!** With 10 concurrent calls, they could do 300/hour but are limited by monthly call volume.

**Solutions:**
1. Add 3× Calls Booster: +450 calls → 1,950 calls/month → ~65/day → 77 days
2. Enable higher overage budget
3. Focus on Campaign A (hot leads) first

### Monthly Billing for Full Utilization
- 1,500 calls × 1.5 min = 2,250 min (exactly the included amount)
- Cost: **$649/month** (no overage if they stay within limits)
- With 1 extra seat ($49): **$698/month**

### Issues in This Scenario

1. **ISSUE-12 (Critical for this scenario)**: If TechScale uses Dynamics 365 instead of/alongside Salesforce, call results will NOT sync back to Dynamics because the webhook handler doesn't call the Dynamics push function
2. **Zoom meeting creation** depends on `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` env vars being configured. The calendar sync code checks for this and warns if missing
3. **Salesforce sync works** — the webhook handler calls `pushCallResultToSalesforce()`
4. **Team permissions work** — admin/member role separation is enforced via RLS policies. Team invitations have expiry (7 days) and token-based acceptance
5. **The 10 concurrent call limit** is tracked via the Bland AI sub-account, not in the application. The `call_queue` manages dispatching but relies on Bland's concurrency handling
6. **Smart follow-up** (`smart_follow_up: true`) is referenced in the agent_runs schema but the actual "smart" scheduling logic (AI-determined best retry time) would need to be implemented in the follow-up processing worker

---

## 14. PRODUCT VIABILITY ASSESSMENT

### Strengths

1. **Clear Value Proposition**: AI phone calls for three specific, high-value use cases
2. **Strong ROI Story**: The dental clinic scenario shows 23.4x ROI — compelling sales material
3. **Well-Architected**: Clean code, proper TypeScript, comprehensive error handling
4. **Multi-Tenant Isolation**: Sub-account architecture per company (Bland AI) + RLS (Supabase)
5. **Comprehensive Integration Ecosystem**: 11 integrations covering major CRMs, calendars, and tools
6. **Scalable Pricing**: 6-tier plan structure with clear upgrade path
7. **AI-Powered Post-Call Intelligence**: GPT-4o-mini analysis adds significant value beyond raw calls
8. **International Ready**: Multi-currency (USD/EUR/GBP), i18n, timezone-aware
9. **Developer-Friendly**: Webhook system, API, Zapier/Make/n8n compatibility
10. **Retention System**: Cancellation flow with feedback, retention offers, coupons

### Weaknesses

1. **Single Provider Dependency**: 100% dependent on Bland AI for telephony. If Bland has an outage, the entire product is down
2. **No Real-Time Call Monitoring**: Users cannot listen to calls in progress or intervene
3. **Limited to Outbound Only**: No inbound call handling (not necessarily a weakness — it's focused)
4. **Analysis Latency**: Sync mode AI analysis adds 1-3s to webhook processing; async mode requires queue worker
5. **No A/B Testing Framework**: Cannot compare different agent prompts or configurations
6. **No SMS/Email Follow-up**: Follow-ups are phone-only; adding multi-channel would increase value
7. **Recording Retention Default (30 days)**: Short for compliance-heavy industries unless they buy the add-on

### Market Positioning

The product sits in the **AI calling automation** space, competing with:
- **Air AI** — fully autonomous AI agents (higher-end)
- **Bland AI** directly — users could build their own
- **Synthflow** — similar concept, different execution
- **Vapi.ai** — developer-focused

Callengo differentiates by being:
- **Template-based** (not requiring AI prompt engineering)
- **CRM-integrated** (not just a calling API)
- **Use-case focused** (3 specific agents vs. generic)
- **Fully managed** (no infrastructure knowledge needed)

### Viability Verdict: **VIABLE — Ready for beta launch after fixing critical issues**

The product has a solid technical foundation, clear value proposition, and reasonable pricing. The three agent types cover real business pain points with measurable ROI. The integration ecosystem is impressively comprehensive for an early-stage product.

---

## 15. CRITICAL RECOMMENDATIONS

### Must Fix Before Launch (Critical/High)

1. **REMOVE** the `authenticated_can_view_companies` RLS policy — data leak vulnerability
2. **ADD** Zoho and Dynamics outbound push to the Bland webhook handler
3. **SECURE** the seed endpoint — always require a secret, block in all non-development environments
4. **REPLACE** in-memory rate limiter with Redis/KV-based solution for Vercel

### Should Fix Before Launch (Medium)

5. **REFACTOR** the Bland webhook handler — extract into separate service modules
6. **FIX** the self-referential HTTP call in usage-tracker.ts
7. **VERIFY** the admin_finances role check works with the actual admin user's role
8. **CONFIGURE** the analysis queue cron job (Vercel Cron or external)
9. **FIX** the annual price monthly_equivalent metadata calculation

### Nice to Have (Low)

10. Clean up duplicate RLS policies
11. Clean up duplicate updated_at triggers
12. Add encryption layer for OAuth tokens
13. Add DESC index for usage_tracking period lookups
14. Document Google Sheets as import-only in user-facing content

---

*Report generated by automated code analysis on March 6, 2026.*
*329 source files analyzed across frontend, backend, database, and integrations.*
