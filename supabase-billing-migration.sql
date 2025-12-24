-- Migration: Add Billing and Subscription functionality
-- This script creates billing tables for subscription plans, company subscriptions, and usage tracking
-- Execute this in your Supabase SQL editor

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_annual DECIMAL(10,2) NOT NULL,
  calls_included INTEGER NOT NULL,
  price_per_extra_call DECIMAL(10,4) NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 1,
  price_per_extra_user DECIMAL(10,2) DEFAULT 0,
  max_agents INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create company_subscriptions table
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trial')),
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMPTZ,
  extra_users INTEGER DEFAULT 0,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id)
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  calls_made INTEGER DEFAULT 0,
  calls_included INTEGER NOT NULL,
  overage_calls INTEGER GENERATED ALWAYS AS (
    CASE WHEN calls_made > calls_included THEN calls_made - calls_included ELSE 0 END
  ) STORED,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create billing_history table
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  invoice_url TEXT,
  stripe_invoice_id TEXT UNIQUE,
  billing_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_company_id ON usage_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_history_company_id ON billing_history(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_date ON billing_history(billing_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for company_subscriptions
CREATE POLICY "Users can view their company's subscription"
  ON company_subscriptions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's subscription"
  ON company_subscriptions FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view their company's usage"
  ON usage_tracking FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for billing_history
CREATE POLICY "Users can view their company's billing history"
  ON billing_history FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Create functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_company_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_usage_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_plans_updated_at();

DROP TRIGGER IF EXISTS update_company_subscriptions_updated_at ON company_subscriptions;
CREATE TRIGGER update_company_subscriptions_updated_at
  BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_company_subscriptions_updated_at();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking_updated_at();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_annual, calls_included, price_per_extra_call, max_users, price_per_extra_user, max_agents, features, display_order)
VALUES
  (
    'Starter',
    'starter',
    'Perfect for testing and getting started',
    99.00,
    87.00,
    100,
    1.20,
    1,
    0,
    1,
    '[
      "100 llamadas incluidas",
      "1 usuario",
      "1 agente activo",
      "CSV / Excel / Google Sheets",
      "Export básico",
      "$1.20 por llamada extra"
    ]'::jsonb,
    1
  ),
  (
    'Business',
    'business',
    'For businesses ready to scale operations',
    279.00,
    237.00,
    700,
    0.85,
    3,
    0,
    -1,
    '[
      "700 llamadas incluidas",
      "3 usuarios incluidos",
      "Todos los agentes",
      "Follow-ups automáticos",
      "Export avanzado",
      "Scheduling",
      "$0.85 por llamada extra"
    ]'::jsonb,
    2
  ),
  (
    'Teams',
    'teams',
    'For teams that need scale and governance',
    599.00,
    479.00,
    1800,
    0.65,
    5,
    79.00,
    -1,
    '[
      "1,800 llamadas incluidas",
      "5 usuarios incluidos",
      "$79 por usuario adicional",
      "Agentes ilimitados",
      "Retry logic + voicemail",
      "Priority support",
      "Governance básica",
      "$0.65 por llamada extra"
    ]'::jsonb,
    3
  ),
  (
    'Enterprise',
    'enterprise',
    'For large organizations with custom needs',
    1500.00,
    1500.00,
    3000,
    0.40,
    -1,
    0,
    -1,
    '[
      "3,000 llamadas incluidas",
      "Usuarios ilimitados",
      "Admin portal",
      "Compliance / logs",
      "SLA garantizado",
      "Integraciones personalizadas",
      "Soporte dedicado",
      "$0.40 por llamada extra",
      "Contrato anual"
    ]'::jsonb,
    4
  )
ON CONFLICT (slug) DO NOTHING;

-- Create default trial subscriptions for existing companies without a subscription
INSERT INTO company_subscriptions (company_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_end)
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
