-- Migration: Analysis Queue + Resource Routing + SimplyBook Webhooks
-- Date: 2026-03-04

-- ============================================================================
-- 1. ANALYSIS QUEUE TABLE — Async AI analysis processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_log_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  agent_run_id UUID,
  template_slug TEXT NOT NULL,
  transcript TEXT NOT NULL,
  call_metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_status ON analysis_queue(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_company ON analysis_queue(company_id, status);

-- RPC for atomic job claiming (FOR UPDATE SKIP LOCKED pattern)
CREATE OR REPLACE FUNCTION claim_analysis_job()
RETURNS SETOF analysis_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed analysis_queue;
BEGIN
  SELECT * INTO claimed
  FROM analysis_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed.id IS NOT NULL THEN
    UPDATE analysis_queue
    SET status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id = claimed.id;

    claimed.status := 'processing';
    claimed.started_at := NOW();
    claimed.attempts := claimed.attempts + 1;
    RETURN NEXT claimed;
  END IF;
  RETURN;
END;
$$;

-- RLS policies
ALTER TABLE analysis_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_queue_company_read" ON analysis_queue
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- ============================================================================
-- 2. TEAM MEMBER CALENDAR ASSIGNMENTS — Resource/Doctor Routing
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_calendar_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'member',
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  google_calendar_id TEXT,
  microsoft_calendar_id TEXT,
  simplybook_provider_id INTEGER,
  specialties TEXT[] DEFAULT '{}',
  max_daily_appointments INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_calendar_company ON team_calendar_assignments(company_id, is_active);

-- Add assigned_to column to calendar_events for resource routing
DO $$ BEGIN
  ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES team_calendar_assignments(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add assigned_to_name for quick display
DO $$ BEGIN
  ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned ON calendar_events(assigned_to) WHERE assigned_to IS NOT NULL;

-- RLS policies
ALTER TABLE team_calendar_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_cal_read" ON team_calendar_assignments
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "team_cal_write" ON team_calendar_assignments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Auto-update trigger
CREATE TRIGGER update_team_calendar_assignments_updated_at
  BEFORE UPDATE ON team_calendar_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. SIMPLYBOOK WEBHOOK LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS simplybook_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sb_webhook_logs_company ON simplybook_webhook_logs(company_id, created_at DESC);

ALTER TABLE simplybook_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sb_webhook_logs_read" ON simplybook_webhook_logs
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
