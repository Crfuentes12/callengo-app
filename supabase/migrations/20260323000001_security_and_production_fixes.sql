-- =============================================================================
-- Migration: Security & Production Readiness Fixes
-- Date: 2026-03-23
-- Audit: Full codebase audit remediation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FIX #1: Prevent users from self-escalating their role via RLS
-- The users table UPDATE policy only checks (id = auth.uid()) with no column
-- restriction, allowing any authenticated user to SET role = 'admin'.
-- This trigger blocks role changes from non-service-role callers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (admin SDK) to change roles freely
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block any role change from regular authenticated users
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Role changes are not allowed. Contact your administrator.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON users;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- FIX #2: Atomic usage increment RPC — fallback when optimistic lock fails.
-- This ensures usage data is never silently lost under high concurrency.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION atomic_increment_usage(
  p_usage_id UUID,
  p_minutes NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usage_tracking
  SET minutes_used = minutes_used + p_minutes,
      updated_at = now()
  WHERE id = p_usage_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- FIX #12: Add unique constraint on hubspot_integrations (company_id, user_id)
-- Prevents duplicate HubSpot connections for the same company+user pair.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hubspot_integrations_company_user_unique'
  ) THEN
    ALTER TABLE hubspot_integrations
      ADD CONSTRAINT hubspot_integrations_company_user_unique
      UNIQUE (company_id, user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FIX #3: Create campaign_queue table (missing from schema) and add
-- unique partial index to prevent duplicate dispatches.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_id UUID,
  agent_run_id UUID,
  contact_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  call_config JSONB NOT NULL DEFAULT '{}',
  webhook_url TEXT,
  dedicated_number TEXT,
  effective_max_duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  call_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_campaign_queue_status_priority
  ON campaign_queue (status, priority, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_campaign_queue_company
  ON campaign_queue (company_id);

-- Unique partial index: prevents duplicate queue entries for the same
-- agent_run + contact while the entry is still pending/processing.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_queue_agent_run_contact_unique
  ON campaign_queue (agent_run_id, contact_id)
  WHERE agent_run_id IS NOT NULL AND status IN ('pending', 'processing');

-- RLS
ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_queue_select ON campaign_queue
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY campaign_queue_insert ON campaign_queue
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
