-- ============================================================================
-- SIMPLYBOOK.ME INTEGRATION TABLES
-- Mirrors the pattern used by other integrations (Salesforce, HubSpot, etc.)
-- SimplyBook uses token-based auth (company login + user credentials), NOT OAuth
-- ============================================================================

-- 1. simplybook_integrations: stores auth tokens and connection metadata
CREATE TABLE IF NOT EXISTS public.simplybook_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sb_company_login TEXT NOT NULL,
  sb_user_login TEXT NOT NULL,
  sb_token TEXT NOT NULL,
  sb_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  sb_user_id TEXT,
  sb_user_name TEXT,
  sb_user_email TEXT,
  sb_company_name TEXT,
  sb_domain TEXT,
  token_issued_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,
  is_active BOOLEAN DEFAULT true,
  raw_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. simplybook_sync_logs: audit trail for sync operations
CREATE TABLE IF NOT EXISTS public.simplybook_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.simplybook_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'inbound',
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. simplybook_contact_mappings: maps Callengo contacts to SimplyBook client IDs
CREATE TABLE IF NOT EXISTS public.simplybook_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.simplybook_integrations(id) ON DELETE CASCADE,
  callengo_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sb_client_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT DEFAULT 'inbound',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (integration_id, sb_client_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_simplybook_integrations_company
  ON public.simplybook_integrations (company_id);

CREATE INDEX IF NOT EXISTS idx_simplybook_integrations_active
  ON public.simplybook_integrations (company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_simplybook_sync_logs_integration
  ON public.simplybook_sync_logs (integration_id);

CREATE INDEX IF NOT EXISTS idx_simplybook_contact_mappings_integration
  ON public.simplybook_contact_mappings (integration_id);

CREATE INDEX IF NOT EXISTS idx_simplybook_contact_mappings_contact
  ON public.simplybook_contact_mappings (callengo_contact_id);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_simplybook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_simplybook_integrations_updated ON public.simplybook_integrations;
CREATE TRIGGER trg_simplybook_integrations_updated
  BEFORE UPDATE ON public.simplybook_integrations
  FOR EACH ROW EXECUTE FUNCTION update_simplybook_updated_at();

DROP TRIGGER IF EXISTS trg_simplybook_contact_mappings_updated ON public.simplybook_contact_mappings;
CREATE TRIGGER trg_simplybook_contact_mappings_updated
  BEFORE UPDATE ON public.simplybook_contact_mappings
  FOR EACH ROW EXECUTE FUNCTION update_simplybook_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.simplybook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simplybook_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simplybook_contact_mappings ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/modify their own company's data
CREATE POLICY simplybook_integrations_select ON public.simplybook_integrations
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_integrations_insert ON public.simplybook_integrations
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_integrations_update ON public.simplybook_integrations
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_sync_logs_select ON public.simplybook_sync_logs
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_contact_mappings_select ON public.simplybook_contact_mappings
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_contact_mappings_insert ON public.simplybook_contact_mappings
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY simplybook_contact_mappings_update ON public.simplybook_contact_mappings
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));
