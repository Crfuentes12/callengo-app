-- Update subscription_plans features to English, add voicemail/followup tiers,
-- integration access levels, and correct plan descriptions.
-- Free plan: starter-like for 15 min then fully blocked, no recharge option.
-- Starter: voicemail + 1 auto follow-up
-- Business+: custom voicemail, unlimited follow-ups, smart follow-up
-- Enterprise: API access, custom workflows

-- Free Plan
UPDATE subscription_plans SET
  description = 'Test AI calling workflows risk-free',
  features = '[
    "15 free minutes (~5 test calls)",
    "Max 3 min per call",
    "1 concurrent call",
    "1 user",
    "1 active agent",
    "CSV/Excel export",
    "Email support only",
    "Slack, Zapier, Twilio, Webhooks integrations",
    "No recharge — upgrade to continue calling"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'free';

-- Starter Plan
UPDATE subscription_plans SET
  description = 'For solo operators & early validation. Cheaper than one SDR hour.',
  features = '[
    "300 minutes included (~100-150 calls)",
    "Max 3 min per call",
    "1 concurrent call",
    "1 user",
    "1 active agent",
    "CSV/Excel export",
    "Voicemail detection",
    "1 automatic follow-up per contact",
    "Slack, Zapier, Twilio, Webhooks integrations",
    "Google Calendar, Calendly, Google Sheets integrations",
    "$0.60/min overage"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'starter';

-- Business Plan
UPDATE subscription_plans SET
  description = 'Run AI calling as part of your operation. Hundreds of records per month.',
  features = '[
    "1,200 minutes included (~240-400 calls)",
    "Max 5 min per call",
    "3 concurrent calls",
    "3 users included",
    "Up to 3 agents in parallel",
    "Custom voicemail messages",
    "Unlimited automatic follow-ups",
    "Smart follow-up scheduling",
    "Advanced scheduling",
    "All Starter integrations",
    "Salesforce, HubSpot, Pipedrive, MS Teams, Zoho integrations",
    "$0.35/min overage"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'business';

-- Teams Plan
UPDATE subscription_plans SET
  description = 'Control, scale, and govern AI calls across your organization',
  features = '[
    "2,400 minutes included (~300-500 calls)",
    "Max 8 min per call",
    "10 concurrent calls",
    "5 users included",
    "$79 per additional user",
    "Unlimited agents",
    "Custom voicemail messages",
    "Unlimited automatic follow-ups",
    "Smart follow-up scheduling",
    "Retry logic + voicemail",
    "Priority support",
    "Governance & audit logs",
    "All Business integrations",
    "$0.22/min overage"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'teams';

-- Enterprise Plan
UPDATE subscription_plans SET
  description = 'Full control, compliance, and dedicated support for large-scale operations',
  features = '[
    "6,000 minutes included (custom available)",
    "Max 15 min per call (configurable)",
    "50 concurrent calls",
    "Unlimited users",
    "Custom workflows",
    "Dedicated account manager",
    "Guaranteed SLA",
    "Compliance & audit logs",
    "Custom voicemail messages",
    "Unlimited automatic follow-ups",
    "Smart follow-up scheduling",
    "All Teams integrations",
    "REST API access",
    "Custom integrations",
    "$0.18/min overage",
    "Annual contract available"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'enterprise';
