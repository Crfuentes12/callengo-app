---
tags: [overview, architecture, system-design, infrastructure]
aliases: [System Architecture, Technical Architecture]
---

# Architecture Overview

Callengo is a serverless-first B2B SaaS platform built on Next.js, deployed on Vercel, with data in Supabase, telephony through Bland AI, payments via Stripe, state in Redis, and AI analysis through OpenAI. This document describes the complete system architecture, data flows, and key design patterns.

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Web Browser  │  │  Stripe      │  │  Bland AI Webhook    │   │
│  │  (React 19)   │  │  Webhooks    │  │  (Call Completion)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼──────────────────┼────────────────────┼───────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL EDGE / SERVERLESS                     │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐ │
│  │middleware │  │           Next.js API Routes (142+)          │ │
│  │  (Edge)   │  │  ┌────────┬────────┬────────┬─────────────┐ │ │
│  │  - Auth   │  │  │billing │ bland  │calendar│integrations │ │ │
│  │  - Routes │  │  │  (13)  │  (4)   │  (10)  │   (60+)     │ │ │
│  │  - i18n   │  │  ├────────┼────────┼────────┼─────────────┤ │ │
│  └──────────┘  │  │ admin  │contacts│  team  │  campaigns  │ │ │
│                │  │  (8)   │  (8)   │  (5)   │    (3)      │ │ │
│                │  └────────┴────────┴────────┴─────────────┘ │ │
│                └──────────────────────────────────────────────┘ │
└────────┬──────────┬──────────┬──────────┬──────────┬───────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ Supabase │ │ Bland AI │ │ Stripe │ │  Redis │ │  OpenAI  │
│(Postgres)│ │ (Voice)  │ │(Billing│ │(Upstash│ │(GPT-4o-  │
│ 56 tables│ │ Master   │ │  Sub,  │ │  Rate  │ │  mini)   │
│ RLS on   │ │ API Key  │ │ Meter, │ │  Limit │ │ Intent   │
│ all user │ │ 66 voices│ │ Addon) │ │ Concur │ │ Analysis │
│ tables   │ │          │ │        │ │ Slots  │ │ JSON mode│
└──────────┘ └──────────┘ └────────┘ └────────┘ └──────────┘
         │                                          │
         ▼                                          ▼
┌──────────────────────────────────────────────────────────────┐
│                     ANALYTICS LAYER                           │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │  Google Analytics 4  │  │         PostHog               │  │
│  │  130+ custom events  │  │  Session replay, feature      │  │
│  │  Server + client     │  │  flags, group analytics       │  │
│  │  Measurement Protocol│  │  20 event categories          │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Call Lifecycle

The most important data flow in the system is the call lifecycle, from campaign creation to post-call CRM sync.

```
1. User creates campaign (agent_runs record)
         │
2. User starts campaign → POST /api/campaigns/dispatch
         │
3. Pre-dispatch checks:
   ├── checkCallAllowed() → subscription active? period valid?
   ├── Redis checkCallCapacity() → global + company limits
   └── Minutes available? → usage_tracking + overage check
         │
4. Batch INSERT to campaign_queue (status=pending)
         │
5. Background processor (dispatch-queue.ts) claims entries
         │
6. Per contact:
   ├── Pre-register call_log (status=queued)
   ├── acquireCallSlot() → atomic Redis pipeline
   │   ├── INCR callengo:concurrent:global
   │   ├── INCR callengo:concurrent:company:{id}
   │   ├── INCR callengo:daily:{date}
   │   ├── INCR callengo:hourly:{bucket}
   │   └── SET callengo:active_call:{callId} (30min TTL)
   └── dispatchCall() → Bland AI POST /v1/calls (15s timeout)
         │
7. Bland AI makes the call (1-60 min)
         │
8. Bland webhook → POST /api/bland/webhook
   ├── HMAC-SHA256 signature verification
   ├── Idempotency check (skip if already completed)
   ├── Atomic claim: UPDATE call_logs SET completed=true WHERE completed=false
   ├── Update call_log (status, duration, transcript, recording)
   ├── Voicemail detection → voicemail_logs, agent_run counters
   ├── Contact record update (status, call metadata)
   ├── AI analysis (sync or async via analysis_queue)
   │   ├── Lead Qualification → BANT scores, qualification 1-10
   │   ├── Data Validation → field verification, contact updates
   │   └── Appointment Confirmation → intent, reschedule handling
   ├── Calendar event creation (callbacks, meetings)
   ├── CRM sync → pushCallResult to HubSpot/Salesforce/Pipedrive/Clio
   ├── Redis releaseCallSlot() → DECR all counters
   ├── Atomic usage tracking → atomic_increment_usage()
   ├── Analytics → GA4 server event + PostHog capture
   └── Outbound webhook fire (HMAC-SHA256 signed)
         │
9. DB triggers fire:
   ├── auto_create_followup → follow_up_queue entry
   ├── notify_campaign_completion → notification
   └── notify_high_failure_rate → alert notification
```

---

## Async Processing Queues

Callengo uses four database-backed queues for asynchronous work. All follow the same pattern: entries inserted with `status=pending`, a background processor atomically claims entries, processes them, and marks them `completed` or `failed`.

| Queue Table | Purpose | Processor File | Batch Size | Trigger |
|------------|---------|---------------|-----------|---------|
| `campaign_queue` | Pending calls to dispatch via Bland AI | `src/lib/queue/dispatch-queue.ts` | 5 | Campaign start |
| `follow_up_queue` | Retry calls for no-answer, busy, voicemail | `src/lib/queue/followup-queue.ts` | 10 | `auto_create_followup` trigger |
| `analysis_queue` | Post-call AI analysis with OpenAI | `src/lib/queue/analysis-queue.ts` | 10 | Webhook (if async mode) |
| `call_queue` | Legacy individual call dispatch | `src/app/api/queue/` | — | Manual |

### Queue Processing Pattern

```typescript
// 1. Claim entries atomically
UPDATE queue SET status='processing'
WHERE status='pending' AND next_attempt_at <= NOW()
LIMIT batch_size
RETURNING *;

// 2. Process each entry
for (const entry of claimed) {
  try {
    await processEntry(entry);
    await markCompleted(entry.id);
  } catch (error) {
    await markFailed(entry.id, error.message);
  }
}
```

---

## Redis Concurrency Model

All concurrency tracking happens in [[Upstash Redis]] using atomic pipelines. The system tracks six counter types simultaneously, and a 90% safety margin is applied to Bland AI plan limits to prevent overruns.

### Redis Key Structure

| Key Pattern | TTL | Purpose |
|------------|-----|---------|
| `callengo:concurrent:global` | None | Global active calls |
| `callengo:concurrent:company:{id}` | None | Per-company active calls |
| `callengo:daily:{YYYY-MM-DD}` | 36h | Global daily call count |
| `callengo:daily:{YYYY-MM-DD}:{id}` | 36h | Per-company daily count |
| `callengo:hourly:{YYYY-MM-DD-HH}` | 2h | Global hourly call count |
| `callengo:hourly:{YYYY-MM-DD-HH}:{id}` | 2h | Per-company hourly count |
| `callengo:active_call:{callId}` | 30min | Active call tracker (safety net) |
| `callengo:contact_cooldown:{contactId}` | 5min | Prevents re-calling same contact |
| `callengo:bland_plan_info` | 1h | Cached Bland AI plan limits |

### Circuit Breaker

After 5 consecutive Redis failures, the circuit breaker blocks all call dispatches for 1 minute to prevent cascading failures. During this time, the system falls back to database-based concurrency checks.

---

## Supabase Client Patterns

Three client types exist for different contexts:

| Client | Source File | RLS | Use Case |
|--------|-----------|-----|----------|
| **Server** | `src/lib/supabase/server.ts` | Yes | API routes (user context) |
| **Browser** | `src/lib/supabase/client.ts` | Yes | React components |
| **Service** | `src/lib/supabase/service.ts` | **Bypassed** | Webhooks, background jobs, admin |

```typescript
// Server-side (API routes)
import { createServerSupabaseClient } from '@/lib/supabase/server';
const supabase = createServerSupabaseClient();

// Client-side (components)
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
const supabase = createBrowserSupabaseClient();

// Service role (bypasses RLS)
import { createServiceClient } from '@/lib/supabase/service';
const supabase = createServiceClient();
```

---

## Edge Middleware (`src/middleware.ts`)

The Edge middleware runs before every request and handles:

1. **Route protection** — Redirects unauthenticated users to `/auth/login` for protected routes under `/(app)/`
2. **Admin access control** — Verifies admin/owner role for `/admin/` routes
3. **Auth page redirects** — Redirects authenticated users away from `/auth/` pages to `/home`
4. **Session refresh** — Keeps Supabase auth session alive

---

## Component Architecture

Several components are intentionally large (>1,000 lines) because they encapsulate complex, self-contained features. These should not be refactored without explicit request.

| Component | Location | Lines | Description |
|-----------|---------|-------|-------------|
| `AgentConfigModal` | `src/components/agents/` | ~2,300 | Full agent configuration (voice, language, instructions, calendar, follow-ups, voicemail) |
| `IntegrationsPage` | `src/components/integrations/` | ~2,300 | All 14 integration connections in a single page |
| `AdminCommandCenter` | `src/components/admin/` | ~1,200 | 6-tab admin monitoring dashboard |
| `BillingSettings` | `src/components/settings/` | ~1,000 | Plan management, add-ons, usage display |

---

## Dual Analytics System

Callengo implements two parallel analytics systems, both initialized in the app layout:

**Root Layout** (`src/app/layout.tsx`):
- Loads `GoogleAnalytics` component from `@next/third-parties/google`

**Protected App Layout** (`src/app/(app)/layout.tsx`):
- `AnalyticsProvider` — Sets GA4 user properties (plan, industry, team size, etc.)
- `PostHogProvider` — Initializes PostHog, identifies user, sets company group
- Both providers receive: userId, email, planSlug, billingCycle, industry, teamSize, countryCode, currency, createdAt

**Page-Level Tracking** — Each of 15 pages imports `PageTracker` (GA4) and `PostHogPageTracker` to record page views.

See [[Google Analytics 4]] and [[PostHog]] for full event catalogs.

---

## Internationalization (i18n)

Callengo supports 7 languages with auto-detection via geolocation:

| Code | Language |
|------|----------|
| `en` | English (default) |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `it` | Italian |
| `nl` | Dutch |
| `pt` | Portuguese |

Translation files live in `src/i18n/` with one file per language. The `useAutoGeolocation` hook detects the user's country via IP and sets the appropriate language and currency. All user-facing strings must use the translation system — never hardcode English strings in components.

---

## Error Handling Patterns

API routes follow a consistent error handling pattern:

```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Zod validation
    const body = schema.parse(await request.json());

    // Business logic...

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('[endpoint-name]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## Related Notes

- [[App Identity]] — Product identity, stack, and project structure
- [[Schema Overview]] — Complete database schema (56 tables)
- [[RLS Patterns]] — Row Level Security patterns
- [[Bland AI]] — Voice infrastructure and master key architecture
- [[Upstash Redis]] — Concurrency control and rate limiting
- [[OpenAI]] — Post-call AI analysis
- [[Stripe Integration]] — Payment processing
- [[Google Analytics 4]] — Product analytics (130+ events)
- [[PostHog]] — Behavioral analytics and session replay
- [[Campaign Dispatch Flow]] — Full dispatch workflow
- [[Call Processing Flow]] — Webhook processing pipeline
- [[Command Center]] — Admin monitoring dashboard
- [[Security & Encryption]] — Token encryption, RLS, webhooks
