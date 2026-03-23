---
tags: [api, endpoints, backend, architecture, next-js]
created: 2026-03-23
updated: 2026-03-23
---

# API Overview

Callengo exposes over 140 API routes implemented as Next.js App Router API Routes (serverless functions) deployed on Vercel. Every route lives under `src/app/api/` and follows the `route.ts`-per-folder convention introduced in Next.js 13+. The API layer sits between the React frontend and the Supabase PostgreSQL database, with outbound integrations to Stripe, Bland AI, OpenAI, Upstash Redis, and seven CRM providers.

This document serves as the master index of all endpoint groups, the shared patterns every route follows, and the cross-cutting concerns (authentication, validation, error handling, rate limiting) that govern the entire API surface.

---

## Endpoint Groups at a Glance

| Group | Approx. Routes | Description | Detail Page |
|-------|---------------|-------------|-------------|
| [[Billing API]] | 22 | Plans, checkout sessions, verify, portal, subscriptions, usage, overage, addons, phone numbers, history, notifications, retention | [[Billing API]] |
| [[Bland AI API]] | 4 | send-call dispatch, webhook receiver, get-call status, analyze-call | [[Bland AI API]] |
| [[Calendar API]] | 7 | Events CRUD, availability, team routing, personal events, contact sync | [[Calendar API]] |
| [[Admin API]] | 10 | Command Center, clients, finances, accounting, reconcile, monitor, cleanup-orphans, billing-events, promo-codes | [[Admin API]] |
| [[Integrations API]] | 60+ | Per-CRM OAuth flows, contacts, sync, status for 7 CRMs + Google Sheets + Google Calendar + Microsoft Outlook + Zoom + Slack + webhooks + feedback | [[Integrations API]] |
| [[Contacts API]] | 10 | List, create, update, delete, import, export, parse-csv, stats, AI analyze, AI segment | [[Contacts API]] |
| [[Auth API]] | 7+ | Team members, invite, accept-invite, cancel-invite, remove, check-admin, verify-recaptcha | [[Auth API]] |
| Company | 4 | Update settings, bootstrap, onboarding-status, scrape | |
| Campaigns | 1 | Dispatch campaign | |
| OpenAI | 3 | analyze-call, context-suggestions, recommend-agent | |
| Webhooks | 3 | Stripe webhook handler, outbound webhook endpoints CRUD | |
| Queue | 2 | Process queue, follow-ups queue | |
| AI Chat | 1 | Conversational AI assistant | |
| Settings | 1 | Calendar config | |
| Misc | 4 | Seed data, health check, voice sample, user location update, get-started | |

**Total: ~140+ route handlers** across GET, POST, PUT, DELETE methods.

---

## Complete Endpoint Inventory

### Billing (22 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/billing/create-checkout-session` | Create Stripe Checkout session for plan purchase |
| POST | `/api/billing/verify-session` | Verify Stripe Checkout completion, activate subscription |
| POST | `/api/billing/create-portal-session` | Create Stripe Customer Portal session |
| GET | `/api/billing/subscription` | Get current company subscription with plan details and usage |
| POST | `/api/billing/change-plan` | Admin-only: change plan directly in DB (bypasses Stripe) |
| GET | `/api/billing/plans` | List all available subscription plans |
| GET | `/api/billing/history` | Billing history (payments, overages, credits) |
| POST | `/api/billing/report-usage` | Report metered overage usage to Stripe |
| POST | `/api/billing/check-usage-limit` | Check if company has remaining minutes |
| POST | `/api/billing/update-overage` | Update overage settings (enable/disable, budget) |
| POST | `/api/billing/ensure-free-plan` | Ensure company has at least a free plan subscription |
| POST | `/api/billing/check-retention` | Check retention offer eligibility |
| POST | `/api/billing/cancellation-feedback` | Submit cancellation feedback |
| POST | `/api/billing/notifications` | Billing notifications management |
| POST | `/api/billing/addon-checkout` | Create Stripe Checkout for add-on purchase |
| POST | `/api/billing/seat-checkout` | Create Stripe Checkout for extra seat purchase |
| GET | `/api/billing/phone-numbers` | List company phone numbers |
| POST | `/api/billing/phone-numbers/search` | Search available phone numbers by area code |
| POST | `/api/billing/phone-numbers/purchase` | Purchase a dedicated phone number |
| POST | `/api/billing/phone-numbers/release` | Release a dedicated phone number |

### Bland AI (4 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bland/send-call` | Dispatch a call via Bland AI master key |
| POST | `/api/bland/webhook` | Receive call completion webhook from Bland |
| GET | `/api/bland/get-call/[callId]` | Get call details from Bland API |
| POST | `/api/bland/analyze-call` | Analyze call transcript with OpenAI |

### Calendar (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/events` | List calendar events with filtering |
| POST | `/api/calendar/events` | Create calendar event |
| PUT | `/api/calendar/events` | Update calendar event |
| DELETE | `/api/calendar/events` | Delete/cancel calendar event |
| GET | `/api/calendar/events/personal` | Get personal (non-company) events |
| GET | `/api/calendar/availability` | Check available time slots |
| GET/POST | `/api/calendar/team` | Team calendar assignments |
| POST | `/api/calendar/contact-sync` | Sync calendar events for a contact |

### Admin (10 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/command-center` | Read all Command Center data (KPIs, health, Redis, operations) |
| POST | `/api/admin/command-center` | Save Bland plan selection, cache in Redis |
| GET | `/api/admin/clients` | Paginated company list with usage and unit economics |
| GET | `/api/admin/finances` | P&L data, revenue and cost breakdown |
| GET | `/api/admin/accounting` | Full accounting: P&L, cash flow, ledger, charts, discounts |
| GET | `/api/admin/reconcile` | Usage reconciliation: call_logs vs usage_tracking |
| GET | `/api/admin/monitor` | Real-time system health: Redis, companies, active calls, Bland |
| GET/DELETE | `/api/admin/cleanup-orphans` | Preview / clean up orphaned companies |
| GET | `/api/admin/billing-events` | Paginated billing event log with fallback synthesis |
| GET | `/api/admin/promo-codes` | All promo codes, coupons, and redemption data from Stripe |

### Integrations (60+ endpoints)

Each of the 7 CRMs follows a standard pattern of 5-6 endpoints (callback, connect, disconnect, contacts, sync, users). Additionally there are endpoints for Google Sheets, Google Calendar, Microsoft Outlook, Zoom, Slack, outbound webhooks, and integration feedback. See [[Integrations API]] for the complete listing.

### Contacts (10 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contacts` | Paginated list with search, filter, sort |
| POST | `/api/contacts` | Create single contact |
| GET | `/api/contacts/[id]` | Get single contact |
| PUT | `/api/contacts/[id]` | Update contact |
| DELETE | `/api/contacts/[id]` | Delete contact |
| POST | `/api/contacts/import` | Bulk CSV/Excel import |
| POST | `/api/contacts/export` | Export contacts to CSV |
| POST | `/api/contacts/parse-csv` | Parse CSV headers for field mapping |
| GET | `/api/contacts/stats` | Contact statistics |
| POST | `/api/contacts/ai-analyze` | AI-powered contact analysis |
| POST | `/api/contacts/ai-segment` | AI-powered contact segmentation |

### Team & Auth (7+ endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/team/members` | List team members and pending invitations |
| POST | `/api/team/invite` | Send team invitation |
| POST | `/api/team/accept-invite` | Accept invitation via token |
| POST | `/api/team/cancel-invite` | Cancel pending invitation |
| POST | `/api/team/remove` | Remove team member |
| GET | `/api/auth/check-admin` | Check if current user is admin |
| POST | `/api/auth/verify-recaptcha` | Verify reCAPTCHA token |

### Company (4 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/company/update` | Update company settings |
| POST | `/api/company/bootstrap` | Bootstrap new company (post-onboarding) |
| GET | `/api/company/onboarding-status` | Check onboarding completion |
| POST | `/api/company/scrape` | Scrape company website for context |

### OpenAI (3 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/openai/analyze-call` | Analyze call transcript with GPT-4o-mini |
| POST | `/api/openai/context-suggestions` | Get AI context suggestions for agents |
| POST | `/api/openai/recommend-agent` | AI agent recommendation based on use case |

### Webhooks (3 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhook handler (signature-verified) |
| GET/POST | `/api/webhooks/endpoints` | CRUD for outbound webhook endpoints |
| GET/PUT/DELETE | `/api/webhooks/endpoints/[id]` | Manage individual outbound webhook |

### Queue (2 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/queue/process` | Process campaign call queue |
| POST | `/api/queue/followups` | Process follow-up queue |

### Miscellaneous

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/campaigns/dispatch` | Dispatch campaign (enqueue contacts) |
| POST | `/api/ai/chat` | AI chat assistant |
| GET/POST | `/api/settings/calendar-config` | Calendar settings |
| GET/POST/DELETE | `/api/seed` | Seed data management |
| GET | `/api/health` | Health check |
| GET | `/api/voices/sample` | Voice sample audio |
| POST | `/api/user/update-location` | Update user geolocation |
| POST | `/api/get-started` | Get-started flow handler |
| POST | `/api/hubspot-events` | HubSpot event tracking |

---

## Common Patterns

Every API route in Callengo follows a consistent set of patterns for authentication, authorization, validation, and error handling. Understanding these patterns is essential for reading or modifying any endpoint.

### Authentication

All protected endpoints authenticate the user through Supabase Auth. The server-side Supabase client reads the session cookie set by the Edge middleware and verifies the JWT.

```typescript
const supabase = await createServerClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

The `createServerClient()` function lives in `src/lib/supabase/server.ts` and creates a Supabase client configured for server-side use with cookie-based auth.

**Exceptions to authentication:**
- `POST /api/bland/webhook` -- authenticated via HMAC-SHA256 signature verification instead (webhook secret)
- `POST /api/webhooks/stripe` -- authenticated via Stripe webhook signature verification
- `GET /api/health` -- public endpoint
- `GET /api/billing/plans` -- public endpoint (plan listing)

### Company Resolution

After authentication, most endpoints resolve the user's company membership by querying the `users` table. This establishes the `company_id` scope that all subsequent queries use, ensuring data isolation through [[RLS Patterns|Row Level Security]].

```typescript
const { data: userData } = await supabase
  .from('users')
  .select('company_id, role')
  .eq('id', user.id)
  .single();

if (!userData?.company_id) {
  return NextResponse.json({ error: 'No company found' }, { status: 404 });
}
```

### Role-Based Access Control

Certain endpoints restrict access by role. The common roles are `owner`, `admin`, and `member`. Admin endpoints check for the `admin` role (and sometimes `owner`):

```typescript
if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

Billing management endpoints typically require `owner` or `admin` role. Team invitation endpoints require `owner` or `admin`, with the additional constraint that only `owner` can invite users with the `admin` role (to prevent privilege escalation).

### Input Validation with Zod

Most endpoints that accept a request body validate inputs using Zod schemas. This provides type-safe parsing with detailed error messages.

```typescript
const sendCallSchema = z.object({
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  task: z.string().min(1).max(5000),
  voice: z.string().default('maya'),
  metadata: z.record(z.string(), z.unknown()).refine(
    (m) => !m.contact_id || z.string().uuid().safeParse(m.contact_id).success,
    { message: 'metadata.contact_id must be a valid UUID if provided' }
  ).optional(),
  company_id: z.string().uuid(),
});

const parseResult = sendCallSchema.safeParse(await request.json());
if (!parseResult.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
    { status: 400 }
  );
}
```

### Error Handling

All endpoints wrap their logic in try-catch blocks and return standardized error responses:

```typescript
try {
  // ... endpoint logic
} catch (error) {
  console.error('Error description:', error);
  return NextResponse.json(
    { error: 'Human-readable error message' },
    { status: 500 }
  );
}
```

Standard HTTP status codes used across the API:
- `200` -- Success
- `400` -- Bad request (validation failure, missing params)
- `401` -- Unauthorized (no valid session)
- `403` -- Forbidden (insufficient role/permissions)
- `404` -- Not found (company, plan, contact, etc.)
- `409` -- Conflict (duplicate invitation, existing member)
- `429` -- Too many requests (rate limited)
- `500` -- Internal server error
- `502` -- Bad gateway (upstream service failure, e.g., Bland API down)

### Rate Limiting

The `expensiveLimiter` from `src/lib/rate-limit.ts` provides per-user rate limiting using Upstash Redis. It is applied on a per-endpoint basis where it has been explicitly added, but it is **not globally applied** as middleware. This remains a known gap.

```typescript
const rateLimit = await expensiveLimiter.check(5, `checkout_${user.id}`);
if (!rateLimit.success) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}
```

Endpoints that currently apply rate limiting include:
- `send-call` (10/min per user)
- `create-checkout-session` (5/min)
- `verify-session` (5/min)
- `change-plan` (3/min)
- `contacts/import` (3/min)
- `team/invite` (3/min)
- `admin/command-center` (10/min)
- `admin/reconcile` (5/min)
- `admin/cleanup-orphans` (1/min)
- `report-usage` (3/min)
- `addon-checkout` (5/min)

### Supabase Client Types

The API uses three different Supabase clients depending on the context:

| Client | Import | Purpose |
|--------|--------|---------|
| `createServerClient()` | `@/lib/supabase/server` | Authenticated server-side requests (respects RLS) |
| `supabaseAdmin` | `@/lib/supabase/service` | Service role client (bypasses RLS) -- for cross-company admin queries |
| `supabaseAdminRaw` | `@/lib/supabase/service` | Untyped service role client -- for tables with columns not yet in TypeScript types |

---

## Webhook Authentication

Two inbound webhook endpoints use signature verification instead of session-based auth:

**Bland AI Webhook** (`/api/bland/webhook`): HMAC-SHA256 signature verification using `BLAND_WEBHOOK_SECRET`. The raw request body is hashed and compared using `crypto.timingSafeEqual()` to prevent timing attacks.

**Stripe Webhook** (`/api/webhooks/stripe`): Uses Stripe's built-in `constructEvent()` method with the `STRIPE_WEBHOOK_SECRET` to verify webhook signatures. Idempotency is enforced via the `stripe_events` table.

---

## Known Issues and Gaps

- **Rate limiting not globally applied** -- The `rate-limit.ts` module exists and is used by individual endpoints, but there is no middleware-level rate limiting applied to all routes. Critical auth and billing endpoints could be targeted by brute-force attacks. See [[Security & Encryption]] for details.
- **No automated test coverage** -- No test runner is configured. The API has zero automated tests.
- **Free plan expiration** -- The logic to block Free plan users after their one-time trial credits are exhausted is incomplete.
- **Exchange rates are static** -- EUR/GBP currency conversions use hardcoded exchange rates rather than fetching live rates.

---

## Source Files

- API route directory: `src/app/api/`
- Supabase server client: `src/lib/supabase/server.ts`
- Supabase service client: `src/lib/supabase/service.ts`
- Rate limiting: `src/lib/rate-limit.ts`
- Edge middleware: `src/middleware.ts`

## Related Notes

- [[Architecture Overview]]
- [[RLS Patterns]]
- [[Security & Encryption]]
- [[Stripe Integration]]
- [[Bland AI]]
- [[Upstash Redis]]
