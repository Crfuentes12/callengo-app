-- ============================================================================
-- SECURITY & RLS FIXES
-- ============================================================================
-- 1. Drop any overly permissive company_settings RLS policy (USING(true))
-- 2. Ensure company_settings uses company_id scoping
-- 3. Clean up duplicate users RLS policies
-- 4. Add INSERT/UPDATE policies for company_addons (currently only SELECT)
-- 5. Add missing index for usage_tracking lookups
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix company_settings RLS — drop any policy with USING(true)
-- The "Company members can manage settings" policy already exists with proper
-- company_id scoping. We just need to ensure no overly permissive policy exists.
-- ============================================================================

-- Drop any potentially overly permissive SELECT-only policy that uses USING(true)
DROP POLICY IF EXISTS "authenticated_can_view_settings" ON company_settings;
DROP POLICY IF EXISTS "Anyone can view settings" ON company_settings;
DROP POLICY IF EXISTS "allow_select_settings" ON company_settings;

-- Ensure the correct company-scoped policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_settings'
    AND policyname = 'Company members can manage settings'
  ) THEN
    CREATE POLICY "Company members can manage settings"
      ON company_settings FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Clean up duplicate users table INSERT policies
-- ============================================================================

-- Drop any duplicate insert policies on users table
DROP POLICY IF EXISTS "insert_own_user" ON users;
DROP POLICY IF EXISTS "users_can_insert_own_record" ON users;

-- Ensure a single clean insert policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
    AND policyname = 'Users can insert own record'
  ) THEN
    CREATE POLICY "Users can insert own record"
      ON users FOR INSERT
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add INSERT/UPDATE policies for company_addons via service_role
-- The table has RLS enabled but only SELECT — addons purchased via checkout
-- need to be insertable/updatable by the service role.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_addons'
    AND policyname = 'Service role can manage addons'
  ) THEN
    CREATE POLICY "Service role can manage addons"
      ON company_addons FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Company members can view their own addons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_addons'
    AND policyname = 'Company members can view addons'
  ) THEN
    CREATE POLICY "Company members can view addons"
      ON company_addons FOR SELECT
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add missing index for usage_tracking period lookups
-- Used by report-usage endpoint with period_start/period_end filters
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_tracking_period_lookup
  ON usage_tracking (company_id, subscription_id, period_start, period_end);

-- ============================================================================
-- STEP 5: Add index for call_queue processing performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_call_queue_pending
  ON call_queue (status, scheduled_at)
  WHERE status = 'pending';

-- ============================================================================
-- STEP 6: Ensure billing_events has proper indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_billing_events_company_type
  ON billing_events (company_id, event_type, created_at DESC);
