---
tags: [integration, voice, core]
aliases: [Bland, Voice Provider]
---

# Bland AI

The voice infrastructure provider powering all AI phone calls in Callengo.

## Architecture: Master Key

All calls route through a **single Bland AI API key** (`BLAND_API_KEY` env var). There are no sub-accounts — tenant isolation is enforced in Supabase via `company_id`.

- `bland_subaccount_id` in `company_settings` is always `'master'`
- Bland sees a flat pool of calls — correlation is via UUIDs in metadata
- The master key owner maintains a Bland account with auto-recharge or manual credits

## Bland Plans

Configurable in [[Command Center]] via dropdown:

| Plan | $/min | Concurrent | Daily | Hourly | Voice Clones |
|------|-------|-----------|-------|--------|-------------|
| Start | $0.14 | 10 | 100 | 100 | 1 |
| Build | $0.12 | 50 | 2,000 | 1,000 | 5 |
| Scale | $0.11 | 100 | 5,000 | 1,000 | 15 |
| Enterprise | $0.09 | ∞ | ∞ | ∞ | 999 |

- Limits cached in [[Upstash Redis]] (TTL 1h, 90% safety margin)
- Source of truth: `BLAND_PLAN_LIMITS` in `src/lib/bland/master-client.ts`
- `BLAND_COST_PER_MINUTE` env var overrides default cost

## Call Flow

```
Campaign dispatch
  → checkCallAllowed() [plan limits + Bland limits]
  → acquireCallSlot() [Redis atomic slot]
  → Bland AI API call with company metadata
  → Bland webhook → /api/bland/webhook
  → releaseCallSlot() + usage tracking
```

## Concurrency Management ([[Upstash Redis]])

- **Global counters:** concurrent, daily, hourly
- **Per-company counters:** concurrent, daily, hourly
- **Active call slots:** `callengo:active_call:{callId}` with 30min TTL
- **Contact cooldown:** 5min between calls to same contact

## Source Files

- Master client: `src/lib/bland/master-client.ts` (plan detection, dispatch, limits)
- Phone numbers: `src/lib/bland/phone-numbers.ts`
- Voice catalog: `src/lib/voices/`
- API routes: `src/app/api/bland/`

## Cost Model

- Bland charges per minute: $0.09-$0.14 depending on plan
- Callengo overage rates ($0.17-$0.29/min) provide margin above Bland cost
- Tracked in admin finances for gross margin calculation

## Related Notes

- [[Upstash Redis]]
- [[Call]]
- [[Campaign Dispatch Flow]]
- [[Call Processing Flow]]
- [[Command Center]]
