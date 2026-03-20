-- ============================================================================
-- MIGRATION: Billing Audit Fixes (March 2026)
-- ============================================================================
-- Fixes identified during comprehensive billing system audit:
-- 1. Add bland_api_key to company_settings (was referenced but never added)
-- 2. Add atomic increment RPC for usage_tracking (prevents race conditions)
-- 3. Add processed_stripe_events index for faster idempotency checks
-- 4. Add usage_alert_level tracking
-- 5. Add indexes for call_logs status queries (concurrent call counting)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add bland_api_key to company_settings
-- The column bland_subaccount_id exists but bland_api_key was missing.
-- Code references it (send-call/route.ts line 81) but it was never added.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'bland_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN bland_api_key TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Atomic increment function for usage_tracking
-- Prevents race conditions in concurrent usage reporting.
-- Replaces the optimistic locking approach with a true atomic increment.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_usage_minutes(
  p_usage_id UUID,
  p_minutes INTEGER
)
RETURNS TABLE(
  new_minutes_used INTEGER,
  minutes_included INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE usage_tracking
  SET
    minutes_used = usage_tracking.minutes_used + p_minutes,
    updated_at = NOW()
  WHERE id = p_usage_id
  RETURNING
    usage_tracking.minutes_used AS new_minutes_used,
    usage_tracking.minutes_included;
END;
$$;

-- ============================================================================
-- STEP 3: Add indexes for concurrent call counting and daily call queries
-- These are critical for the new pre-dispatch throttle checks.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_call_logs_company_status_created
  ON call_logs (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_company_created
  ON call_logs (company_id, created_at DESC);

-- ============================================================================
-- STEP 4: Add index on stripe_events for processed queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stripe_events_type_processed
  ON stripe_events (type, processed);

-- ============================================================================
-- STEP 5: Add index on usage_tracking for period queries
-- The report-usage endpoint queries by company_id + subscription_id + period range
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_tracking_company_period
  ON usage_tracking (company_id, subscription_id, period_start, period_end);

-- ============================================================================
-- STEP 6: Add billing_events index for faster event queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_billing_events_company_type
  ON billing_events (company_id, event_type, created_at DESC);

COMMIT;
