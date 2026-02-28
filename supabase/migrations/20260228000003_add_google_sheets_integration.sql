-- ============================================================================
-- Google Sheets Integration Table
-- Stores OAuth tokens for Google Sheets access (contact import from sheets)
-- Available from Free plan onwards
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_sheets_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Google account info
  google_email TEXT,
  google_user_id TEXT,
  google_user_name TEXT,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  scopes TEXT[],
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active integration per company
  CONSTRAINT uq_google_sheets_company_active UNIQUE (company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_google_sheets_integrations_company ON public.google_sheets_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_integrations_active ON public.google_sheets_integrations(company_id, is_active);

-- RLS
ALTER TABLE public.google_sheets_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company google sheets integrations"
  ON public.google_sheets_integrations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert google sheets integrations for their company"
  ON public.google_sheets_integrations
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company google sheets integrations"
  ON public.google_sheets_integrations
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_google_sheets_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_google_sheets_integrations_updated_at
  BEFORE UPDATE ON public.google_sheets_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_sheets_integrations_updated_at();

-- Grant service role full access
GRANT ALL ON public.google_sheets_integrations TO service_role;
