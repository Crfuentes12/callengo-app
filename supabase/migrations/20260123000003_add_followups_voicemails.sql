-- Migration: Add Follow-ups and Voicemail systems
-- Created: 2026-01-23
-- Business Plan Features

-- ============================================
-- FOLLOW-UP SYSTEM
-- ============================================

-- Add follow-up settings to agent_runs (campaigns)
ALTER TABLE agent_runs
ADD COLUMN IF NOT EXISTS follow_up_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS follow_up_interval_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS follow_up_conditions JSONB DEFAULT '{"no_answer": true, "busy": true, "failed": false}'::jsonb;

-- Create follow_up_queue table
CREATE TABLE IF NOT EXISTS follow_up_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  original_call_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,

  -- Follow-up tracking
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_attempt_at TIMESTAMP WITH TIME ZONE,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, calling, completed, failed, cancelled
  reason VARCHAR(50), -- no_answer, busy, voicemail_left, answered, max_attempts_reached

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for follow-up queue
CREATE INDEX IF NOT EXISTS idx_followup_company_id ON follow_up_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_followup_agent_run_id ON follow_up_queue(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_followup_contact_id ON follow_up_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_next_attempt ON follow_up_queue(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_followup_status ON follow_up_queue(status);

-- ============================================
-- VOICEMAIL SYSTEM
-- ============================================

-- Add voicemail settings to agent_runs (campaigns)
ALTER TABLE agent_runs
ADD COLUMN IF NOT EXISTS voicemail_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voicemail_detection_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS voicemail_message TEXT,
ADD COLUMN IF NOT EXISTS voicemail_action VARCHAR(20) DEFAULT 'leave_message'; -- leave_message, hang_up, schedule_callback

-- Add voicemail tracking to call_logs
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS voicemail_detected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voicemail_left BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voicemail_message_url TEXT,
ADD COLUMN IF NOT EXISTS voicemail_duration INTEGER;

-- Create voicemail_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS voicemail_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Detection
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  detection_method VARCHAR(50), -- ai_analysis, beep_detection, silence_pattern

  -- Message
  message_left BOOLEAN DEFAULT false,
  message_text TEXT,
  message_duration INTEGER, -- seconds
  message_audio_url TEXT,

  -- Follow-up
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_id UUID REFERENCES follow_up_queue(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for voicemail logs
CREATE INDEX IF NOT EXISTS idx_voicemail_company_id ON voicemail_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_call_id ON voicemail_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_agent_run ON voicemail_logs(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_created_at ON voicemail_logs(created_at DESC);

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp for follow-up queue
CREATE OR REPLACE FUNCTION update_followup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for follow-up queue
DROP TRIGGER IF EXISTS update_followup_timestamp ON follow_up_queue;
CREATE TRIGGER update_followup_timestamp
  BEFORE UPDATE ON follow_up_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at();

-- Function to automatically create follow-up when call fails (no answer, busy, etc.)
CREATE OR REPLACE FUNCTION auto_create_followup()
RETURNS TRIGGER AS $$
DECLARE
  run_followup_enabled BOOLEAN;
  run_max_attempts INTEGER;
  run_interval_hours INTEGER;
  run_conditions JSONB;
  should_followup BOOLEAN;
BEGIN
  -- Only process completed calls
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'no-answer', 'busy', 'failed') AND OLD.status != NEW.status) THEN

    -- Get follow-up settings from agent_run
    SELECT follow_up_enabled, follow_up_max_attempts, follow_up_interval_hours, follow_up_conditions
    INTO run_followup_enabled, run_max_attempts, run_interval_hours, run_conditions
    FROM agent_runs
    WHERE id = NEW.agent_run_id;

    -- Check if follow-ups are enabled
    IF run_followup_enabled THEN
      -- Determine if we should create a follow-up based on call outcome
      should_followup := FALSE;

      IF NEW.status = 'no-answer' AND (run_conditions->>'no_answer')::boolean THEN
        should_followup := TRUE;
      ELSIF NEW.status = 'busy' AND (run_conditions->>'busy')::boolean THEN
        should_followup := TRUE;
      ELSIF NEW.status = 'failed' AND (run_conditions->>'failed')::boolean THEN
        should_followup := TRUE;
      END IF;

      -- Create follow-up if conditions are met
      IF should_followup AND NEW.contact_id IS NOT NULL THEN
        INSERT INTO follow_up_queue (
          company_id,
          agent_run_id,
          contact_id,
          original_call_id,
          max_attempts,
          next_attempt_at,
          attempt_number,
          reason
        ) VALUES (
          NEW.company_id,
          NEW.agent_run_id,
          NEW.contact_id,
          NEW.id,
          run_max_attempts,
          NOW() + (run_interval_hours || ' hours')::INTERVAL,
          1,
          NEW.status
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create follow-ups
DROP TRIGGER IF EXISTS trigger_auto_create_followup ON call_logs;
CREATE TRIGGER trigger_auto_create_followup
  AFTER UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_followup();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE voicemail_logs ENABLE ROW LEVEL SECURITY;

-- Follow-up queue policies
CREATE POLICY "Users can view follow-ups for their company"
  ON follow_up_queue FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage follow-ups for their company"
  ON follow_up_queue FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Voicemail logs policies
CREATE POLICY "Users can view voicemails for their company"
  ON voicemail_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert voicemail logs"
  ON voicemail_logs FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON follow_up_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON voicemail_logs TO authenticated;
