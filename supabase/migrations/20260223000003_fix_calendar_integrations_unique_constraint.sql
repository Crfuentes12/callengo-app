-- ============================================================================
-- FIX: Add unique constraint on calendar_integrations (company_id, user_id, provider)
-- Required for ON CONFLICT upsert in Microsoft Outlook callback
-- Error: 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- ============================================================================

-- Create unique index if it doesn't already exist
-- This covers the case where CREATE TABLE IF NOT EXISTS skipped constraint creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_integrations_unique_company_user_provider
  ON calendar_integrations (company_id, user_id, provider);
