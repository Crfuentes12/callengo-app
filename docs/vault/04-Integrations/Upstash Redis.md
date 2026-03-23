---
tags: [integration, infrastructure, concurrency]
aliases: [Redis]
---

# Upstash Redis

Serverless Redis used for rate limiting, concurrency control, and caching.

## Key Patterns

### Call Concurrency
```
callengo:active_call:{callId}     → TTL 30min (call slot)
callengo:global:concurrent        → Current concurrent calls
callengo:global:daily:{date}      → Daily call count
callengo:global:hourly:{hour}     → Hourly call count
callengo:company:{id}:concurrent  → Per-company concurrent
callengo:company:{id}:daily       → Per-company daily
callengo:company:{id}:hourly      → Per-company hourly
```

### Contact Cooldown
```
callengo:contact_cooldown:{contactId} → TTL 5min
```

### Bland Plan Cache
```
callengo:bland_plan_limits → TTL 1h (cached plan config)
```

## Operations

| Function | Description |
|----------|-------------|
| `acquireCallSlot(callId)` | Atomic slot reservation |
| `releaseCallSlot(callId)` | Release slot on call completion |
| `checkCallAllowed(companyId)` | Validate all limits (global + company) |
| `getGlobalGauges()` | Current concurrent/daily/hourly counts |
| `getCompanyGauges(companyId)` | Per-company counts |

## Safety Margin

Bland plan limits are applied with a **90% safety margin** to avoid hitting hard limits:
```typescript
effectiveLimit = Math.floor(blandLimit * 0.9)
```

## Source Files

- Concurrency manager: `src/lib/redis/concurrency-manager.ts`
- Rate limiter: `src/lib/rate-limit.ts` (defined but NOT applied globally)

## Command Center Integration

The [[Command Center]] Health tab displays:
- Global gauges (concurrent, daily, hourly)
- Per-company breakdown
- Active call slots list

## Related Notes

- [[Bland AI]]
- [[Call Processing Flow]]
- [[Campaign Dispatch Flow]]
