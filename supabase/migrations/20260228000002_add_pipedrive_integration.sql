-- ============================================================================
-- Pipedrive Integration Tables
-- Mirrors the Salesforce/HubSpot integration pattern for Pipedrive CRM
-- ============================================================================

-- 1. Pipedrive Integrations (stores OAuth tokens & connection metadata)
CREATE TABLE IF NOT EXISTS public.pipedrive_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Pipedrive account info
  pd_company_id TEXT NOT NULL,
  pd_company_name TEXT,
  pd_company_domain TEXT,
  pd_user_id TEXT NOT NULL,
  pd_user_email TEXT,
  pd_user_name TEXT,

  -- Metadata
  token_issued_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scopes TEXT[],
  raw_profile JSONB,
  api_domain TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pipedrive_integrations
CREATE INDEX IF NOT EXISTS idx_pipedrive_integrations_company_id ON public.pipedrive_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_integrations_user_id ON public.pipedrive_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_integrations_pd_company ON public.pipedrive_integrations(pd_company_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_integrations_active ON public.pipedrive_integrations(company_id, is_active);

-- RLS policies for pipedrive_integrations
ALTER TABLE public.pipedrive_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company pipedrive integrations"
  ON public.pipedrive_integrations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pipedrive integrations for their company"
  ON public.pipedrive_integrations
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company pipedrive integrations"
  ON public.pipedrive_integrations
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 2. Pipedrive Contact Mappings (maps Pipedrive records to Callengo contacts)
CREATE TABLE IF NOT EXISTS public.pipedrive_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.pipedrive_integrations(id) ON DELETE CASCADE,
  callengo_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- Pipedrive IDs
  pd_person_id TEXT,
  pd_object_type TEXT NOT NULL DEFAULT 'Person',

  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT NOT NULL DEFAULT 'inbound',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pipedrive_contact_mappings
CREATE INDEX IF NOT EXISTS idx_pipedrive_contact_mappings_integration_id ON public.pipedrive_contact_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_contact_mappings_callengo_contact ON public.pipedrive_contact_mappings(callengo_contact_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_contact_mappings_pd_person ON public.pipedrive_contact_mappings(integration_id, pd_person_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_contact_mappings_company ON public.pipedrive_contact_mappings(company_id);

-- RLS policies for pipedrive_contact_mappings
ALTER TABLE public.pipedrive_contact_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company pipedrive contact mappings"
  ON public.pipedrive_contact_mappings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pipedrive contact mappings for their company"
  ON public.pipedrive_contact_mappings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company pipedrive contact mappings"
  ON public.pipedrive_contact_mappings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 3. Pipedrive Sync Logs (audit trail of sync operations)
CREATE TABLE IF NOT EXISTS public.pipedrive_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.pipedrive_integrations(id) ON DELETE CASCADE,

  -- Sync details
  sync_type TEXT NOT NULL DEFAULT 'full',
  sync_direction TEXT NOT NULL DEFAULT 'inbound',
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pipedrive_sync_logs
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_logs_integration_id ON public.pipedrive_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_logs_company_id ON public.pipedrive_sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_logs_status ON public.pipedrive_sync_logs(status);

-- RLS policies for pipedrive_sync_logs
ALTER TABLE public.pipedrive_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company pipedrive sync logs"
  ON public.pipedrive_sync_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pipedrive sync logs for their company"
  ON public.pipedrive_sync_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company pipedrive sync logs"
  ON public.pipedrive_sync_logs
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Auto-update updated_at trigger for pipedrive_integrations
CREATE OR REPLACE FUNCTION public.update_pipedrive_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_pipedrive_integrations_updated_at
  BEFORE UPDATE ON public.pipedrive_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipedrive_integrations_updated_at();

-- Auto-update updated_at trigger for pipedrive_contact_mappings
CREATE OR REPLACE FUNCTION public.update_pipedrive_contact_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_pipedrive_contact_mappings_updated_at
  BEFORE UPDATE ON public.pipedrive_contact_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipedrive_contact_mappings_updated_at();

-- Grant service role full access (for server-side operations via supabaseAdmin)
GRANT ALL ON public.pipedrive_integrations TO service_role;
GRANT ALL ON public.pipedrive_contact_mappings TO service_role;
GRANT ALL ON public.pipedrive_sync_logs TO service_role;
