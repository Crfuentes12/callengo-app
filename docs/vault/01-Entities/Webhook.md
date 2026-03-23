---
tags: [entity, integrations]
aliases: [Outbound Webhook]
---

# Webhook

Outbound webhooks that notify external systems (Zapier, Make, n8n) about Callengo events.

## Database Tables

### `webhook_endpoints`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK | |
| url | TEXT | Destination URL |
| description | TEXT | |
| secret | TEXT | HMAC-SHA256 signing key |
| events | TEXT[] | Subscribed event types |
| is_active | BOOLEAN | |
| consecutive_failures | INTEGER | Default 0 |
| auto_disabled_at | TIMESTAMPTZ | Auto-disabled after failures |

### `webhook_deliveries`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| endpoint_id | UUID FK → webhook_endpoints | CASCADE |
| event_type | TEXT | |
| event_id | TEXT | For idempotency |
| payload | JSONB | |
| status | TEXT | pending, success, failed |
| http_status | INTEGER | |
| response_body | TEXT | |
| duration_ms | INTEGER | |

## Webhook Signature Verification

Outbound webhooks are signed with HMAC-SHA256 using the endpoint's `secret`. Implementation in `src/lib/webhooks.ts`.

Inbound Stripe webhooks are verified separately via Stripe's signature verification.

## Related Notes

- [[Stripe Integration]]
- [[API Overview]]
