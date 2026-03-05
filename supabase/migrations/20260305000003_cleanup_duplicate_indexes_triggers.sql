-- Migration: Clean up duplicate indexes and triggers
-- Part of Fase 2 audit recommendations (#16)

-- ============================================================
-- 1. Remove duplicate calendar_events indexes
-- idx_cal_events_company and idx_calendar_events_company_time both cover company_id
-- Keep the composite one (more useful for range queries)
-- ============================================================
DROP INDEX IF EXISTS idx_cal_events_company;

-- idx_cal_events_source duplicates functionality - source is low-cardinality
-- The assigned/agent_run/call_log indexes are more useful
DROP INDEX IF EXISTS idx_cal_events_source;

-- ============================================================
-- 2. Remove duplicate triggers on contacts
-- Both 'set_updated_at' (from handle_updated_at) and
-- 'update_contacts_updated_at' (from update_updated_at_column) do the same thing
-- Keep set_updated_at (the standard pattern), drop the duplicate
-- ============================================================
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;

-- ============================================================
-- 3. Remove duplicate triggers on company_settings
-- Same issue: set_updated_at and update_company_settings_updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;

-- ============================================================
-- 4. Drop the redundant update_updated_at_column() function
-- if no other triggers depend on it
-- ============================================================
DO $$
BEGIN
  -- Only drop if no triggers reference this function
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE p.proname = 'update_updated_at_column'
  ) THEN
    DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
  END IF;
END $$;
