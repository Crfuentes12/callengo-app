---
tags: [api, bland, voice]
---

# Bland AI API

Endpoints for sending calls and receiving call results from [[Bland AI]].

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bland/send-call` | Dispatch a single call via Bland AI |
| POST | `/api/bland/webhook` | Receive call completion webhook from Bland |
| GET | `/api/bland/status/[callId]` | Check call status |
| GET | `/api/bland/phone-numbers` | List available phone numbers |

## send-call Flow

1. Validate input (Zod schema, UUID format for contact_id)
2. Check plan limits via `checkCallAllowed()` (minutes, concurrent, daily, hourly)
3. Acquire Redis call slot via `acquireCallSlot()`
4. Send call via Bland AI master API key with company metadata
5. Create `call_logs` entry and `campaign_queue` update
6. Return call_id for tracking

## webhook Flow

1. Receive POST from Bland AI with call results
2. Look up call by `call_id` in `call_logs`
3. Update call status, duration, transcript
4. Release Redis call slot via `releaseCallSlot()`
5. Track usage in `usage_tracking` (atomic increment)
6. Queue AI analysis in `analysis_queue`
7. Trigger follow-up creation (via DB trigger)
8. Fire outbound webhooks if configured

## Security

- `send-call`: Authenticated, company-scoped, validates UUID format for contact_id
- `webhook`: Verifies Bland AI webhook signature

## Source Files

- Master client: `src/lib/bland/master-client.ts`
- Phone numbers: `src/lib/bland/phone-numbers.ts`

## Related Notes

- [[Bland AI]]
- [[Call]]
- [[Campaign Dispatch Flow]]
- [[Call Processing Flow]]
- [[Upstash Redis]]
