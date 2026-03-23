---
tags: [workflow, technical, calls, dispatch, campaign, bland-ai, redis]
aliases: [Dispatch Flow, Campaign Dispatch, Call Dispatch]
updated: 2026-03-23
---

# Campaign Dispatch Flow

This document details the complete lifecycle of dispatching calls from a campaign, from the moment a user clicks "Start Campaign" through to each individual call being sent to [[Bland AI]]. The dispatch system is designed as a two-phase architecture: a synchronous API endpoint that validates and enqueues contacts, followed by a background processor that handles the actual call dispatch with throttling, concurrency control, and error recovery.

---

## Phase 1: Campaign Setup and Submission

### Campaign Creation

Before dispatch, the user creates a campaign through the campaign wizard UI. This produces an `agent_runs` record in the database:

| Field | Value | Description |
|-------|-------|-------------|
| `status` | `draft` or `pending` | Initial state before dispatch |
| `agent_template_id` | UUID | References the agent template ([[Lead Qualification]], [[Data Validation]], or [[Appointment Confirmation]]) |
| `company_id` | UUID | Company that owns this campaign |
| `settings` | JSONB | Campaign configuration including calendar config, voice, prompts, scheduling |
| `total_contacts` | Integer | Number of contacts assigned to this campaign |

The user adds contacts (from manual selection, CSV import, CRM sync, or tag-based filters) and configures the agent's behavior (voice, first sentence, voicemail action, max duration, follow-up settings, calendar integration).

### Dispatch API Endpoint

**Endpoint:** `POST /api/campaigns/dispatch`
**Source:** `src/app/api/campaigns/dispatch/route.ts`

When the user starts the campaign, the frontend sends a POST request to the dispatch endpoint. The request body is validated with Zod against a strict schema:

```typescript
{
  company_id: UUID,
  campaign_id?: UUID,
  agent_run_id?: UUID,
  contacts: [
    {
      contact_id: UUID,
      phone_number: string (E.164 regex: /^\+?[1-9]\d{6,14}$/),
      contact_name?: string
    }
  ],  // min 1, max 500 contacts per dispatch
  call_config: {
    task: string (1-5000 chars, non-empty after trim),
    voice: string (default 'maya'),
    first_sentence?: string (max 500 chars),
    voicemail_action: 'leave_message' | 'hangup' | 'ignore',
    voicemail_message?: string (max 1000 chars),
    max_duration?: number (1-600 minutes),
    agent_template_slug?: string,
    agent_name?: string
  },
  webhook_url?: URL,
  delay_between_calls_ms: number (500-30000, default 2000)
}
```

### Pre-Dispatch Validation Sequence

The endpoint performs a series of validations before any contacts are enqueued:

1. **Authentication:** Verifies the user session via `createServerClient()` and `supabase.auth.getUser()`. Returns 401 if unauthenticated.

2. **Rate limiting:** Applies a rate limit of 2 campaign dispatches per minute per user via `expensiveLimiter.check()`. Returns 429 if exceeded. This prevents rapid-fire campaign starts from overwhelming the system.

3. **Zod validation:** Parses and validates the request body against `dispatchSchema`. Returns 400 with detailed field errors if validation fails.

4. **Company authorization:** Queries the `users` table to verify the authenticated user belongs to the specified `company_id`. Returns 403 if the user is not a member of the company.

5. **Initial throttle check:** Calls `checkCallAllowed(company_id)` from [[Usage Tracking]] to verify the company can make calls. This checks subscription status, minute limits, concurrent capacity, and daily/hourly caps. Returns 429 with reason and reason code if blocked.

6. **Max duration enforcement:** Calculates `effectiveMaxDuration` as the minimum of the user's requested `max_duration` and the plan's maximum from `getMaxCallDuration(planSlug)`. For example, a Growth plan user requesting 10-minute calls would be capped at 4 minutes (the Growth plan limit).

7. **Dedicated number lookup:** Calls `getCompanyCallerNumber(company_id)` to check if the company has a dedicated phone number add-on. If so, calls will use this number as the `from` field in the [[Bland AI]] payload.

8. **Contact ownership verification:** Queries the `contacts` table to verify all submitted `contact_id` values belong to the specified company. Any contacts not found are excluded from the queue and returned as failed results.

---

## Phase 2: Queue Insertion

After validation, the dispatch endpoint inserts contacts into the `campaign_queue` table for background processing. This decouples the API response from the actual call dispatch, avoiding Vercel's serverless function timeout limits.

### Queue Entry Structure

Each contact produces one row in `campaign_queue`:

| Field | Value |
|-------|-------|
| `company_id` | From request |
| `campaign_id` | From request (nullable) |
| `agent_run_id` | From request (nullable) |
| `contact_id` | Contact UUID |
| `phone_number` | E.164 formatted number |
| `contact_name` | Optional display name |
| `call_config` | Serialized call configuration |
| `webhook_url` | Platform webhook URL or custom webhook |
| `dedicated_number` | Company's dedicated number or null |
| `effective_max_duration` | Plan-capped maximum call duration |
| `status` | `'pending'` |
| `priority` | Array index (preserves original dispatch order) |
| `created_at` | Current timestamp |

### Idempotency via Unique Partial Index

The `campaign_queue` table has a unique partial index on `(agent_run_id, contact_id) WHERE status IN ('pending', 'processing')`. This prevents the same contact from being enqueued twice for the same campaign while active. If a duplicate dispatch is attempted, the INSERT raises a `23505` unique constraint violation, and the endpoint returns a 409 Conflict with message "This campaign is already being dispatched."

### Agent Run Status Update

After successful queue insertion, the `agent_runs` record is updated to status `'dispatching'` (only transitioning from `pending`, `running`, or `active` to avoid overwriting terminal states).

### API Response

The endpoint returns immediately with a summary:

```json
{
  "status": "queued",
  "summary": {
    "total": 150,
    "queued": 148,
    "failed": 2
  },
  "results": [
    { "contact_id": "...", "status": "queued" },
    { "contact_id": "...", "status": "failed", "error": "Contact not found in company" }
  ],
  "message": "148 contacts queued for dispatch. Processing will begin shortly."
}
```

---

## Phase 3: Background Processing

### Dispatch Queue Processor

**Source:** `src/lib/queue/dispatch-queue.ts`

The background processor (`processDispatchBatch()`) is triggered periodically (e.g., via a cron endpoint or queue trigger) and processes contacts in batches of 5 (configurable via the `batchSize` parameter). This batch size balances throughput against the risk of overwhelming [[Bland AI]] rate limits.

### Per-Contact Processing Flow

For each pending queue entry, the processor executes the following steps:

#### Step 1: Atomic Claim

The processor claims a pending entry by atomically updating its status from `'pending'` to `'processing'` with a `WHERE status = 'pending'` guard. If the update returns no rows, another processor instance already claimed this entry, and it is skipped. This prevents duplicate dispatch in multi-instance environments.

#### Step 2: Throttle Check

Calls `checkCallAllowed(company_id)` to perform a fresh pre-dispatch check. If the call is not allowed (plan limits, concurrency, daily/hourly caps, usage exhaustion), the entry is set back to `'pending'` status with the `error_message` populated, and the `throttled` counter is incremented. The entry will be retried in a subsequent batch.

#### Step 3: Pre-Register Call Log

Creates a `call_logs` record with a temporary `call_id` (format: `pre_{timestamp}_{uuid}`) and status `'queued'`. This ensures a database record exists before the call is sent to Bland, enabling webhook correlation even if the dispatch fails between sending and receiving the Bland response.

#### Step 4: Acquire Redis Call Slot

Calls `acquireCallSlot(company_id, preCallId, contact_id)` from the [[Upstash Redis]] concurrency manager. This atomically:

- Checks and sets the contact cooldown key (5-minute TTL, using `SET NX` for atomicity).
- Increments global and per-company concurrent counters.
- Increments global and per-company daily/hourly counters.
- Sets TTLs on all counters in the same pipeline.
- Creates an active call tracking key (`callengo:active_call:{callId}`) with 30-minute TTL.
- Performs a post-increment cap check -- if any limit was exceeded, rolls back the counters immediately.

If slot acquisition fails, the pre-registered call log is deleted, and the queue entry is set back to `'pending'`.

#### Step 5: Dispatch Call via Bland AI

Calls `dispatchCall()` from `src/lib/bland/master-client.ts` with the following payload:

| Field | Value |
|-------|-------|
| `phone_number` | Contact's E.164 phone number |
| `task` | Agent prompt text from campaign configuration |
| `voice` | Selected voice (default 'maya') |
| `first_sentence` | Optional custom opening line |
| `wait_for_greeting` | `true` (default) |
| `record` | `true` (default) |
| `max_duration` | Plan-capped maximum duration in minutes |
| `voicemail_action` | `'leave_message'`, `'hangup'`, or `'ignore'` |
| `voicemail_message` | Optional voicemail script |
| `answered_by_enabled` | `true` (enables voicemail detection) |
| `webhook` | Platform webhook URL (`/api/bland/webhook`) |
| `metadata` | `{ company_id, contact_id, agent_run_id, agent_template_slug, agent_name, campaign_id }` |
| `from` | Dedicated number (if company has one) |
| `model` | `'enhanced'` (default) |
| `language` | `'en'` (default) |
| `temperature` | `0.7` (default) |
| `background_track` | `'office'` (default) |

The dispatch call has a **15-second timeout** via `AbortController` to prevent hanging dispatch loops if the [[Bland AI]] API is unresponsive.

#### Step 6: Success Handling

If Bland returns a `call_id`:

1. The pre-registered call log is updated with the real Bland `call_id` and status `'in_progress'`.
2. `transferCallSlot()` atomically transfers the Redis active call key from `pre_{...}` to the real Bland `call_id` so that `releaseCallSlot()` can find it when the webhook arrives.
3. The queue entry is marked as `'completed'`.

#### Step 7: Failure Handling

If the Bland dispatch fails:

1. The pre-registered call log is deleted (wrapped in try-catch, non-fatal).
2. `releaseCallSlot()` decrements concurrent counters and removes the active call key.
3. The queue entry is marked as `'failed'` with the error message from Bland.

---

## Throttle Details

### Daily Soft Caps Per Plan

These caps limit the maximum number of calls a single company can dispatch per calendar day (UTC midnight reset). They are enforced by both [[Upstash Redis]] counters and DB-based fallback queries.

| Plan | Daily Soft Cap | Hourly Cap |
|------|:--------------:|:----------:|
| Free | 10 | 5 |
| Starter | 10 | 15 |
| Growth | 20 | 25 |
| Business | 40 | 50 |
| Teams | 75 | 100 |
| Enterprise | 500 | 200 |

The daily caps are derived from each plan's monthly minute allowance: `monthly_minutes / 1.5 min per call / 30 days`, rounded to practical values.

### Global Platform Limits

The platform also enforces global limits based on the master [[Bland AI]] account's plan tier, with a 90% safety margin:

| Bland Plan | Concurrent (90%) | Daily (90%) | Hourly (90%) |
|------------|:-----------------:|:-----------:|:------------:|
| Start | 9 | 90 | 90 |
| Build | 45 | 1,800 | 900 |
| Scale | 90 | 4,500 | 900 |
| Enterprise | Unlimited | Unlimited | Unlimited |

### Contact Cooldown

A 5-minute minimum gap is enforced between calls to the same contact, implemented via the Redis key `callengo:contact_cooldown:{contactId}` with a 300-second TTL. The cooldown uses `SET NX` (set if not exists) for atomicity -- if two dispatch threads try to call the same contact simultaneously, only the first one succeeds.

---

## Concurrency Control Architecture

The concurrency system uses [[Upstash Redis]] as the primary mechanism with database fallback:

### Redis Key Structure

| Key Pattern | Purpose | TTL |
|-------------|---------|:---:|
| `callengo:concurrent:global` | Global concurrent call counter | 1800s |
| `callengo:concurrent:company:{companyId}` | Per-company concurrent counter | 1800s |
| `callengo:daily:{YYYY-MM-DD}` | Global daily counter | 86400s |
| `callengo:hourly:{hourBucket}` | Global hourly counter | 7200s |
| `callengo:daily:{YYYY-MM-DD}:{companyId}` | Per-company daily counter | 86400s |
| `callengo:hourly:{hourBucket}:{companyId}` | Per-company hourly counter | 7200s |
| `callengo:contact_cooldown:{contactId}` | Contact call cooldown | 300s |
| `callengo:active_call:{callId}` | Active call tracking with company/contact metadata | 1800s |
| `callengo:bland_plan_info` | Cached Bland plan limits | 3600s |

### Circuit Breaker

The Redis concurrency manager includes a circuit breaker to handle Redis outages safely:

- After 5 consecutive Redis failures, the circuit breaker trips and blocks all new calls (to prevent exceeding [[Bland AI]] rate limits without visibility).
- The circuit breaker auto-resets after 60 seconds to allow retry.
- During the first 2 failures (before the breaker trips), calls are allowed through (fail-open) to avoid blocking business during brief Redis blips.

### Stale Counter Reconciliation

The `resetStaleConcurrency()` function reconciles Redis counters with actual active call slots. It scans all `callengo:active_call:*` keys, counts active calls per company, and resets the concurrent counters to match reality. This corrects drift from missed `releaseCallSlot()` calls (crashes, timeouts, duplicate webhooks). It should be run periodically (e.g., every 5 minutes via cron).

---

## Error Recovery

The dispatch system is designed for resilience at every step:

| Failure Point | Recovery Mechanism |
|--------------|-------------------|
| API endpoint timeout | Queue-based architecture ensures contacts are not lost |
| Bland API timeout (>15s) | AbortController cancels request, call log deleted, slot released |
| Bland API error (4xx/5xx) | Queue entry set to `failed`, slot released, log deleted |
| Redis unavailable | DB-based fallback in `call-throttle.ts` for concurrent/daily checks |
| Redis circuit breaker tripped | All calls blocked for 60s, then auto-retry |
| Optimistic lock failure | Exponential backoff retry, then atomic RPC fallback |
| Webhook never arrives | Active call key expires after 30min TTL, concurrent counter auto-corrects |
| Double dispatch (race) | Unique partial index on `campaign_queue` returns 409 |
| Contact cooldown race | `SET NX` atomicity ensures only one caller wins |

---

## Source Files

| File | Purpose |
|------|---------|
| `src/app/api/campaigns/dispatch/route.ts` | Dispatch API endpoint (validation, queueing) |
| `src/lib/queue/dispatch-queue.ts` | Background batch processor |
| `src/lib/billing/call-throttle.ts` | Pre-dispatch throttle checks |
| `src/lib/bland/master-client.ts` | Bland AI dispatch and plan limits |
| `src/lib/redis/concurrency-manager.ts` | Redis-based concurrency control |
| `src/lib/bland/phone-numbers.ts` | Dedicated number lookup |

---

## Related Notes

- [[Call Processing Flow]] -- what happens after a call is dispatched (webhook processing)
- [[Bland AI]] -- telephony provider API and rate limits
- [[Upstash Redis]] -- distributed state management for concurrency
- [[Usage Tracking]] -- minute tracking and overage enforcement
- [[Plan Features]] -- concurrent limits and daily caps per plan
- [[Campaign]] -- campaign data model and lifecycle
- [[Admin Command Center]] -- Redis concurrency panel for monitoring active calls
