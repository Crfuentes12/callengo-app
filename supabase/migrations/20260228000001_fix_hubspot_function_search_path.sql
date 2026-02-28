-- ============================================================================
-- Fix: Set search_path on HubSpot trigger functions
-- Resolves Supabase linter warning: function_search_path_mutable
-- ============================================================================

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
