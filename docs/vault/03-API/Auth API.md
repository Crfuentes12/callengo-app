---
tags: [api, auth, team, invitations, roles]
created: 2026-03-23
updated: 2026-03-23
---

# Auth API

The Auth API covers two closely related concerns: user authentication (handled primarily by Supabase Auth with thin API wrappers) and team management (invitations, member listing, removal, and role changes). Authentication in Callengo is session-based, using Supabase Auth for email/password login and OAuth providers (Google, GitHub). The Edge middleware (`src/middleware.ts`) protects routes at the infrastructure level, while API routes verify sessions server-side via `createServerSupabaseClient()`.

Team management enables multi-user companies. The number of allowed team members (seats) is governed by the [[Subscription]] plan, with seat limits checked at invitation time.

---

## Authentication Architecture

Callengo does not implement its own auth endpoints for login/signup. Instead, authentication is delegated entirely to Supabase Auth:

1. **Signup/Login** -- The frontend uses `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()` directly from the browser Supabase client.
2. **OAuth** -- Google and GitHub OAuth are initiated via `supabase.auth.signInWithOAuth()`. The callback URL is configured in Supabase Dashboard.
3. **Session management** -- Supabase Auth sets HTTP-only cookies. The Edge middleware reads these cookies to protect routes. API routes call `supabase.auth.getUser()` to verify the session.
4. **Post-auth flow** -- After successful authentication, the user is redirected to `/home` (regular users) or `/admin/command-center` (admin users). The `AuthContext.tsx` provider manages client-side auth state.

The thin API wrappers that do exist handle ancillary auth concerns:

---

## Auth Utility Endpoints

### GET /api/auth/check-admin

Checks whether the currently authenticated user has the `admin` role. This is used by the frontend to conditionally show the Command Center navigation link. Note that `admin` is the platform administrator (founder) role -- distinct from the `owner` role which is a customer-level role.

**Authentication:** Required (returns `{ isAdmin: false }` with 401 if unauthenticated).

**Response:**

```json
{ "isAdmin": true }
```

or

```json
{ "isAdmin": false }
```

**Source file:** `src/app/api/auth/check-admin/route.ts`

---

### POST /api/auth/verify-recaptcha

Verifies a reCAPTCHA token to prevent bot signups. Called during the registration flow before creating a Supabase Auth account.

**Request body:**

```json
{ "token": "reCAPTCHA-response-token" }
```

**Response:**

```json
{ "success": true, "score": 0.9 }
```

**Source file:** `src/app/api/auth/verify-recaptcha/route.ts`

---

## Team Endpoints

Team management endpoints live under `/api/team/`. They enable multi-user companies with role-based access control. The role hierarchy is:

| Role | Permissions |
|------|-------------|
| `owner` | Full access. Can invite admins, remove admins, manage billing. One per company. |
| `admin` | Can invite members (not admins), remove members (not admins/owners), manage billing. |
| `member` | Standard access. Cannot manage team or billing. |

---

### GET /api/team/members

Returns all team members and pending invitations for the authenticated user's company. Member data is enriched with `last_sign_in_at` from Supabase Auth, fetched in a single batch API call (optimized from N+1 `getUserById` calls in the March 2026 audit).

**Authentication:** Required.

**Response:**

```json
{
  "members": [
    {
      "id": "uuid",
      "email": "alice@acme.com",
      "full_name": "Alice Johnson",
      "role": "owner",
      "created_at": "2026-01-15T10:00:00Z",
      "last_sign_in_at": "2026-03-23T09:15:00Z"
    },
    {
      "id": "uuid",
      "email": "bob@acme.com",
      "full_name": "Bob Smith",
      "role": "member",
      "created_at": "2026-02-20T14:30:00Z",
      "last_sign_in_at": "2026-03-22T16:45:00Z"
    }
  ],
  "invites": [
    {
      "id": "uuid",
      "email": "carol@acme.com",
      "role": "member",
      "created_at": "2026-03-20T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

**Source file:** `src/app/api/team/members/route.ts`

---

### POST /api/team/invite

Sends a team invitation to an email address. The invitation is stored in the `team_invitations` table and an email is sent via Supabase Auth's `inviteUserByEmail()` method.

**Authentication:** Required. Only `owner` and `admin` roles can invite.

**Rate limit:** 3 requests/minute per user.

**Request body:**

```json
{
  "email": "carol@acme.com",
  "role": "member"
}
```

The `role` field accepts `member` or `admin`. Only the `owner` can invite with the `admin` role (prevents privilege escalation -- audit fix #8).

**Validation checks (in order):**
1. User must be authenticated
2. Rate limit check
3. Email is required; role must be `member` or `admin`
4. Inviter must be `owner` or `admin`
5. Only `owner` can invite with `admin` role
6. Company must have an active subscription
7. Plan must support team members (Business plan or higher -- Free, Starter, Growth are single-user)
8. Seat limit check: counts current members + pending invitations against `max_seats` from the plan. If the plan allows extra seats (`extra_seat_price` is set), it also checks whether enough extra seats have been purchased.
9. Email must not already belong to an existing team member (409 Conflict)
10. No duplicate pending invitation for the same email (409 Conflict)

**Plan seat limits:**

| Plan | Included Seats | Extra Seat Price |
|------|---------------|-----------------|
| Free | 1 | -- |
| Starter | 1 | -- |
| Growth | 1 | -- |
| Business | 3 | $49/mo |
| Teams | 5 | $49/mo |
| Enterprise | unlimited | -- |

**Response (new user):**

```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "email": "carol@acme.com",
    "role": "member",
    "status": "pending"
  },
  "email_sent": true
}
```

**Response (existing Supabase Auth user):**

```json
{
  "success": true,
  "existing_user": true,
  "invitation": {
    "id": "uuid",
    "email": "carol@acme.com",
    "role": "member",
    "status": "pending"
  },
  "message": "Invitation created for existing user. They can accept it from their Team page."
}
```

**Source file:** `src/app/api/team/invite/route.ts`

---

### POST /api/team/accept-invite

Accepts a team invitation using the invitation token. The authenticated user's email must match the invitation email. Upon acceptance, the user's `company_id` and `role` are updated in the `users` table.

**Authentication:** Required.

**Request body:**

```json
{ "token": "invitation-uuid-token" }
```

**Validation checks:**
1. Token is required
2. Invitation must exist and be in `pending` status
3. Invitation must not be expired (checked against `expires_at`)
4. Authenticated user's email must match invitation email (case-insensitive)
5. User must not already be a member of another company (409 Conflict -- must leave current company first)

**On success:**
- Updates the user's `company_id` and `role` in the `users` table
- Marks the invitation as `accepted` in `team_invitations`
- Redirects to `/home?team_joined=true`

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing token |
| 403 | Email mismatch |
| 404 | Invalid or expired token |
| 409 | User already in another company |
| 410 | Invitation expired |

**Source file:** `src/app/api/team/accept-invite/route.ts`

---

### POST /api/team/cancel-invite

Cancels a pending team invitation. Only `owner` and `admin` roles can cancel invitations.

**Authentication:** Required. Owner or admin role.

**Request body:**

```json
{ "invitationId": "uuid" }
```

**Source file:** `src/app/api/team/cancel-invite/route.ts`

---

### POST /api/team/remove

Removes a team member from the company. The user's row is deleted from the `users` table (their Supabase Auth account remains, allowing them to re-onboard or accept a new invitation).

**Authentication:** Required. Owner or admin role.

**Rate limit:** 3 requests/minute per user.

**Request body:**

```json
{ "userId": "uuid" }
```

**Validation checks:**
1. Cannot remove yourself
2. Only `owner` and `admin` can remove members
3. Target user must be in the same company
4. Cannot remove the `owner`
5. `admin` users cannot remove other `admin` users (only `owner` can)
6. Cannot remove the last member of a company

**Response:**

```json
{ "success": true }
```

**Source file:** `src/app/api/team/remove/route.ts`

---

## Auth Flow Diagram

```
User arrives at /auth/login
        |
        v
  [Email/Password]  or  [OAuth: Google/GitHub]
        |                       |
        v                       v
  supabase.auth.          supabase.auth.
  signInWithPassword()    signInWithOAuth()
        |                       |
        v                       v
  Session cookie set      Redirect to provider
        |                       |
        v                       v
  Redirect to /home       OAuth callback
                                |
                                v
                          Session cookie set
                                |
                                v
                          Redirect to /home
```

The `AuthContext.tsx` provider wraps the application and exposes the current user, loading state, and sign-out function to all components.

---

## Database Tables

| Table | Description |
|-------|-------------|
| `users` | User profiles with `company_id`, `role`, `email`, `full_name`. Protected by RLS + trigger `trg_prevent_sensitive_field_changes` that blocks self-modification of `company_id` and `email`. |
| `team_invitations` | Pending, accepted, expired, and cancelled invitations. Columns: `company_id`, `invited_by`, `email`, `role`, `token` (UUID), `status`, `expires_at`. |
| `companies` | Company records. One-to-many with users. Soft-deletable via `deleted_at`. |

---

## Source Files

- Team routes: `src/app/api/team/`
- Auth utilities: `src/app/api/auth/`
- Auth context: `src/contexts/AuthContext.tsx`
- Edge middleware: `src/middleware.ts`
- Supabase server client: `src/lib/supabase/server.ts`

## Related Notes

- [[User]]
- [[Company]]
- [[Team Invitation]]
- [[Subscription]]
- [[API Overview]]
- [[RLS Patterns]]
