-- Migration: Production Audit Fixes (2026-03-23)
-- Addresses findings from comprehensive production readiness audit:
-- 1. RLS: Restrict users table self-update (prevent company_id switching)
-- 2. RLS: Restrict company_subscriptions update to owner/admin
-- 3. CHECK constraints on status columns
-- 4. Soft-delete support for companies
-- 5. Prevent company_id self-modification trigger

-- ============================================================================
-- 1. TRIGGER: Prevent users from changing their own company_id or email
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_sensitive_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only applies to self-updates (user updating their own row)
  IF NEW.id = auth.uid() THEN
    -- Prevent company_id changes
    IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Users cannot change their own company_id';
    END IF;
    -- Prevent email changes (must go through Supabase Auth)
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      RAISE EXCEPTION 'Users cannot change their own email directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sensitive_field_changes ON public.users;
CREATE TRIGGER trg_prevent_sensitive_field_changes
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sensitive_field_changes();

-- ============================================================================
-- 2. RLS: Restrict company_subscriptions update to owner/admin roles
-- ============================================================================
-- Drop the existing overly-permissive update policy
DROP POLICY IF EXISTS company_subscriptions_update ON public.company_subscriptions;

-- Create restricted update policy: only owner/admin can modify subscriptions
CREATE POLICY company_subscriptions_update ON public.company_subscriptions
  FOR UPDATE
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 3. CHECK constraints on status columns
-- ============================================================================

-- company_subscriptions.status
DO $$ BEGIN
  ALTER TABLE public.company_subscriptions
    ADD CONSTRAINT chk_subscription_status
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete', 'paused'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- contacts.status
DO $$ BEGIN
  ALTER TABLE public.contacts
    ADD CONSTRAINT chk_contact_status
    CHECK (status IN ('new', 'pending', 'called', 'completed', 'failed', 'no_answer', 'busy', 'voicemail', 'callback', 'qualified', 'disqualified', 'do_not_call', 'invalid_number'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- agent_runs.status
DO $$ BEGIN
  ALTER TABLE public.agent_runs
    ADD CONSTRAINT chk_agent_run_status
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- call_queue.status
DO $$ BEGIN
  ALTER TABLE public.call_queue
    ADD CONSTRAINT chk_call_queue_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- campaign_queue.status
DO $$ BEGIN
  ALTER TABLE public.campaign_queue
    ADD CONSTRAINT chk_campaign_queue_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- follow_up_queue.status
DO $$ BEGIN
  ALTER TABLE public.follow_up_queue
    ADD CONSTRAINT chk_follow_up_queue_status
    CHECK (status IN ('pending', 'scheduled', 'processing', 'completed', 'failed', 'cancelled', 'skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- team_invitations.status
DO $$ BEGIN
  ALTER TABLE public.team_invitations
    ADD CONSTRAINT chk_team_invitation_status
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Soft-delete support for companies
-- ============================================================================
-- Add deleted_at column for soft-delete (30-day recovery window)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index for filtering active companies quickly
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies (deleted_at) WHERE deleted_at IS NULL;

-- Update RLS to exclude soft-deleted companies from normal queries
-- (admin can still see them for recovery)
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
    )
    AND (deleted_at IS NULL OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'owner')
    ))
  );

-- ============================================================================
-- 5. Add addon_type CHECK constraint on company_addons
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.company_addons
    ADD CONSTRAINT chk_addon_type
    CHECK (addon_type IN ('dedicated_number', 'recording_vault', 'calls_booster'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Done
-- ============================================================================
