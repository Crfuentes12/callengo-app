---
tags: [entity, billing]
---

# Add-on

Optional paid extras that companies can add to their [[Subscription]].

## Database Table: `company_addons`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| addon_type | TEXT CHECK | dedicated_number, recording_vault, calls_booster |
| stripe_subscription_item_id | TEXT | |
| stripe_price_id | TEXT | |
| quantity | INTEGER | Default 1 |
| status | TEXT CHECK | active, canceled, past_due |
| current_period_start | TIMESTAMPTZ | |
| current_period_end | TIMESTAMPTZ | |

### Dedicated Number Fields

| Column | Type | Notes |
|--------|------|-------|
| dedicated_phone_number | TEXT | Actual number |
| number_label | TEXT | e.g. "Sales Line" |
| bland_number_id | TEXT | Bland AI number ID |

### Recording Vault Fields

| Column | Type |
|--------|------|
| recording_retention_months | INTEGER |

## Add-on Types

| Add-on | Price | Description |
|--------|-------|-------------|
| **Dedicated Number** | $15/mo | Custom phone number for outbound calls (max 3 per company) |
| **Recording Vault** | $12/mo | Extended call recording storage |
| **Calls Booster** | $35/mo | Additional call capacity |

## Constraints

- **CHECK** on `addon_type`: only the 3 valid types
- **CHECK** on `status`: active, canceled, past_due
- **Trigger:** `check_max_dedicated_numbers` — enforces max 3 dedicated numbers per company
- **RLS:** SELECT by company members; INSERT/UPDATE by service_role only

## Related Notes

- [[Subscription]]
- [[Pricing Model]]
- [[Stripe Integration]]
