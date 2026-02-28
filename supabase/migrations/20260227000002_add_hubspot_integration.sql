-- ============================================================================
-- HubSpot Integration Tables
-- Mirrors the Salesforce integration pattern for HubSpot CRM
-- ============================================================================

-- 1. HubSpot Integrations (stores OAuth tokens & connection metadata)
CREATE TABLE IF NOT EXISTS public.hubspot_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,

  -- HubSpot account info
  hub_id TEXT NOT NULL,
  hub_domain TEXT,
  hs_user_id TEXT NOT NULL,
  hs_user_email TEXT,
  hs_display_name TEXT,

  -- Metadata
  token_issued_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scopes TEXT[],
  raw_profile JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for hubspot_integrations
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_company_id ON public.hubspot_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_user_id ON public.hubspot_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_hub_id ON public.hubspot_integrations(hub_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_active ON public.hubspot_integrations(company_id, is_active);

-- RLS policies for hubspot_integrations
ALTER TABLE public.hubspot_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company hubspot integrations"
  ON public.hubspot_integrations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hubspot integrations for their company"
  ON public.hubspot_integrations
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company hubspot integrations"
  ON public.hubspot_integrations
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 2. HubSpot Contact Mappings (maps HubSpot records to Callengo contacts)
CREATE TABLE IF NOT EXISTS public.hubspot_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.hubspot_integrations(id) ON DELETE CASCADE,
  callengo_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- HubSpot IDs
  hs_contact_id TEXT,
  hs_object_type TEXT NOT NULL DEFAULT 'Contact',

  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT NOT NULL DEFAULT 'inbound',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for hubspot_contact_mappings
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_integration_id ON public.hubspot_contact_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_callengo_contact ON public.hubspot_contact_mappings(callengo_contact_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_hs_contact ON public.hubspot_contact_mappings(integration_id, hs_contact_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_company ON public.hubspot_contact_mappings(company_id);

-- RLS policies for hubspot_contact_mappings
ALTER TABLE public.hubspot_contact_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company hubspot contact mappings"
  ON public.hubspot_contact_mappings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hubspot contact mappings for their company"
  ON public.hubspot_contact_mappings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company hubspot contact mappings"
  ON public.hubspot_contact_mappings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 3. HubSpot Sync Logs (audit trail of sync operations)
CREATE TABLE IF NOT EXISTS public.hubspot_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.hubspot_integrations(id) ON DELETE CASCADE,

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

-- Indexes for hubspot_sync_logs
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_integration_id ON public.hubspot_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_company_id ON public.hubspot_sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_status ON public.hubspot_sync_logs(status);

-- RLS policies for hubspot_sync_logs
ALTER TABLE public.hubspot_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company hubspot sync logs"
  ON public.hubspot_sync_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hubspot sync logs for their company"
  ON public.hubspot_sync_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company hubspot sync logs"
  ON public.hubspot_sync_logs
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Auto-update updated_at trigger for hubspot_integrations
CREATE OR REPLACE FUNCTION public.update_hubspot_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_hubspot_integrations_updated_at
  BEFORE UPDATE ON public.hubspot_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_integrations_updated_at();

-- Auto-update updated_at trigger for hubspot_contact_mappings
CREATE OR REPLACE FUNCTION public.update_hubspot_contact_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_hubspot_contact_mappings_updated_at
  BEFORE UPDATE ON public.hubspot_contact_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_contact_mappings_updated_at();

-- Grant service role full access (for server-side operations via supabaseAdmin)
GRANT ALL ON public.hubspot_integrations TO service_role;
GRANT ALL ON public.hubspot_contact_mappings TO service_role;
GRANT ALL ON public.hubspot_sync_logs TO service_role;
