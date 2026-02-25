-- Migration: Add calendar configuration columns to agent_runs (campaigns)
-- This migration adds dedicated columns for calendar-related campaign settings
-- that are configured during the new calendar step of campaign creation.
--
-- The calendarConfig is also stored in the settings JSONB, but these columns
-- provide faster querying and indexing for calendar-related operations.

-- Add calendar config columns to agent_runs
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS calendar_context_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS calendar_timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS calendar_working_hours_start TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS calendar_working_hours_end TEXT DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS calendar_working_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  ADD COLUMN IF NOT EXISTS calendar_exclude_holidays BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS callback_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS callback_max_attempts INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS smart_follow_up BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_video_provider TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS allow_rescheduling BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS no_show_auto_retry BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS no_show_retry_delay_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS default_meeting_duration INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS connected_integrations TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add appointment-specific tracking columns to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_rescheduled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_scheduled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_link TEXT,
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0;

-- Add agent_run_id to calendar_events for campaign tracking
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_link TEXT,
  ADD COLUMN IF NOT EXISTS video_provider TEXT;

-- Index for fast lookup of calendar events by campaign
CREATE INDEX IF NOT EXISTS idx_calendar_events_agent_run_id
  ON calendar_events(agent_run_id)
  WHERE agent_run_id IS NOT NULL;

-- Index for fast lookup of calendar events by call log
CREATE INDEX IF NOT EXISTS idx_calendar_events_call_log_id
  ON calendar_events(call_log_id)
  WHERE call_log_id IS NOT NULL;

-- Index for contacts with appointments
CREATE INDEX IF NOT EXISTS idx_contacts_appointment_date
  ON contacts(appointment_date)
  WHERE appointment_date IS NOT NULL;

-- Index for agent_runs with calendar config
CREATE INDEX IF NOT EXISTS idx_agent_runs_calendar_timezone
  ON agent_runs(calendar_timezone)
  WHERE calendar_timezone IS NOT NULL;

-- Add comment explaining the calendar configuration
COMMENT ON COLUMN agent_runs.calendar_context_enabled IS 'Whether the agent has access to calendar context (always true by default)';
COMMENT ON COLUMN agent_runs.preferred_video_provider IS 'Preferred video platform: none, google_meet, zoom, microsoft_teams';
COMMENT ON COLUMN agent_runs.connected_integrations IS 'Snapshot of connected calendar integrations at campaign creation time';
COMMENT ON COLUMN contacts.appointment_date IS 'Scheduled appointment date/time for appointment confirmation campaigns';
COMMENT ON COLUMN contacts.no_show_count IS 'Number of times the contact was a no-show';
