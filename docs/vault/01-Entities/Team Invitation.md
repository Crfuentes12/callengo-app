---
tags: [entity, team, auth, rbac]
aliases: [Team Invite, Invitation, Seat Management]
created: 2026-02-26
updated: 2026-03-23
---

# Team Invitation

Invitation records that enable [[Company]] owners and admins to invite new members to their team. The invitation system supports role-based access control (RBAC), seat limits enforced by plan tier, email-based onboarding via Supabase Auth, and token-based acceptance with a 7-day expiration window.

Team invitations are only available on multi-seat plans (Business and above). Free, Starter, and Growth plans are single-user and do not support team invitations.

---

## Database Table: `team_invitations`

Created in migration `20260226000002_fix_warnings_and_team_invitations.sql`. The status CHECK constraint was tightened in `20260323000002_production_audit_fixes.sql` to add `declined` and `revoked` statuses (replacing the original `cancelled`).

### Full Column Specification

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NOT NULL | Primary key. |
| `company_id` | `UUID` | -- | NOT NULL | Foreign key to `companies(id)` with `ON DELETE CASCADE`. The company the invitee will join upon acceptance. |
| `invited_by` | `UUID` | -- | NOT NULL | Foreign key to `users(id)` with `ON DELETE CASCADE`. The user who created the invitation. Must have `owner` or `admin` role. If the inviting user is deleted, their invitations are cascade-deleted. |
| `email` | `TEXT` | -- | NOT NULL | The email address of the person being invited. Stored in lowercase (normalized by the API). Checked against existing `users.email` to prevent inviting someone who is already a team member. |
| `role` | `TEXT` | `'member'` | NOT NULL | The role the invitee will receive upon joining. CHECK constraint limits to `'member'` or `'admin'`. Privilege escalation prevention: only users with `owner` role can invite with `role = 'admin'`; `admin` users can only invite with `role = 'member'`. |
| `status` | `TEXT` | `'pending'` | NOT NULL | Lifecycle state of the invitation. See status transitions below. |
| `token` | `UUID` | `gen_random_uuid()` | NOT NULL | A cryptographically random token used in the acceptance URL. Generated automatically by PostgreSQL. Included in the Supabase Auth invitation email as a query parameter: `?invite_token={token}&type=team_invite`. |
| `expires_at` | `TIMESTAMPTZ` | `NOW() + INTERVAL '7 days'` | NOT NULL | Expiration timestamp. The `accept-invite` endpoint checks `expires_at < NOW()` and returns HTTP 410 (Gone) if expired, also transitioning the status to `'expired'`. |
| `accepted_at` | `TIMESTAMPTZ` | `NULL` | YES | Timestamp when the invitation was accepted. Set by the `accept-invite` endpoint upon successful acceptance. Remains `NULL` for non-accepted invitations. |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | Last modification timestamp. Automatically updated by the `update_team_invitations_updated_at` trigger. |

### Status Transitions

```
pending ──> accepted    (invitee accepts via token)
pending ──> expired     (expires_at passes; detected on accept attempt)
pending ──> cancelled   (inviter or admin cancels via cancel-invite endpoint)
pending ──> declined    (invitee explicitly declines)
pending ──> revoked     (admin revokes the invitation)
```

Note: The original migration defined statuses as `pending`, `accepted`, `expired`, `cancelled`. The production audit migration `20260323000002` replaced the CHECK constraint with:
```sql
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked'))
```
This replaced `cancelled` with `declined` and `revoked` to distinguish between invitee-initiated rejection and admin-initiated revocation.

### Constraints

| Constraint | Type | Expression | Description |
|-----------|------|------------|-------------|
| `team_invitations_pkey` | PRIMARY KEY | `id` | UUID primary key. |
| (inline CHECK) | CHECK | `role IN ('member', 'admin')` | Only valid roles. The `owner` role cannot be assigned via invitation. |
| `chk_team_invitation_status` | CHECK | `status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')` | Valid status values. Added in `20260323000002`. |
| (inline UNIQUE) | UNIQUE | `(company_id, email, status)` | Prevents duplicate invitations with the same status for the same company-email pair. This allows re-inviting an email that previously had an `expired` or `declined` invitation, since those have different status values. However, it means only one `pending` invitation can exist per company-email combination. |

### Indexes

| Index Name | Columns | Type | Partial | Notes |
|------------|---------|------|---------|-------|
| `team_invitations_pkey` | `id` | PRIMARY KEY | No | Default UUID PK index. |
| `idx_team_invitations_company` | `company_id` | B-tree | No | Lists all invitations for a company. Used in the Team page UI and the seat-counting query. |
| `idx_team_invitations_email` | `email` | B-tree | No | Lookup invitations by email. Used when checking for existing invitations to the same address and during the accept flow. |
| `idx_team_invitations_token` | `token` | B-tree | No | Fast token-based lookup during the acceptance flow. The `accept-invite` endpoint queries by `token = :token AND status = 'pending'`. |
| `idx_team_invitations_status` | `status` | B-tree | `WHERE status = 'pending'` | Partial index covering only pending invitations. Optimizes the seat-counting query that sums pending invitations against the plan's seat limit. |
| (UNIQUE index) | `(company_id, email, status)` | UNIQUE | No | Implicitly created by the UNIQUE constraint. |

### Foreign Key Relationships

| Column | References | On Delete | Purpose |
|--------|-----------|-----------|---------|
| `company_id` | `companies(id)` | `CASCADE` | When a company is deleted, all its invitations are removed. |
| `invited_by` | `users(id)` | `CASCADE` | When the inviting user is deleted, their invitations are cascade-deleted. This prevents orphaned invitations from counting against seat limits. |

### Triggers

| Trigger Name | Event | Function | Description |
|-------------|-------|----------|-------------|
| `update_team_invitations_updated_at` | `BEFORE UPDATE` | `update_updated_at_column()` | Automatically sets `updated_at = NOW()` on every row update. Uses the shared `update_updated_at_column()` function (with `SET search_path = public`). |

### Row Level Security

RLS is enabled on `team_invitations`.

| Policy Name | Operation | Rule | Description |
|-------------|-----------|------|-------------|
| `Company members can view invitations` | `SELECT` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())` | Any authenticated user in the company can see all invitations. This allows the Team page to display pending and past invitations to all members, not just admins. |
| `Company admins can create invitations` | `INSERT` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))` | Only owners and admins can create new invitations. Regular members cannot invite. |
| `Company admins can update invitations` | `UPDATE` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))` | Only owners and admins can update invitation status (cancel, revoke). The `accept-invite` endpoint uses the service role client to bypass this restriction, since the accepting user is not yet a member of the company. |
| `Company admins can delete invitations` | `DELETE` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))` | Only owners and admins can hard-delete invitation records. |

### Grants

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON team_invitations TO authenticated;
```

---

## Seat Limits by Plan

Seat limits are enforced by the `max_seats` column on `subscription_plans` (added in migration `20260226000002`) and updated to V4 values in migration `20260306000001`.

| Plan | `max_seats` Value | Max Users | Extra Seat Available | Extra Seat Price |
|------|:-:|:-:|:-:|:-:|
| **Free** | 1 | 1 | No | -- |
| **Starter** | 1 | 1 | No | -- |
| **Growth** | 1 | 1 | No | -- |
| **Business** | 3 | 3 | Yes | $49/mo |
| **Teams** | 5 | 5 | Yes | $49/mo |
| **Enterprise** | -1 | Unlimited | N/A (unlimited) | -- |

A value of `-1` for `max_seats` means unlimited users; the enforcement logic in the invite endpoint skips the seat check entirely for these plans.

### Extra Seats

Business and Teams plans can purchase additional seats beyond the included `max_seats` via `POST /api/billing/seat-checkout`. Each extra seat costs $49/month (V4 pricing, unified for both plans; the earlier V3 pricing had $79 for Teams). Extra seats are tracked on `company_subscriptions.extra_users` (INTEGER, default 0) and incremented atomically via optimistic locking in the Stripe webhook handler to prevent race conditions when two seat purchases happen concurrently.

The effective seat limit is: `max_seats + extra_users`.

---

## Invitation Flow

### Creating an Invitation (`POST /api/team/invite`)

1. **Authentication:** Validates the requesting user via Supabase Auth.
2. **Rate limiting:** 3 requests per minute per user via `expensiveLimiter`.
3. **Input validation:** Requires `email`; `role` defaults to `'member'`. Role must be `'member'` or `'admin'`.
4. **Privilege escalation prevention:** If `role = 'admin'`, the inviter must be an `owner`. Admin users can only invite members, not other admins. This prevents privilege escalation where an admin could create another admin.
5. **Plan check:** Rejects invitations on Free, Starter, and Growth plans (single-user plans).
6. **Seat count:** Counts current `users` in the company plus pending `team_invitations`. If `totalSeats >= max_seats + extra_users`, returns HTTP 403 with a message to purchase additional seats.
7. **Duplicate check:** Verifies the email is not already a member (`users` table) and does not have a pending invitation (`team_invitations` table).
8. **Record creation:** Inserts the invitation row via `supabaseAdminRaw` (service role, bypasses RLS since the `token` is auto-generated by PostgreSQL default).
9. **Email delivery:** Calls `supabaseAdmin.auth.admin.inviteUserByEmail()` to send the invitation email. The redirect URL includes the invitation token: `{appUrl}/auth/callback?invite_token={token}&type=team_invite`. If the user already has a Supabase Auth account, the email delivery fails gracefully and the API returns `existing_user: true`, indicating the user can accept from their Team page.

### Accepting an Invitation (`POST /api/team/accept-invite`)

1. **Authentication:** The accepting user must be authenticated.
2. **Token lookup:** Finds the invitation by `token` with `status = 'pending'`.
3. **Expiration check:** If `expires_at < NOW()`, updates status to `'expired'` and returns HTTP 410.
4. **Email match:** The authenticated user's email must match `invitation.email` (case-insensitive).
5. **Company conflict:** If the user already belongs to a different company, returns HTTP 409.
6. **User update:** Sets `users.company_id = invitation.company_id` and `users.role = invitation.role` via service role client (bypasses the `trg_prevent_sensitive_field_changes` trigger which only blocks self-updates via `auth.uid()`).
7. **Invitation update:** Sets `status = 'accepted'` and `accepted_at = NOW()`.
8. **Response:** Returns `company_id`, `company_name`, and `role`. The frontend redirects to `/home?team_joined=true`.

### Canceling an Invitation (`POST /api/team/cancel-invite`)

Available to owners and admins. Updates the invitation status to `'cancelled'` (or `'revoked'` depending on the actor).

### Removing a Team Member (`POST /api/team/remove`)

Separate from the invitation system. Removes a user from the company by clearing their `company_id` and resetting their role.

---

## API Endpoints

| Endpoint | Method | Auth Required | Role Required | Description |
|----------|--------|:-:|:-:|-------------|
| `/api/team/invite` | `POST` | Yes | `owner` or `admin` | Create a new team invitation. |
| `/api/team/accept-invite` | `POST` | Yes | Any | Accept an invitation by token. |
| `/api/team/cancel-invite` | `POST` | Yes | `owner` or `admin` | Cancel a pending invitation. |
| `/api/team/members` | `GET` | Yes | Any | List all team members and pending invitations. |
| `/api/team/remove` | `POST` | Yes | `owner` or `admin` | Remove a team member from the company. |

---

## Source Code References

| File | Purpose |
|------|---------|
| `src/app/api/team/invite/route.ts` | Invitation creation with plan checks, seat counting, privilege escalation prevention, and Supabase Auth email delivery. |
| `src/app/api/team/accept-invite/route.ts` | Token-based acceptance with expiration, email match, and company conflict checks. |
| `src/app/api/team/cancel-invite/route.ts` | Invitation cancellation. |
| `src/app/api/team/members/route.ts` | Team member listing with pending invitation counts. |
| `src/app/api/team/remove/route.ts` | Team member removal. |
| `src/app/api/billing/seat-checkout/route.ts` | Stripe Checkout for purchasing extra seats. |
| `src/config/plan-features.ts` | Plan tier definitions referenced during seat limit enforcement. |
| `supabase/migrations/20260226000002_fix_warnings_and_team_invitations.sql` | Table creation, indexes, RLS, triggers, and subscription_plans seat columns. |
| `supabase/migrations/20260306000001_v4_pricing_subaccounts_addons.sql` | Updated `max_users` and `extra_seat_price` to V4 values ($49 unified). |
| `supabase/migrations/20260323000002_production_audit_fixes.sql` | `chk_team_invitation_status` CHECK constraint with expanded status values. |

---

## Related Notes

- [[Company]] -- The entity that team members belong to; `company_id` is the scoping key
- [[User]] -- Invited users join by having their `company_id` and `role` set on the `users` table
- [[Subscription]] -- Plan tier determines seat limits (`max_seats`), extra seat availability (`extra_seat_price`), and whether team invitations are allowed at all
- [[Pricing Model]] -- Seat pricing: $49/mo per extra seat on Business and Teams plans
- [[Notification]] -- `team_member_joined` notification type created when an invitation is accepted
