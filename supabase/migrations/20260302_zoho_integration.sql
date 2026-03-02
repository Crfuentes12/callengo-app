-- ============================================================================
-- ZOHO CRM INTEGRATION TABLES
-- Mirrors the pattern used by Salesforce, HubSpot, Pipedrive, and Clio
-- ============================================================================

-- 1. zoho_integrations: stores OAuth tokens and connection metadata
CREATE TABLE IF NOT EXISTS public.zoho_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  zoho_user_id TEXT NOT NULL,
  zoho_user_name TEXT,
  zoho_user_email TEXT,
  zoho_org_name TEXT,
  zoho_org_id TEXT,
  zoho_domain TEXT DEFAULT 'https://www.zohoapis.com',
  token_issued_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,
  is_active BOOLEAN DEFAULT true,
  scopes TEXT[] DEFAULT NULL,
  raw_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. zoho_sync_logs: audit trail for sync operations
CREATE TABLE IF NOT EXISTS public.zoho_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.zoho_integrations(id) ON DELETE CASCADE,
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

-- 3. zoho_contact_mappings: maps Callengo contacts to Zoho contacts/leads
CREATE TABLE IF NOT EXISTS public.zoho_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.zoho_integrations(id) ON DELETE CASCADE,
  callengo_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  zoho_contact_id TEXT NOT NULL,
  zoho_object_type TEXT DEFAULT 'Contacts',
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT DEFAULT 'inbound',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (integration_id, zoho_contact_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zoho_integrations_company ON public.zoho_integrations(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_logs_integration ON public.zoho_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_zoho_contact_mappings_integration ON public.zoho_contact_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_zoho_contact_mappings_callengo ON public.zoho_contact_mappings(callengo_contact_id);

-- ============================================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_zoho_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_zoho_integrations_updated_at
  BEFORE UPDATE ON public.zoho_integrations
  FOR EACH ROW EXECUTE FUNCTION update_zoho_updated_at();

CREATE TRIGGER trg_zoho_contact_mappings_updated_at
  BEFORE UPDATE ON public.zoho_contact_mappings
  FOR EACH ROW EXECUTE FUNCTION update_zoho_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.zoho_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_contact_mappings ENABLE ROW LEVEL SECURITY;

-- zoho_integrations: users can see their company's integrations
CREATE POLICY zoho_integrations_select ON public.zoho_integrations
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY zoho_integrations_insert ON public.zoho_integrations
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY zoho_integrations_update ON public.zoho_integrations
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- zoho_sync_logs: users can see their company's sync logs
CREATE POLICY zoho_sync_logs_select ON public.zoho_sync_logs
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- zoho_contact_mappings: users can see their company's mappings
CREATE POLICY zoho_contact_mappings_select ON public.zoho_contact_mappings
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
