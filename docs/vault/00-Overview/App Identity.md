---
tags: [overview, identity, product, architecture, stack]
aliases: [Callengo, Platform, Product Identity]
---

# Callengo — App Identity

> **Tagline:** "Agentes de IA que llaman a tus contactos, califican tus leads, verifican tus datos y confirman tus citas — para que tu equipo nunca tenga que hacerlo."

---

## What Is Callengo?

Callengo is a **B2B SaaS platform for automated outbound AI phone calls**. It replaces manual, repetitive phone work — lead qualification, data validation, and appointment confirmation — with intelligent voice agents that call, converse, analyze, and follow up autonomously. The platform is designed for sales teams, operations departments, legal firms, healthcare offices, and any organization that needs to reach contacts by phone at scale without hiring additional staff.

Callengo is **not** a generic dialer, not a chatbot, and not a call center platform. It is a purpose-built system for three specific, high-value use cases where AI voice agents deliver measurable ROI: qualifying leads before sales reps touch them, cleaning and verifying contact databases, and confirming appointments to reduce no-shows. Every feature in the platform — from the campaign dispatch engine to the post-call AI analysis to the CRM sync — is designed around these three workflows.

The platform operates on a **multi-tenant architecture** where every customer (called a "company" internally) shares the same infrastructure. All calls flow through a single Bland AI master API key, all data lives in a shared Supabase PostgreSQL database with Row Level Security (RLS) enforcing strict tenant isolation, and all concurrency is managed through Upstash Redis counters. This architecture keeps operational complexity low while supporting hundreds of companies simultaneously.

---

## The Three Core AI Agents

Callengo ships with three pre-built agent templates. Each template defines the agent's behavior, conversation strategy, opening sentence, voicemail message, and post-call analysis criteria. Companies can customize each agent's instructions, voice, language, and calendar settings, but the fundamental structure of each agent type is fixed.

### 1. Lead Qualification Agent (`lead-qualification`)

The Lead Qualification Agent calls leads and applies the **BANT framework** (Budget, Authority, Need, Timeline) to determine whether a lead is worth pursuing. During the conversation, the agent asks discovery questions, listens for buying signals, and classifies the lead as **hot** (3-4 BANT dimensions confirmed), **warm** (1-2 dimensions), or **cold** (0 dimensions). If the lead is qualified and interested, the agent offers to schedule a meeting with the sales team, checking real-time calendar availability to propose concrete time slots.

After the call, OpenAI GPT-4o-mini analyzes the transcript to extract a structured BANT assessment, a qualification score (1-10), sentiment analysis, key discussion points, and recommended next steps. The results are stored in the contact's record and synced back to the originating CRM ([[HubSpot]], [[Salesforce]], [[Pipedrive]], etc.) if connected.

- **Category:** Sales
- **Slug:** `lead-qualification`
- **Key outcome:** Qualified leads with BANT scores, optional meeting scheduled
- **Post-call AI:** Extracts budget, authority, need, timeline, qualification score, meeting time
- **See also:** [[Lead Qualification]] workflow

### 2. Data Validation Agent (`data-validation`)

The Data Validation Agent calls contacts to verify and update their information: email addresses, phone numbers, physical addresses, job titles, and company names. The agent confirms each data point conversationally, asks for corrections when information is outdated, and captures any new information volunteered by the contact. This is particularly valuable for organizations with large, aging databases where a significant percentage of records are stale or incorrect.

After the call, the AI analysis extracts every validated and updated field, compares them against the existing record, and produces a structured diff showing what changed. The webhook handler then applies these changes directly to the contact record in Callengo and syncs them to connected CRMs.

- **Category:** Verification
- **Slug:** `data-validation`
- **Key outcome:** Verified/updated contact fields, CRM sync
- **Post-call AI:** Extracts confirmed fields, updated values, new data points
- **See also:** [[Data Validation]] workflow

### 3. Appointment Confirmation Agent (`appointment-confirmation`)

The Appointment Confirmation Agent calls contacts 24-48 hours before a scheduled appointment to confirm their attendance, handle rescheduling requests, and detect no-shows. The agent is calendar-aware: it understands the company's working hours, time zone, and available slots, so it can offer concrete alternative times when a contact wants to reschedule. If the contact confirms, the calendar event is updated. If the contact doesn't answer or reaches voicemail, the agent can leave a message and schedule a callback.

After the call, the AI analysis determines the intent: `confirmed`, `reschedule`, `cancel`, `no_show`, `callback_requested`, or `unclear`. If the intent is confirmed with high confidence (≥0.6), the system automatically updates the calendar event status and marks the follow-up as completed. If rescheduling is detected, the system creates a new calendar event at the requested time.

- **Category:** Appointment
- **Slug:** `appointment-confirmation`
- **Key outcome:** Confirmed/rescheduled appointment, no-show detection
- **Post-call AI:** Extracts intent, new appointment time, patient sentiment
- **See also:** [[Appointment Confirmation]] workflow

---

## Technology Stack

Callengo is built entirely on modern, serverless-first technologies. There are no traditional backend servers, no Docker containers, and no Kubernetes clusters. Everything runs as serverless functions on Vercel, with data in Supabase, calls through Bland AI, and state management in Redis.

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js (App Router) | 16.1.1 | Full-stack framework, server components, API routes |
| **UI Library** | React | 19.2.1 | Component rendering |
| **Language** | TypeScript | 5.9.3 | Type safety across frontend and backend |
| **Styling** | Tailwind CSS | 4.0 | Utility-first CSS, no `@layer` syntax |
| **Component Library** | shadcn/ui | Latest | Pre-built accessible UI components |
| **Database** | Supabase (PostgreSQL) | — | 56 tables, Row Level Security, triggers, RPC functions |
| **Authentication** | Supabase Auth | — | Email/password + OAuth (Google, GitHub) |
| **Payments** | [[Stripe Integration\|Stripe]] | 20.1.0 | Subscriptions, metered billing, add-ons, invoicing |
| **Voice/Telephony** | [[Bland AI]] | v1 API | Outbound calls, transcription, voicemail detection |
| **Concurrency** | [[Upstash Redis]] | Serverless | Rate limiting, call slots, cooldowns, caching |
| **AI Analysis** | [[OpenAI]] GPT-4o-mini | — | Post-call intent analysis, JSON mode, temperature 0.1 |
| **Charts** | Recharts | 3.8.0 | Dashboard and analytics visualizations |
| **Analytics (Product)** | [[Google Analytics 4]] | — | 130+ custom events, server-side Measurement Protocol |
| **Analytics (Behavior)** | [[PostHog]] | — | Session replay, feature flags, group analytics |
| **Internationalization** | Custom i18n | — | 7 languages: en, es, fr, de, it, nl, pt |
| **Deployment** | Vercel | — | Serverless functions, edge middleware, CDN |

### NPM Dependencies (Key)

```json
{
  "next": "16.1.1",
  "react": "19.2.1",
  "typescript": "5.9.3",
  "stripe": "20.1.0",
  "recharts": "3.8.0",
  "posthog-js": "^1.360.1",
  "posthog-node": "^5.28.1",
  "@next/third-parties": "^16.1.6",
  "@supabase/supabase-js": "latest",
  "@upstash/redis": "latest",
  "@upstash/ratelimit": "latest",
  "openai": "latest",
  "zod": "latest"
}
```

---

## Key Architectural Decisions

These are the fundamental design choices that shape how Callengo works. Understanding them is essential for working on the codebase.

### 1. Single Bland AI Master Key

All calls across all companies flow through **one Bland AI API key** (stored in `BLAND_API_KEY` environment variable). There are no sub-accounts, no per-company API keys, and no per-company Bland configurations. Bland AI sees a flat pool of calls; the correlation between calls and companies happens entirely in Callengo's database via `company_id` in the call metadata. This simplifies billing (one Bland invoice), reduces operational overhead (one account to manage), and makes it easy to enforce global concurrency limits.

The trade-off is that all companies share the same Bland AI plan limits (concurrent calls, daily cap, hourly cap). Callengo manages fair distribution through per-company Redis counters that subdivide the global capacity based on each company's [[Subscription]] plan.

### 2. Redis-Based Concurrency Control

Every call dispatch goes through an atomic Redis pipeline that checks and increments multiple counters simultaneously: global concurrent calls, per-company concurrent calls, global daily count, global hourly count, per-company daily count, and per-company hourly count. If any counter would exceed its limit, the entire pipeline rolls back and the call is rejected. This ensures that no single company can monopolize the shared Bland AI capacity.

Active calls are tracked as individual Redis keys (`callengo:active_call:{callId}`) with a 30-minute TTL that acts as a safety net — if a call's webhook never fires (e.g., due to a Bland AI outage), the slot is automatically reclaimed after 30 minutes. See [[Upstash Redis]] for details.

### 3. Minutes as the Internal Metric

Internally, Callengo tracks usage in **minutes**. The `subscription_plans` table defines `minutes_included` per plan, and the `usage_tracking` table records `minutes_used`. The frontend converts minutes to an estimated call count using the formula `calls = minutes / 1.5` (assuming an average call duration of 1.5 minutes). This is a display-only conversion; billing and throttling operate exclusively on minutes. See [[Usage Tracking]] for the full flow.

### 4. Row Level Security Everywhere

Every table in the database (except `agent_templates` and `subscription_plans`, which are public read) has RLS policies that filter data by `company_id`. A user can only see data belonging to their company. This is enforced at the database level, not the application level, which means even if an API route has a bug that omits a WHERE clause, the database will still prevent cross-tenant data leaks. See [[RLS Patterns]] for all five patterns.

### 5. Encrypted OAuth Tokens

All OAuth tokens (access tokens, refresh tokens) for all 11 integration providers are encrypted at rest using AES-256-GCM before being stored in the database. The encryption key is a 64-character hex string stored in the `TOKEN_ENCRYPTION_KEY` environment variable. The `decryptToken()` function is backward-compatible: if it encounters a token that doesn't start with the `enc:` prefix, it returns it as-is, allowing gradual migration from plaintext to encrypted tokens. See [[Security & Encryption]] for details.

### 6. Async Processing Queues

Callengo uses four database-backed queues for asynchronous processing:

| Queue Table | Purpose | Processor |
|------------|---------|-----------|
| `campaign_queue` | Pending calls to dispatch | `src/lib/queue/dispatch-queue.ts` |
| `follow_up_queue` | Retry calls (no-answer, busy, voicemail) | `src/lib/queue/followup-queue.ts` |
| `analysis_queue` | Post-call AI analysis jobs | `src/lib/queue/analysis-queue.ts` |
| `call_queue` | Legacy call queue (pre-campaign_queue) | `src/app/api/queue/` |

Each queue follows the same pattern: entries are inserted with `status=pending`, a background processor claims entries atomically (UPDATE WHERE status=pending), processes them, and marks them as `completed` or `failed`.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                    # 37 protected routes (authenticated users)
│   │   ├── home/                 # Default landing page (dashboard)
│   │   ├── agents/               # Agent configuration and management
│   │   ├── contacts/             # Contact management + CRM sub-routes
│   │   ├── campaigns/            # Campaign creation and monitoring
│   │   ├── calls/                # Call history and details
│   │   ├── calendar/             # Calendar view and event management
│   │   ├── analytics/            # Analytics dashboards and reports
│   │   ├── reports/              # Exportable reports
│   │   ├── voicemails/           # Voicemail inbox
│   │   ├── follow-ups/           # Follow-up queue management
│   │   ├── settings/             # Account settings (billing at ?tab=billing)
│   │   ├── team/                 # Team member management
│   │   └── integrations/         # Integration connections
│   ├── auth/                     # Login, signup, OAuth callbacks
│   ├── admin/                    # Admin panel ([[Command Center]])
│   ├── onboarding/               # New user onboarding wizard
│   ├── pricing/                  # Public pricing page
│   └── api/                      # 142+ API endpoints
│       ├── admin/                # Command Center, clients, finances, monitor
│       ├── billing/              # 13 billing endpoints
│       ├── bland/                # Bland AI webhooks and dispatch
│       ├── integrations/         # 60+ CRM integration endpoints
│       ├── contacts/             # Contact CRUD
│       ├── calendar/             # Calendar CRUD and sync
│       ├── openai/               # AI analysis endpoints
│       ├── team/                 # Team management
│       ├── queue/                # Async queue processing
│       ├── campaigns/            # Campaign dispatch
│       └── webhooks/             # Stripe webhooks
├── components/                   # 25 component directories
│   ├── agents/                   # AgentConfigModal (~2,300 lines)
│   ├── integrations/             # IntegrationsPage (~2,300 lines)
│   ├── settings/                 # BillingSettings (~1,000 lines)
│   ├── admin/                    # AdminCommandCenter (~1,200 lines)
│   ├── analytics/                # AnalyticsProvider, PostHogProvider, PageTrackers
│   ├── dashboard/                # Dashboard components
│   └── ui/                       # shadcn/ui base components
├── config/
│   └── plan-features.ts          # Source of truth: features by plan (400 lines)
├── contexts/
│   └── AuthContext.tsx            # Authentication context provider
├── hooks/
│   ├── useStripe.ts              # Stripe client hooks
│   └── useAutoGeolocation.ts     # Auto-detect user location
├── i18n/                         # Translation files (7 languages)
├── lib/                          # Core business logic
│   ├── ai/                       # Intent analyzers (GPT-4o-mini)
│   ├── bland/                    # master-client.ts, phone-numbers.ts
│   ├── billing/                  # usage-tracker, overage-manager, call-throttle
│   ├── redis/                    # concurrency-manager.ts
│   ├── calendar/                 # Google Calendar, Outlook sync
│   ├── queue/                    # dispatch-queue, followup-queue, analysis-queue
│   ├── hubspot/                  # HubSpot OAuth + sync
│   ├── salesforce/               # Salesforce OAuth + sync
│   ├── pipedrive/                # Pipedrive OAuth + sync
│   ├── zoho/                     # Zoho OAuth + sync
│   ├── dynamics/                 # MS Dynamics OAuth + sync
│   ├── clio/                     # Clio OAuth + sync
│   ├── simplybook/               # SimplyBook API + sync
│   ├── voices/                   # Bland AI voice catalog (66 voices)
│   ├── supabase/                 # client.ts, server.ts, service.ts
│   ├── analytics.ts              # [[Google Analytics 4]] (1,036 lines, 130+ events)
│   ├── posthog.ts                # [[PostHog]] tracking (850+ lines, 20 categories)
│   ├── posthog-server.ts         # PostHog server-side capture
│   ├── encryption.ts             # AES-256-GCM token encryption
│   ├── stripe.ts                 # Stripe SDK wrapper (380 lines)
│   ├── rate-limit.ts             # Rate limiting (defined, not globally applied)
│   ├── mock-data.ts              # Demo data (687 lines)
│   └── webhooks.ts               # Webhook signature verification
├── types/                        # TypeScript type definitions
└── middleware.ts                  # Edge middleware for route protection
```

---

## Navigation Flow

The application has a well-defined navigation hierarchy:

| Trigger | Destination |
|---------|------------|
| Root `/` | → `/home` |
| Post-login (regular user) | → `/home` |
| Post-login (admin/owner) | → `/admin/command-center` |
| Post-onboarding | → `/home` |
| Team join | → `/home?team_joined=true` |
| Billing management | → `/settings?tab=billing` |

---

## Environment Variables (Key)

| Variable | Purpose | Scope |
|----------|---------|-------|
| `BLAND_API_KEY` | Bland AI master API key | Server |
| `BLAND_WEBHOOK_SECRET` | Bland webhook HMAC signature | Server |
| `BLAND_COST_PER_MINUTE` | Override default cost (default: $0.14) | Server |
| `STRIPE_SECRET_KEY` | Stripe API key | Server |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature | Server |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o-mini) | Server |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key (64 hex chars) | Server |
| `UPSTASH_REDIS_REST_URL` | Redis connection URL | Server |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Server |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (G-XXXXXXXXXX) | Public |
| `GA_API_SECRET` | GA4 Measurement Protocol secret | Server |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key (phc_XXX) | Public |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (default: us.i.posthog.com) | Public |

---

## Related Notes

- [[Architecture Overview]] — Detailed system architecture and data flow patterns
- [[ICP & Positioning]] — Ideal customer profile, buyer personas, competitive positioning
- [[Schema Overview]] — Complete database schema (56 tables)
- [[Plan Features]] — Feature matrix by subscription plan
- [[Pricing Model]] — V4 pricing structure and unit economics
- [[Bland AI]] — Voice infrastructure and master key architecture
- [[Stripe Integration]] — Payment processing and subscription management
- [[Upstash Redis]] — Concurrency control, rate limiting, and caching
- [[OpenAI]] — Post-call AI analysis and intent detection
- [[Google Analytics 4]] — Product analytics (130+ events)
- [[PostHog]] — Behavioral analytics, session replay, feature flags
- [[Security & Encryption]] — Token encryption, RLS, rate limiting
- [[Command Center]] — Admin monitoring dashboard
