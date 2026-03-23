---
tags: [security, encryption, rls, authentication, oauth, middleware, rate-limiting, webhooks]
aliases: [Security Overview, Encryption, Token Encryption, Security Architecture]
created: 2026-03-23
updated: 2026-03-23
---

# Security & Encryption

This document covers the full security architecture of the Callengo platform, from token encryption and database-level protections to webhook verification and route protection. Callengo handles sensitive data including OAuth tokens for 11 integration providers, Stripe payment information, and customer contact data, making security a critical concern across every layer of the stack.

For known security issues and the results of the March 2026 production audit, see [[Known Issues & Audit]].

---

## AES-256-GCM Token Encryption

All OAuth tokens and sensitive API keys stored in the database are encrypted at rest using AES-256-GCM symmetric encryption. The implementation lives in `src/lib/encryption.ts` (116 lines) and provides four exported functions.

### Source File

**Path**: `src/lib/encryption.ts`

### Encryption Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Algorithm | AES-256-GCM | Authenticated encryption with associated data |
| IV Length | 12 bytes (96 bits) | Recommended IV size for GCM mode |
| Auth Tag Length | 16 bytes (128 bits) | Full-length authentication tag |
| Encoding | Base64 | Used for IV, auth tag, and ciphertext in the stored format |
| Key Length | 32 bytes (256 bits) | Derived from 64 hex character environment variable |

### Environment Variable

| Variable | Format | Description |
|----------|--------|-------------|
| `TOKEN_ENCRYPTION_KEY` | 64 hex characters (32 bytes) | Master encryption key. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

The key is validated at runtime: if it is missing or not exactly 64 hex characters, the encryption functions throw an error with a helpful message. This is a fail-closed design -- the application will not silently store plaintext tokens when the key is misconfigured.

### Encrypted Value Format

Encrypted values are stored as a single string with a recognizable prefix:

```
enc:{iv_base64}:{authTag_base64}:{ciphertext_base64}
```

The `enc:` prefix serves two purposes:
1. It allows `decryptToken()` to distinguish encrypted values from plaintext values for backward compatibility.
2. It provides a quick visual indicator in database queries that a value is encrypted.

### Exported Functions

#### `encryptToken(plaintext: string): string`

Encrypts a plaintext string. Returns the `enc:...` formatted string. If the input is empty or already encrypted (starts with `enc:`), returns it unchanged. This idempotency prevents double-encryption.

#### `decryptToken(encrypted: string): string`

Decrypts an `enc:...` formatted string back to plaintext. If the input does not start with `enc:`, it is returned as-is. This backward compatibility ensures that existing plaintext tokens in the database continue to work during the migration period. The function validates the encrypted format and throws an error if the format is malformed.

#### `encryptTokenFields<T>(data: T, fields: (keyof T)[]): T`

Encrypts specific string fields in an object, returning a new object with the encrypted values. Non-string fields and fields not in the `fields` array are passed through unchanged. Used when inserting or updating database rows that contain multiple token fields.

#### `decryptTokenFields<T>(data: T, fields: (keyof T)[]): T`

Decrypts specific string fields in an object, returning a new object with the decrypted values. The inverse of `encryptTokenFields`. Used when reading database rows that contain encrypted tokens.

### Covered Providers (11 OAuth Integrations)

All OAuth token storage across the following providers uses `encryptToken()` before writing and `decryptToken()` after reading:

| # | Provider | Token Fields Encrypted | Source Directory |
|---|----------|----------------------|-----------------|
| 1 | Google Calendar | `access_token`, `refresh_token` | `src/lib/calendar/` |
| 2 | Microsoft Outlook | `access_token`, `refresh_token` | `src/lib/calendar/` |
| 3 | Zoom | `access_token`, `refresh_token` | `src/lib/calendar/` |
| 4 | HubSpot | `access_token`, `refresh_token` | `src/lib/hubspot/` |
| 5 | Pipedrive | `access_token`, `refresh_token` | `src/lib/pipedrive/` |
| 6 | Zoho CRM | `access_token`, `refresh_token` | `src/lib/zoho/` |
| 7 | Salesforce | `access_token`, `refresh_token` | `src/lib/salesforce/` |
| 8 | Microsoft Dynamics | `access_token`, `refresh_token` | `src/lib/dynamics/` |
| 9 | Clio | `access_token`, `refresh_token` | `src/lib/clio/` |
| 10 | Google Sheets | `access_token`, `refresh_token` | See [[Google Sheets]] |
| 11 | SimplyBook.me | `api_key`, `secret` | `src/lib/simplybook/` |

---

## Row Level Security (RLS)

All 56 tables in the Supabase database have RLS enabled. The policies follow five primary patterns documented in [[RLS Patterns]]:

| Pattern | Description | Example Tables |
|---------|-------------|---------------|
| **Company-scoped** | Users can only access rows where `company_id` matches their own | `contacts`, `campaigns`, `call_logs`, `agents` |
| **User-scoped** | Users can only access their own rows | `user_preferences` |
| **Role-restricted** | Only specific roles (admin, owner) can access | `admin_platform_config`, `admin_audit_log` |
| **Service-role only** | Only server-side code with the service role key can write | `admin_audit_log` (INSERT) |
| **Soft-delete aware** | Excludes rows from soft-deleted companies | `companies` (WHERE `deleted_at IS NULL`) |

### Reinforced RLS (March 2026 Audit)

The following RLS improvements were applied during the [[Known Issues & Audit|March 2026 production audit]]:

- **`company_subscriptions`**: Previously editable by any authenticated user in the company. Now restricted to `owner` and `admin` roles only.
- **Soft-deleted companies**: A new RLS policy excludes rows from companies with a non-null `deleted_at` column, preventing access to data from deleted organizations.
- **Partial index**: `CREATE INDEX idx_companies_active ON companies(id) WHERE deleted_at IS NULL` ensures the soft-delete filter is efficient.

---

## Security Triggers

Two database triggers enforce security invariants at the PostgreSQL level, providing defense-in-depth beyond application code.

### prevent_role_self_escalation

**Type**: `SECURITY DEFINER` function (runs with the function owner's privileges, not the caller's)

This trigger prevents users from escalating their own role. For example, a `member` cannot update their own `users` row to set `role = 'admin'`. The trigger fires on `BEFORE UPDATE` on the `users` table and compares `OLD.role` with `NEW.role` -- if the role is being changed and the current user is the same as the row being updated, the operation is rejected.

### prevent_sensitive_field_changes (trg_prevent_sensitive_field_changes)

**Type**: `BEFORE UPDATE` trigger on the `users` table

This trigger blocks any authenticated user from changing their own `company_id` or `email` fields. These fields can only be changed by the `service_role` (server-side code). This prevents:

- A user moving themselves to a different company to access that company's data
- A user changing their email to impersonate another user

The trigger was added during the March 2026 audit after identifying that the previous RLS policies allowed these changes.

---

## CHECK Constraints

Eight tables have CHECK constraints on their status columns, ensuring that only valid status values can be stored. This is a defense-in-depth measure -- the application validates status values before writing, but the CHECK constraints catch any bugs or direct database modifications that might bypass the application layer.

| Table | Column | Allowed Values |
|-------|--------|---------------|
| `call_logs` | `status` | `pending`, `in_progress`, `completed`, `failed`, `no_answer`, `voicemail`, `busy` |
| `campaigns` | `status` | `draft`, `scheduled`, `running`, `paused`, `completed`, `canceled` |
| `contacts` | `status` | `active`, `inactive`, `do_not_call`, `invalid` |
| `follow_ups` | `status` | `pending`, `completed`, `snoozed`, `canceled` |
| `voicemails` | `status` | `new`, `listened`, `archived` |
| `company_subscriptions` | `status` | `active`, `trialing`, `canceled`, `past_due`, `paused` |
| `agents` | `status` | `active`, `inactive`, `draft` |
| `companies` | `status` | `active`, `suspended`, `inactive` |

---

## Soft-Delete on Companies

The `companies` table supports soft-delete via a `deleted_at` TIMESTAMPTZ column (defaults to NULL). When a company is "deleted", `deleted_at` is set to the current timestamp rather than removing the row. This provides a 30-day recovery window.

| Aspect | Implementation |
|--------|---------------|
| **Column** | `deleted_at TIMESTAMPTZ DEFAULT NULL` |
| **Deletion** | `UPDATE companies SET deleted_at = now() WHERE id = ?` |
| **Recovery** | `UPDATE companies SET deleted_at = NULL WHERE id = ?` (within 30 days) |
| **RLS exclusion** | All RLS policies on `companies` include `AND deleted_at IS NULL` |
| **Partial index** | `idx_companies_active ON companies(id) WHERE deleted_at IS NULL` |
| **Permanent deletion** | After 30 days, a scheduled job can hard-delete the row and cascade to related data |

---

## Webhook Verification

### Stripe Webhooks

Stripe webhook signatures are verified using the `verifyWebhookSignature()` function in `src/lib/webhooks.ts`. This function uses Stripe's `constructEvent()` method with the `STRIPE_WEBHOOK_SECRET` environment variable to verify that incoming webhook payloads are genuinely from Stripe and have not been tampered with.

The verification happens in the `/api/webhooks/stripe/route.ts` handler before any payload processing occurs. If verification fails, the handler returns a 400 response and does not process the event.

### Bland AI Webhooks

Bland AI webhook payloads are verified using HMAC-SHA256 signatures. The incoming request includes a signature header, and the handler computes the expected signature using the `BLAND_WEBHOOK_SECRET` and compares them using a constant-time comparison to prevent timing attacks.

### Outbound Webhooks (Zapier/Make/n8n)

When Callengo sends webhooks to customer-configured endpoints (via Zapier, Make, or n8n integrations), each outbound payload includes an HMAC-SHA256 signature in the `X-Callengo-Signature` header. This allows the receiving system to verify that the webhook genuinely came from Callengo.

---

## Edge Middleware Route Protection

The Edge middleware at `src/middleware.ts` provides the first line of defense for route protection. It runs on Vercel's Edge network before the request reaches the Next.js server.

| Route Pattern | Protection |
|---------------|------------|
| `/app/*` (all authenticated routes) | Requires valid Supabase session cookie |
| `/admin/*` | Requires `admin` or `owner` role |
| `/api/admin/*` | Requires `admin` or `owner` role |
| `/auth/*` | Public (login, signup, OAuth callbacks) |
| `/pricing` | Public |
| `/` | Public (redirects to `/home` if authenticated) |

The middleware checks for a valid Supabase session by verifying the session cookie. If no valid session exists, the user is redirected to `/auth/login`. For admin routes, the middleware additionally checks the user's role.

---

## Rate Limiting

Rate limiting is implemented in `src/lib/rate-limit.ts` using `@upstash/ratelimit` (distributed via [[Upstash Redis]]) with an in-memory LRU cache fallback for local development.

### Defined Limiters

| Limiter | Limit | Window | Intended Use |
|---------|-------|--------|-------------|
| `apiLimiter` | 30 req/min | 60 seconds | General API endpoints |
| `expensiveLimiter` | 5 req/min | 60 seconds | Resource-intensive operations (AI analysis, bulk imports) |
| `authLimiter` | 10 req/min | 60 seconds | Login, signup, password reset |
| `callLimiter` | 10 req/min | 60 seconds | Send-call endpoint |

### Known Issue: Not Globally Applied

**IMPORTANT**: While the four limiters are fully implemented and functional, they are **not currently imported or applied** in any API route handler. This is documented as a **high-priority known issue** in [[Known Issues & Audit]]. The limiters exist and work correctly -- they simply need to be imported and called at the top of each relevant API route handler.

The typical application pattern would be:

```typescript
import { apiLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const result = await apiLimiter.check(30, ip);
  if (!result.success) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }
  // ... handle request
}
```

### Fallback Behavior

When `UPSTASH_REDIS_REST_URL` is not configured (e.g., in local development), the limiters fall back to an in-memory LRU cache. This provides rate limiting within a single process but does not work across multiple serverless function instances.

### Legacy Functions

Two deprecated functions remain for backward compatibility:

| Function | Status | Replacement |
|----------|--------|-------------|
| `checkGlobalHourlyCap()` | Deprecated, always returns `allowed: true` | `checkCallCapacity()` from `src/lib/redis/concurrency-manager.ts` |
| `getGlobalHourlyUsage()` | Deprecated, always returns `0` | `getConcurrencySnapshot()` from `src/lib/redis/concurrency-manager.ts` |

---

## Input Validation

### UUID Validation on send-call

The `/api/bland/send-call` endpoint validates that `metadata.contact_id` is a valid UUID format using a Zod `.refine()` validator. This was added during the March 2026 audit to prevent injection attacks or malformed data from being passed to Bland AI.

### verify-session Prefix Validation

The `/api/billing/verify-session` endpoint validates that the `session_id` parameter starts with the `cs_` prefix (Stripe Checkout Session ID format). This prevents arbitrary strings from being passed to the Stripe API.

### addon_type Whitelist

The Stripe webhook handler validates `addon_type` values against a `VALID_ADDON_TYPES` whitelist constant. Only the following values are accepted:

| Addon Type | Description |
|------------|-------------|
| `dedicated_number` | Dedicated phone number ($15/mo) |
| `recording_vault` | Call recording storage ($12/mo) |
| `calls_booster` | Additional call capacity ($35/mo) |

Any `addon_type` not in this whitelist is rejected, preventing attackers from creating arbitrary addon types through crafted webhook payloads.

---

## Authentication

Authentication is handled by Supabase Auth, which supports:

| Method | Description |
|--------|-------------|
| Email/password | Standard credentials with email verification |
| Google OAuth | Social login via Google |
| GitHub OAuth | Social login via GitHub |

The auth context is managed by `src/contexts/AuthContext.tsx`, which provides the current user, session, and company information to all components. Server-side authentication in API routes uses `createServerSupabaseClient()` from `src/lib/supabase/server.ts`.

---

## Source Files

| File | Lines | Description |
|------|-------|-------------|
| `src/lib/encryption.ts` | 116 | AES-256-GCM encryption/decryption functions |
| `src/lib/rate-limit.ts` | 153 | Rate limiter definitions (not yet applied) |
| `src/lib/webhooks.ts` | -- | Stripe webhook signature verification |
| `src/middleware.ts` | -- | Edge middleware for route protection |
| `src/lib/supabase/server.ts` | -- | Server-side Supabase client with auth |
| `src/lib/supabase/service.ts` | -- | Service role client for admin operations |
| `src/contexts/AuthContext.tsx` | -- | Client-side auth context provider |

---

## Related Notes

- [[Known Issues & Audit]] -- Audit findings, open bugs, and corrected issues
- [[RLS Patterns]] -- Detailed RLS policy documentation
- [[Triggers & Functions]] -- Database trigger implementations
- [[Platform Config]] -- Admin-managed platform settings
- [[Audit Log]] -- Immutable admin action log
- [[Command Center]] -- Admin monitoring panel
- [[Google Sheets]] -- OAuth token encryption example
- [[Schema Overview]] -- Full database schema
- [[Upstash Redis]] -- Rate limiting and concurrency infrastructure
