---
tags: [entity, billing, stripe, bland-ai]
aliases: [Company Addon, Addon, Dedicated Number, Recording Vault, Calls Booster]
created: 2026-03-06
updated: 2026-03-23
---

# Add-on

Optional paid extras that companies can attach to their [[Subscription]]. Add-ons are individually billed through [[Stripe Integration]] as separate subscription items and tracked in the `company_addons` table. They require an active paid plan (Starter or above); Free-tier companies cannot purchase any add-on.

Callengo offers three add-on products, each addressing a distinct operational need: dedicated phone numbers for branded caller ID, extended recording storage beyond the default 30-day window, and stackable minute boosters for teams that burst beyond their plan allowance.

---

## Database Table: `company_addons`

Created in migration `20260306000001_v4_pricing_subaccounts_addons.sql`. The `number_label` column was added later in `20260321000001_single_apikey_architecture.sql`. A CHECK constraint on `addon_type` was tightened in `20260323000002_production_audit_fixes.sql`.

### Full Column Specification

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NOT NULL | Primary key. |
| `company_id` | `UUID` | -- | NOT NULL | Foreign key to `companies(id)` with `ON DELETE CASCADE`. Links the add-on to the owning [[Company]]. |
| `addon_type` | `TEXT` | -- | NOT NULL | One of three valid types: `dedicated_number`, `recording_vault`, `calls_booster`. Enforced by CHECK constraint `chk_addon_type`. |
| `stripe_subscription_item_id` | `TEXT` | `NULL` | YES | The Stripe `si_xxx` identifier linking this add-on to its recurring billing item inside the customer's Stripe subscription. Set when the Stripe webhook `checkout.session.completed` fires with `is_addon: 'true'` in metadata. |
| `stripe_price_id` | `TEXT` | `NULL` | YES | The Stripe `price_xxx` identifier used during checkout. Looked up dynamically from Stripe products filtered by `addon_type` metadata on the product. |
| `quantity` | `INTEGER` | `1` | NOT NULL | Number of units. For Calls Booster this can be greater than 1 when stacking multiple boosters. For Dedicated Number and Recording Vault it is always 1 per row. |
| `status` | `TEXT` | `'active'` | NOT NULL | Lifecycle state. CHECK constraint limits to: `active`, `canceled`, `past_due`. Transitions: `active` -> `canceled` on release or Stripe cancellation; `active` -> `past_due` on payment failure. |
| `current_period_start` | `TIMESTAMPTZ` | `NULL` | YES | Start of the current billing period for this add-on, synced from Stripe subscription data. |
| `current_period_end` | `TIMESTAMPTZ` | `NULL` | YES | End of the current billing period. After this date, the add-on auto-renews or expires based on Stripe subscription status. |
| `dedicated_phone_number` | `TEXT` | `NULL` | YES | The full E.164 phone number (e.g., `+14155551234`). Only populated when `addon_type = 'dedicated_number'`. Used as the `from` field when dispatching calls through [[Bland AI]]. |
| `bland_number_id` | `TEXT` | `NULL` | YES | The identifier returned by Bland AI's `/numbers/purchase` endpoint. Used to release the number back to Bland when the add-on is canceled. Only populated for `dedicated_number` type. |
| `recording_retention_months` | `INTEGER` | `1` | YES | Number of months recordings are retained. Default is 1 (30 days). When `addon_type = 'recording_vault'`, this is set to 12 months (extended retention). |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last modification timestamp. No automatic trigger exists on this table for `updated_at`; updates are handled application-side. |
| `number_label` | `TEXT` | `NULL` | YES | Optional human-readable label for a dedicated number, such as "Sales Line" or "Support". Added in migration `20260321000001`. Displayed in the billing UI and used in `getCompanyNumbers()` to identify numbers. |

### Indexes

| Index Name | Columns | Type | Notes |
|------------|---------|------|-------|
| `company_addons_pkey` | `id` | PRIMARY KEY | Default UUID PK index. |
| `idx_company_addons_company_id` | `company_id` | B-tree | Fast lookup of all add-ons belonging to a company. Used by `getCompanyNumbers()`, `getCompanyNumberCount()`, and the billing settings UI. |
| `idx_company_addons_type` | `addon_type` | B-tree | Filter add-ons by type across all companies. Used in admin Command Center for add-on revenue aggregation. |
| `idx_company_addons_status` | `status` | B-tree | Filter by lifecycle state. Useful for finding all active add-ons or all past-due add-ons requiring attention. |

### Foreign Key Relationships

| Column | References | On Delete | Purpose |
|--------|-----------|-----------|---------|
| `company_id` | `companies(id)` | `CASCADE` | When a company is hard-deleted, all its add-ons are removed. Soft-deleted companies (via `deleted_at`) retain their add-on rows but are excluded from normal queries by RLS. |

### CHECK Constraints

| Constraint Name | Expression | Migration |
|----------------|------------|-----------|
| (inline on CREATE) | `addon_type IN ('dedicated_number', 'recording_vault', 'calls_booster')` | `20260306000001` |
| (inline on CREATE) | `status IN ('active', 'canceled', 'past_due')` | `20260306000001` |
| `chk_addon_type` | `addon_type IN ('dedicated_number', 'recording_vault', 'calls_booster')` | `20260323000002` (duplicates the inline for safety) |

### Row Level Security

RLS is enabled on `company_addons` (migration `20260306000001`).

| Policy Name | Operation | Rule | Description |
|-------------|-----------|------|-------------|
| `company_addons_company_members_select` | `SELECT` | `company_id IN (SELECT company_id FROM users WHERE id = auth.uid())` | Any authenticated user can view add-ons belonging to their own company. |
| (service_role bypass) | `ALL` | Implicit via Supabase service role | All INSERT, UPDATE, and DELETE operations go through the service role client (`supabaseAdminRaw`), which bypasses RLS. This is by design: add-on mutations are exclusively server-side operations triggered by Stripe webhooks or admin API routes. |

---

## Add-on Types

### 1. Dedicated Number ($25/mo to customer, $15/mo cost from Bland)

A company-exclusive phone number purchased through the [[Bland AI]] master account and logically assigned to the company in Supabase. When the company dispatches calls, the dedicated number is passed as the `from` parameter to Bland's `/v1/calls` endpoint, giving the company a consistent, branded caller ID instead of Bland's auto-rotated pool numbers.

**Key fields used:** `dedicated_phone_number`, `bland_number_id`, `number_label`.

**Purchase flow:**
1. User navigates to Settings > Billing and clicks "Add Dedicated Number."
2. Frontend calls `POST /api/billing/phone-numbers/purchase` with `area_code`, `country_code`, and optional `label`.
3. The API validates the user is `owner` or `admin`, checks the company has an active paid subscription (not Free), and verifies the current dedicated number count is below `MAX_DEDICATED_NUMBERS` (3).
4. `purchaseNumber()` in `src/lib/bland/phone-numbers.ts` calls Bland's `/numbers/purchase` endpoint using the master API key (`BLAND_API_KEY`).
5. `assignNumberToCompany()` inserts a row into `company_addons` with `addon_type = 'dedicated_number'` and updates `company_subscriptions.addon_dedicated_number = true`.
6. A `billing_events` record is logged with `event_type = 'addon_purchased'`.

**Alternatively**, the user can go through a Stripe Checkout flow via `POST /api/billing/addon-checkout` with `addonType: 'dedicated_number'`. After Stripe confirms payment, the webhook handler in `src/app/api/webhooks/stripe/route.ts` inserts the `company_addons` row.

**Release flow:**
1. `releaseNumberFromCompany()` sets the add-on `status` to `canceled`.
2. It then calls Bland's `/numbers/{id}/release` endpoint (best-effort, non-fatal on failure) to stop Bland from billing for the number.
3. If no active dedicated numbers remain, `company_subscriptions.addon_dedicated_number` is set back to `false`.

**Number rotation:** When a company has multiple dedicated numbers, `getCompanyCallerNumber()` rotates among them using a simple time-based hash (`Math.floor(Date.now() / 1000) % numbers.length`).

**Maximum per company:** 3 numbers, enforced application-side in `assignNumberToCompany()` and in the purchase endpoint. The constant `MAX_DEDICATED_NUMBERS` is defined in `src/lib/bland/phone-numbers.ts`.

**Pricing note:** The CLAUDE.md document states $15/mo for the Dedicated Number add-on to the customer, but the source code in `plan-features.ts` and `phone-numbers.ts` shows the customer price as $25/mo while the Bland cost is $15/mo. The margin is $10/mo per number.

### 2. Recording Vault ($12/mo)

Extends call recording retention from the default 30 days to 12 months. Without this add-on, recordings stored in the `call-recordings` Supabase Storage bucket (created in migration `20260306000001`, max 50MB per file, allowed MIME types: `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/ogg`, `audio/webm`) expire after 30 days as tracked by the `recording_expires_at` column on `call_logs`.

**Key fields used:** `recording_retention_months` (set to 12 when active).

**Related columns on `call_logs`:**
- `recording_stored_url` (TEXT) -- URL to the stored recording in Supabase Storage
- `recording_expires_at` (TIMESTAMPTZ) -- When the recording will be purged
- `recording_archived` (BOOLEAN, default `false`) -- Whether the recording has been archived

The `check-retention` billing endpoint (`GET /api/billing/check-retention`) verifies a company's active Recording Vault status to determine the correct retention policy when storing new recordings.

### 3. Calls Booster ($35/mo per booster)

Each Calls Booster adds 225 extra minutes (approximately 150 calls at the 1.5 min/call effective average) to the company's monthly allowance. Unlike the other add-ons, Calls Boosters are designed to stack: a company can purchase multiple boosters, and each one adds to the total.

**Key fields used:** `quantity` (can be > 1 on a single row, or multiple rows).

**Tracking on `company_subscriptions`:**
- `addon_calls_booster` (BOOLEAN) -- Whether the company has at least one active booster
- `addon_calls_booster_count` (INTEGER, default 0) -- Total number of active boosters

The extra minutes from boosters are factored into the usage limit checks performed by `checkCallAllowed()` in `src/lib/bland/master-client.ts` and the overage calculation in `src/lib/billing/`.

---

## Plan Availability

Add-ons are gated by plan tier. The source of truth is `ADDON_AVAILABILITY` in `src/config/plan-features.ts` and the corresponding `recordingVaultAddon` / `callsBoosterAddon` flags in `CAMPAIGN_FEATURE_ACCESS`.

| Plan | Dedicated Number | Recording Vault | Calls Booster |
|------|:---:|:---:|:---:|
| **Free** | No | No | No |
| **Starter** | Yes | Yes | Yes |
| **Growth** | Yes | Yes | Yes |
| **Business** | Yes | Yes | Yes |
| **Teams** | Yes | Yes | Yes |
| **Enterprise** | Yes | Yes | Yes |

The `addon-checkout` endpoint enforces this by checking the company's active subscription plan slug:
```typescript
if (!subscription || planSlug === 'free') {
  return NextResponse.json(
    { error: 'Add-ons require an active paid plan (Starter or above)' },
    { status: 403 }
  );
}
```

---

## Stripe Integration

Add-on products are synced to Stripe via the `npm run stripe:sync` script. Each add-on type corresponds to a Stripe Product with `metadata.addon_type` set to the type string. Monthly prices are created in USD, EUR, and GBP.

**Checkout flow (`POST /api/billing/addon-checkout`):**
1. Looks up the Stripe product by matching `metadata.addon_type`.
2. Finds the monthly recurring price in the requested currency.
3. Creates a Stripe Checkout Session in `subscription` mode.
4. On success, redirects to `/settings?tab=billing&addon_success={addonType}`.
5. The `checkout.session.completed` webhook handler inserts the `company_addons` row.

**Webhook handler** (`src/app/api/webhooks/stripe/route.ts`, line ~188):
- Detects add-on checkouts by checking `session.metadata.is_addon === 'true'`.
- Validates `addon_type` against `VALID_ADDON_TYPES` whitelist (security fix from March 2026 audit).
- Inserts a row into `company_addons` with `status: 'active'`.

---

## Denormalized Flags on `company_subscriptions`

For fast query access without joining `company_addons`, boolean and count flags are maintained on the `company_subscriptions` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `addon_dedicated_number` | `BOOLEAN` | `false` | `true` if the company has at least one active dedicated number. |
| `addon_recording_vault` | `BOOLEAN` | `false` | `true` if the company has an active Recording Vault. |
| `addon_calls_booster` | `BOOLEAN` | `false` | `true` if the company has at least one active Calls Booster. |
| `addon_calls_booster_count` | `INTEGER` | `0` | Total number of active Calls Booster units. Used to calculate total available minutes: `plan_minutes + (booster_count * 225)`. |

These flags are updated by the application code in `src/lib/bland/phone-numbers.ts` (for dedicated numbers) and the Stripe webhook handler (for all types).

---

## Revenue Tracking in Admin Command Center

The `admin_finances` table has dedicated columns for add-on revenue, added in migration `20260306000001`:

| Column | Type | Description |
|--------|------|-------------|
| `addon_revenue` | `NUMERIC(12,2)` | Total add-on revenue across all types. |
| `dedicated_number_revenue` | `NUMERIC(12,2)` | Revenue from Dedicated Number add-ons. |
| `recording_vault_revenue` | `NUMERIC(12,2)` | Revenue from Recording Vault add-ons. |
| `calls_booster_revenue` | `NUMERIC(12,2)` | Revenue from Calls Booster add-ons. |

These are surfaced in the [[Admin Command Center]] Finances tab.

---

## Source Code References

| File | Purpose |
|------|---------|
| `src/lib/bland/phone-numbers.ts` | Dedicated number purchase, release, rotation, and count management. Constants: `MAX_DEDICATED_NUMBERS = 3`, `DEDICATED_NUMBER_PRICE = 25`, `DEDICATED_NUMBER_COST = 15`. |
| `src/app/api/billing/addon-checkout/route.ts` | Stripe Checkout session creation for all add-on types. |
| `src/app/api/billing/phone-numbers/purchase/route.ts` | Direct number purchase endpoint (Bland API + Supabase). |
| `src/app/api/billing/phone-numbers/release/route.ts` | Number release endpoint. |
| `src/app/api/billing/phone-numbers/search/route.ts` | Area code search/availability check. |
| `src/app/api/billing/check-retention/route.ts` | Recording retention policy check. |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook handler for add-on checkout completion. |
| `src/config/plan-features.ts` | `ADDON_AVAILABILITY` and `PHONE_NUMBER_FEATURES` -- plan-gating logic. |
| `supabase/migrations/20260306000001_v4_pricing_subaccounts_addons.sql` | Table creation, indexes, RLS, storage bucket. |
| `supabase/migrations/20260321000001_single_apikey_architecture.sql` | Added `number_label` column. |
| `supabase/migrations/20260323000002_production_audit_fixes.sql` | Added `chk_addon_type` CHECK constraint. |

---

## Related Notes

- [[Company]] -- The owning entity for all add-ons
- [[Subscription]] -- The parent subscription that must be active (Starter+) for add-on eligibility
- [[Stripe Integration]] -- Payment processing for add-on subscriptions
- [[Pricing Model]] -- Full pricing table including add-on unit economics
- [[Bland AI]] -- Phone number provisioning and call dispatch using dedicated numbers
- [[Call]] -- `call_logs` table columns affected by Recording Vault (`recording_stored_url`, `recording_expires_at`, `recording_archived`)
- [[Admin Command Center]] -- Revenue tracking for add-ons in Finances tab
