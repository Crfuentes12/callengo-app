-- ============================================================================
-- Fix: Set search_path on Clio, Zoho, and Dynamics trigger functions
-- Resolves Supabase linter warning: function_search_path_mutable
--
-- Functions affected:
--   - public.update_clio_updated_at
--   - public.update_zoho_updated_at
--   - public.update_dynamics_updated_at
--
-- Setting search_path = '' prevents search_path manipulation attacks
-- where a malicious user could create objects in a schema that appears
-- earlier in the search_path, potentially hijacking function behavior.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================================

-- Fix update_clio_updated_at
CREATE OR REPLACE FUNCTION public.update_clio_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_zoho_updated_at
CREATE OR REPLACE FUNCTION public.update_zoho_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_dynamics_updated_at
CREATE OR REPLACE FUNCTION public.update_dynamics_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
