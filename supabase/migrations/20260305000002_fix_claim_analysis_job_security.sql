-- Migration: Fix claim_analysis_job security — require company_id filter
-- Date: 2026-03-05
--
-- The original claim_analysis_job() function (from 20260304000004) selects from
-- analysis_queue without any company_id filtering. Since it uses SECURITY DEFINER,
-- any authenticated user could claim any company's job via the RPC.
-- This migration drops the old function and recreates it with a mandatory
-- p_company_id parameter to enforce tenant isolation.

DROP FUNCTION IF EXISTS claim_analysis_job();

CREATE OR REPLACE FUNCTION claim_analysis_job(p_company_id UUID)
RETURNS SETOF analysis_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed analysis_queue;
BEGIN
  SELECT * INTO claimed
  FROM analysis_queue
  WHERE status = 'pending'
    AND company_id = p_company_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed.id IS NOT NULL THEN
    UPDATE analysis_queue
    SET status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id = claimed.id;

    claimed.status := 'processing';
    claimed.started_at := NOW();
    claimed.attempts := claimed.attempts + 1;
    RETURN NEXT claimed;
  END IF;
  RETURN;
END;
$$;
