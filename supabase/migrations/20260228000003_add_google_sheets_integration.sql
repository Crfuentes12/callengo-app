-- ============================================================================
-- Google Sheets Integration Tables
-- Full bidirectional sync between Callengo contacts and Google Sheets
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

-- ============================================================================
-- Linked Sheets Table
-- Tracks which Google Spreadsheets/tabs are linked for bidirectional sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_sheets_linked_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.google_sheets_integrations(id) ON DELETE CASCADE,

  -- Spreadsheet identification
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT NOT NULL,
  sheet_tab_title TEXT NOT NULL,
  sheet_tab_id INTEGER NOT NULL DEFAULT 0,

  -- Column mapping (maps sheet columns to contact fields)
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Sync metadata
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional', -- inbound, outbound, bidirectional
  last_synced_at TIMESTAMPTZ,
  last_sync_row_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active link per spreadsheet+tab per company
  CONSTRAINT uq_linked_sheet_tab UNIQUE (company_id, spreadsheet_id, sheet_tab_title)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_linked_sheets_company ON public.google_sheets_linked_sheets(company_id);
CREATE INDEX IF NOT EXISTS idx_linked_sheets_integration ON public.google_sheets_linked_sheets(integration_id);
CREATE INDEX IF NOT EXISTS idx_linked_sheets_active ON public.google_sheets_linked_sheets(company_id, is_active);

-- RLS
ALTER TABLE public.google_sheets_linked_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company linked sheets"
  ON public.google_sheets_linked_sheets
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert linked sheets for their company"
  ON public.google_sheets_linked_sheets
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company linked sheets"
  ON public.google_sheets_linked_sheets
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company linked sheets"
  ON public.google_sheets_linked_sheets
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_google_sheets_linked_sheets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_google_sheets_linked_sheets_updated_at
  BEFORE UPDATE ON public.google_sheets_linked_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_sheets_linked_sheets_updated_at();

GRANT ALL ON public.google_sheets_linked_sheets TO service_role;
