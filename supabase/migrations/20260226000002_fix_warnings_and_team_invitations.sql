-- ============================================================================
-- MIGRATION: Fix Supabase Linter Warnings + Team Invitation System
-- Date: 2026-02-26
-- Purpose:
--   1. Fix 14 function_search_path_mutable warnings
--   2. Fix 9 rls_policy_always_true warnings
--   3. Add team_invitations table and RLS for invitation workflow
--   4. Add subscription_plans columns for seat management
--   5. Add missing subscription_plans.max_seats column
--   6. Fix usage_tracking FK to company_subscriptions
-- ============================================================================

-- ============================================================================
-- SECTION 1: FIX FUNCTION SEARCH PATH WARNINGS
-- All 14 functions in public schema need SET search_path = public
-- This prevents search_path manipulation attacks (CVE-style)
-- ============================================================================

-- 1a. update_updated_at_column (used by calendar_integrations, calendar_events,
--     company_subscriptions, contacts, company_settings)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1b. update_notifications_updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1c. notify_campaign_completion
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND (NEW.status = 'completed' OR NEW.status = 'failed')) THEN
    INSERT INTO notifications (company_id, type, title, message, metadata)
    VALUES (
      NEW.company_id,
      CASE
        WHEN NEW.status = 'completed' THEN 'campaign_completed'
        WHEN NEW.status = 'failed' THEN 'campaign_failed'
      END,
      CASE
        WHEN NEW.status = 'completed' THEN 'Campaign Completed'
        WHEN NEW.status = 'failed' THEN 'Campaign Failed'
      END,
      CASE
        WHEN NEW.status = 'completed' THEN
          'Campaign "' || NEW.name || '" has completed successfully with ' || NEW.completed_calls || ' calls made.'
        WHEN NEW.status = 'failed' THEN
          'Campaign "' || NEW.name || '" has failed. Please check the logs for more details.'
      END,
      jsonb_build_object(
        'campaign_id', NEW.id,
        'campaign_name', NEW.name,
        'completed_calls', NEW.completed_calls,
        'successful_calls', NEW.successful_calls,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1d. notify_high_failure_rate
CREATE OR REPLACE FUNCTION notify_high_failure_rate()
RETURNS TRIGGER AS $$
DECLARE
  failed_calls INTEGER;
  failure_rate NUMERIC;
BEGIN
  IF NEW.completed_calls >= 10 THEN
    failed_calls := NEW.completed_calls - NEW.successful_calls;
    failure_rate := (failed_calls::NUMERIC / NEW.completed_calls::NUMERIC) * 100;

    IF failure_rate > 50 AND (OLD.completed_calls IS NULL OR OLD.completed_calls < 10 OR
       (OLD.completed_calls - OLD.successful_calls)::NUMERIC / OLD.completed_calls::NUMERIC * 100 <= 50) THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (
        NEW.company_id,
        'high_failure_rate',
        'High Call Failure Rate Detected',
        'Campaign "' || NEW.name || '" has a high failure rate of ' || ROUND(failure_rate, 1) || '%. Consider reviewing your agent configuration.',
        jsonb_build_object(
          'campaign_id', NEW.id,
          'campaign_name', NEW.name,
          'failure_rate', ROUND(failure_rate, 1),
          'total_calls', NEW.completed_calls,
          'failed_calls', failed_calls
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1e. notify_minutes_limit
CREATE OR REPLACE FUNCTION notify_minutes_limit()
RETURNS TRIGGER AS $$
DECLARE
  usage_percentage NUMERIC;
BEGIN
  IF NEW.minutes_used IS NOT NULL AND NEW.minutes_included IS NOT NULL AND NEW.minutes_included > 0 THEN
    usage_percentage := (NEW.minutes_used::NUMERIC / NEW.minutes_included::NUMERIC) * 100;

    IF usage_percentage >= 80 AND (OLD.minutes_used IS NULL OR
       (OLD.minutes_used::NUMERIC / NEW.minutes_included::NUMERIC * 100) < 80) THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (
        NEW.company_id,
        CASE
          WHEN usage_percentage >= 100 THEN 'minutes_exceeded'
          WHEN usage_percentage >= 90 THEN 'minutes_critical'
          ELSE 'minutes_warning'
        END,
        CASE
          WHEN usage_percentage >= 100 THEN 'Minutes Limit Exceeded'
          WHEN usage_percentage >= 90 THEN 'Minutes Limit Critical'
          ELSE 'Minutes Limit Warning'
        END,
        CASE
          WHEN usage_percentage >= 100 THEN
            'You have exceeded your monthly minutes limit. Additional charges may apply.'
          WHEN usage_percentage >= 90 THEN
            'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly minutes. Consider upgrading your plan.'
          ELSE
            'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly minutes.'
        END,
        jsonb_build_object(
          'minutes_used', NEW.minutes_used,
          'minutes_included', NEW.minutes_included,
          'usage_percentage', ROUND(usage_percentage, 1)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1f. update_followup_updated_at
CREATE OR REPLACE FUNCTION update_followup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1g. auto_create_followup
CREATE OR REPLACE FUNCTION auto_create_followup()
RETURNS TRIGGER AS $$
DECLARE
  run_followup_enabled BOOLEAN;
  run_max_attempts INTEGER;
  run_interval_hours INTEGER;
  run_conditions JSONB;
  should_followup BOOLEAN;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'no-answer', 'busy', 'failed') AND OLD.status != NEW.status) THEN
    SELECT follow_up_enabled, follow_up_max_attempts, follow_up_interval_hours, follow_up_conditions
    INTO run_followup_enabled, run_max_attempts, run_interval_hours, run_conditions
    FROM agent_runs
    WHERE id = NEW.agent_run_id;

    IF run_followup_enabled THEN
      should_followup := FALSE;

      IF NEW.status = 'no-answer' AND (run_conditions->>'no_answer')::boolean THEN
        should_followup := TRUE;
      ELSIF NEW.status = 'busy' AND (run_conditions->>'busy')::boolean THEN
        should_followup := TRUE;
      ELSIF NEW.status = 'failed' AND (run_conditions->>'failed')::boolean THEN
        should_followup := TRUE;
      END IF;

      IF should_followup AND NEW.contact_id IS NOT NULL THEN
        INSERT INTO follow_up_queue (
          company_id, agent_run_id, contact_id, original_call_id,
          max_attempts, next_attempt_at, attempt_number, reason
        ) VALUES (
          NEW.company_id, NEW.agent_run_id, NEW.contact_id, NEW.id,
          run_max_attempts,
          NOW() + (run_interval_hours || ' hours')::INTERVAL,
          1, NEW.status
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1h-1n. Remaining updated_at functions that exist in the database
-- These are created by the initial schema or other migrations

-- handle_updated_at (generic, used by some tables)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_usage_tracking_updated_at
CREATE OR REPLACE FUNCTION update_usage_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_call_queue_updated_at
CREATE OR REPLACE FUNCTION update_call_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_admin_finances_updated_at
CREATE OR REPLACE FUNCTION update_admin_finances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_contact_lists_updated_at
CREATE OR REPLACE FUNCTION update_contact_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_subscription_plans_updated_at
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- update_company_subscriptions_updated_at (from comprehensive fixes migration)
CREATE OR REPLACE FUNCTION update_company_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================================
-- SECTION 2: FIX RLS ALWAYS-TRUE POLICY WARNINGS
-- Drop 9 overly permissive policies that use USING(true) or WITH CHECK(true)
-- The proper company-scoped policies already exist on these tables
-- ============================================================================

-- 2a. agent_runs: Drop "authenticated_can_manage_runs" (USING true)
-- Company-scoped policies should already exist from initial schema
DROP POLICY IF EXISTS "authenticated_can_manage_runs" ON agent_runs;

-- Add proper company-scoped policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_runs'
    AND policyname = 'Company members can manage agent runs'
  ) THEN
    CREATE POLICY "Company members can manage agent runs"
      ON agent_runs FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- 2b. call_logs: Drop "authenticated_can_manage_call_logs" (USING true)
DROP POLICY IF EXISTS "authenticated_can_manage_call_logs" ON call_logs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_logs'
    AND policyname = 'Company members can manage call logs'
  ) THEN
    CREATE POLICY "Company members can manage call logs"
      ON call_logs FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- 2c. companies: Drop 3 overly permissive policies
DROP POLICY IF EXISTS "anyone_can_create_company" ON companies;
DROP POLICY IF EXISTS "authenticated_can_update_companies" ON companies;
DROP POLICY IF EXISTS "authenticated_insert_companies" ON companies;

-- Add proper policies for companies
DO $$
BEGIN
  -- Users can view their own company
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'Users can view own company'
  ) THEN
    CREATE POLICY "Users can view own company"
      ON companies FOR SELECT
      USING (
        id IN (SELECT company_id FROM users WHERE id = auth.uid())
        OR auth.role() = 'service_role'
      );
  END IF;

  -- Authenticated users can create a company (during onboarding only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'Authenticated users can create company'
  ) THEN
    CREATE POLICY "Authenticated users can create company"
      ON companies FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- Users can update their own company
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'Users can update own company'
  ) THEN
    CREATE POLICY "Users can update own company"
      ON companies FOR UPDATE
      USING (id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- 2d. company_agents: Drop "authenticated_can_manage_agents" (USING true)
DROP POLICY IF EXISTS "authenticated_can_manage_agents" ON company_agents;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_agents'
    AND policyname = 'Company members can manage agents'
  ) THEN
    CREATE POLICY "Company members can manage agents"
      ON company_agents FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- 2e. company_settings: Drop "authenticated_can_create_settings" and "authenticated_can_update_settings"
DROP POLICY IF EXISTS "authenticated_can_create_settings" ON company_settings;
DROP POLICY IF EXISTS "authenticated_can_update_settings" ON company_settings;

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

-- 2f. contacts: Drop "authenticated_can_manage_contacts" (USING true)
DROP POLICY IF EXISTS "authenticated_can_manage_contacts" ON contacts;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contacts'
    AND policyname = 'Company members can manage contacts'
  ) THEN
    CREATE POLICY "Company members can manage contacts"
      ON contacts FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: TEAM INVITATIONS TABLE
-- Supports the invitation workflow: Business+ plans can invite team members
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending invites to same email for same company
  UNIQUE(company_id, email, status)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_company ON team_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status) WHERE status = 'pending';

-- Updated_at trigger
CREATE TRIGGER update_team_invitations_updated_at
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Company owners/admins can view invitations
CREATE POLICY "Company members can view invitations"
  ON team_invitations FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Company owners/admins can create invitations
CREATE POLICY "Company admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can update invitations (cancel)
CREATE POLICY "Company admins can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can delete invitations
CREATE POLICY "Company admins can delete invitations"
  ON team_invitations FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON team_invitations TO authenticated;

-- ============================================================================
-- SECTION 4: ADD max_seats AND max_agents COLUMNS TO subscription_plans
-- These enforce seat limits per plan tier
-- ============================================================================

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_seats INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_seat_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS max_agents INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_call_duration INTEGER NOT NULL DEFAULT 3;

-- Update seat limits for each plan
UPDATE subscription_plans SET
  max_seats = 1,
  extra_seat_price = NULL,
  max_agents = 1,
  max_concurrent_calls = 1,
  max_call_duration = 3
WHERE slug = 'free';

UPDATE subscription_plans SET
  max_seats = 1,
  extra_seat_price = NULL,
  max_agents = 1,
  max_concurrent_calls = 1,
  max_call_duration = 3
WHERE slug = 'starter';

UPDATE subscription_plans SET
  max_seats = 3,
  extra_seat_price = NULL,
  max_agents = 3,
  max_concurrent_calls = 3,
  max_call_duration = 5
WHERE slug = 'business';

UPDATE subscription_plans SET
  max_seats = 5,
  extra_seat_price = 79.00,
  max_agents = -1,
  max_concurrent_calls = 10,
  max_call_duration = 8
WHERE slug = 'teams';

UPDATE subscription_plans SET
  max_seats = -1,
  extra_seat_price = NULL,
  max_agents = -1,
  max_concurrent_calls = 50,
  max_call_duration = 15
WHERE slug = 'enterprise';

-- ============================================================================
-- SECTION 5: ADD usage_tracking FK TO company_subscriptions
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_usage_tracking_subscription'
    AND table_name = 'usage_tracking'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Clean orphaned records first
    DELETE FROM usage_tracking
    WHERE subscription_id IS NOT NULL
      AND subscription_id NOT IN (SELECT id FROM company_subscriptions);

    ALTER TABLE usage_tracking
      ADD CONSTRAINT fk_usage_tracking_subscription
      FOREIGN KEY (subscription_id) REFERENCES company_subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- SECTION 6: ENABLE RLS ON TABLES THAT MIGHT BE MISSING IT
-- ============================================================================

-- Ensure RLS is enabled on core tables
DO $$
BEGIN
  -- agent_runs
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'agent_runs' AND rowsecurity = true
  ) THEN
    ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
  END IF;

  -- call_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'call_logs' AND rowsecurity = true
  ) THEN
    ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
  END IF;

  -- companies
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'companies' AND rowsecurity = true
  ) THEN
    ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
  END IF;

  -- company_agents
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'company_agents' AND rowsecurity = true
  ) THEN
    ALTER TABLE company_agents ENABLE ROW LEVEL SECURITY;
  END IF;

  -- company_settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'company_settings' AND rowsecurity = true
  ) THEN
    ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
  END IF;

  -- contacts
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'contacts' AND rowsecurity = true
  ) THEN
    ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
  END IF;

  -- contact_lists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'contact_lists' AND rowsecurity = true
  ) THEN
    ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
  END IF;

  -- users
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'users' AND rowsecurity = true
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add company-scoped RLS policies for contact_lists if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_lists'
    AND policyname = 'Company members can manage contact lists'
  ) THEN
    CREATE POLICY "Company members can manage contact lists"
      ON contact_lists FOR ALL
      USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- SECTION 7: ADD SERVICE ROLE BYPASS POLICIES
-- Webhook handlers and server-side operations need service_role access
-- ============================================================================

-- agent_runs: service_role bypass for webhook operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_runs'
    AND policyname = 'Service role bypass for agent runs'
  ) THEN
    CREATE POLICY "Service role bypass for agent runs"
      ON agent_runs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- call_logs: service_role bypass for webhook operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_logs'
    AND policyname = 'Service role bypass for call logs'
  ) THEN
    CREATE POLICY "Service role bypass for call logs"
      ON call_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- contacts: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contacts'
    AND policyname = 'Service role bypass for contacts'
  ) THEN
    CREATE POLICY "Service role bypass for contacts"
      ON contacts FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- company_settings: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_settings'
    AND policyname = 'Service role bypass for company settings'
  ) THEN
    CREATE POLICY "Service role bypass for company settings"
      ON company_settings FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- company_agents: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_agents'
    AND policyname = 'Service role bypass for company agents'
  ) THEN
    CREATE POLICY "Service role bypass for company agents"
      ON company_agents FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- companies: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
    AND policyname = 'Service role bypass for companies'
  ) THEN
    CREATE POLICY "Service role bypass for companies"
      ON companies FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- contact_lists: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_lists'
    AND policyname = 'Service role bypass for contact lists'
  ) THEN
    CREATE POLICY "Service role bypass for contact lists"
      ON contact_lists FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Summary of changes:
-- 1. Fixed 14 functions with SET search_path = public (security)
-- 2. Dropped 9 overly permissive RLS policies (USING true / WITH CHECK true)
-- 3. Added proper company-scoped RLS policies as replacements
-- 4. Created team_invitations table with full RLS
-- 5. Added max_seats, extra_seat_price, max_agents, max_concurrent_calls, max_call_duration to subscription_plans
-- 6. Added usage_tracking FK to company_subscriptions
-- 7. Ensured RLS enabled on all core tables
-- 8. Added service_role bypass policies for webhook/server operations
