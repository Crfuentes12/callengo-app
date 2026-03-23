---
tags: [database, schema, supabase, postgresql]
aliases: [DB Schema, Database, Database Schema]
---

# Schema Overview

Callengo uses **Supabase (PostgreSQL)** with **56 tables**, Row Level Security (RLS) on all user-facing tables, **45 sequential migrations**, and comprehensive indexing, triggers, and CHECK constraints. All data is organized around the `company_id` tenant key, enforcing strict multi-tenant isolation at the database level.

---

## Table Categories

### Core Tables (8)

The foundational entities that define companies, users, contacts, and agents.

| Table | PK | Key FK | Description | See |
|-------|-----|--------|-------------|-----|
| `companies` | `id` UUID | — | Top-level tenant entity. Soft-delete via `deleted_at`. | [[Company]] |
| `company_settings` | `company_id` UUID | → `companies` CASCADE | Per-company configuration (voice, API keys, etc.). 1:1 with company. | [[Company]] |
| `users` | `id` UUID (= auth.users) | → `companies` CASCADE | Platform users with role, geolocation, preferences. | [[User]] |
| `contacts` | `id` UUID | → `companies` CASCADE, → `contact_lists` SET NULL | Call targets with status, call history, CRM mappings. | [[Contact]] |
| `contact_lists` | `id` UUID | → `companies` CASCADE | Contact grouping/organization. | [[Contact]] |
| `agent_templates` | `id` UUID | — | 3 built-in agent types (global, read-only). | [[Agent]] |
| `company_agents` | `id` UUID | → `companies` CASCADE, → `agent_templates` | Company-specific agent instances. | [[Agent]] |
| `agent_runs` | `id` UUID | → `companies` CASCADE, → `agent_templates` | Campaigns (batch call operations). | [[Campaign]] |

### Call & Processing Tables (6)

Tables that handle the call lifecycle, from dispatch to analysis.

| Table | PK | Key FK | Description | See |
|-------|-----|--------|-------------|-----|
| `call_logs` | `id` UUID | → `companies` CASCADE, → `contacts`, → `agent_runs` | Call records with transcript, analysis, recordings. `call_id` is UNIQUE (Bland AI ID). | [[Call]] |
| `campaign_queue` | `id` UUID | → `companies` CASCADE | Pending call dispatch queue. Unique partial index on `(agent_run_id, contact_id)`. | [[Campaign]] |
| `call_queue` | `id` UUID | → `companies` CASCADE, → `contacts`, → `company_agents`, → `agent_runs` | Legacy individual call dispatch queue. | [[Call]] |
| `follow_up_queue` | `id` UUID | → `companies` CASCADE, → `agent_runs` CASCADE, → `contacts` CASCADE, → `call_logs` SET NULL | Automatic retry queue for failed calls. | [[Follow-Up]] |
| `voicemail_logs` | `id` UUID | → `companies` CASCADE, → `call_logs` CASCADE, → `contacts`, → `follow_up_queue` | Voicemail detection and message logs. | [[Voicemail]] |
| `analysis_queue` | `id` UUID | → `companies` CASCADE, → `contacts` | Post-call AI analysis job queue (GPT-4o-mini). | [[OpenAI]] |

### Billing Tables (7)

Tables that manage subscriptions, usage tracking, and payment history.

| Table | PK | Key FK | Description | See |
|-------|-----|--------|-------------|-----|
| `subscription_plans` | `id` UUID | — | 6 plan definitions (Free → Enterprise). `slug` and `name` are UNIQUE. | [[Subscription]] |
| `company_subscriptions` | `id` UUID | → `companies` CASCADE (UNIQUE), → `subscription_plans` | Active subscription per company. Stripe IDs. Overage tracking. | [[Subscription]] |
| `company_addons` | `id` UUID | → `companies` CASCADE | Paid add-ons (dedicated number, recording vault, calls booster). | [[Add-on]] |
| `usage_tracking` | `id` UUID | → `companies` CASCADE, → `company_subscriptions` SET NULL | Minute/call consumption per billing period. Atomic increment via RPC. | [[Usage Tracking]] |
| `billing_history` | `id` UUID | → `companies` CASCADE, → `company_subscriptions` SET NULL | Payment/invoice records. `stripe_invoice_id` UNIQUE. | [[Stripe Integration]] |
| `billing_events` | `id` UUID | → `companies` CASCADE, → `company_subscriptions` SET NULL | Billing event log (payments, overages, credits, cancellations). | [[Stripe Integration]] |
| `stripe_events` | `id` TEXT | — | Stripe webhook idempotency tracking. Service role only. | [[Stripe Integration]] |

### Calendar Tables (4)

| Table | PK | Key FK | Description | See |
|-------|-----|--------|-------------|-----|
| `calendar_events` | `id` UUID | → `companies` CASCADE, → `contacts`, → `agent_runs`, → `call_logs`, → `follow_up_queue`, → `team_calendar_assignments` | Calendar events (meetings, callbacks, confirmations). 20+ indexes. | [[Calendar Event]] |
| `calendar_integrations` | `id` UUID | → `companies` CASCADE | OAuth connections to Google Calendar / Outlook. UNIQUE per `(company, user, provider)`. | [[Calendar Event]] |
| `calendar_sync_log` | `id` UUID | → `companies` CASCADE, → `calendar_integrations` CASCADE | Sync operation tracking (full, incremental, push, pull). | [[Calendar Event]] |
| `team_calendar_assignments` | `id` UUID | → `companies` CASCADE | Team member routing for calendar events. UNIQUE per `(company, user)`. | [[Calendar Event]] |

### CRM Integration Tables (21 = 7 CRMs × 3 tables each)

Each CRM follows the same 3-table pattern: `{crm}_integrations` (OAuth connection), `{crm}_contact_mappings` (record linking), `{crm}_sync_logs` (operation tracking).

| CRM | Tables Prefix | Auth Type | Plan Tier | See |
|-----|--------------|-----------|-----------|-----|
| HubSpot | `hubspot_` | OAuth 2.0 | Business+ | [[HubSpot]] |
| Salesforce | `salesforce_` | OAuth 2.0 | Teams+ | [[Salesforce]] |
| Pipedrive | `pipedrive_` | OAuth 2.0 | Business+ | [[Pipedrive]] |
| Zoho | `zoho_` | OAuth 2.0 | Business+ | [[Zoho]] |
| Dynamics 365 | `dynamics_` | OAuth 2.0 (Azure AD) | Teams+ | [[Dynamics 365]] |
| Clio | `clio_` | OAuth 2.0 | Business+ | [[Clio]] |
| SimplyBook | `simplybook_` | API Key + Secret | Free+ | [[SimplyBook]] |

### Google Sheets (2)

| Table | PK | Description | See |
|-------|-----|-------------|-----|
| `google_sheets_integrations` | `id` UUID | OAuth connection. UNIQUE per `(company, user)`. | [[Google Sheets]] |
| `google_sheets_linked_sheets` | `id` UUID | Linked spreadsheets with column mapping. UNIQUE per `(company, spreadsheet_id, tab)`. | [[Google Sheets]] |

### Communication Tables (5)

| Table | PK | Description | See |
|-------|-----|-------------|-----|
| `notifications` | `id` UUID | In-app alert system (campaigns, usage, team). | [[Notification]] |
| `webhook_endpoints` | `id` UUID | Customer-configured outbound webhook URLs. | [[Webhook]] |
| `webhook_deliveries` | `id` UUID | Webhook delivery attempt log. | [[Webhook]] |
| `integration_feedback` | `id` UUID | User feedback on integrations. | — |
| `team_invitations` | `id` UUID | Team member invitations with token and expiry. | [[Team Invitation]] |

### AI Tables (2)

| Table | PK | Description |
|-------|-----|-------------|
| `ai_conversations` | `id` UUID | AI chat assistant sessions (user-scoped RLS). |
| `ai_messages` | `id` UUID | Individual chat messages within conversations. |

### Admin Tables (3)

| Table | PK | Description | See |
|-------|-----|-------------|-----|
| `admin_finances` | `id` UUID | Monthly P&L snapshots with revenue, costs, margins. | [[Command Center]] |
| `admin_platform_config` | `id` UUID | Singleton platform configuration (Bland plan, alerts, maintenance). UNIQUE((true)). | [[Platform Config]] |
| `admin_audit_log` | `id` UUID | Immutable admin action log. No UPDATE/DELETE. | [[Audit Log]] |

### Retention Tables (3)

| Table | PK | Description |
|-------|-----|-------------|
| `cancellation_feedback` | `id` UUID | Reasons for subscription cancellation. |
| `retention_offers` | `id` UUID | Retention offer tracking per company (UNIQUE company_id). |
| `retention_offer_log` | `id` UUID | Log of retention offer presentations and acceptances. |

### Extra (1)

| Table | PK | Description |
|-------|-----|-------------|
| `simplybook_webhook_logs` | `id` UUID | SimplyBook inbound webhook event log. |

---

## Schema Statistics

| Metric | Count |
|--------|-------|
| **Tables** | 56 |
| **Foreign Keys** | 100+ |
| **Indexes** | 150+ |
| **RLS Policies** | 95+ |
| **CHECK Constraints** | 8 status columns |
| **Unique Constraints** | 15+ |
| **Triggers** | 40+ |
| **Functions/RPCs** | 15+ (including `claim_analysis_job`, `atomic_increment_usage`) |
| **Migrations** | 45 |

---

## Entity Relationship Overview

```
                    ┌─────────────┐
                    │  companies  │ ← Top-level tenant
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │   users   │  │  contacts   │  │   agents    │
    │           │  │             │  │  (company_  │
    │           │  │  ┌─────────┐│  │   agents)   │
    └───────────┘  │  │  lists  ││  └──────┬──────┘
                   │  └─────────┘│         │
                   └──────┬──────┘  ┌──────┴──────┐
                          │         │ agent_runs  │
                          │         │ (campaigns) │
                          │         └──────┬──────┘
                          │                │
                   ┌──────┴────────────────┴──────┐
                   │         call_logs             │
                   └──────┬──────┬──────┬─────────┘
                          │      │      │
                   ┌──────┘      │      └──────┐
                   │             │             │
            ┌──────┴──────┐ ┌───┴───┐  ┌──────┴──────┐
            │ follow_up   │ │voicema│  │  calendar   │
            │   _queue    │ │il_logs│  │  _events    │
            └─────────────┘ └───────┘  └─────────────┘
```

---

## Related Notes

- [[RLS Patterns]] — Five RLS patterns used across all tables
- [[Triggers & Functions]] — All database triggers and functions
- [[Migrations Timeline]] — Chronological migration history
- [[Security & Encryption]] — Token encryption and security constraints
