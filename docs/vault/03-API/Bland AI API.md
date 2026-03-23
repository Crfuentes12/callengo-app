---
tags: [api, bland, voice, calls, redis, webhooks, concurrency]
created: 2026-03-23
updated: 2026-03-23
---

# Bland AI API

The Bland AI API consists of 4 endpoints that form the core call execution engine of Callengo. These endpoints handle dispatching outbound calls through the [[Bland AI]] voice platform, receiving call completion results via webhook, querying call status, and analyzing call transcripts with AI. All calls are dispatched through a single Bland AI master API key (no sub-accounts), with company isolation enforced via `company_id` metadata in Supabase and [[Upstash Redis]] concurrency tracking.

The call lifecycle spans two endpoints: `send-call` initiates the call and acquires a Redis concurrency slot, while `webhook` receives the completion event, releases the slot, tracks usage, and triggers downstream processing (AI analysis, CRM sync, follow-ups, calendar events).

---

## Architecture: Master Key Model

Callengo operates on a **single master API key** for all Bland AI interactions. There are no per-company Bland sub-accounts. This design simplifies management and cost tracking at the platform level.

**Implications:**
- All calls appear in a single Bland account. Company isolation is maintained exclusively through `company_id` in the call metadata and Supabase `call_logs`.
- Bland AI plan limits (concurrent, daily, hourly) are global -- shared across all companies. Per-company limits are enforced by Callengo's own throttling layer.
- The master key is stored in `BLAND_API_KEY` environment variable.
- Bland plan selection is configured in the [[Command Center]] and cached in Redis (TTL 1 hour).

**Concurrency tracking:** [[Upstash Redis]] manages atomic counters for global and per-company concurrent, daily, and hourly call counts. Active call slots use keys like `callengo:active_call:{callId}` with a 30-minute TTL. Contact cooldown keys (`callengo:contact_cooldown:{contactId}`) enforce a 5-minute gap between calls to the same contact.

---

## Endpoint Reference

### POST /api/bland/send-call

Dispatches a single outbound call through Bland AI. This is the most critical endpoint in the system -- it must validate plan limits, acquire concurrency slots atomically, dispatch the call, and handle cleanup on any failure path.

**Authentication:** Required (user session).

**Rate limit:** 10 requests/minute per user.

**Request body (Zod-validated):**

```json
{
  "phone_number": "+14155551234",
  "task": "You are calling John Smith to confirm his appointment on March 25th at 2:00 PM...",
  "voice": "maya",
  "first_sentence": "Hi, is this John?",
  "wait_for_greeting": true,
  "record": true,
  "max_duration": 5,
  "voicemail_action": "leave_message",
  "voicemail_message": "Hi John, this is a reminder about your appointment...",
  "answered_by_enabled": true,
  "webhook": "https://app.callengo.com/api/bland/webhook",
  "metadata": {
    "contact_id": "uuid",
    "campaign_id": "uuid",
    "agent_name": "Appointment Confirmation"
  },
  "company_id": "uuid"
}
```

**Field validation (Zod schema):**

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `phone_number` | string | E.164 regex: `/^\+?[1-9]\d{6,14}$/` | Required |
| `task` | string | 1-5000 chars | Required |
| `voice` | string | Any string | `"maya"` |
| `first_sentence` | string | Max 500 chars | Optional |
| `wait_for_greeting` | boolean | -- | `true` |
| `record` | boolean | -- | `true` |
| `max_duration` | number | 1-600, integer | Plan limit |
| `voicemail_action` | enum | `leave_message`, `hangup`, `ignore` | `leave_message` |
| `voicemail_message` | string | Max 1000 chars | Optional |
| `answered_by_enabled` | boolean | -- | `true` |
| `webhook` | string | HTTPS URL | Optional |
| `metadata` | object | `contact_id` must be valid UUID if present | Optional |
| `company_id` | string | Valid UUID | Required |

**Dispatch flow (step by step):**

1. **Authenticate** -- Verify user session via `createServerClient()`.
2. **Rate limit** -- Check `expensiveLimiter` (10 calls/min per user).
3. **Parse and validate** -- Zod schema validates all fields. Returns 400 with field-level errors on failure.
4. **Company authorization** -- Verify user's `company_id` matches the request's `company_id`.
5. **Pre-register call_log** -- Insert a `queued` status entry in `call_logs` with a temporary `pre_*` call ID. This prevents TOCTOU race conditions: concurrent requests see each other's pre-registered entries when checking limits.
6. **Throttle check** -- `checkCallAllowed(company_id)` validates:
   - Company has an active subscription
   - Minutes remaining in the billing period (or overage enabled)
   - Concurrent call count is below plan limit
   - Daily call count is below Bland daily cap
   - Hourly call count is below Bland hourly cap
   - If rejected, the pre-registered call_log entry is deleted and 429 is returned with details.
7. **Acquire Redis slot** -- `acquireCallSlot(company_id, callId, contactId)` atomically increments global and per-company concurrent counters, creates an active call key with 30-min TTL, and checks contact cooldown.
   - If slot acquisition fails (e.g., concurrent limit reached or contact in cooldown), the pre-registered entry is deleted and 429 is returned.
8. **Enforce max duration** -- `getMaxCallDuration(planSlug)` returns the plan-specific max. If the user specified a lower `max_duration`, the minimum of both is used.
9. **Get caller ID** -- `getCompanyCallerNumber(company_id)` checks for a dedicated phone number add-on.
10. **Dispatch call** -- `dispatchCall()` sends the call to Bland AI via the master API key, including `company_id` in the metadata.
11. **Update call_log** -- On success, the pre-registered entry is updated with the real Bland `call_id` and status `in_progress`.
12. **Transfer Redis slot** -- `transferCallSlot()` moves the active call key from the temporary `pre_*` ID to the real Bland call ID, so `releaseCallSlot()` in the webhook can find it.
13. **Cleanup on failure** -- A `finally` block ensures that if dispatch fails at any point, the pre-registered call_log entry is deleted and the Redis slot is released.

**Success response:**

```json
{
  "status": "success",
  "call_id": "bland-call-uuid",
  "message": "Call initiated successfully",
  "limits": {
    "concurrent": "2/3",
    "dailyCalls": "15/∞",
    "maxDuration": "5 min"
  }
}
```

**Error response (throttled):**

```json
{
  "error": "Concurrent call limit reached for your plan",
  "code": "concurrent_limit",
  "upgrade": "business",
  "limits": {
    "concurrent": 3,
    "currentConcurrent": 3,
    "dailyCap": null,
    "dailyCallsToday": 42
  }
}
```

**Source file:** `src/app/api/bland/send-call/route.ts`

---

### POST /api/bland/webhook

Receives call completion notifications from Bland AI. This is the most complex endpoint in the system, orchestrating over a dozen post-call operations. The webhook is triggered by Bland AI when a call ends (completed, no_answer, voicemail, failed, etc.).

**Authentication:** HMAC-SHA256 signature verification using `BLAND_WEBHOOK_SECRET`. The signature is compared using `crypto.timingSafeEqual()` to prevent timing attacks. Signature verification is enforced in ALL environments (not just production -- audit fix #5).

**Webhook payload from Bland AI:**

```json
{
  "call_id": "bland-call-uuid",
  "status": "completed",
  "call_length": 93,
  "to": "+14155551234",
  "from": "+18005551234",
  "completed": true,
  "inbound": false,
  "queue_status": "completed",
  "answered_by": "human",
  "transcript": "Agent: Hi, is this John?...",
  "recording_url": "https://bland.ai/recordings/xxx.mp3",
  "corrected_duration": "1:33",
  "end_at": "2026-03-23T15:31:33Z",
  "metadata": {
    "company_id": "uuid",
    "contact_id": "uuid",
    "agent_name": "Appointment Confirmation",
    "campaign_id": "uuid",
    "calendar_event_id": "uuid",
    "follow_up_needed": false,
    "appointment_confirmed": true
  }
}
```

**Post-call processing pipeline:**

1. **Signature verification** -- Verify HMAC-SHA256 signature from `x-bland-signature` header.
2. **Idempotency check** -- Look up call by `call_id` in `call_logs`. If already marked completed, return 200 (already processed).
3. **Update call_logs** -- Set status, duration (`call_length`), transcript, recording URL, `answered_by`, and completion timestamp.
4. **Release Redis slot** -- `releaseCallSlot(company_id, call_id)` atomically decrements concurrent counters and deletes the active call key.
5. **Track usage** -- `trackCallUsage(company_id, minutes)` increments `minutes_used` in `usage_tracking`. If overage threshold is crossed, triggers overage reporting to Stripe.
6. **AI analysis** -- `enqueueAnalysis(callId)` adds the call to the analysis queue for GPT-4o-mini processing. For immediate analysis (appointment agent calls), `analyzeCallIntent()` is called synchronously to extract:
   - Appointment confirmation/reschedule/no-show status
   - Lead qualification (BANT scoring)
   - Data validation results
7. **Contact update** -- Updates the contact's `last_call_date`, `call_attempts`, `status`, and any verified data (email, address, company name) based on AI analysis.
8. **Voicemail handling** -- If the call went to voicemail and the agent left a message, creates a `voicemail_logs` entry with the recording URL and transcript.
9. **Calendar operations** -- Based on metadata and AI analysis:
   - `syncConfirmAppointment()` -- marks appointment as confirmed
   - `syncRescheduleAppointment()` -- reschedules to new time
   - `syncHandleNoShow()` -- marks as no-show
   - `syncScheduleMeeting()` -- creates new meeting
   - `syncScheduleCallback()` -- schedules callback
   - `createAgentCallback()` / `createAgentFollowUp()` -- creates follow-up calendar entries
   - `autoAssignEvent()` -- routes events to team members
   - `getNextAvailableSlot()` -- finds next open slot for rescheduling
10. **CRM sync** -- Pushes call results to connected CRM integrations:
    - `pushCallResultToPipedrive()` -- via `getActivePipedriveIntegration()`
    - `pushCallResultToClio()` -- via `getActiveClioIntegration()`
    - `pushCallResultToHubSpot()` -- via `getActiveHubSpotIntegration()`
    - `pushCallResultToSalesforce()` -- via `getActiveSalesforceIntegration()`
11. **Outbound webhooks** -- `dispatchWebhookEvent()` fires configured outbound webhooks (Zapier, Make, n8n) with the call result payload.
12. **Analytics** -- `trackServerEvent()` and `captureServerEvent()` log analytics events.

**Response:** Always returns `200 OK` with `{ received: true }` to acknowledge receipt, even if downstream processing fails (to prevent Bland AI from retrying).

**Source file:** `src/app/api/bland/webhook/route.ts`

---

### GET /api/bland/get-call/[callId]

Retrieves detailed call information from the Bland AI API for a specific call. Includes IDOR protection to ensure the authenticated user can only access calls belonging to their company.

**Authentication:** Required.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `company_id` | string (UUID) | Yes | Company ID for ownership verification |

**URL parameter:** `callId` -- The Bland AI call ID.

**Validation:**
1. Both `callId` and `company_id` are required
2. User must be authenticated
3. User's `company_id` must match the requested `company_id`
4. The call must exist in `call_logs` for this company (prevents cross-company access via the master key)

**Behavior:** Fetches call details from Bland AI via `getCallDetails(callId)` using the master API key. The Bland response includes status, transcript, recording URL, duration, and metadata.

**Response:** Returns the Bland AI call details object directly.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing callId or company_id |
| 401 | Unauthenticated |
| 403 | company_id mismatch |
| 404 | Call not found in call_logs for this company |
| 502 | Bland API returned no data |

**Source file:** `src/app/api/bland/get-call/[callId]/route.ts`

---

### POST /api/bland/analyze-call

Analyzes a call transcript using OpenAI GPT-4o-mini to extract structured insights. This endpoint provides on-demand analysis (as opposed to the automatic queued analysis triggered by the webhook).

**Authentication:** Required.

**Request body:**

```json
{
  "callId": "uuid",
  "transcript": "Agent: Hi, is this John?...",
  "agentType": "appointment_confirmation"
}
```

**Analysis output schema (CallAnalysisResult):**

```json
{
  "verifiedAddress": "123 Main St, Springfield, IL 62701",
  "contactName": "John Smith",
  "verifiedEmail": "john@acme.com",
  "businessConfirmed": true,
  "outcomeNotes": "Appointment confirmed for March 25 at 2:00 PM",
  "callSentiment": "positive",
  "customerInterestLevel": "high",
  "callCategory": "successful",
  "keyPoints": ["Confirmed appointment", "Requested parking info"],
  "followUpRequired": false,
  "followUpReason": null
}
```

The analysis is performed with GPT-4o-mini at temperature 0.1 in JSON mode for deterministic, structured output.

**Source file:** `src/app/api/bland/analyze-call/route.ts`

---

## Concurrency Model

The concurrency system uses [[Upstash Redis]] for atomic counter management. The implementation lives in `src/lib/redis/concurrency-manager.ts`.

### Redis Key Structure

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `callengo:concurrent:global` | counter | 1h | Global concurrent calls |
| `callengo:concurrent:{companyId}` | counter | 1h | Per-company concurrent calls |
| `callengo:daily:global` | counter | end of day | Global daily call count |
| `callengo:daily:{companyId}` | counter | end of day | Per-company daily count |
| `callengo:hourly:global` | counter | 1h | Global hourly call count |
| `callengo:hourly:{companyId}` | counter | 1h | Per-company hourly count |
| `callengo:active_call:{callId}` | hash | 30min | Active call slot with metadata |
| `callengo:contact_cooldown:{contactId}` | flag | 5min | Prevents duplicate calls to same contact |

### Slot Lifecycle

```
send-call                     webhook
   |                            |
   v                            v
acquireCallSlot()          releaseCallSlot()
   |                            |
   +-- INCR concurrent          +-- DECR concurrent
   +-- INCR daily               +-- DEL active_call key
   +-- INCR hourly
   +-- SET active_call key
   +-- SET contact_cooldown
```

### Bland Plan Limits (enforced globally)

| Bland Plan | Concurrent | Daily | Hourly | Cost/min |
|------------|-----------|-------|--------|----------|
| Start | 10 | 100 | 100 | $0.14 |
| Build | 50 | 2,000 | 1,000 | $0.12 |
| Scale | 100 | 5,000 | 1,000 | $0.11 |
| Enterprise | unlimited | unlimited | unlimited | $0.09 |

Limits are applied with a 90% safety margin to prevent overruns. The active plan is selected in the [[Command Center]] and cached in Redis with a 1-hour TTL.

---

## Source Files

- Route directory: `src/app/api/bland/`
- Master client: `src/lib/bland/master-client.ts` (plan detection, dispatch, limits, `BLAND_PLAN_LIMITS`)
- Phone numbers: `src/lib/bland/phone-numbers.ts`
- Concurrency manager: `src/lib/redis/concurrency-manager.ts`
- Call throttle: `src/lib/billing/call-throttle.ts`
- Usage tracker: `src/lib/billing/usage-tracker.ts`
- AI intent analyzer: `src/lib/ai/intent-analyzer.ts`
- Calendar sync: `src/lib/calendar/sync.ts`, `src/lib/calendar/campaign-sync.ts`
- Outbound webhooks: `src/lib/webhooks.ts`

## Related Notes

- [[Bland AI]]
- [[Call]]
- [[Campaign Dispatch Flow]]
- [[Call Processing Flow]]
- [[Upstash Redis]]
- [[Usage Tracking]]
- [[API Overview]]
