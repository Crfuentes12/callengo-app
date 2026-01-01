-- ============================================================================
-- MIGRATION: Transform Pricing from Calls to Minutes Model
-- ============================================================================
-- This script migrates your existing subscription_plans table to the new
-- minutes-based pricing model with optimized margins.
--
-- WHAT IT DOES:
-- 1. Adds new columns (minutes_included, max_call_duration, price_per_extra_minute)
-- 2. Deletes old pricing plans
-- 3. Inserts new optimized plans
-- 4. Optionally removes old columns
--
-- IMPORTANT: This will DELETE existing subscription plans and recreate them.
-- Any active subscriptions will need to be reassigned to new plan IDs.
-- ============================================================================

-- STEP 1: Add new columns to subscription_plans
-- ============================================================================
DO $$
BEGIN
  -- Add minutes_included column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    AND column_name = 'minutes_included'
  ) THEN
    ALTER TABLE subscription_plans
    ADD COLUMN minutes_included INTEGER;
  END IF;

  -- Add max_call_duration column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    AND column_name = 'max_call_duration'
  ) THEN
    ALTER TABLE subscription_plans
    ADD COLUMN max_call_duration INTEGER DEFAULT 10;
  END IF;

  -- Add price_per_extra_minute column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    AND column_name = 'price_per_extra_minute'
  ) THEN
    ALTER TABLE subscription_plans
    ADD COLUMN price_per_extra_minute DECIMAL(10,4);
  END IF;
END $$;

-- STEP 2: Add new columns to usage_tracking
-- ============================================================================
DO $$
BEGIN
  -- Add minutes_used column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking'
    AND column_name = 'minutes_used'
  ) THEN
    ALTER TABLE usage_tracking
    ADD COLUMN minutes_used INTEGER DEFAULT 0;
  END IF;

  -- Add minutes_included column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking'
    AND column_name = 'minutes_included'
  ) THEN
    ALTER TABLE usage_tracking
    ADD COLUMN minutes_included INTEGER;
  END IF;
END $$;

-- STEP 3: Migrate existing usage data (if any)
-- ============================================================================
-- Convert calls to approximate minutes (3 min average per call)
UPDATE usage_tracking
SET
  minutes_used = COALESCE(calls_made * 3, 0),
  minutes_included = COALESCE(calls_included * 3, 0)
WHERE minutes_used IS NULL OR minutes_included IS NULL;

-- STEP 4: Recreate overage calculation for minutes
-- ============================================================================
-- Drop old computed column
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS overage_calls;
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS overage_minutes;

-- Add new computed column for overage_minutes
ALTER TABLE usage_tracking
ADD COLUMN overage_minutes INTEGER GENERATED ALWAYS AS (
  CASE WHEN minutes_used > COALESCE(minutes_included, 0)
  THEN minutes_used - minutes_included
  ELSE 0 END
) STORED;

-- STEP 5: Delete old subscription plans and insert new ones
-- ============================================================================
-- Save IDs of companies with active subscriptions
CREATE TEMP TABLE temp_active_subscriptions AS
SELECT DISTINCT company_id, billing_cycle, status
FROM company_subscriptions;

-- Delete existing subscriptions (will be recreated)
DELETE FROM company_subscriptions;

-- Delete old plans
DELETE FROM subscription_plans;

-- Insert new optimized pricing plans
INSERT INTO subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_annual,
  minutes_included,
  max_call_duration,
  price_per_extra_minute,
  max_users,
  price_per_extra_user,
  max_agents,
  features,
  display_order,
  is_active
) VALUES
  -- STARTER PLAN
  (
    'Starter',
    'starter',
    'Perfect for testing and validation',
    99.00,
    89.00,
    300,
    3,
    0.60,
    1,
    0,
    1,
    '[
      "300 minutos incluidos (~100 llamadas)",
      "Máx 3 min por llamada",
      "1 usuario",
      "1 agente activo",
      "CSV / Excel export",
      "$0.60/min adicional"
    ]'::jsonb,
    1,
    true
  ),
  -- BUSINESS PLAN
  (
    'Business',
    'business',
    'For businesses ready to scale',
    279.00,
    249.00,
    1200,
    5,
    0.35,
    3,
    0,
    -1,
    '[
      "1,200 minutos incluidos (~400 llamadas)",
      "Máx 5 min por llamada",
      "3 usuarios incluidos",
      "Agentes ilimitados",
      "Follow-ups automáticos",
      "Scheduling avanzado",
      "$0.35/min adicional"
    ]'::jsonb,
    2,
    true
  ),
  -- TEAMS PLAN
  (
    'Teams',
    'teams',
    'For teams that need scale and governance',
    599.00,
    529.00,
    2400,
    8,
    0.22,
    5,
    79.00,
    -1,
    '[
      "2,400 minutos incluidos (~600 llamadas)",
      "Máx 8 min por llamada",
      "5 usuarios incluidos",
      "$79 por usuario adicional",
      "Agentes ilimitados",
      "Retry logic + voicemail",
      "Priority support",
      "Governance & logs",
      "$0.22/min adicional"
    ]'::jsonb,
    3,
    true
  ),
  -- ENTERPRISE PLAN
  (
    'Enterprise',
    'enterprise',
    'For large organizations with custom needs',
    1500.00,
    1350.00,
    6000,
    15,
    0.18,
    -1,
    0,
    -1,
    '[
      "6,000 minutos incluidos (custom)",
      "Sin límite de duración",
      "Usuarios ilimitados",
      "Custom workflows",
      "Dedicated account manager",
      "SLA garantizado",
      "Compliance & audit logs",
      "Integraciones personalizadas",
      "$0.18/min adicional",
      "Contrato anual"
    ]'::jsonb,
    4,
    true
  );

-- STEP 6: Recreate subscriptions for companies
-- ============================================================================
-- Recreate subscriptions for companies that had them
INSERT INTO company_subscriptions (
  company_id,
  plan_id,
  billing_cycle,
  status,
  current_period_start,
  current_period_end,
  trial_end
)
SELECT
  t.company_id,
  (SELECT id FROM subscription_plans WHERE slug = 'starter' LIMIT 1),
  COALESCE(t.billing_cycle, 'monthly'),
  CASE
    WHEN t.status = 'trial' THEN 'trial'
    ELSE 'active'
  END,
  now(),
  now() + CASE
    WHEN COALESCE(t.billing_cycle, 'monthly') = 'monthly' THEN interval '30 days'
    ELSE interval '1 year'
  END,
  CASE
    WHEN t.status = 'trial' THEN now() + interval '14 days'
    ELSE NULL
  END
FROM temp_active_subscriptions t;

-- Create trial subscriptions for companies that didn't have one
INSERT INTO company_subscriptions (
  company_id,
  plan_id,
  billing_cycle,
  status,
  current_period_start,
  current_period_end,
  trial_end
)
SELECT
  c.id,
  (SELECT id FROM subscription_plans WHERE slug = 'starter' LIMIT 1),
  'monthly',
  'trial',
  now(),
  now() + interval '30 days',
  now() + interval '14 days'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM company_subscriptions cs
  WHERE cs.company_id = c.id
);

-- Clean up temp table
DROP TABLE IF EXISTS temp_active_subscriptions;

-- STEP 7: Make new columns NOT NULL
-- ============================================================================
ALTER TABLE subscription_plans
ALTER COLUMN minutes_included SET NOT NULL,
ALTER COLUMN price_per_extra_minute SET NOT NULL;

ALTER TABLE usage_tracking
ALTER COLUMN minutes_included SET NOT NULL;

-- STEP 8: Add helpful comments
-- ============================================================================
COMMENT ON TABLE subscription_plans IS 'Subscription plans with minutes-based pricing. Cost basis: ~$0.15/min. All plans maintain 40-55% margin on base minutes, higher margins on overages.';
COMMENT ON COLUMN subscription_plans.minutes_included IS 'Total minutes included in the plan per billing period';
COMMENT ON COLUMN subscription_plans.max_call_duration IS 'Maximum duration in minutes for a single call on this plan';
COMMENT ON COLUMN subscription_plans.price_per_extra_minute IS 'Price charged per minute over the included minutes';
COMMENT ON TABLE usage_tracking IS 'Tracks minute usage per billing period. Overage minutes are auto-calculated.';
COMMENT ON COLUMN usage_tracking.minutes_used IS 'Total minutes consumed in the current billing period';
COMMENT ON COLUMN usage_tracking.minutes_included IS 'Total minutes included in the subscription plan';
COMMENT ON COLUMN usage_tracking.overage_minutes IS 'Computed field: minutes_used - minutes_included (when positive)';

-- STEP 9 (OPTIONAL): Drop old columns
-- ============================================================================
-- ⚠️ WARNING: Uncomment these lines ONLY after verifying everything works!
-- This will permanently delete the old pricing columns.
--
-- ALTER TABLE subscription_plans
-- DROP COLUMN IF EXISTS calls_included,
-- DROP COLUMN IF EXISTS price_per_extra_call;
--
-- ALTER TABLE usage_tracking
-- DROP COLUMN IF EXISTS calls_made,
-- DROP COLUMN IF EXISTS calls_included;

-- STEP 10: Verify migration
-- ============================================================================
SELECT
  '✅ Migration Complete!' as status,
  'New pricing plans installed' as message;

-- Show new plans
SELECT
  name,
  slug,
  price_monthly as monthly,
  price_annual as annual,
  minutes_included as minutes,
  max_call_duration as max_duration,
  price_per_extra_minute as overage_rate,
  display_order
FROM subscription_plans
ORDER BY display_order;

-- Show column structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND table_schema = 'public'
  AND column_name IN (
    'minutes_included',
    'max_call_duration',
    'price_per_extra_minute',
    'calls_included',
    'price_per_extra_call'
  )
ORDER BY column_name;
