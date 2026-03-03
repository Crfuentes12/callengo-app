-- ============================================================================
-- MIGRATION: V3 Pricing & Feature Gating (March 2026)
-- ============================================================================
-- Updates subscription plans to V3 pricing structure:
-- 1. Business: $279 -> $299, overage $0.35 -> $0.39
-- 2. Teams: $599 -> $649, 2400 -> 2500 min, overage $0.22 -> $0.29
-- 3. Enterprise: $1500 -> $1499, overage $0.18 -> $0.25
-- 4. Starter: overage $0.60 -> $0.55
-- 5. Free: overage set to 0 (blocked), max_agents = 1
-- 6. Add extra_seat_price and max_follow_up_attempts columns
-- 7. Update all plan features to remove fake features
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add new columns if they don't exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'extra_seat_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN extra_seat_price NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'max_follow_up_attempts'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN max_follow_up_attempts INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Update FREE plan
-- ============================================================================

UPDATE subscription_plans SET
  price_per_extra_minute = 0,
  max_agents = 1,
  extra_seat_price = 0,
  max_follow_up_attempts = 0,
  description = 'Try AI calling with 15 one-time minutes',
  features = '[
    "15 one-time minutes (no renewal)",
    "1 AI agent (locked after selection)",
    "Full campaign wizard experience",
    "Google Calendar + Google Meet",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers"
  ]'::jsonb
WHERE slug = 'free';

-- ============================================================================
-- STEP 3: Update STARTER plan
-- ============================================================================

UPDATE subscription_plans SET
  price_per_extra_minute = 0.55,
  max_agents = 1,
  extra_seat_price = 0,
  max_follow_up_attempts = 2,
  description = 'For solo founders and freelancers getting started',
  features = '[
    "300 minutes per month",
    "1 active agent (switchable)",
    "Voicemail detection",
    "Follow-ups (max 2 attempts)",
    "Google Calendar + Google Meet",
    "Slack notifications",
    "Zoom meetings",
    "SimplyBook.me integration",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Async email support"
  ]'::jsonb
WHERE slug = 'starter';

-- ============================================================================
-- STEP 4: Update BUSINESS plan ($279 -> $299)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 299,
  price_annual = 3228,
  price_per_extra_minute = 0.39,
  max_agents = -1,
  extra_seat_price = 0,
  max_follow_up_attempts = 5,
  description = 'For growing businesses ready to scale',
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
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Priority email support"
  ]'::jsonb
WHERE slug = 'business';

-- ============================================================================
-- STEP 5: Update TEAMS plan ($599 -> $649, 2400 -> 2500 min)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 649,
  price_annual = 6948,
  minutes_included = 2500,
  price_per_extra_minute = 0.29,
  max_agents = -1,
  extra_seat_price = 69,
  max_follow_up_attempts = 10,
  description = 'For teams that need collaboration and enterprise CRMs',
  features = '[
    "2,500 minutes per month",
    "All agents simultaneously",
    "5 users included ($69/extra seat)",
    "User permissions (admin/member)",
    "Advanced follow-ups (max 10 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Google Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "Twilio BYOP (own phone number)",
    "Salesforce CRM integration",
    "Microsoft Dynamics 365 integration",
    "Clio (legal practice management)",
    "HubSpot + Pipedrive + Zoho CRM",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Priority support"
  ]'::jsonb
WHERE slug = 'teams';

-- ============================================================================
-- STEP 6: Update ENTERPRISE plan ($1500 -> $1499)
-- ============================================================================

UPDATE subscription_plans SET
  price_monthly = 1499,
  price_annual = 16188,
  price_per_extra_minute = 0.25,
  max_agents = -1,
  extra_seat_price = 0,
  max_follow_up_attempts = -1,
  description = 'For large organizations with critical operations',
  features = '[
    "6,000 minutes per month",
    "All agents simultaneously",
    "Unlimited users",
    "Unlimited follow-up attempts",
    "Voicemail detection & smart handling",
    "All calendar integrations",
    "All video integrations",
    "All communication integrations",
    "All CRM integrations (current + future)",
    "Twilio BYOP (own phone number)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "SLA guarantee",
    "Dedicated account manager",
    "Annual contract"
  ]'::jsonb
WHERE slug = 'enterprise';

COMMIT;
