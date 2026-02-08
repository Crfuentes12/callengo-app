-- Migration: Create cancellation feedback and retention tracking tables
-- Run this in your Supabase SQL editor

-- ============================================================
-- Table: cancellation_feedback
-- Stores all feedback from users going through cancellation flow
-- ============================================================
CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reason_details TEXT,
  plan_name TEXT,
  plan_slug TEXT,
  months_subscribed INTEGER DEFAULT 0,
  monthly_price NUMERIC(10,2) DEFAULT 0,
  was_offered_retention BOOLEAN DEFAULT FALSE,
  accepted_retention BOOLEAN DEFAULT FALSE,
  outcome TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_company ON cancellation_feedback(company_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_reason ON cancellation_feedback(reason);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_created ON cancellation_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_outcome ON cancellation_feedback(outcome);

-- ============================================================
-- Table: retention_offers
-- Tracks retention benefit usage per company
-- ============================================================
CREATE TABLE IF NOT EXISTS retention_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  times_redeemed INTEGER NOT NULL DEFAULT 0,
  last_redeemed_at TIMESTAMPTZ,
  next_eligible_after_months INTEGER NOT NULL DEFAULT 3,
  stripe_coupon_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS idx_retention_offers_company ON retention_offers(company_id);

-- ============================================================
-- Table: retention_offer_log
-- Detailed log of each retention offer event
-- ============================================================
CREATE TABLE IF NOT EXISTS retention_offer_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  months_paid_at_time INTEGER DEFAULT 0,
  months_required INTEGER DEFAULT 3,
  was_eligible BOOLEAN DEFAULT FALSE,
  stripe_coupon_id TEXT,
  plan_name TEXT,
  plan_slug TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_offer_log_company ON retention_offer_log(company_id);
CREATE INDEX IF NOT EXISTS idx_retention_offer_log_action ON retention_offer_log(action);
CREATE INDEX IF NOT EXISTS idx_retention_offer_log_created ON retention_offer_log(created_at);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_offer_log ENABLE ROW LEVEL SECURITY;

-- cancellation_feedback: users can read their own company's feedback
CREATE POLICY "Users can view own company cancellation feedback"
  ON cancellation_feedback FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- retention_offers: users can read their own company's retention status
CREATE POLICY "Users can view own company retention offers"
  ON retention_offers FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- retention_offer_log: users can read their own company's logs
CREATE POLICY "Users can view own company retention logs"
  ON retention_offer_log FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Service role (supabaseAdmin) bypasses all RLS so INSERT/UPDATE handled server-side
