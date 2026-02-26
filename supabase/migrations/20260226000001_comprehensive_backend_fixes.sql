-- ============================================================================
-- COMPREHENSIVE BACKEND FIXES MIGRATION
-- Date: 2026-02-26
-- Purpose: Fix all FK constraints, cascade delete gaps, RLS security issues,
--          type mismatches, and orphaned data risks identified in backend audit.
-- ============================================================================

-- ============================================================================
-- SECTION 1: MISSING FOREIGN KEY CONSTRAINTS
-- These missing FKs mean deleting a user/company won't cascade properly.
-- ============================================================================

-- 1a. calendar_integrations.user_id -> users(id) ON DELETE CASCADE
-- The column references users but the FK was already created in the calendar migration.
-- However, verify it exists and is CASCADE (it was created with ON DELETE CASCADE).
-- CONFIRMED: calendar_integrations already has FK to users(id) ON DELETE CASCADE.

-- 1b. ai_conversations.user_id -> auth.users(id) ON DELETE CASCADE
-- CONFIRMED: Already defined in migration 20260222000001 as:
--   REFERENCES auth.users(id) ON DELETE CASCADE
-- This is correct - when auth user is deleted, conversations are deleted.

-- 1c. cancellation_feedback.user_id - MISSING FK to users(id)
-- Currently user_id is UUID NOT NULL but has NO foreign key constraint.
-- If a user is deleted, their cancellation feedback will be orphaned.
ALTER TABLE cancellation_feedback
  ADD CONSTRAINT fk_cancellation_feedback_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 1d. retention_offer_log.user_id - MISSING FK to users(id)
-- Currently user_id is UUID NOT NULL but has NO foreign key constraint.
ALTER TABLE retention_offer_log
  ADD CONSTRAINT fk_retention_offer_log_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 1e. call_logs.agent_run_id - MISSING FK to agent_runs(id)
-- The column exists and is used in code but has NO FK constraint.
-- Use SET NULL so deleting an agent_run doesn't delete call history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_call_logs_agent_run'
    AND table_name = 'call_logs'
  ) THEN
    ALTER TABLE call_logs
      ADD CONSTRAINT fk_call_logs_agent_run
      FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1f. notifications.user_id already has FK with CASCADE - CONFIRMED OK.

-- ============================================================================
-- SECTION 2: FIX contacts.list_id TYPE MISMATCH
-- contacts.list_id is TEXT but contact_lists.id is UUID.
-- This prevents adding a proper FK constraint and causes silent data integrity issues.
-- ============================================================================

-- Step 2a: Add a proper UUID column
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS list_id_uuid UUID;

-- Step 2b: Migrate existing data (cast valid UUIDs, set invalid to NULL)
UPDATE contacts
SET list_id_uuid = list_id::uuid
WHERE list_id IS NOT NULL
  AND list_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 2c: Drop the old column and rename
ALTER TABLE contacts DROP COLUMN IF EXISTS list_id;
ALTER TABLE contacts RENAME COLUMN list_id_uuid TO list_id;

-- Step 2d: Add the FK constraint
ALTER TABLE contacts
  ADD CONSTRAINT fk_contacts_list
  FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE SET NULL;

-- Step 2e: Add index for the FK
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id) WHERE list_id IS NOT NULL;

-- ============================================================================
-- SECTION 3: ENSURE public.users -> auth.users CASCADE
-- When deleting from auth.users, public.users rows must be deleted too.
-- The original schema should have this, but let's verify/add it.
-- ============================================================================

DO $$
BEGIN
  -- Check if FK from users.id -> auth.users.id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'users'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
  ) THEN
    -- Add the FK if it doesn't exist
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_auth
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- SECTION 4: FIX OVERLY PERMISSIVE RLS POLICIES
-- Several tables have policies using "true" which allows ANY authenticated user
-- to access ANY company's data. These need to be company-scoped.
-- ============================================================================

-- 4a. Fix voicemail_logs INSERT policy (currently WITH CHECK (true))
DROP POLICY IF EXISTS "System can insert voicemail logs" ON voicemail_logs;
-- Recreate: Allow service role (admin) to insert, and company members
CREATE POLICY "Company members or system can insert voicemail logs"
  ON voicemail_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- 4b. Fix notifications INSERT policy (currently WITH CHECK (true))
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
-- Recreate: Allow service role inserts and trigger-based inserts
CREATE POLICY "Company members or system can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- 4c. Fix follow_up_queue FOR ALL policy
-- Currently has a permissive FOR ALL + FOR SELECT which is redundant.
-- The FOR ALL policy already covers SELECT, INSERT, UPDATE, DELETE.
-- Drop the redundant SELECT-only policy.
DROP POLICY IF EXISTS "Users can view follow-ups for their company" ON follow_up_queue;
-- The "Users can manage follow-ups for their company" FOR ALL policy remains.

-- ============================================================================
-- SECTION 5: ADD MISSING RLS POLICIES FOR TABLES THAT NEED THEM
-- ============================================================================

-- 5a. stripe_events - No RLS enabled (admin-only table, but should be protected)
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- Only service role should access stripe_events
CREATE POLICY "Service role only for stripe_events"
  ON stripe_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5b. admin_finances - Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'admin_finances' AND rowsecurity = true
  ) THEN
    ALTER TABLE admin_finances ENABLE ROW LEVEL SECURITY;

    -- Only service_role or admin users
    EXECUTE 'CREATE POLICY "Admin users can view finances" ON admin_finances FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
        OR auth.role() = ''service_role''
      )';
  END IF;
END $$;

-- ============================================================================
-- SECTION 6: ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- 6a. call_logs.agent_run_id (now has FK, needs index)
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_run_id ON call_logs(agent_run_id)
  WHERE agent_run_id IS NOT NULL;

-- 6b. call_logs.call_id (used in webhook for lookups)
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);

-- 6c. contacts.company_id + status (common filter combo)
CREATE INDEX IF NOT EXISTS idx_contacts_company_status ON contacts(company_id, status);

-- 6d. agent_runs.company_id + status (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_agent_runs_company_status ON agent_runs(company_id, status);

-- 6e. usage_tracking.company_id + subscription_id (common lookup)
CREATE INDEX IF NOT EXISTS idx_usage_tracking_company_sub ON usage_tracking(company_id, subscription_id);

-- 6f. billing_events.company_id + event_type (analytics queries)
CREATE INDEX IF NOT EXISTS idx_billing_events_company_type ON billing_events(company_id, event_type);

-- 6g. billing_history.company_id (used in billing page)
CREATE INDEX IF NOT EXISTS idx_billing_history_company ON billing_history(company_id);

-- 6h. company_subscriptions.company_id + status (most common query)
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_status
  ON company_subscriptions(company_id, status);

-- ============================================================================
-- SECTION 7: ADD MISSING CASCADE PATHS FOR COMPLETE USER DELETION
-- When deleting a user/company, these tables must also be cleaned up.
-- ============================================================================

-- 7a. Ensure call_queue has proper FK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_queue') THEN
    -- Add company_id FK if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name LIKE '%call_queue%company%'
      AND table_name = 'call_queue'
      AND constraint_type = 'FOREIGN KEY'
    ) THEN
      BEGIN
        ALTER TABLE call_queue
          ADD CONSTRAINT fk_call_queue_company
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END $$;

-- 7b. Ensure calendar_sync_log cascades on integration delete
-- Already defined: REFERENCES calendar_integrations(id) ON DELETE CASCADE ✓

-- ============================================================================
-- SECTION 8: DATA CLEANUP - Fix orphaned records
-- Clean up any existing orphaned data from missing FK constraints.
-- ============================================================================

-- 8a. Clean orphaned contacts with invalid list_id references
UPDATE contacts SET list_id = NULL
WHERE list_id IS NOT NULL
  AND list_id NOT IN (SELECT id FROM contact_lists);

-- 8b. Clean orphaned call_logs with invalid agent_run_id references
UPDATE call_logs SET agent_run_id = NULL
WHERE agent_run_id IS NOT NULL
  AND agent_run_id NOT IN (SELECT id FROM agent_runs);

-- 8c. Clean orphaned usage_tracking with invalid subscription_id references
DELETE FROM usage_tracking
WHERE subscription_id IS NOT NULL
  AND subscription_id NOT IN (SELECT id FROM company_subscriptions);

-- ============================================================================
-- SECTION 9: ADD updated_at TRIGGER TO TABLES MISSING IT
-- ============================================================================

-- Generic updated_at function (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9a. company_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_company_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_company_subscriptions_updated_at
      BEFORE UPDATE ON company_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 9b. contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_contacts_updated_at
      BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 9c. company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_company_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_company_settings_updated_at
      BEFORE UPDATE ON company_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- SECTION 10: GRANT MISSING PERMISSIONS
-- ============================================================================

-- Ensure authenticated role can access retention/cancellation tables
-- (currently uses supabaseAdminRaw because no RLS insert policies exist)
GRANT SELECT ON cancellation_feedback TO authenticated;
GRANT SELECT ON retention_offers TO authenticated;
GRANT SELECT ON retention_offer_log TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Summary of changes:
-- 1. Added FK: cancellation_feedback.user_id -> users(id) CASCADE
-- 2. Added FK: retention_offer_log.user_id -> users(id) CASCADE
-- 3. Added FK: call_logs.agent_run_id -> agent_runs(id) SET NULL
-- 4. Fixed contacts.list_id: TEXT -> UUID with FK to contact_lists(id) SET NULL
-- 5. Ensured public.users.id -> auth.users.id CASCADE exists
-- 6. Fixed overly permissive RLS INSERT policies on voicemail_logs and notifications
-- 7. Added RLS to stripe_events (service_role only)
-- 8. Added 8 performance indexes
-- 9. Cleaned orphaned data
-- 10. Added updated_at triggers to tables missing them
-- 11. Added proper GRANT permissions for retention tables
