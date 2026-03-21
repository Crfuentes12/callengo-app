-- ============================================================================
-- Migration: Admin Platform Configuration Table
-- Date: 2026-03-21
-- Purpose: Persistent storage for platform-wide admin settings, Bland AI
--          plan configuration, alerting thresholds, and audit logging.
--          Replaces volatile Redis-only plan caching with DB source of truth.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. admin_platform_config — Singleton table for platform settings
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_platform_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Bland AI Plan Configuration ──
  bland_plan text NOT NULL DEFAULT 'start',
  bland_cost_per_minute numeric(6,4) NOT NULL DEFAULT 0.14,
  bland_transfer_rate numeric(6,4) NOT NULL DEFAULT 0.05,
  bland_daily_cap integer NOT NULL DEFAULT 100,
  bland_hourly_cap integer NOT NULL DEFAULT 100,
  bland_concurrent_cap integer NOT NULL DEFAULT 10,
  bland_voice_clones integer NOT NULL DEFAULT 1,

  -- ── Bland AI Account State (cached from API) ──
  bland_account_balance numeric(10,2) DEFAULT 0,
  bland_account_plan text,
  bland_account_total_calls integer DEFAULT 0,
  bland_last_synced_at timestamptz,

  -- ── Platform Settings ──
  platform_name text NOT NULL DEFAULT 'Callengo',
  default_landing_page text NOT NULL DEFAULT '/home',
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,

  -- ── Alerting Thresholds ──
  alert_balance_warning numeric(10,2) NOT NULL DEFAULT 5.00,
  alert_balance_critical numeric(10,2) NOT NULL DEFAULT 1.00,
  alert_concurrency_warning_pct integer NOT NULL DEFAULT 80,
  alert_daily_usage_warning_pct integer NOT NULL DEFAULT 80,

  -- ── Metadata ──
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only ONE row can exist (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS admin_platform_config_singleton
  ON admin_platform_config ((true));

-- Insert default config row
INSERT INTO admin_platform_config (bland_plan, bland_cost_per_minute, bland_daily_cap, bland_hourly_cap, bland_concurrent_cap)
VALUES ('start', 0.14, 100, 100, 10)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. admin_audit_log — Track all admin actions for accountability
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,            -- e.g. 'bland_plan', 'company', 'subscription'
  entity_id text,              -- ID of the affected entity
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON admin_audit_log (action);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_id
  ON admin_audit_log (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS Policies
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE admin_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can read/write platform config
CREATE POLICY admin_platform_config_admin_access ON admin_platform_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'owner')
    )
  );

-- Only admins/owners can read audit log
CREATE POLICY admin_audit_log_admin_read ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'owner')
    )
  );

-- Service role can insert audit log entries
CREATE POLICY admin_audit_log_service_insert ON admin_audit_log
  FOR INSERT
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Auto-update updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_admin_platform_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_platform_config_updated_at
  BEFORE UPDATE ON admin_platform_config
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_platform_config_updated_at();
