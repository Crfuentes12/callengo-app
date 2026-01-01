-- Migration: Update Pricing Model from Calls to Minutes
-- This script migrates existing billing tables from calls-based to minutes-based pricing
-- Execute this in your Supabase SQL editor

-- Step 1: Add new columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS minutes_included INTEGER,
ADD COLUMN IF NOT EXISTS max_call_duration INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS price_per_extra_minute DECIMAL(10,4);

-- Step 2: Add new columns to usage_tracking
ALTER TABLE usage_tracking
ADD COLUMN IF NOT EXISTS minutes_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minutes_included INTEGER,
ADD COLUMN IF NOT EXISTS overage_minutes INTEGER;

-- Step 3: Migrate existing data (if any exists)
-- For subscription_plans: convert calls to approximate minutes (assuming 3 min avg)
UPDATE subscription_plans
SET
  minutes_included = COALESCE(calls_included * 3, 0),
  price_per_extra_minute = COALESCE(price_per_extra_call / 3.0, 0)
WHERE minutes_included IS NULL;

-- For usage_tracking: convert calls to approximate minutes
UPDATE usage_tracking
SET
  minutes_used = COALESCE(calls_made * 3, 0),
  minutes_included = COALESCE(calls_included * 3, 0)
WHERE minutes_used IS NULL OR minutes_included IS NULL;

-- Step 4: Drop old computed column and recreate with new formula
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS overage_calls;
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS overage_minutes;

-- Add computed column for overage_minutes
ALTER TABLE usage_tracking
ADD COLUMN overage_minutes INTEGER GENERATED ALWAYS AS (
  CASE WHEN minutes_used > minutes_included THEN minutes_used - minutes_included ELSE 0 END
) STORED;

-- Step 5: Make new columns NOT NULL after data migration
ALTER TABLE subscription_plans
ALTER COLUMN minutes_included SET NOT NULL,
ALTER COLUMN price_per_extra_minute SET NOT NULL;

ALTER TABLE usage_tracking
ALTER COLUMN minutes_included SET NOT NULL;

-- Step 6: Drop old columns (CAREFUL - this will delete data!)
-- Uncomment these lines only after verifying the migration worked correctly
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS calls_included;
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price_per_extra_call;
-- ALTER TABLE usage_tracking DROP COLUMN IF EXISTS calls_made;
-- ALTER TABLE usage_tracking DROP COLUMN IF EXISTS calls_included;

-- Step 7: Update existing plans with new optimized pricing
-- Delete old test data first (if any)
DELETE FROM usage_tracking;
DELETE FROM company_subscriptions WHERE plan_id IN (SELECT id FROM subscription_plans);
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

-- Step 8: Create trial subscriptions for existing companies without a subscription
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

-- Step 9: Add helpful comments
COMMENT ON TABLE subscription_plans IS 'Subscription plans with minutes-based pricing. Cost basis: ~$0.15/min. All plans maintain 40-55% margin on base minutes, higher margins on overages.';
COMMENT ON COLUMN subscription_plans.minutes_included IS 'Total minutes included in the plan per billing period';
COMMENT ON COLUMN subscription_plans.max_call_duration IS 'Maximum duration in minutes for a single call on this plan';
COMMENT ON COLUMN subscription_plans.price_per_extra_minute IS 'Price charged per minute over the included minutes';
COMMENT ON TABLE usage_tracking IS 'Tracks minute usage per billing period. Overage minutes are auto-calculated.';
COMMENT ON COLUMN usage_tracking.minutes_used IS 'Total minutes consumed in the current billing period';
COMMENT ON COLUMN usage_tracking.minutes_included IS 'Total minutes included in the subscription plan';
COMMENT ON COLUMN usage_tracking.overage_minutes IS 'Computed field: minutes_used - minutes_included (when positive)';

-- Step 10: Verify migration
SELECT
  name,
  slug,
  price_monthly,
  minutes_included,
  max_call_duration,
  price_per_extra_minute
FROM subscription_plans
ORDER BY display_order;
