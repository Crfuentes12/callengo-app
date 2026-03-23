---
tags: [workflow, technical, calls]
---

# Campaign Dispatch Flow

Technical flow for dispatching calls from a [[Campaign]].

## Flow

```
1. User creates campaign (agent_runs)
   ├── Selects agent, contacts, configuration
   └── Status: pending

2. User starts campaign → Status: running
   └── campaign_queue entries created (one per contact)

3. Dispatch loop processes queue:
   FOR each pending campaign_queue entry:
   │
   ├── checkCallAllowed(companyId)
   │   ├── Check plan minute limits (usage_tracking)
   │   ├── Check Bland plan limits (cached in Redis)
   │   ├── Check company concurrent limit (Redis counter)
   │   ├── Check global concurrent limit (Redis counter)
   │   ├── Check daily/hourly limits (Redis counters)
   │   └── Check contact cooldown (5min Redis key)
   │
   ├── If NOT allowed → skip or queue for later
   │
   ├── acquireCallSlot(callId) — Redis atomic reservation
   │   └── callengo:active_call:{callId} TTL 30min
   │
   ├── Bland AI API call
   │   ├── Master API key
   │   ├── Phone number (dedicated or pool)
   │   ├── Agent voice + prompt
   │   ├── Metadata: {company_id, contact_id, agent_run_id}
   │   └── Webhook URL: /api/bland/webhook
   │
   ├── Create call_logs entry (status: pending)
   ├── Update campaign_queue (status: processing)
   │
   └── Error handling:
       └── try-catch with non-fatal cleanup (delete operations wrapped)

4. Campaign monitoring:
   ├── Track completed_calls, successful_calls, failed_calls
   ├── Notification at >50% failure rate
   └── Status → completed when all contacts processed
```

## Concurrency Strategy

- Bland plan limits applied with 90% safety margin
- Redis counters are atomic (INCR/DECR)
- Call slots have 30min TTL (auto-cleanup for stuck calls)
- Contact cooldown prevents spam (5min between calls to same contact)

## Source Files

- Master client: `src/lib/bland/master-client.ts`
- Concurrency: `src/lib/redis/concurrency-manager.ts`
- Queue processing: `src/app/api/queue/`

## Related Notes

- [[Call Processing Flow]]
- [[Bland AI]]
- [[Upstash Redis]]
- [[Campaign]]
