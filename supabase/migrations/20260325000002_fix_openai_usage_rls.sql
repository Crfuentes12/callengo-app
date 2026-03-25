-- Fix RLS on openai_usage_logs
-- The INSERT policy WITH CHECK (true) is overly permissive and triggers a Supabase security warning.
-- The service role (used by all server-side tracking calls) bypasses RLS entirely,
-- so no INSERT policy is needed. Dropping it means:
--   - service role: can INSERT (bypasses RLS)
--   - authenticated users: BLOCKED (RLS enabled, no matching INSERT policy)
--   - anon: BLOCKED (RLS enabled, no matching INSERT policy)

DROP POLICY IF EXISTS "openai_usage_service_insert" ON openai_usage_logs;
