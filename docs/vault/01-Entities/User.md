---
tags: [entity, core, auth, security, database, rls]
aliases: [Team Member, Account, user, users]
created: 2026-03-23
updated: 2026-03-23
---

# User

A User is a person with authenticated access to the Callengo platform. Every User belongs to exactly one [[Company]], and the User's role within that Company determines what they can see and do. The User entity bridges Supabase Auth (the `auth.users` table managed by Supabase) with Callengo's application data model (the `public.users` table). The `id` column in `public.users` is both the primary key and a foreign key referencing `auth.users(id)`, ensuring a 1:1 relationship between authentication identity and application profile.

Users interact with the platform through the Next.js frontend, which reads their profile from the `public.users` table to determine permissions, display preferences, and locale. The User's `role` column governs access control at the UI level (showing/hiding features) and at the database level (RLS policies and security triggers). Two database triggers -- `prevent_role_self_escalation` and `prevent_sensitive_field_changes` -- provide defense-in-depth against privilege escalation attacks, even if application-level validation is bypassed.

---

## Database Table: `users`

The `public.users` table stores application-level profile data for each authenticated user. It extends the Supabase-managed `auth.users` table with Callengo-specific fields.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | — | NOT NULL | Primary key. References `auth.users(id)` with `ON DELETE CASCADE`. When a user is deleted from Supabase Auth (e.g., via the Supabase dashboard or Auth API), their `public.users` row is automatically deleted, which cascades to all related data (notifications, cancellation feedback, retention offer logs, calendar integrations). |
| `company_id` | `UUID` | — | NOT NULL | Foreign key to `companies(id)`. Determines which [[Company]] this user belongs to. Protected by the `prevent_sensitive_field_changes` trigger -- users cannot change their own `company_id` via self-update. Only the `service_role` can modify this field. |
| `email` | `TEXT` | — | NOT NULL, UNIQUE | The user's email address. Must be unique across the entire platform (not just per-company). Protected by the `prevent_sensitive_field_changes` trigger -- email changes must go through Supabase Auth's email change flow, not direct database updates. Used for login, team invitations, and notifications. |
| `full_name` | `TEXT` | — | YES | The user's display name. Shown in the dashboard, team management, and notification attributions. Set during signup or pulled from OAuth provider profile (Google, GitHub). |
| `role` | `TEXT` | `'member'` | NOT NULL | The user's role within their company. Determines permissions for billing, team management, admin access, and data modification. Protected by the `prevent_role_self_escalation` trigger -- no user can change their own role. Only the `service_role` can modify roles. Valid values: `'owner'`, `'admin'`, `'member'`, `'invited_member'`. See the Roles section below. |
| `currency` | `VARCHAR(3)` | `'USD'` | NOT NULL | The user's preferred display currency for billing and pricing. Auto-detected from geolocation during first login. Supported values include `'USD'`, `'EUR'`, `'GBP'`. Note: exchange rates are currently hardcoded (known bug -- see [[Architecture Overview]]). |
| `country_code` | `VARCHAR(2)` | — | YES | ISO 3166-1 alpha-2 country code (e.g., `'US'`, `'DE'`, `'FR'`). Auto-detected via the `useAutoGeolocation` hook on first login. Used for i18n language detection and currency defaults. |
| `country_name` | `VARCHAR(100)` | — | YES | Full country name (e.g., `'United States'`, `'Germany'`). Stored for display purposes alongside `country_code`. |
| `city` | `VARCHAR(100)` | — | YES | The user's detected city (e.g., `'San Francisco'`, `'Berlin'`). Used for timezone inference and analytics. |
| `region` | `VARCHAR(100)` | — | YES | The user's detected region/state (e.g., `'California'`, `'Bavaria'`). Stored alongside `city` for more precise location data. |
| `timezone` | `VARCHAR(50)` | — | YES | IANA timezone identifier (e.g., `'America/Los_Angeles'`, `'Europe/Berlin'`). Auto-detected from geolocation. Used for scheduling campaigns in the user's local time and displaying timestamps correctly in the UI. |
| `ip_address` | `VARCHAR(45)` | — | YES | The user's last detected IP address. Supports both IPv4 (max 15 chars) and IPv6 (max 45 chars). Stored for security auditing and geolocation accuracy. Updated on each login. |
| `location_logs` | `JSONB` | — | YES | A JSONB array containing historical location data points. Each entry records a timestamp, IP address, country, city, and region. Used to detect unusual login patterns (e.g., logins from a new country) and for compliance auditing. Example structure: `[{"timestamp": "2026-03-23T10:00:00Z", "ip": "1.2.3.4", "country": "US", "city": "San Francisco"}]`. |
| `location_updated_at` | `TIMESTAMPTZ` | — | YES | Timestamp of the last geolocation update. The `useAutoGeolocation` hook checks this timestamp and only re-detects location if it is older than a configurable threshold (currently 24 hours), avoiding unnecessary API calls. |
| `fav_voices` | `JSONB` | — | YES | A JSONB array of Bland AI voice IDs that the user has marked as favorites. These appear at the top of the voice selection dropdown in the [[Agent]] configuration modal, making it faster to find preferred voices across the 51-voice catalog. See [[Voice Catalog]]. Example: `["2f9fdbc7-4bf2-4792-8a18-21ce3c93978f", "37b3f1c8-a01e-4d70-b251-294733f08371"]`. |
| `notifications_enabled` | `BOOLEAN` | `true` | NOT NULL | Whether the user wants to receive in-app notifications. When `false`, the notification bell icon is hidden and no [[Notification]] records are displayed, though they are still created by database triggers (campaign completion, high failure rate, usage warnings). |
| `created_at` | `TIMESTAMPTZ` | `now()` | NOT NULL | Timestamp of when the user record was created. Set once during signup/onboarding. |
| `updated_at` | `TIMESTAMPTZ` | `now()` | NOT NULL | Timestamp of the last modification. Updated by application code on profile changes. |

### Indexes on `users`

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| `users_pkey` | `id` | B-tree (PK) | Primary key lookup |
| `users_email_key` | `email` | B-tree (UNIQUE) | Enforces email uniqueness across the platform and enables fast email-based lookups during login, team invitation acceptance, and duplicate detection |
| `idx_users_company_id` | `company_id` | B-tree | Fast lookup of all users belonging to a company. Used extensively in RLS subqueries (`SELECT company_id FROM public.users WHERE id = auth.uid()`) that appear in nearly every RLS policy across the system. This index is performance-critical because these subqueries execute on every single database operation. |

### RLS Policies on `users`

Row Level Security is enabled on the `users` table. The policies enforce strict self-only access:

| Policy Name | Operation | USING / WITH CHECK | Description |
|-------------|-----------|-------------------|-------------|
| `users_select` | SELECT | `id = (select auth.uid())` | Users can only read their own row. They cannot see other team members' rows directly via the `users` table. Team member listings are provided through separate API endpoints that use the `service_role` to query across users within the same company. |
| `users_insert` | INSERT | `id = (select auth.uid())` | Users can only insert a row with their own `auth.uid()` as the `id`. This is used during the onboarding flow when the user's `public.users` profile is created. The `WITH CHECK` ensures no one can create a user record for someone else. |
| `users_update` | UPDATE | USING: `id = (select auth.uid())`, WITH CHECK: `id = (select auth.uid())` | Users can only update their own row. The dual USING + WITH CHECK ensures that (a) you can only modify your own row, and (b) you cannot change the `id` to hijack someone else's row. However, this policy alone does not prevent self-escalation of `role` or `company_id` -- that is handled by the security triggers below. |

**Important:** There is no DELETE policy on the `users` table for authenticated users. User deletion is handled exclusively through the Supabase Auth API (which cascades to `public.users` via the foreign key), or through the `service_role`.

---

## Roles

The `role` column defines the user's permissions within their [[Company]]. Roles are hierarchical:

### `owner`

The company owner is the user who created the company during onboarding. There is exactly one owner per company.

- **Full platform access:** Can use all features including agents, campaigns, contacts, analytics, reports, and integrations.
- **Billing management:** Full access to subscription management, plan changes, add-on purchases, payment method updates, and invoice history via the Settings billing tab.
- **Team management:** Can invite new team members, change member roles (via `service_role` API), and remove members.
- **Admin panel:** Has access to the [[Command Center]] at `/admin/command-center` (added in the March 2026 audit -- previously only `admin` role had access).
- **Subscription modification:** The `company_subscriptions` UPDATE RLS policy requires the user to have `owner` or `admin` role.
- **Account deletion:** Only the owner can initiate company soft-delete.

### `admin`

Administrators have nearly the same access as owners, with the exception that they did not create the company and cannot delete the company account.

- **Full platform access:** Same as owner.
- **Billing management:** Same as owner -- can manage subscriptions, add-ons, and payment methods.
- **Team management:** Can invite members, change roles, and remove members.
- **Admin panel:** Has access to the [[Command Center]].
- **Subscription modification:** Can modify `company_subscriptions` via RLS.

### `member`

Regular team members with standard operational access.

- **Operational access:** Can create and manage agents, contacts, campaigns, and calls.
- **No billing access:** Cannot view or modify subscription, payment methods, or invoices. The billing tab in Settings is hidden.
- **No team management:** Cannot invite new members or change roles. The team management page is read-only.
- **No admin panel:** Cannot access the [[Command Center]].
- **No subscription modification:** The `company_subscriptions` UPDATE RLS policy blocks modifications from `member` role users.

### `invited_member`

A transitional state for users who have been invited to join a company but have not yet accepted the invitation.

- **Pre-acceptance state:** The user has been invited via [[Team Invitation]] but has not completed the signup/acceptance flow.
- **No platform access:** Cannot access any application features until the invitation is accepted and the role is upgraded to `member` by the system.
- **Automatic promotion:** When the user accepts the invitation (clicks the link in the email and signs up), the `service_role` updates their role from `invited_member` to `member`.

---

## Security Triggers

Two database triggers on the `users` table provide defense-in-depth against privilege escalation, even if application-level validation is bypassed or an attacker finds a way to issue direct SQL updates through the authenticated Supabase client.

### 1. `trg_prevent_role_self_escalation`

**Function:** `prevent_role_self_escalation()`
**Trigger:** `BEFORE UPDATE ON users FOR EACH ROW`
**Migration:** `20260323000001_security_and_production_fixes.sql`
**Language:** PL/pgSQL, `SECURITY DEFINER`, `SET search_path = public`

This trigger prevents any authenticated user from changing their own `role` column. Without this trigger, the `users_update` RLS policy (which only checks `id = auth.uid()`) would allow a user to execute `UPDATE users SET role = 'admin' WHERE id = auth.uid()` and escalate their own privileges.

**Logic:**
1. If the current JWT claim is `service_role`, allow the update (service role can change any user's role).
2. If `OLD.role IS DISTINCT FROM NEW.role`, raise an exception: `'Role changes are not allowed. Contact your administrator.'`
3. Otherwise, allow the update to proceed.

This means role changes can only be performed by:
- The Supabase service role (used by API routes like `/api/team/update-role`)
- Direct database access via the Supabase dashboard

### 2. `trg_prevent_sensitive_field_changes`

**Function:** `prevent_sensitive_field_changes()`
**Trigger:** `BEFORE UPDATE ON users FOR EACH ROW`
**Migration:** `20260323000002_production_audit_fixes.sql`
**Language:** PL/pgSQL, `SECURITY DEFINER`, `SET search_path = public`

This trigger prevents users from changing their own `company_id` or `email` columns via self-update. Without this trigger, a malicious user could:
- Change their `company_id` to another company's ID, gaining access to that company's data through RLS policies that check `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())`.
- Change their `email` to bypass email-based access controls.

**Logic:**
1. Only applies to self-updates: `IF NEW.id = auth.uid() THEN`.
2. If `OLD.company_id IS DISTINCT FROM NEW.company_id`, raise: `'Users cannot change their own company_id'`.
3. If `OLD.email IS DISTINCT FROM NEW.email`, raise: `'Users cannot change their own email directly'`.
4. Non-self-updates (service role updating another user's row) are allowed.

**Important:** Email changes must go through the Supabase Auth email change flow, which updates `auth.users.email` and can trigger a sync to `public.users.email` via a Supabase function or application logic.

---

## Geolocation Auto-Detection

Callengo automatically detects each user's geographic location to provide locale-appropriate defaults. This is implemented via the `useAutoGeolocation` custom React hook at `src/hooks/useAutoGeolocation.ts`.

### Detection Flow

1. On first login (or when `location_updated_at` is older than 24 hours), the hook runs.
2. The hook calls a geolocation API (IP-based) to determine the user's country, city, region, timezone, and IP address.
3. The detected values are written to the `users` table columns: `country_code`, `country_name`, `city`, `region`, `timezone`, `ip_address`.
4. The previous location is appended to the `location_logs` JSONB array for historical tracking.
5. `location_updated_at` is set to `now()`.

### Usage of Geolocation Data

| Field | Used For |
|-------|----------|
| `country_code` | i18n language detection. If the user's country maps to a supported language (7 languages: en, es, fr, de, it, nl, pt), the UI automatically switches to that language. |
| `timezone` | Default timezone for campaign scheduling. When creating a campaign, the calendar working hours default to the user's timezone. |
| `currency` | Default display currency for pricing and billing. Auto-set based on country (US/CA -> USD, EU countries -> EUR, UK -> GBP). |
| `location_logs` | Security auditing. If a user suddenly logs in from a different country, this can be flagged (not yet implemented as an automated alert, but the data is available). |
| `ip_address` | Rate limiting context (when implemented) and security auditing. |

---

## Team Management Workflow

### Inviting a New Member

1. An `owner` or `admin` navigates to `/team` and enters an email address to invite.
2. The system creates a [[Team Invitation]] record with `status = 'pending'`.
3. An invitation email is sent to the invitee.
4. If the invitee does not have a Callengo account:
   - They click the invitation link and are redirected to the signup page.
   - After signup, their `public.users` row is created with `role = 'invited_member'`.
   - The invitation acceptance flow (via `service_role`) updates their role to `member` and sets their `company_id`.
5. If the invitee already has a Callengo account (in a different company), they cannot accept -- users can only belong to one company.

### Changing a Member's Role

1. An `owner` or `admin` uses the team management UI to change a member's role.
2. The UI calls `POST /api/team/update-role` which uses `createServerSupabaseClient()` with service role credentials.
3. The service role bypasses the `prevent_role_self_escalation` trigger (which only blocks changes by the user themselves).
4. The update is applied directly.

### Removing a Member

1. An `owner` or `admin` removes a member via the team management UI.
2. The system can either:
   - Delete the user's auth account (cascades to `public.users`), or
   - Keep the auth account but unlink them from the company (application-level logic).

---

## Plan-Based User Limits

The number of users allowed per company is determined by the [[Subscription]] plan:

| Plan | Max Users | Extra Seat |
|------|----------|------------|
| Free | 1 | Not available |
| Starter | 1 | Not available |
| Growth | 1 | Not available |
| Business | 3 | $49/mo per additional seat |
| Teams | 5 | $49/mo per additional seat |
| Enterprise | Unlimited | Included |

These limits are enforced at the application level when processing team invitations. The system checks the current user count against the plan's limit before allowing a new invitation to be created.

---

## Source Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | TypeScript interface for `User` |
| `src/contexts/AuthContext.tsx` | React context providing current user data, role, and company throughout the app |
| `src/hooks/useAutoGeolocation.ts` | Custom hook for automatic geolocation detection |
| `src/app/(app)/team/page.tsx` | Team management page |
| `src/app/api/team/` | Team API endpoints (invite, update-role, remove) |
| `src/middleware.ts` | Edge middleware that protects authenticated routes |
| `supabase/migrations/20260103000002_add_user_geolocation.sql` | Added geolocation columns |
| `supabase/migrations/20260104000001_add_fav_voices.sql` | Added `fav_voices` JSONB column |
| `supabase/migrations/add_notifications_system.sql` | Added `notifications_enabled` column |
| `supabase/migrations/20260322000001_comprehensive_db_cleanup.sql` | Consolidated RLS policies |
| `supabase/migrations/20260323000001_security_and_production_fixes.sql` | `prevent_role_self_escalation` trigger |
| `supabase/migrations/20260323000002_production_audit_fixes.sql` | `prevent_sensitive_field_changes` trigger |

---

## Related Notes

- [[Company]] -- The organization this user belongs to
- [[Team Invitation]] -- Mechanism for adding new users to a company
- [[Notification]] -- In-app notifications delivered to users
- [[RLS Patterns]] -- Row Level Security patterns, including the `users` table policies
- [[Triggers & Functions]] -- Database triggers including the two security triggers on this table
- [[Auth API]] -- Authentication endpoints (login, signup, OAuth callbacks)
- [[Onboarding Flow]] -- User and company creation workflow
- [[Plan Features]] -- Per-plan user limits and feature access
