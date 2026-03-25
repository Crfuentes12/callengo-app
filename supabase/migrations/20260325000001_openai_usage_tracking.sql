-- OpenAI Usage Tracking
-- Tracks every OpenAI API call: model, tokens, cost, feature, company
-- Used by Admin Command Center → AI Costs tab

CREATE TABLE IF NOT EXISTS openai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  feature_key TEXT NOT NULL,
    -- 'call_analysis' | 'contact_analysis' | 'cali_ai' | 'onboarding' | 'demo_analysis'
  api_key_label TEXT NOT NULL,
    -- human-readable label: 'Call Analysis Key' | 'Contact Analysis Key' | 'Cali AI Key' | 'Default Key'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  openai_request_id TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for admin queries
CREATE INDEX idx_openai_usage_logs_created_at ON openai_usage_logs(created_at DESC);
CREATE INDEX idx_openai_usage_logs_feature_key ON openai_usage_logs(feature_key, created_at DESC);
CREATE INDEX idx_openai_usage_logs_company_id ON openai_usage_logs(company_id, created_at DESC);

-- RLS: only admin/owner can read usage logs
ALTER TABLE openai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "openai_usage_admin_read" ON openai_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'owner')
    )
  );

-- Service role inserts (no auth.uid() needed for server-side inserts via service role)
CREATE POLICY "openai_usage_service_insert" ON openai_usage_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE openai_usage_logs IS 'Tracks every OpenAI API call for cost analysis and admin visibility. Inserted server-side via service role.';
COMMENT ON COLUMN openai_usage_logs.feature_key IS 'Which feature/product area triggered this call.';
COMMENT ON COLUMN openai_usage_logs.api_key_label IS 'Human-readable name of the API key used.';
COMMENT ON COLUMN openai_usage_logs.cost_usd IS 'Estimated cost in USD based on model pricing at time of call.';
COMMENT ON COLUMN openai_usage_logs.openai_request_id IS 'OpenAI request ID from response headers (x-request-id).';
