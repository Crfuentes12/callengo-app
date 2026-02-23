-- ============================================================================
-- DEFINITIVE MIGRATION: Add ALL missing columns to calendar tables
-- Run this in Supabase SQL Editor to bring the DB in sync with the app code
-- ============================================================================

-- ============================================================================
-- 1. calendar_integrations - already has most columns, this is just safety
-- ============================================================================

ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_email TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_user_name TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS calendly_organization_uri TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS calendly_webhook_uri TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary';
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_token TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS raw_profile JSONB;

-- ============================================================================
-- 2. calendar_events - missing many columns the app code expects
-- ============================================================================

-- Location and timing
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

-- Contact info (denormalized for quick display)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Additional foreign keys
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS follow_up_id UUID REFERENCES follow_up_queue(id) ON DELETE SET NULL;

-- AI Agent / automation data
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS ai_notes TEXT;

-- Confirmation tracking
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS confirmation_attempts INTEGER DEFAULT 0;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS last_confirmation_at TIMESTAMPTZ;

-- Rescheduling history
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS original_start_time TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS rescheduled_count INTEGER DEFAULT 0;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS rescheduled_reason TEXT;

-- Recurrence (from Google Calendar)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurring_event_id TEXT;

-- Attendees
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;

-- Sync error detail
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- External calendar ID (Google calendar ID or Calendly event type)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS external_calendar_id TEXT;

-- Plan-gating for premium features
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_by_feature TEXT;

-- ============================================================================
-- 3. Fix legacy NOT NULL constraints on columns the new code doesn't use
--    The old schema had scheduled_at NOT NULL, but new code uses start_time/end_time
-- ============================================================================

ALTER TABLE calendar_events ALTER COLUMN scheduled_at DROP NOT NULL;
