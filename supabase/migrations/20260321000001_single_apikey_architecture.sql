-- ================================================================
-- Migration: Single Master API Key Architecture
-- Date: 2026-03-21
--
-- Removes dependency on Bland sub-accounts. All calls now go through
-- a single master Bland API key. Company isolation is in Supabase only.
--
-- Changes:
-- 1. Add number_label column to company_addons for dedicated number labeling
-- 2. Update dedicated_number addon pricing from $15 to $25
-- 3. Add Bland plan tracking columns to admin_finances
-- 4. Add indexes for Redis concurrency manager integration
-- 5. Migrate existing companies to master key architecture
-- ================================================================

-- 1. Add label column for dedicated numbers (e.g., "Sales Line", "Support")
ALTER TABLE company_addons
ADD COLUMN IF NOT EXISTS number_label TEXT;

-- 2. Update admin_finances for single-key architecture monitoring
ALTER TABLE admin_finances
ADD COLUMN IF NOT EXISTS bland_plan_name TEXT,
ADD COLUMN IF NOT EXISTS bland_account_balance NUMERIC,
ADD COLUMN IF NOT EXISTS bland_total_calls_made INTEGER,
ADD COLUMN IF NOT EXISTS global_concurrent_calls INTEGER,
ADD COLUMN IF NOT EXISTS global_daily_calls INTEGER,
ADD COLUMN IF NOT EXISTS global_hourly_calls INTEGER,
ADD COLUMN IF NOT EXISTS redis_connected BOOLEAN DEFAULT FALSE;

-- 3. Update dedicated number addon pricing comment
-- (Actual pricing is in Stripe products, this is for documentation)
COMMENT ON COLUMN company_addons.dedicated_phone_number IS
  'Phone number purchased on Bland master account. $25/mo to customer, $15/mo Bland cost. Max 3 per company.';

-- 4. Add index for efficient phone number lookup during call dispatch
CREATE INDEX IF NOT EXISTS idx_company_addons_dedicated_number
  ON company_addons(company_id, addon_type, status)
  WHERE addon_type = 'dedicated_number' AND status = 'active';

-- 5. Add index for Redis-backed contact cooldown verification in Supabase fallback
CREATE INDEX IF NOT EXISTS idx_call_logs_contact_recent
  ON call_logs(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

-- 6. Migrate all existing companies to use master key
-- Sets bland_subaccount_id to 'master' for all companies that had sub-accounts
-- This marks them as using the single-key architecture
UPDATE company_settings
SET bland_subaccount_id = 'master'
WHERE bland_subaccount_id IS NOT NULL
  AND bland_subaccount_id != 'master';

-- 7. For companies that don't have an API key yet, we'll set it at runtime
-- (ensure-free-plan and command-center handle this)

-- 8. Log this migration as a billing event for audit trail
INSERT INTO billing_events (company_id, event_type, event_data, minutes_consumed, cost_usd)
SELECT
  cs.company_id,
  'architecture_migration',
  jsonb_build_object(
    'migration', '20260321000001_single_apikey_architecture',
    'from', 'sub_accounts',
    'to', 'single_master_key',
    'note', 'Migrated to single API key architecture. Sub-accounts deprecated.'
  ),
  0,
  0
FROM company_settings cs
WHERE cs.bland_subaccount_id = 'master'
ON CONFLICT DO NOTHING;

-- 9. Add check constraint: max 3 dedicated numbers per company
-- (Enforced in application layer, but add a safety trigger)
CREATE OR REPLACE FUNCTION check_max_dedicated_numbers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.addon_type = 'dedicated_number' AND NEW.status = 'active' THEN
    IF (
      SELECT COUNT(*)
      FROM company_addons
      WHERE company_id = NEW.company_id
        AND addon_type = 'dedicated_number'
        AND status = 'active'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 dedicated numbers per company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_dedicated_numbers ON company_addons;
CREATE TRIGGER trg_check_max_dedicated_numbers
  BEFORE INSERT OR UPDATE ON company_addons
  FOR EACH ROW
  EXECUTE FUNCTION check_max_dedicated_numbers();
