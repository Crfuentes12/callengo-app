-- Check what agents currently exist in the database
SELECT
  slug,
  name,
  is_active,
  sort_order,
  created_at
FROM agent_templates
ORDER BY sort_order, created_at;

-- This will show you all agents in your database
-- You need to run the migration: supabase/migrations/20260123000001_configure_core_agents.sql
-- in your Supabase SQL Editor to activate the 3 core agents
