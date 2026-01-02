-- Migration: Add Free Plan (one-time 20 minutes)
-- This plan is for new users to test the platform

-- Insert Free Plan
INSERT INTO public.subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_annual,
  minutes_included,
  max_call_duration,
  price_per_extra_minute,
  max_users,
  max_concurrent_calls,
  max_calls_per_hour,
  max_calls_per_day,
  auto_overage_default,
  features,
  is_active
) VALUES (
  'Free',
  'free',
  'Try Callengo with 20 one-time minutes. Perfect for testing your first calls.',
  0,
  0,
  20,
  3,
  0.80,
  1,
  1,
  NULL,
  NULL,
  false,
  ARRAY[
    'Basic AI calling',
    'CSV/Excel export',
    'Email support only'
  ]::text[],
  true
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  minutes_included = EXCLUDED.minutes_included,
  max_call_duration = EXCLUDED.max_call_duration,
  price_per_extra_minute = EXCLUDED.price_per_extra_minute,
  max_users = EXCLUDED.max_users,
  max_concurrent_calls = EXCLUDED.max_concurrent_calls,
  max_calls_per_hour = EXCLUDED.max_calls_per_hour,
  max_calls_per_day = EXCLUDED.max_calls_per_day,
  auto_overage_default = EXCLUDED.auto_overage_default,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Note: This is a ONE-TIME credit, not monthly renewable
-- The 20 minutes are given once when the account is created
-- After that, user must upgrade or enable overage ($0.80/min)
