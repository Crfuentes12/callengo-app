---
tags: [database, security, rls, supabase]
aliases: [Row Level Security, RLS]
---

# RLS Patterns

All user-facing tables in Callengo use PostgreSQL Row Level Security (RLS) to enforce multi-tenant data isolation at the database level. This means that even if application code has a bug that omits a WHERE clause, the database will prevent cross-tenant data leaks. Five distinct patterns are used consistently across the 56-table schema.

---

## Pattern 1: Company-Scoped Access

The most common pattern, applied to the vast majority of tables. Users can only access rows where `company_id` matches their own company. The same SQL expression is used for both the USING clause (read/update/delete) and WITH CHECK clause (insert/update).

```sql
CREATE POLICY "table_all" ON table_name
FOR ALL
USING (company_id IN (
  SELECT users.company_id FROM users WHERE users.id = (SELECT auth.uid())
))
WITH CHECK (company_id IN (
  SELECT users.company_id FROM users WHERE users.id = (SELECT auth.uid())
));
```

**Applied to (32+ tables):**

| Category | Tables |
|----------|--------|
| **Core** | `contacts`, `contact_lists`, `company_agents`, `company_settings`, `agent_runs` |
| **Calls** | `call_logs`, `call_queue`, `campaign_queue`, `follow_up_queue` |
| **Calendar** | `calendar_events`, `calendar_integrations`, `team_calendar_assignments` |
| **CRM** | `hubspot_integrations`, `hubspot_contact_mappings`, `hubspot_sync_logs`, `pipedrive_*`, `zoho_*`, `dynamics_*`, `clio_*`, `simplybook_*` |
| **Sheets** | `google_sheets_integrations`, `google_sheets_linked_sheets` |
| **Webhooks** | `webhook_endpoints` |

---

## Pattern 2: Service Role Bypass

Allows API routes using the Supabase service role key to bypass RLS entirely. This is essential for webhook processing, background jobs, and admin operations where there is no authenticated user context.

```sql
CREATE POLICY "table_service" ON table_name
FOR ALL
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');
```

**Applied to (12+ tables):** `call_logs`, `contacts`, `contact_lists`, `company_agents`, `agent_runs`, `company_settings`, `company_addons`, `salesforce_integrations`, `salesforce_contact_mappings`, `salesforce_sync_logs`, `stripe_events`, `admin_audit_log` (INSERT only).

---

## Pattern 3: User Self-Access

Users can only read and modify their own record. No access to other users' data, even within the same company (for the users table).

```sql
CREATE POLICY "users_select" ON users FOR SELECT
USING (id = (SELECT auth.uid()));

CREATE POLICY "users_update" ON users FOR UPDATE
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (id = (SELECT auth.uid()));
```

**Applied to:** `users` (all operations), `ai_conversations` (via `user_id = auth.uid()`), `integration_feedback` (SELECT by user_id).

---

## Pattern 4: Admin/Owner Only

Restricts access to users with `admin` or `owner` roles. Used for platform administration tables.

```sql
CREATE POLICY "admin_table_all" ON table_name
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users
  WHERE users.id = (SELECT auth.uid())
  AND users.role IN ('admin', 'owner')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users
  WHERE users.id = (SELECT auth.uid())
  AND users.role IN ('admin', 'owner')
));
```

**Applied to:** `admin_platform_config`, `admin_audit_log` (SELECT only), `admin_finances`.

---

## Pattern 5: Role-Based Write Restrictions

Some tables have different permissions for read vs write. Company members can SELECT, but only specific roles can INSERT/UPDATE/DELETE.

### Team Invitations

Anyone in the company can view invitations, but only admin/owner can create, update, or delete them:

```sql
-- SELECT: all company members
CREATE POLICY "team_invitations_select" ON team_invitations FOR SELECT
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));

-- INSERT/UPDATE/DELETE: admin/owner only
CREATE POLICY "team_invitations_insert" ON team_invitations FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM users
  WHERE id = auth.uid() AND role IN ('owner', 'admin')
));
```

### Company Subscriptions

All company members can view the subscription, but only the owner/admin can modify it (enforced since the March 2026 audit):

- `company_subscriptions_select` — Company-scoped SELECT
- `company_subscriptions_update` — Company-scoped UPDATE (owner/admin only)

### Read-Only Tables

Some tables are SELECT-only for authenticated users:

| Table | SELECT Policy | Write |
|-------|-------------|-------|
| `subscription_plans` | `WHERE is_active = true` | None (managed by migrations) |
| `agent_templates` | `WHERE is_active = true` | None (managed by migrations) |
| `cancellation_feedback` | Company-scoped | INSERT by company members |
| `retention_offers` | Company-scoped | None |
| `retention_offer_log` | Company-scoped | None |
| `usage_tracking` | Company-scoped | None (managed by service role) |
| `billing_history` | Company-scoped | None |
| `billing_events` | Company-scoped | None |

---

## Security Triggers (Beyond RLS)

RLS controls data access. These triggers add additional protection at the row mutation level:

| Trigger | Table | Protection | Type |
|---------|-------|-----------|------|
| `trg_prevent_role_self_escalation` | `users` | Users cannot change their own `role` field | `SECURITY DEFINER` |
| `prevent_sensitive_field_changes` | `users` | Users cannot change their own `company_id` or `email` | `SECURITY DEFINER` |
| `trg_check_max_dedicated_numbers` | `company_addons` | Enforces maximum 3 dedicated numbers per company | BEFORE INSERT/UPDATE |

These triggers run with elevated privileges (`SECURITY DEFINER`) to ensure they can't be bypassed by the calling user.

---

## Soft-Delete Protection

The `companies` table implements soft-delete with additional RLS considerations:

1. **Column:** `deleted_at TIMESTAMPTZ` — When set, the company is soft-deleted
2. **RLS behavior:** The `companies_select` policy includes `(SELECT auth.role()) = 'service_role'` for admin access
3. **Recovery window:** 30 days — after which the company can be permanently deleted
4. **Partial index:** `WHERE deleted_at IS NULL` — Optimizes queries for active companies
5. **Cascading effect:** Soft-deleted companies are excluded from user login flows, effectively locking out all company members

---

## RLS Statistics

| Metric | Count |
|--------|-------|
| Total RLS policies | 95+ |
| Tables with company-scoped access | 32+ |
| Tables with service role bypass | 12+ |
| Tables with admin/owner restriction | 3 |
| Tables with role-based write | 4 |
| Security triggers | 3 |

---

## Related Notes

- [[Schema Overview]] — Complete table listing
- [[User]] — User roles and self-access policies
- [[Company]] — Company-level tenant isolation
- [[Security & Encryption]] — Comprehensive security documentation
- [[Triggers & Functions]] — Database triggers and functions
