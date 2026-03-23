---
tags: [integration, voice, core, infrastructure]
aliases: [Bland, Voice Provider, Bland.ai, Voice Infrastructure]
---

# Bland AI

Bland AI is the telephony and voice synthesis provider that powers every outbound call in [[Callengo]]. All three [[Agent|AI agents]] (Lead Qualification, Data Validation, and Appointment Confirmation) use Bland's API to place calls, stream synthesized speech, and capture transcripts. Bland is the single most critical external dependency in the platform; if Bland is unreachable, no calls can be dispatched.

## Master Key Architecture

Callengo operates on a **single master API key** model. The environment variable `BLAND_API_KEY` holds one key that authenticates every request to Bland's REST API at `https://api.bland.ai/v1`. There are no sub-accounts, no per-company API keys, and no delegated authentication. Bland sees a flat, undifferentiated pool of calls originating from a single account.

Tenant isolation is enforced entirely within [[Supabase]]. Every `call_logs` row carries a `company_id` foreign key, and every dispatched call includes `company_id` in its metadata payload so the [[Bland Webhook|webhook handler]] at `/api/bland/webhook` can correlate the completed call back to the correct company. The `bland_subaccount_id` field on the `company_settings` table is set to the literal string `'master'` for the admin account; it exists as a vestige of an earlier sub-account architecture that was replaced by the master key model.

The master key owner (the platform operator) maintains a Bland account with either auto-recharge enabled or manual credit top-ups. All call costs are borne centrally by the master account, and then recouped from tenants via [[Stripe Integration|Stripe metered billing]] (overage charges) and subscription fees.

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `BLAND_API_KEY` | Master API key for all Bland requests | Required, no default |
| `BLAND_COST_PER_MINUTE` | Override the per-minute cost used in margin calculations | `0.14` (Start plan rate) |
| `BLAND_API_URL` | Base URL for the Bland REST API (hardcoded constant) | `https://api.bland.ai/v1` |

### Security Considerations

The master API key is never exposed to client-side code. It is accessed only in server-side API routes and library modules. The function `getMasterApiKey()` in `src/lib/bland/master-client.ts` returns the key for admin-only operations but should never be called from any endpoint accessible to regular users. Company ownership of calls is always verified at the API route level by checking `call_logs.company_id` before returning call details fetched via the master key.

## Bland Plans

Bland AI offers four pricing tiers. The active plan is selected via a dropdown in the [[Command Center]] Health tab and persisted by `POST /api/admin/command-center`. The selected plan's limits are cached in [[Upstash Redis]] under the key `callengo:bland_plan_info` with a 1-hour TTL.

| Plan | Cost/min | Concurrent Calls | Daily Cap | Hourly Cap | Voice Clones | Transfer Rate |
|------|----------|-----------------|-----------|-----------|-------------|---------------|
| **Start** | $0.14 | 10 | 100 | 100 | 1 | $0.05/min |
| **Build** | $0.12 | 50 | 2,000 | 1,000 | 5 | $0.04/min |
| **Scale** | $0.11 | 100 | 5,000 | 1,000 | 15 | $0.03/min |
| **Enterprise** | $0.09 | Unlimited | Unlimited | Unlimited | 999 | $0.02/min |

The source of truth for these limits is the `BLAND_PLAN_LIMITS` constant exported from `src/lib/bland/master-client.ts`. Each plan entry is a record containing `dailyCap`, `hourlyCap`, `concurrentCap`, `voiceClones`, `costPerMinute`, and `transferRate`. The "unlimited" values for Enterprise are represented as `999999` in code.

### Plan Detection

The function `getBlandAccountInfo()` fetches the current account status from Bland's API. It attempts two endpoints in sequence:

1. `GET /v1/me` -- the primary endpoint
2. `GET /v1/org` -- fallback if `/me` fails

Both return varying response shapes, so the function uses `inferPlanFromOrgData()` to determine the plan. This function checks for an explicit `org_plan` or `plan` field first, then falls back to inferring the plan from the `org_rate_limit` value (>= 100 = Scale, >= 50 = Build, otherwise Start). If both endpoints fail entirely, the function constructs a fallback `BlandAccountInfo` based on the `BLAND_COST_PER_MINUTE` environment variable.

The `BlandAccountInfo` interface returned contains: `status`, `balance`, `totalCalls`, `plan`, `dailyCap`, `hourlyCap`, `concurrentCap`, `voiceClones`, `costPerMinute`, and `transferRate`.

### Safety Margin

All Bland plan limits are applied with a **90% safety margin** to prevent hitting hard caps that could trigger account suspension:

```
effectiveLimit = Math.floor(blandLimit * 0.9)
```

This means on a Scale plan with 100 concurrent call slots, Callengo will stop dispatching at 90 concurrent calls.

## Call Dispatch Flow

The complete lifecycle of a call from campaign dispatch to completion:

```
1. Campaign dispatch loop selects next contact
2. checkCallAllowed() validates:
   - Company plan limits (minutes, concurrent slots)
   - Bland global limits (daily, hourly, concurrent)
   - Contact cooldown (5-min gap)
3. acquireCallSlot() atomically reserves slot in Redis
4. dispatchCall() sends POST /v1/calls to Bland
5. Bland places the call and streams audio
6. Call completes → Bland sends webhook to /api/bland/webhook
7. releaseCallSlot() decrements concurrent counters
8. Usage tracked in usage_tracking for Stripe metered billing
9. AI analysis triggered (sync or async per AI_ANALYSIS_MODE)
```

### dispatchCall() Details

The `dispatchCall()` function in `src/lib/bland/master-client.ts` is the sole entry point for placing calls. It accepts a `BlandCallPayload` and returns a `BlandCallResult`.

**Payload fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `phone_number` | string | Required | E.164 formatted phone number |
| `task` | string | Required | The prompt/script for the AI agent |
| `voice` | string | `'maya'` | Voice ID from the catalog |
| `first_sentence` | string | Optional | Opening line override |
| `wait_for_greeting` | boolean | `true` | Wait for the recipient to speak first |
| `record` | boolean | `true` | Record the call for transcription |
| `max_duration` | number | `5` | Maximum call length in minutes |
| `voicemail_action` | enum | `'leave_message'` | What to do when voicemail is detected: `leave_message`, `hangup`, `ignore` |
| `voicemail_message` | string | Optional | Message to leave on voicemail |
| `answered_by_enabled` | boolean | `true` | Enable voicemail/human detection |
| `webhook` | string | Optional | Webhook URL for call completion |
| `metadata` | object | Optional | Custom metadata including `company_id` |
| `from` | string | Optional | Dedicated caller ID number |
| `background_track` | string | `'office'` | Background audio track |
| `model` | string | `'enhanced'` | Bland AI model tier |
| `language` | string | `'en'` | Call language |
| `temperature` | number | `0.7` | Voice generation temperature |

**Timeout:** The function uses a 15-second `AbortController` timeout to prevent hanging dispatch loops if Bland's API is unresponsive. If the timeout fires, the call is marked as failed and the slot is released.

**Return value:** `BlandCallResult` contains `success` (boolean), `callId` (the Bland-assigned UUID), `message`, `error`, and `statusCode`.

### getCallDetails()

The `getCallDetails(callId)` function fetches the full call record from Bland via `GET /v1/calls/{callId}`. It is used by admin endpoints and the reconciliation system. Company ownership must be verified at the API route level before calling this function, since the master key can access any call on the account.

## Concurrency Management

Call concurrency is managed entirely through [[Upstash Redis]]. See that note for full details on key patterns, atomic operations, and the circuit breaker. The key interactions from Bland AI's perspective are:

1. **Pre-flight check:** `checkCallCapacity()` reads all counters without incrementing to determine if a new call can be dispatched.
2. **Slot acquisition:** `acquireCallSlot()` atomically increments global and per-company concurrent counters, sets daily/hourly counters, creates an active call tracker key with 30-minute TTL, and sets contact cooldown.
3. **Slot release:** `releaseCallSlot()` decrements concurrent counters and removes the active call tracker when the Bland webhook fires.
4. **Slot transfer:** `transferCallSlot()` renames the active call key from a pre-assigned UUID to the real Bland call ID when the dispatch response arrives.

## Voice Catalog

Callengo ships with a static catalog of **66 voices** defined in `src/lib/voices/bland-voices.ts`. Each voice is a `BlandVoice` object with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Bland's voice identifier |
| `name` | string | Display name (e.g., "Maya", "Ryan", "Helena") |
| `description` | string | Brief description (e.g., "Young American Female") |
| `public` | boolean | Whether the voice is publicly available |
| `ratings` | number | Number of user ratings |
| `tags` | string[] | Categorization tags (language, accent, "Bland Curated") |
| `user_id` | string or null | Owner of the voice (null for Bland-owned) |
| `total_ratings` | number | Total rating count |
| `average_rating` | number | Average star rating |

The default voice is **Maya** (`'maya'`), a "Young American Female" voice. If no voice is specified in the `BlandCallPayload`, `dispatchCall()` falls back to Maya.

Voice types are defined in `src/lib/voices/types.ts`, which also exports `VoiceCategory`, `VoiceSample`, `VoiceCharacteristic` (professional, casual, young, mature, warm, energetic, calm, formal, friendly, authoritative, soft, engaging), and `VoiceWithCharacteristics`.

The voices span multiple accents and languages: American English, British English, Australian English, and Spanish. Tags include `english`, `british`, `australian`, `spanish`, `cloned`, `Bland Curated`, and gender markers.

## Phone Numbers

Phone number management is handled in `src/lib/bland/phone-numbers.ts` (413 lines). There are two modes:

### Auto-Rotation (Default)

All plans include automatic phone number rotation from Callengo's shared pool. Bland manages the rotation internally based on the numbers available on the master account. No `from` field is set in the call payload, so Bland picks an available number. This provides basic spam protection by distributing calls across multiple numbers.

### Dedicated Numbers (Add-on)

Available on **Starter+** plans as a paid add-on ($25/month per number to the customer, $15/month cost to Bland). Companies can have up to 3 dedicated numbers (defined by `MAX_DEDICATED_NUMBERS = 3`).

**Purchase flow:**
1. User selects area code via the UI (US/Canada area codes available, defined in `US_AREA_CODES_BY_STATE` and `CA_AREA_CODES_BY_PROVINCE`)
2. `purchaseNumber(areaCode, countryCode)` sends `POST /numbers/purchase` to Bland's API
3. Number is stored in the `company_addons` table with `addon_type = 'dedicated_number'`
4. `assignNumberToCompany()` creates the addon record and sets `addon_dedicated_number = true` on `company_subscriptions`

**Call routing with dedicated numbers:**
When a company has dedicated numbers, `getCompanyCallerNumber(companyId)` retrieves them and provides one to the dispatch payload's `from` field. If the company has multiple numbers, simple timestamp-based rotation selects among them: `Math.floor(Date.now() / 1000) % numbers.length`.

**Release flow:**
`releaseNumberFromCompany()` marks the addon as `canceled` in Supabase and also releases the number from the Bland master account via `POST /numbers/{id}/release` (best-effort, non-fatal if it fails). If no active numbers remain, `addon_dedicated_number` is set to `false` on the subscription.

## Cost Model

Bland charges per minute of call time. The cost depends on the active plan:

| Plan | Bland Cost/min | Callengo Overage Rate | Gross Margin per Overage Minute |
|------|---------------|----------------------|-------------------------------|
| Start | $0.14 | $0.29 (Starter) | $0.15 (52%) |
| Build | $0.12 | $0.26 (Growth) | $0.14 (54%) |
| Scale | $0.11 | $0.23 (Business) | $0.12 (52%) |
| Enterprise | $0.09 | $0.17 (Enterprise) | $0.08 (47%) |

All overage rates are above the Bland cost floor, ensuring positive unit economics. Bland costs are tracked in the `admin_finances` table and displayed in the [[Command Center]] Operations and Finances tabs for burn rate and runway calculations.

The dedicated number add-on also generates margin: $25/month charged to customer minus $15/month cost to Bland = $10/month gross margin per number.

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/bland/master-client.ts` | 304 | Plan detection, call dispatch, account info, limits |
| `src/lib/bland/phone-numbers.ts` | 413 | Dedicated number purchase, assignment, release, area code catalog |
| `src/lib/voices/bland-voices.ts` | 67 | Static voice catalog (66 voices) |
| `src/lib/voices/types.ts` | 51 | TypeScript types for voices |
| `src/app/api/bland/` | Multiple | Webhook handler, call status endpoints |

## Related Notes

- [[Upstash Redis]] -- concurrency control and call slot management
- [[Call]] -- call log data model
- [[Campaign Dispatch Flow]] -- how campaigns queue and dispatch calls
- [[Call Processing Flow]] -- webhook handling and post-call processing
- [[Command Center]] -- admin monitoring including Bland plan selection
- [[Stripe Integration]] -- metered billing for overage charges
- [[OpenAI]] -- post-call transcript analysis
- [[Agent]] -- the three AI agent types that generate call scripts
