-- Integration Feedback
-- Allows users to submit feedback about integrations (suggestions, improvements, bugs, etc.)

CREATE TABLE IF NOT EXISTS integration_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('suggestion', 'improvement', 'new_integration', 'bug', 'other')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up feedback by company, user, and recency
CREATE INDEX IF NOT EXISTS idx_integration_feedback_company_user_created
  ON integration_feedback(company_id, user_id, created_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE integration_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback if they belong to the company
CREATE POLICY integration_feedback_insert ON integration_feedback
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- Users can select their own feedback
CREATE POLICY integration_feedback_select ON integration_feedback
  FOR SELECT USING (
    user_id = auth.uid()
  );
