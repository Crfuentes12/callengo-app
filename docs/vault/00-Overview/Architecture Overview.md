---
tags: [overview, architecture, system-design]
---

# Architecture Overview

## High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js    │────▶│  API Routes  │────▶│  Supabase   │
│  Frontend    │     │  (142 routes)│     │ (PostgreSQL) │
│  (App Router)│     └──────┬───────┘     └─────────────┘
└─────────────┘            │
                    ┌──────┼──────────────┐
                    ▼      ▼              ▼
              ┌──────┐ ┌───────┐  ┌──────────┐
              │Bland │ │Stripe │  │  Redis   │
              │ AI   │ │       │  │(Upstash) │
              └──────┘ └───────┘  └──────────┘
                    │
                    ▼
              ┌──────────┐
              │  OpenAI  │
              │GPT-4o-mini│
              └──────────┘
```

## Project Structure

```
src/
├── app/
│   ├── (app)/          → Protected routes (37 routes)
│   ├── auth/           → Login, signup, OAuth callbacks
│   ├── admin/          → Internal admin panel
│   ├── onboarding/     → New user flow
│   ├── api/            → 142 API endpoints
│   └── pricing/        → Public pricing page
├── components/         → 25 component directories
├── config/             → plan-features.ts (source of truth)
├── contexts/           → AuthContext
├── hooks/              → useStripe, useAutoGeolocation
├── i18n/               → 7 language files
├── lib/                → Business logic
│   ├── ai/             → Intent analyzer (OpenAI)
│   ├── bland/          → Master client, phone numbers
│   ├── billing/        → Usage tracker, overage, throttle
│   ├── redis/          → Concurrency manager
│   ├── calendar/       → Google, Outlook, Zoom sync
│   ├── {crm}/          → 7 CRM libraries
│   ├── supabase/       → Client configs (browser, server, service)
│   └── encryption.ts   → AES-256-GCM token encryption
├── types/              → TypeScript types (12 files, 200+ interfaces)
└── middleware.ts       → Edge route protection
```

## Key Architectural Patterns

### 1. Master Key Architecture ([[Bland AI]])
All calls route through a single Bland AI API key. Tenant isolation is enforced in Supabase via `company_id`, not via Bland sub-accounts.

### 2. Redis Concurrency ([[Upstash Redis]])
- Global counters: concurrent, daily, hourly calls
- Per-company counters: same breakdown
- Active call slots: `callengo:active_call:{callId}` with 30min TTL
- Contact cooldown: 5min between calls to same contact

### 3. Async Processing Queues
- **[[Campaign Queue]]** — Dispatches calls from campaigns
- **[[Call Queue]]** — Individual call dispatch
- **[[Analysis Queue]]** — Post-call AI analysis (claim via `FOR UPDATE SKIP LOCKED`)
- **[[Follow-Up Queue]]** — Auto-created follow-ups on call completion

### 4. Row Level Security ([[RLS Patterns]])
All user-facing tables use RLS with company-scoped access. Service role bypass for webhooks and API operations.

### 5. Supabase Client Pattern
- **Server-side:** `createServerSupabaseClient()` from `src/lib/supabase/server.ts`
- **Client-side:** `createBrowserSupabaseClient()` from `src/lib/supabase/client.ts`
- **Service role:** `src/lib/supabase/service.ts` (bypasses RLS)

## Navigation Flow

```
/ → /home (regular users) or /admin/command-center (admins)
Post-login → /home
Post-onboarding → /home
Team join → /home?team_joined=true
```

## Related Notes

- [[App Identity]]
- [[Schema Overview]]
- [[API Overview]]
- [[Campaign Dispatch Flow]]
- [[Call Processing Flow]]
