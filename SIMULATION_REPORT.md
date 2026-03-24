# CALLENGO SIMULATION REPORT

> Generated: 2026-03-24
> Method: Static code-path tracing (no runtime execution)
> Codebase version: Current HEAD on `claude/trace-saas-scenarios-t6ZjQ`

---

## System Model

### Plan Tiers

| Tier | Price/mo | Minutes Included | Est. Calls | Max Concurrent | Max Users | Max Call Duration | Overage Rate | Overage Allowed | Key Restrictions |
|------|----------|-----------------|------------|----------------|-----------|-------------------|-------------|-----------------|------------------|
| **Free** | $0 | 15 | ~10 | 1 | 1 | 3 min | N/A | No (hard block) | No follow-ups, no voicemail detection, no CRM integrations, 10 daily cap, 5 hourly cap |
| **Starter** | $99 | 300 | ~200 | 2 | 1 | 4 min | $0.29/min | Yes (with budget) | 2 follow-up attempts, basic voicemail, no advanced CRM, 10 daily cap, 15 hourly cap |
| **Growth** | $179 | 600 | ~400 | 3 | 1 | 5 min | $0.26/min | Yes | 5 follow-up attempts, voicemail detection, basic integrations, 20 daily cap, 25 hourly cap |
| **Business** | $299 | 1,200 | ~800 | 5 | 3 | 6 min | $0.23/min | Yes | 10 follow-up attempts, all voicemail, HubSpot/Pipedrive/Zoho/Clio, 40 daily cap, 50 hourly cap |
| **Teams** | $649 | 2,250 | ~1,500 | 10 | 5 | Unlimited* | $0.20/min | Yes | Unlimited follow-ups, Salesforce/Dynamics, 75 daily cap, 100 hourly cap |
| **Enterprise** | $1,499 | 6,000 | ~4,000+ | Unlimited | Unlimited | Unlimited* | $0.17/min | Yes | Everything unlimited, 500 daily cap, 200 hourly cap |

*Unlimited duration is capped at 600 minutes in code (`getMaxCallDuration` in `src/lib/billing/call-throttle.ts:341-345`).

**Source of truth:** `src/config/plan-features.ts` (feature matrix), `subscription_plans` DB table (pricing/limits), `DAILY_SOFT_CAPS` and `HOURLY_CAPS` in `src/lib/billing/call-throttle.ts:39-56`.

**Conversion formula:** `calls = minutes / 1.5` (defined in `plan-features.ts:363-365`).

**Add-ons (paid plans only):**
| Add-on | Price | Effect | Availability |
|--------|-------|--------|-------------|
| Dedicated Number | $15/mo | Caller ID from purchased number | Starter+ |
| Recording Vault | $12/mo | Extended recording storage | Starter+ |
| Calls Booster | $35/mo | +225 minutes per booster | Starter+ |

**Source:** `ADDON_AVAILABILITY` in `src/config/plan-features.ts:312-323`, `phone-numbers.ts` pricing at line 14-15.

---

### User Roles

| Role | Scope | Key Permissions |
|------|-------|----------------|
| **owner** | Company-level | Full access: billing, team management, settings, campaigns, integrations. Cannot be removed. Can remove admins. |
| **admin** | Platform-level | Access to `/admin/command-center`. Full company access. Can manage team (except remove other admins). Platform admin route check at `middleware.ts:156`. |
| **member** | Company-level | Standard access: campaigns, contacts, calls, calendar. Cannot access billing, cannot invite/remove team members, cannot access admin panel. |

**Enforcement points:**
- Middleware admin check: `middleware.ts:156` — redirects non-admin to `/home`
- Team invite RLS: `team_invitations_insert` policy requires `owner` or `admin` role
- Subscription update RLS: `company_subscriptions_update` allows any company member (not restricted to owner/admin at DB level)
- Team invite API: `src/app/api/team/invite/route.ts` checks `owner` or `admin` role at line ~47
- Team remove API: `src/app/api/team/remove/route.ts` prevents admin removing admin, only owner can
- Self-escalation prevention: DB trigger `trg_prevent_role_self_escalation` on users table

---

### Core Entities

| Entity | Table | Key States | Primary FK |
|--------|-------|-----------|-----------|
| **Company** | `companies` | Active (no `deleted_at`), Soft-deleted (`deleted_at` set) | — |
| **User** | `users` | Active (role: owner/admin/member) | `company_id` → companies |
| **Contact** | `contacts` | status: Pending, Called, Completed, Failed | `company_id` → companies |
| **Agent Template** | `agent_templates` | is_active: true/false | — (global) |
| **Company Agent** | `company_agents` | is_active: true/false | `company_id` → companies |
| **Agent Run (Campaign)** | `agent_runs` | status: draft, pending, dispatching, running, active, completed, failed, cancelled | `company_id` → companies |
| **Call Log** | `call_logs` | status: queued, in_progress, completed, failed, no-answer, busy, voicemail | `company_id` → companies |
| **Campaign Queue** | `campaign_queue` | status: pending, processing, completed, failed | `company_id` → companies |
| **Follow-Up** | `follow_up_queue` | status: pending, in_progress, completed, failed, cancelled | `company_id` → companies |
| **Voicemail Log** | `voicemail_logs` | message_left: true/false | `company_id` → companies |
| **Subscription** | `company_subscriptions` | status: active, trialing, canceled, past_due, expired | `company_id` → companies (UNIQUE) |
| **Usage Tracking** | `usage_tracking` | Rolling: minutes_used vs minutes_included | `company_id` → companies |
| **Calendar Event** | `calendar_events` | status: scheduled, completed, cancelled, no_show | `company_id` → companies |
| **Calendar Integration** | `calendar_integrations` | connected: true/false, is_active: true/false | `company_id` → companies |
| **Team Invitation** | `team_invitations` | status: pending, accepted, expired, cancelled | `company_id` → companies |
| **Notification** | `notifications` | read: true/false | `company_id` → companies |
| **Billing Event** | `billing_events` | event_type (audit log, no state machine) | `company_id` → companies |

---

### State Machines

#### Agent Run (Campaign) — `agent_runs.status`
```
draft → pending → dispatching → running/active → completed
                                                → failed
                                                → cancelled
```
- `draft → pending`: User finalizes campaign configuration
- `pending → dispatching`: Campaign dispatch API called (`src/app/api/campaigns/dispatch/route.ts:166`)
- `dispatching → running`: Queue processor picks up and starts calling
- `running → completed`: All contacts processed (trigger `notify_campaign_completion`)
- `running → failed`: Threshold failures (trigger `notify_high_failure_rate`)

#### Call Log — `call_logs.status`
```
queued → in_progress → completed
                     → failed
                     → no-answer
                     → busy
                     → voicemail
```
- `queued`: Pre-registered before dispatch (`send-call/route.ts:107`)
- `queued → in_progress`: Bland API returns success (`send-call/route.ts:180`)
- `in_progress → completed/failed/etc`: Bland webhook callback (`api/bland/webhook/route.ts`)

#### Campaign Queue — `campaign_queue.status`
```
pending → processing → completed
                     → failed
```
- `pending → processing`: Queue processor claims entry (`dispatch-queue.ts:45-51`)
- `processing → completed`: Call dispatched successfully (`dispatch-queue.ts:134-137`)
- `processing → failed`: Bland API error or exception (`dispatch-queue.ts:140-144`)
- `processing → pending`: Throttle check fails (put back for retry, `dispatch-queue.ts:60-63`)

#### Subscription — `company_subscriptions.status`
```
trialing → active → canceled
                  → past_due → active (payment retry succeeds)
                              → canceled
                              → expired
active → expired (period_end passed without renewal)
```
- `trialing → active`: Payment succeeds (Stripe webhook `checkout.session.completed`)
- `active → past_due`: Invoice payment fails (Stripe webhook `invoice.payment_failed`)
- `active → canceled`: User cancels or Stripe `customer.subscription.deleted`
- `past_due → active`: Retry payment succeeds
- Status transitions driven by Stripe webhooks in `src/app/api/webhooks/stripe/route.ts`

#### Follow-Up — `follow_up_queue.status`
```
pending → in_progress → completed
                      → failed
                      → cancelled
```
- Auto-created by DB trigger `auto_create_followup` on `call_logs` UPDATE
- Processed by `src/app/api/queue/followups/route.ts`

#### Contact — `contacts.status`
```
Pending → Called → Completed
                 → Failed
```
- `call_outcome` field: Not Called, Answered, No Answer, Busy, Voicemail, Failed

---

### Schema Discrepancies

These are columns/tables that exist in the live DB JSON but NOT in `src/types/supabase.ts`, or vice versa. These are silent failure points where TypeScript won't catch runtime errors.

#### Missing from Types (exist in DB, not in `src/types/supabase.ts`)

| Table/Column | DB JSON | Types File | Impact |
|-------------|---------|-----------|--------|
| `companies.deleted_at` | Present in migration (per CLAUDE.md) but NOT in DB JSON columns | **Missing from types** | Soft-delete column not typed — code accessing it won't get type safety |
| `users.fav_voices` | Present in DB JSON (`jsonb`, default `'[]'`) | **Missing from types** | Voice favorites feature has no type safety |
| `subscription_plans.max_seats` | Present in DB JSON (`int4`, default 1) | **Missing from types** | Seat limit checks use untyped column |
| `subscription_plans.extra_seat_price` | Present in DB JSON (`numeric`) | **Missing from types** | Extra seat pricing untyped |
| `subscription_plans.max_follow_up_attempts` | Present in DB JSON (`int4`, default 0) | **Missing from types** | Follow-up limit checks untyped |
| `subscription_plans.calls_included` | Present in DB JSON (`int4`, default 0) | **Missing from types** | Estimated calls display column untyped |
| `company_subscriptions.addon_dedicated_number` | Present in DB JSON (`bool`) | **Missing from types** | Add-on tracking flags untyped |
| `company_subscriptions.addon_recording_vault` | Present in DB JSON (`bool`) | **Missing from types** | Add-on tracking flags untyped |
| `company_subscriptions.addon_calls_booster` | Present in DB JSON (`bool`) | **Missing from types** | Add-on tracking flags untyped |
| `company_subscriptions.addon_calls_booster_count` | Present in DB JSON (`int4`) | **Missing from types** | Booster count untyped |
| `contacts.appointment_date` | Present in DB JSON | **Missing from types** | Appointment confirmation agent uses this |
| `contacts.appointment_confirmed` | Present in DB JSON | **Missing from types** | Confirmation status untyped |
| `contacts.appointment_rescheduled` | Present in DB JSON | **Missing from types** | Reschedule flag untyped |
| `contacts.meeting_scheduled` | Present in DB JSON | **Missing from types** | Meeting flag untyped |
| `contacts.video_link` | Present in DB JSON | **Missing from types** | Video link untyped |
| `contacts.no_show_count` | Present in DB JSON | **Missing from types** | No-show tracking untyped |
| `call_logs.recording_stored_url` | Present in DB JSON | **Missing from types** | Recording vault feature untyped |
| `call_logs.recording_expires_at` | Present in DB JSON | **Missing from types** | Recording expiry untyped |
| `call_logs.recording_archived` | Present in DB JSON | **Missing from types** | Recording archive flag untyped |

**Note:** Many of these untyped columns are accessed via `supabaseAdminRaw` (untyped client) in the codebase, which bypasses TypeScript checks entirely. This is a deliberate pattern but increases risk of silent runtime failures if column names change.

#### Tables in DB JSON but not separately typed (use `supabaseAdminRaw`)
- `company_addons` — present in types as a table definition
- `admin_platform_config` — accessed via raw queries in admin endpoints
- `admin_audit_log` — accessed via raw queries
- `admin_finances` — accessed via raw queries
- `stripe_events` — accessed via raw queries

#### Confirmed Present in Both
- `campaign_queue` — present in both types and DB JSON ✅
- `notifications` — present in both ✅
- All CRM integration tables — present in both ✅

---

### Billing Enforcement Points

Every location where the code checks plan limits before allowing an action:

| Check | File | Lines | Timing | What It Checks |
|-------|------|-------|--------|---------------|
| **Master throttle gate** | `src/lib/billing/call-throttle.ts` | `checkCallAllowed()` at 64-206 | Pre-dispatch | Subscription status, period expiry, concurrent/daily/hourly caps, minutes available |
| **Subscription status** | `call-throttle.ts` | 80-86 | Pre-dispatch | Must be `active` or `trialing` |
| **Period expiry** | `call-throttle.ts` | 88-106 | Pre-dispatch | `current_period_end < now()` → marks `expired` |
| **Redis capacity** | `call-throttle.ts` | 116-121 → `concurrency-manager.ts:174-277` | Pre-dispatch | Global + per-company concurrent, daily, hourly against Bland limits (90% safety margin) |
| **Contact cooldown** | `concurrency-manager.ts` | 241-243, 298-303 | Pre-dispatch | 5-min gap between calls to same contact (Redis SET NX) |
| **DB concurrent fallback** | `call-throttle.ts` | 145-157 | Pre-dispatch (if Redis down) | `call_logs` with status in_progress/ringing/queued in last 30 min |
| **Daily cap (DB fallback)** | `call-throttle.ts` | 161-172 | Pre-dispatch | `call_logs` created today vs `DAILY_SOFT_CAPS[planSlug]` |
| **Hourly cap (DB fallback)** | `call-throttle.ts` | 176-184 | Pre-dispatch | `call_logs` last 60 min vs `HOURLY_CAPS[planSlug]` |
| **Minutes available** | `call-throttle.ts` | 187-194 → `checkMinutesAvailable()` 261-336 | Pre-dispatch | `usage_tracking.minutes_used` vs `minutes_included + booster_minutes` |
| **Free plan hard block** | `call-throttle.ts` | 305-310, `usage-tracker.ts` 337-354 | Pre-dispatch & post-call | Free plan: no overage, hard block at limit |
| **Overage budget** | `call-throttle.ts` | 321-332 | Pre-dispatch | `overage_spent >= overage_budget` |
| **Usage tracking (post-call)** | `src/lib/billing/usage-tracker.ts` | `trackCallUsage()` 38-201 | Post-call (webhook) | Records minutes, atomic increment, reports to Stripe |
| **Stripe metered billing** | `usage-tracker.ts` | 170-176 | Post-call | Reports total overage to Stripe with `action='set'` |
| **Campaign dispatch gate** | `src/app/api/campaigns/dispatch/route.ts` | 89-95 | Pre-enqueue | Single `checkCallAllowed()` before queuing all contacts |
| **Queue processor gate** | `src/lib/queue/dispatch-queue.ts` | 57-66 | Per-call in queue | `checkCallAllowed()` before each individual call dispatch |
| **Send-call gate** | `src/app/api/bland/send-call/route.ts` | 107-130 | Pre-dispatch | Pre-registers call_log, then `checkCallAllowed()`, then `acquireCallSlot()` |
| **Redis slot acquire** | `send-call/route.ts` | 133-142, `dispatch-queue.ts` 82-93 | Pre-dispatch | Atomic Redis increment with post-increment rollback if over cap |
| **Plan feature gating** | `plan-features.ts` | `isPlanAllowedForIntegration()` 395-399 | UI + API | CRM integration access by plan tier |
| **Seat limit** | `src/app/api/team/invite/route.ts` | ~line 60-80 | Pre-invite | Checks user count vs plan `max_seats` + `extra_users` |
| **Rate limiting** | `src/lib/rate-limit.ts` | Various | Pre-request | 30 req/min (API), 5 req/min (expensive), 10 req/min (auth), 10 req/min (calls) |

---

### Queue & Dispatch Architecture

The complete chain from "user clicks dispatch" to "call completed":

```
USER ACTION
    │
    ▼
┌─────────────────────────────────────────────┐
│ POST /api/campaigns/dispatch                 │
│ (src/app/api/campaigns/dispatch/route.ts)    │
│                                              │
│ 1. Auth check (middleware + route)            │
│ 2. Rate limit: 2 dispatches/min/user         │
│ 3. Zod validation (max 500 contacts)         │
│ 4. Company ownership verification            │
│ 5. ONE checkCallAllowed() for initial gate   │
│ 6. Validate contact_ids belong to company    │
│ 7. INSERT into campaign_queue (batch)        │
│ 8. Update agent_run status → 'dispatching'   │
│ 9. Return { status: 'queued', summary }      │
└─────────────────────────────────────────────┘
    │
    ▼ (Vercel Cron triggers every interval)
┌─────────────────────────────────────────────┐
│ GET /api/queue/process                       │
│ (src/app/api/queue/process/route.ts)         │
│                                              │
│ 1. Auth: CRON_SECRET or QUEUE_SECRET         │
│ 2. Calls processDispatchBatch(5)             │
│ 3. Calls processBatch(10) for AI analysis    │
│ 4. Calls resetStaleConcurrency()             │
│ All three run in Promise.all()               │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ processDispatchBatch()                       │
│ (src/lib/queue/dispatch-queue.ts)            │
│                                              │
│ FOR EACH pending entry (up to 5):            │
│ 1. Claim: UPDATE status='processing'         │
│    (atomic, eq status='pending')             │
│ 2. checkCallAllowed(company_id) — PER CALL   │
│    If throttled → put back as 'pending'      │
│ 3. Pre-register call_log (status='queued')   │
│ 4. acquireCallSlot() in Redis                │
│    If unavailable → cleanup + put back       │
│ 5. dispatchCall() to Bland AI                │
│ 6. On success:                               │
│    - Update call_log with real call_id       │
│    - transferCallSlot() pre→real ID          │
│    - Mark queue entry 'completed'            │
│ 7. On failure:                               │
│    - Delete pre-registered call_log          │
│    - releaseCallSlot() (3 retries)           │
│    - Mark queue entry 'failed'               │
└─────────────────────────────────────────────┘
    │
    ▼ (Bland AI makes the call, then sends webhook)
┌─────────────────────────────────────────────┐
│ POST /api/bland/webhook                      │
│ (src/app/api/bland/webhook/route.ts)         │
│ ~1,150 lines                                 │
│                                              │
│ 1. HMAC-SHA256 signature verification        │
│ 2. Idempotency check (call_logs.call_id)     │
│ 3. Upsert call_log with results              │
│ 4. releaseCallSlot() in Redis                │
│ 5. Lock contact for processing (5-min TTL)   │
│ 6. Voicemail detection + logging             │
│ 7. AI Intent Analysis (sync or async):       │
│    - Appointment: confirm/reschedule/no-show │
│    - Lead Qual: BANT scoring                 │
│    - Data Validation: field extraction       │
│ 8. Calendar event creation (if applicable)   │
│ 9. Contact record update                     │
│ 10. CRM sync (HubSpot/SF/Pipedrive/etc)     │
│ 11. Usage tracking: trackCallUsage()         │
│ 12. Outbound webhook dispatch                │
│ 13. Unlock contact                           │
│ 14. Return 200                               │
└─────────────────────────────────────────────┘
```

**Key architectural notes:**
- **Batch size:** 5 calls per cron tick for dispatch queue (`process/route.ts:111`)
- **Cron frequency:** Not defined in code — configured in Vercel Cron settings (external)
- **Throughput:** At 5 calls/tick, a 1000-contact campaign needs 200 cron ticks minimum
- **No parallelism within batch:** Calls dispatched sequentially in a for-loop (`dispatch-queue.ts:43`)
- **Throttle per-call, not per-campaign:** Each call in the queue gets its own `checkCallAllowed()` check
- **Cleanup guarantees:** `finally` blocks ensure Redis slots are released on any failure
- **Single-call path:** `POST /api/bland/send-call` follows same pattern but dispatches immediately (no queue)

---

*System Model complete. Awaiting confirmation before proceeding to Phase 1 (Personas) and Phase 2+ (Simulations).*
