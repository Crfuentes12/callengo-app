-- Outbound Webhooks System
-- Allows users to register webhook endpoints and receive real-time events from Callengo

-- ============================================================================
-- WEBHOOK ENDPOINTS - User-configured URLs to receive events
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Endpoint configuration
  url TEXT NOT NULL,
  description TEXT,
  secret TEXT NOT NULL, -- HMAC-SHA256 signing secret for payload verification

  -- Event subscriptions (which events this endpoint receives)
  events TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'call.completed', 'appointment.scheduled'}

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Health tracking
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Auto-disable after too many failures
  auto_disabled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by company
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_company ON webhook_endpoints(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(company_id, is_active);

-- ============================================================================
-- WEBHOOK DELIVERIES - Log of every webhook delivery attempt
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Event info
  event_type TEXT NOT NULL, -- e.g. 'call.completed'
  event_id TEXT NOT NULL, -- unique event identifier for idempotency
  payload JSONB NOT NULL, -- the full event payload sent

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  http_status INTEGER, -- response status code
  response_body TEXT, -- first 1KB of response body
  error_message TEXT,

  -- Timing
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  duration_ms INTEGER, -- how long the request took

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for delivery lookups
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_company ON webhook_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type, company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- Cleanup: auto-delete deliveries older than 30 days (optional, can be done via cron)

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints: users can only access their company's endpoints
CREATE POLICY webhook_endpoints_select ON webhook_endpoints
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY webhook_endpoints_insert ON webhook_endpoints
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY webhook_endpoints_update ON webhook_endpoints
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY webhook_endpoints_delete ON webhook_endpoints
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Webhook deliveries: users can only view their company's delivery logs
CREATE POLICY webhook_deliveries_select ON webhook_deliveries
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
