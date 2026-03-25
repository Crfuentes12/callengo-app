-- Migration: test_call_logs table
-- Tracks all test/demo calls made by users (onboarding + per-agent tests).
-- Separate from call_logs: test calls bypass billing/throttle, don't count against quotas.

CREATE TABLE IF NOT EXISTS test_call_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  bland_call_id       TEXT NOT NULL UNIQUE,
  agent_slug          TEXT NOT NULL CHECK (agent_slug IN ('lead-qualification', 'appointment-confirmation', 'data-validation')),
  agent_name          TEXT,
  -- Phone masked to last 4 digits + country code prefix for privacy
  phone_number_masked TEXT,
  status              TEXT NOT NULL DEFAULT 'initiated'
                        CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'no_answer', 'voicemail', 'busy', 'invalid')),
  duration_seconds    INT NOT NULL DEFAULT 0,
  is_onboarding       BOOLEAN NOT NULL DEFAULT false,
  answered_by         TEXT,                       -- 'human', 'voicemail', 'machine'
  bland_cost          NUMERIC(10, 4) DEFAULT 0,   -- $ cost from Bland webhook (price field)
  transcript          TEXT,
  summary             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for common admin queries
CREATE INDEX IF NOT EXISTS idx_test_call_logs_company_id   ON test_call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_test_call_logs_created_at   ON test_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_call_logs_agent_slug   ON test_call_logs(agent_slug);
CREATE INDEX IF NOT EXISTS idx_test_call_logs_bland_call_id ON test_call_logs(bland_call_id);
CREATE INDEX IF NOT EXISTS idx_test_call_logs_status       ON test_call_logs(status);

-- Composite index for rate-limit check: "has company X tested agent Y in the last 24h?"
CREATE INDEX IF NOT EXISTS idx_test_call_logs_ratelimit
  ON test_call_logs(company_id, agent_slug, created_at DESC);

-- Row Level Security
ALTER TABLE test_call_logs ENABLE ROW LEVEL SECURITY;

-- Companies can read/insert their own test calls; no UPDATE/DELETE for regular users
CREATE POLICY "test_call_logs_company_select" ON test_call_logs
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "test_call_logs_company_insert" ON test_call_logs
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role (admin) has full access — bypasses RLS
