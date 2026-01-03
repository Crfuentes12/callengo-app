-- Add Stripe fields to subscription_plans table
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_annual TEXT,
ADD COLUMN IF NOT EXISTS stripe_metered_price_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product_id
ON subscription_plans(stripe_product_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_monthly
ON subscription_plans(stripe_price_id_monthly);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_annual
ON subscription_plans(stripe_price_id_annual);

-- Add index to company_subscriptions for faster Stripe lookups
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_subscription_id
ON company_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_customer_id
ON company_subscriptions(stripe_customer_id);

-- Add index to billing_history for faster invoice lookups
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_invoice_id
ON billing_history(stripe_invoice_id);

-- Add payment_intent_id to billing_history for better tracking
ALTER TABLE billing_history
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_payment_intent_id
ON billing_history(stripe_payment_intent_id);

-- Add subscription item ID for metered billing
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_subscription_item_id
ON company_subscriptions(stripe_subscription_item_id);

-- Add table for storing Stripe events (idempotency)
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at ON stripe_events(created_at);

-- Add comments for documentation
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe Product ID';
COMMENT ON COLUMN subscription_plans.stripe_price_id_monthly IS 'Stripe Price ID for monthly billing';
COMMENT ON COLUMN subscription_plans.stripe_price_id_annual IS 'Stripe Price ID for annual billing';
COMMENT ON COLUMN subscription_plans.stripe_metered_price_id IS 'Stripe Price ID for metered/overage billing';
COMMENT ON COLUMN company_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID';
COMMENT ON COLUMN company_subscriptions.stripe_customer_id IS 'Stripe Customer ID';
COMMENT ON COLUMN company_subscriptions.stripe_subscription_item_id IS 'Stripe Subscription Item ID for metered billing';
COMMENT ON TABLE stripe_events IS 'Store Stripe webhook events for idempotency and auditing';
