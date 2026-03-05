-- ============================================================================
-- Fix: Set search_path on SimplyBook trigger function
-- Resolves Supabase linter warning: function_search_path_mutable
--
-- Functions affected:
--   - public.update_simplybook_updated_at
--
-- Setting search_path = '' prevents search_path manipulation attacks
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_simplybook_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
