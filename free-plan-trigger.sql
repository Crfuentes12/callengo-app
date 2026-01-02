-- Trigger: Automatically assign Free plan to new companies
-- This ensures all new users start with the Free plan (20 one-time minutes)

-- First, create a function that will assign the Free plan
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_company()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get the Free plan ID
  SELECT id INTO free_plan_id
  FROM public.subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  -- If Free plan exists, create a subscription for the new company
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.company_subscriptions (
      company_id,
      plan_id,
      billing_cycle,
      status,
      current_period_start,
      current_period_end,
      overage_enabled,
      overage_budget,
      overage_spent,
      overage_alert_level
    ) VALUES (
      NEW.id,
      free_plan_id,
      'monthly',
      'active',  -- Free plan is immediately active
      NOW(),
      NOW() + INTERVAL '30 days',  -- One month from now (but minutes don't renew)
      false,  -- Overage disabled by default
      0,
      0,
      70  -- Alert at 70% of overage budget
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_company_created_assign_free_plan ON public.companies;

-- Create the trigger
CREATE TRIGGER on_company_created_assign_free_plan
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_free_plan_to_new_company();

-- Note: This gives every new company 20 one-time minutes on the Free plan
-- The minutes are NOT monthly renewable - they're a one-time credit
-- Users can enable overage ($0.80/min, max $20) or upgrade to a paid plan
