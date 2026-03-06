-- ============================================================================
-- MIGRATION: V4 Pricing, Sub-Accounts, Add-ons (March 2026)
-- ============================================================================
-- Summary of changes:
-- 1. Add calls_included column to subscription_plans
-- 2. Insert Growth plan ($179/mo) between Starter and Business
-- 3. Update all plan data (pricing, minutes, concurrency, overages)
-- 4. Remove Twilio BYOP from all plan features
-- 5. Zoom available from Free tier
-- 6. Extra seat price $49 for both Business and Teams
-- 7. Add bland_subaccount_id to company_settings
-- 8. Add recording storage columns to call_logs
-- 9. Create company_addons table
-- 10. Add add-on tracking to company_subscriptions
-- 11. Update admin_finances schema for add-on revenue tracking
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add calls_included to subscription_plans
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'calls_included'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN calls_included INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add bland_subaccount_id to company_settings
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'bland_subaccount_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN bland_subaccount_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add recording storage columns to call_logs
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'recording_stored_url'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN recording_stored_url TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'recording_expires_at'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN recording_expires_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'recording_archived'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN recording_archived BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add add-on tracking to company_subscriptions
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_subscriptions' AND column_name = 'addon_dedicated_number'
  ) THEN
    ALTER TABLE company_subscriptions ADD COLUMN addon_dedicated_number BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_subscriptions' AND column_name = 'addon_recording_vault'
  ) THEN
    ALTER TABLE company_subscriptions ADD COLUMN addon_recording_vault BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_subscriptions' AND column_name = 'addon_calls_booster'
  ) THEN
    ALTER TABLE company_subscriptions ADD COLUMN addon_calls_booster BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_subscriptions' AND column_name = 'addon_calls_booster_count'
  ) THEN
    ALTER TABLE company_subscriptions ADD COLUMN addon_calls_booster_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create company_addons table
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('dedicated_number', 'recording_vault', 'calls_booster')),
  stripe_subscription_item_id TEXT,
  stripe_price_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- dedicated_number specific
  dedicated_phone_number TEXT,
  bland_number_id TEXT,
  -- recording_vault specific: retention months
  recording_retention_months INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_addons_company_id ON company_addons(company_id);
CREATE INDEX IF NOT EXISTS idx_company_addons_type ON company_addons(addon_type);
CREATE INDEX IF NOT EXISTS idx_company_addons_status ON company_addons(status);

-- ============================================================================
-- STEP 6: Add add-on revenue tracking columns to admin_finances
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'addon_revenue'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN addon_revenue NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'dedicated_number_revenue'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN dedicated_number_revenue NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'recording_vault_revenue'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN recording_vault_revenue NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'calls_booster_revenue'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN calls_booster_revenue NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'active_subaccounts'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN active_subaccounts INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_finances' AND column_name = 'bland_infrastructure_cost'
  ) THEN
    ALTER TABLE admin_finances ADD COLUMN bland_infrastructure_cost NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Update FREE plan
-- ============================================================================

UPDATE subscription_plans SET
  calls_included = 10,
  minutes_included = 15,
  max_call_duration = 3,
  max_concurrent_calls = 1,
  price_per_extra_minute = 0,
  max_agents = 1,
  max_users = 1,
  extra_seat_price = 0,
  max_follow_up_attempts = 0,
  description = 'Try Callengo with 10 calls and 15 minutes — no credit card required',
  features = '[
    "10 calls included (trial)",
    "15 minutes total",
    "3 min max per call",
    "1 concurrent call",
    "1 AI agent (locked after selection)",
    "Full campaign wizard",
    "Google Calendar + Meet + Zoom",
    "Auto-rotated phone numbers",
    "Call analytics & transcriptions",
    "No overage — upgrade required after trial"
  ]'::jsonb
WHERE slug = 'free';

-- ============================================================================
-- STEP 8: Update STARTER plan ($99/mo)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 99,
  price_annual = 1044,
  calls_included = 200,
  minutes_included = 300,
  max_call_duration = 3,
  max_concurrent_calls = 2,
  price_per_extra_minute = 0.29,
  max_agents = 1,
  max_users = 1,
  extra_seat_price = 0,
  max_follow_up_attempts = 2,
  description = 'For solo founders and freelancers getting started with AI calling',
  features = '[
    "200 calls/month (300 min)",
    "3 min max per call",
    "2 concurrent calls",
    "1 active agent (switchable)",
    "Voicemail detection",
    "Follow-ups (max 2 attempts)",
    "Google Calendar + Meet + Zoom",
    "Slack notifications",
    "SimplyBook.me integration",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Auto-rotated phone numbers",
    "$0.29/min overage",
    "Async email support"
  ]'::jsonb
WHERE slug = 'starter';

-- ============================================================================
-- STEP 9: Insert GROWTH plan ($179/mo) — new plan between Starter and Business
-- ============================================================================

INSERT INTO subscription_plans (
  name, slug, description,
  price_monthly, price_annual,
  calls_included, minutes_included,
  max_call_duration, max_concurrent_calls,
  price_per_extra_minute,
  max_agents, max_users, extra_seat_price,
  max_follow_up_attempts,
  display_order, is_active,
  features
)
SELECT
  'Growth', 'growth',
  'For growing businesses ready to scale AI calling',
  179, 1908,
  400, 600,
  4, 3,
  0.26,
  -1, 1, 0,
  5,
  30, true,
  '[
    "400 calls/month (600 min)",
    "4 min max per call",
    "3 concurrent calls",
    "All agents simultaneously",
    "Voicemail detection & smart handling",
    "Smart follow-ups (max 5 attempts)",
    "Google Calendar + Meet + Zoom",
    "Slack notifications",
    "SimplyBook.me integration",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Auto-rotated phone numbers",
    "$0.26/min overage",
    "Priority email support"
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE slug = 'growth'
);

-- ============================================================================
-- STEP 10: Update BUSINESS plan ($299/mo)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 299,
  price_annual = 3228,
  calls_included = 800,
  minutes_included = 1200,
  max_call_duration = 5,
  max_concurrent_calls = 5,
  price_per_extra_minute = 0.23,
  max_agents = -1,
  max_users = 3,
  extra_seat_price = 49,
  max_follow_up_attempts = 5,
  description = 'For scaling businesses with CRM integrations and multiple users',
  features = '[
    "800 calls/month (1,200 min)",
    "5 min max per call",
    "5 concurrent calls",
    "All agents simultaneously",
    "3 users included ($49/extra seat)",
    "Smart follow-ups (max 5 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "HubSpot CRM integration",
    "Pipedrive CRM integration",
    "Zoho CRM integration",
    "Clio (legal practice management)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Auto-rotated phone numbers",
    "$0.23/min overage",
    "Priority email support"
  ]'::jsonb
WHERE slug = 'business';

-- ============================================================================
-- STEP 11: Update TEAMS plan ($649/mo)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 649,
  price_annual = 6948,
  calls_included = 1500,
  minutes_included = 2250,
  max_call_duration = 6,
  max_concurrent_calls = 10,
  price_per_extra_minute = 0.20,
  max_agents = -1,
  max_users = 5,
  extra_seat_price = 49,
  max_follow_up_attempts = 10,
  description = 'For collaborative teams with enterprise CRMs and user permissions',
  features = '[
    "1,500 calls/month (2,250 min)",
    "6 min max per call",
    "10 concurrent calls",
    "All agents simultaneously",
    "5 users included ($49/extra seat)",
    "User permissions (admin/member)",
    "Advanced follow-ups (max 10 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "Salesforce CRM integration",
    "Microsoft Dynamics 365 integration",
    "All Business integrations",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Auto-rotated phone numbers",
    "$0.20/min overage",
    "Priority support"
  ]'::jsonb
WHERE slug = 'teams';

-- ============================================================================
-- STEP 12: Update ENTERPRISE plan ($1,499/mo)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 1499,
  price_annual = 16188,
  calls_included = 4000,
  minutes_included = 6000,
  max_call_duration = 600,
  max_concurrent_calls = 999,
  price_per_extra_minute = 0.17,
  max_agents = -1,
  max_users = -1,
  extra_seat_price = 0,
  max_follow_up_attempts = -1,
  description = 'For large organizations with critical operations and SLA requirements',
  features = '[
    "4,000+ calls/month (6,000 min)",
    "Unlimited call duration",
    "Unlimited concurrent calls",
    "All agents simultaneously",
    "Unlimited users",
    "Unlimited follow-up attempts",
    "All calendar integrations",
    "Meet + Zoom + Microsoft Teams",
    "All CRM integrations (current + future)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Auto-rotated phone numbers",
    "$0.17/min overage",
    "SLA guarantee",
    "Dedicated account manager",
    "Annual contract"
  ]'::jsonb
WHERE slug = 'enterprise';

-- ============================================================================
-- STEP 13: Ensure display_order is correct
-- ============================================================================

UPDATE subscription_plans SET display_order = 10 WHERE slug = 'free';
UPDATE subscription_plans SET display_order = 20 WHERE slug = 'starter';
UPDATE subscription_plans SET display_order = 30 WHERE slug = 'growth';
UPDATE subscription_plans SET display_order = 40 WHERE slug = 'business';
UPDATE subscription_plans SET display_order = 50 WHERE slug = 'teams';
UPDATE subscription_plans SET display_order = 60 WHERE slug = 'enterprise';

-- ============================================================================
-- STEP 14: Create Supabase Storage bucket for call recordings
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  52428800,  -- 50MB per file
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: only service role can read/write recordings
-- Users can only access their own company's recordings via signed URLs from the API

-- ============================================================================
-- STEP 15: RLS for company_addons
-- ============================================================================

ALTER TABLE company_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_addons_company_members_select"
  ON company_addons FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (bypasses RLS)

COMMIT;
