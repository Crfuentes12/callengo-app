-- Migration: Remove unused analysis_questions column & consolidate max_users/max_seats
-- Part of Fase 3 audit recommendations (#21, #22)

-- ============================================================
-- 1. Remove unused analysis_questions column from agent_templates
-- This column was never used in the application code
-- ============================================================
ALTER TABLE agent_templates DROP COLUMN IF EXISTS analysis_questions;

-- ============================================================
-- 2. Consolidate max_users and max_seats
-- The codebase has both max_users (legacy) and max_seats (new)
-- Ensure max_seats is the canonical column on subscription_plans
-- and deprecate max_users / price_per_extra_user
-- ============================================================

-- Ensure max_seats column exists on subscription_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'max_seats'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN max_seats INTEGER NOT NULL DEFAULT 1;

    -- Copy values from max_users if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'max_users'
    ) THEN
      UPDATE subscription_plans SET max_seats = max_users;
    END IF;
  END IF;
END $$;

-- Ensure extra_seat_price column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'extra_seat_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN extra_seat_price NUMERIC(10,2) DEFAULT NULL;

    -- Copy from price_per_extra_user if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscription_plans' AND column_name = 'price_per_extra_user'
    ) THEN
      UPDATE subscription_plans SET extra_seat_price = price_per_extra_user;
    END IF;
  END IF;
END $$;

-- Add comments to clarify which columns are canonical
COMMENT ON COLUMN subscription_plans.max_seats IS 'Maximum included seats. -1 means unlimited.';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'max_users'
  ) THEN
    COMMENT ON COLUMN subscription_plans.max_users IS 'DEPRECATED: Use max_seats instead.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_per_extra_user'
  ) THEN
    COMMENT ON COLUMN subscription_plans.price_per_extra_user IS 'DEPRECATED: Use extra_seat_price instead.';
  END IF;
END $$;
