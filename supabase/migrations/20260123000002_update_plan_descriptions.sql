-- Migration: Update subscription plan descriptions with better positioning
-- Created: 2026-01-23

-- Update Free Plan
UPDATE subscription_plans
SET description = 'Test AI calling workflows risk-free'
WHERE slug = 'free';

-- Update Starter Plan
UPDATE subscription_plans
SET description = 'For solo operators & early validation. Cheaper than one SDR hour.'
WHERE slug = 'starter';

-- Update Business Plan
UPDATE subscription_plans
SET description = 'Run AI calling as part of your operation. Cleans hundreds of records per month.'
WHERE slug = 'business';

-- Update Teams Plan
UPDATE subscription_plans
SET description = 'Control, scale, and govern AI calls across your organization'
WHERE slug = 'teams';

-- Update Enterprise Plan
UPDATE subscription_plans
SET description = 'Full control, compliance, and dedicated support for large-scale operations'
WHERE slug = 'enterprise';
