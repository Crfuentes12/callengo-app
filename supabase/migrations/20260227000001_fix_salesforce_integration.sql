-- ============================================================================
-- MIGRATION: Fix Salesforce Integration Issues
-- Date: 2026-02-27
-- Purpose:
--   1. Fix salesforce_sync_logs sync_type check constraint to include 'selective'
--   2. Fix salesforce_sync_logs status check constraint to include 'completed_with_errors'
--   3. Fix RLS policies on salesforce_contact_mappings, salesforce_integrations,
--      and salesforce_sync_logs (replace overly permissive USING(true))
--   4. Add proper indexes for Salesforce tables
--   5. Add source column to contacts table for tracking origin (salesforce, csv, manual)
-- ============================================================================

-- ============================================================================
-- SECTION 1: FIX salesforce_sync_logs CHECK CONSTRAINTS
-- The code sends sync_type='selective' for partial syncs and
-- status='completed_with_errors' when sync completes with some errors.
-- Both values are rejected by the current check constraints.
-- ============================================================================

-- 1a. Drop and recreate sync_type check constraint to include 'selective'
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salesforce_sync_logs_sync_type_check'
    AND table_name = 'salesforce_sync_logs'
  ) THEN
    ALTER TABLE salesforce_sync_logs
      DROP CONSTRAINT salesforce_sync_logs_sync_type_check;
  END IF;

  -- Add updated constraint including 'selective'
  ALTER TABLE salesforce_sync_logs
    ADD CONSTRAINT salesforce_sync_logs_sync_type_check
    CHECK (sync_type IN ('full', 'incremental', 'selective', 'contacts', 'leads', 'events', 'users'));
END $$;

-- 1b. Drop and recreate status check constraint to include 'completed_with_errors'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'salesforce_sync_logs_status_check'
    AND table_name = 'salesforce_sync_logs'
  ) THEN
    ALTER TABLE salesforce_sync_logs
      DROP CONSTRAINT salesforce_sync_logs_status_check;
  END IF;

  ALTER TABLE salesforce_sync_logs
    ADD CONSTRAINT salesforce_sync_logs_status_check
    CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed'));
END $$;

-- ============================================================================
-- SECTION 2: FIX RLS POLICIES ON SALESFORCE TABLES
-- Current policies use USING(true) / WITH CHECK(true) which bypasses
-- row-level security entirely. Replace with:
--   - Service role: full access (for server-side sync operations)
--   - Company members: scoped to their company_id
-- ============================================================================

-- 2a. salesforce_integrations
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role full access on SF integrations" ON salesforce_integrations;

-- Add company-scoped policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_integrations'
    AND policyname = 'Company members can view SF integrations'
  ) THEN
    CREATE POLICY "Company members can view SF integrations"
      ON salesforce_integrations FOR SELECT
      USING (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      );
  END IF;

  -- Service role: full access for server-side operations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_integrations'
    AND policyname = 'Service role full access SF integrations'
  ) THEN
    CREATE POLICY "Service role full access SF integrations"
      ON salesforce_integrations FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 2b. salesforce_contact_mappings
DROP POLICY IF EXISTS "Service role full access on SF mappings" ON salesforce_contact_mappings;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_contact_mappings'
    AND policyname = 'Company members can view SF mappings'
  ) THEN
    CREATE POLICY "Company members can view SF mappings"
      ON salesforce_contact_mappings FOR SELECT
      USING (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_contact_mappings'
    AND policyname = 'Service role full access SF mappings'
  ) THEN
    CREATE POLICY "Service role full access SF mappings"
      ON salesforce_contact_mappings FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 2c. salesforce_sync_logs
DROP POLICY IF EXISTS "Service role full access on SF sync logs" ON salesforce_sync_logs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_sync_logs'
    AND policyname = 'Company members can view SF sync logs'
  ) THEN
    CREATE POLICY "Company members can view SF sync logs"
      ON salesforce_sync_logs FOR SELECT
      USING (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesforce_sync_logs'
    AND policyname = 'Service role full access SF sync logs'
  ) THEN
    CREATE POLICY "Service role full access SF sync logs"
      ON salesforce_sync_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: ADD source COLUMN TO contacts TABLE
-- Needed to track where contacts originated (salesforce, csv, manual, api)
-- This allows filtering/segmentation by source.
-- ============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- ============================================================================
-- SECTION 4: ADD INDEXES FOR SALESFORCE TABLES
-- Performance indexes for common query patterns
-- ============================================================================

-- Salesforce integrations: company lookup
CREATE INDEX IF NOT EXISTS idx_sf_integrations_company_active
  ON salesforce_integrations(company_id, is_active)
  WHERE is_active = true;

-- Salesforce contact mappings: integration + SF ID lookups
CREATE INDEX IF NOT EXISTS idx_sf_mappings_integration
  ON salesforce_contact_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_sf_mappings_sf_contact
  ON salesforce_contact_mappings(integration_id, sf_contact_id)
  WHERE sf_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sf_mappings_sf_lead
  ON salesforce_contact_mappings(integration_id, sf_lead_id)
  WHERE sf_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sf_mappings_callengo_contact
  ON salesforce_contact_mappings(callengo_contact_id);

-- Salesforce sync logs: company + status
CREATE INDEX IF NOT EXISTS idx_sf_sync_logs_company
  ON salesforce_sync_logs(company_id, started_at DESC);

-- Contacts: source filter (to find salesforce-imported contacts)
CREATE INDEX IF NOT EXISTS idx_contacts_source
  ON contacts(company_id, source)
  WHERE source IS NOT NULL AND source != 'manual';

-- Contacts: email lookup for dedup (used by sync)
CREATE INDEX IF NOT EXISTS idx_contacts_company_email
  ON contacts(company_id, email)
  WHERE email IS NOT NULL;

-- Contacts: phone_number lookup for dedup (used by sync)
CREATE INDEX IF NOT EXISTS idx_contacts_company_phone
  ON contacts(company_id, phone_number)
  WHERE phone_number IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Summary of changes:
-- 1. Fixed salesforce_sync_logs sync_type check constraint: added 'selective'
-- 2. Fixed salesforce_sync_logs status check constraint: added 'completed_with_errors'
-- 3. Replaced 3 overly permissive RLS policies with company-scoped + service_role policies
-- 4. Added 'source' column to contacts table for tracking origin
-- 5. Added 9 performance indexes for Salesforce and contacts tables
