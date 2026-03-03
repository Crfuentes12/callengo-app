-- ============================================================================
-- MIGRATION: Fix Annual Pricing Display + Clio to Business Tier (March 2026)
-- ============================================================================
--
-- FIXES:
-- 1. price_annual was storing TOTAL annual price (e.g., 3228 for Business)
--    but the frontend code treats it as MONTHLY EQUIVALENT when billed annually.
--    Fix: Store monthly equivalent (e.g., 269 for Business = $269/mo * 12 = $3,228/yr)
--
-- 2. Clio integration moved from Teams to Business tier
--    (must-have for legal professionals, accessible at $299/mo)
--
-- PRICING WITH ~10-12% ANNUAL DISCOUNT:
--   Starter: $99/mo → $87/mo annual ($1,044/yr, ~12% savings)
--   Business: $299/mo → $269/mo annual ($3,228/yr, ~10% savings)
--   Teams: $649/mo → $579/mo annual ($6,948/yr, ~11% savings)
--   Enterprise: $1,499/mo → $1,349/mo annual ($16,188/yr, ~10% savings)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Fix price_annual to store monthly equivalent (not yearly total)
-- ============================================================================

-- Starter: $87/mo annual (12% off $99/mo)
UPDATE subscription_plans SET
  price_annual = 87
WHERE slug = 'starter';

-- Business: $269/mo annual (10% off $299/mo) + add Clio to features
UPDATE subscription_plans SET
  price_annual = 269,
  features = '[
    "1,200 minutes per month",
    "All agents simultaneously",
    "3 users included",
    "Smart follow-ups (max 5 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Google Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "Twilio BYOP (own phone number)",
    "HubSpot CRM integration",
    "Pipedrive CRM integration",
    "Zoho CRM integration",
    "Clio (legal practice management)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Priority email support"
  ]'::jsonb
WHERE slug = 'business';

-- Teams: $579/mo annual (11% off $649/mo) — Clio already included via "All Business"
UPDATE subscription_plans SET
  price_annual = 579
WHERE slug = 'teams';

-- Enterprise: $1,349/mo annual (10% off $1,499/mo)
UPDATE subscription_plans SET
  price_annual = 1349
WHERE slug = 'enterprise';

COMMIT;
