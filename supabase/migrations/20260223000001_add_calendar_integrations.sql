-- ============================================================================
-- CALENDAR INTEGRATIONS & EVENTS
-- Full integration tables for Google Calendar and Calendly
-- ============================================================================

-- 1. calendar_integrations: stores OAuth tokens and connection state
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'calendly')),

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Provider-specific identifiers
  provider_email TEXT,               -- email associated with the provider account
  provider_user_id TEXT,             -- provider's user ID (e.g., Calendly user URI)
  provider_user_name TEXT,           -- display name from the provider

  -- Calendly specific
  calendly_organization_uri TEXT,    -- Calendly organization URI
  calendly_webhook_uri TEXT,         -- Calendly webhook subscription URI

  -- Google specific
  google_calendar_id TEXT DEFAULT 'primary', -- which Google Calendar to sync

  -- Sync state
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,                   -- Google Calendar sync token for incremental sync
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  scopes TEXT[],                     -- OAuth scopes granted
  raw_profile JSONB,                 -- Full profile response from provider

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one active integration per provider per user
  UNIQUE(company_id, user_id, provider)
);

-- 2. calendar_events: local copy of calendar events + Callengo-native events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES calendar_integrations(id) ON DELETE SET NULL,

  -- External references
  external_event_id TEXT,            -- Google event ID or Calendly event URI
  external_calendar_id TEXT,         -- Google calendar ID or Calendly event type

  -- Core event data
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  all_day BOOLEAN NOT NULL DEFAULT false,

  -- Callengo-specific fields
  event_type TEXT NOT NULL DEFAULT 'meeting' CHECK (event_type IN (
    'call', 'follow_up', 'no_show_retry', 'meeting',
    'appointment', 'callback', 'voicemail_followup'
  )),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'completed', 'no_show',
    'cancelled', 'rescheduled', 'pending_confirmation'
  )),

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'campaign', 'google_calendar', 'calendly',
    'ai_agent', 'follow_up_queue', 'webhook'
  )),

  -- Related entities
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  follow_up_id UUID REFERENCES follow_up_queue(id) ON DELETE SET NULL,

  -- Agent / automation data
  agent_name TEXT,                   -- which AI agent created/manages this
  ai_notes TEXT,                     -- AI-generated notes about this event
  confirmation_status TEXT CHECK (confirmation_status IN (
    'unconfirmed', 'confirmed', 'declined', 'tentative', 'no_response'
  )) DEFAULT 'unconfirmed',
  confirmation_attempts INTEGER DEFAULT 0,
  last_confirmation_at TIMESTAMPTZ,

  -- Rescheduling history
  original_start_time TIMESTAMPTZ,   -- original time if rescheduled
  rescheduled_count INTEGER DEFAULT 0,
  rescheduled_reason TEXT,

  -- Recurrence (from Google Calendar)
  recurrence_rule TEXT,              -- RRULE string
  recurring_event_id TEXT,           -- parent recurring event ID

  -- Attendees (JSON array)
  attendees JSONB DEFAULT '[]'::jsonb,

  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN (
    'synced', 'pending_push', 'pending_pull', 'conflict', 'error'
  )),
  sync_error TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,

  -- Plan-gating for premium features
  created_by_feature TEXT,           -- 'smart_followup', 'appointment_confirmation', etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. calendar_sync_log: track sync operations for debugging
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,

  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'push', 'pull', 'webhook')),
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),

  events_created INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_deleted INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- calendar_integrations indexes
CREATE INDEX idx_cal_integrations_company ON calendar_integrations(company_id);
CREATE INDEX idx_cal_integrations_user ON calendar_integrations(user_id);
CREATE INDEX idx_cal_integrations_provider ON calendar_integrations(provider);
CREATE INDEX idx_cal_integrations_active ON calendar_integrations(company_id, provider) WHERE is_active = true;

-- calendar_events indexes
CREATE INDEX idx_cal_events_company ON calendar_events(company_id);
CREATE INDEX idx_cal_events_integration ON calendar_events(integration_id);
CREATE INDEX idx_cal_events_start ON calendar_events(start_time);
CREATE INDEX idx_cal_events_end ON calendar_events(end_time);
CREATE INDEX idx_cal_events_status ON calendar_events(status);
CREATE INDEX idx_cal_events_type ON calendar_events(event_type);
CREATE INDEX idx_cal_events_source ON calendar_events(source);
CREATE INDEX idx_cal_events_contact ON calendar_events(contact_id);
CREATE INDEX idx_cal_events_external ON calendar_events(external_event_id);
CREATE INDEX idx_cal_events_sync ON calendar_events(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_cal_events_confirmation ON calendar_events(confirmation_status) WHERE confirmation_status != 'confirmed';
CREATE INDEX idx_cal_events_company_time ON calendar_events(company_id, start_time, end_time);

-- calendar_sync_log indexes
CREATE INDEX idx_cal_sync_log_integration ON calendar_sync_log(integration_id);
CREATE INDEX idx_cal_sync_log_company ON calendar_sync_log(company_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- calendar_integrations: users can see/manage their own company's integrations
CREATE POLICY "Users can view own company integrations"
  ON calendar_integrations FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company integrations"
  ON calendar_integrations FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own company integrations"
  ON calendar_integrations FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company integrations"
  ON calendar_integrations FOR DELETE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- calendar_events: users can see/manage their own company's events
CREATE POLICY "Users can view own company events"
  ON calendar_events FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company events"
  ON calendar_events FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own company events"
  ON calendar_events FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company events"
  ON calendar_events FOR DELETE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- calendar_sync_log: users can view their own company's sync logs
CREATE POLICY "Users can view own company sync logs"
  ON calendar_sync_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Service role bypasses RLS for API routes
-- (service role key used in server-side API routes already bypasses RLS)

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
