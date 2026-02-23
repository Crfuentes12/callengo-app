-- ============================================================================
-- ADD MISSING COLUMNS TO calendar_integrations
-- The table was created with a minimal schema; this adds all columns
-- that the application code expects.
-- ============================================================================

-- Provider-specific identifiers
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_email TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_user_name TEXT;

-- Calendly specific
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS calendly_organization_uri TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS calendly_webhook_uri TEXT;

-- Google specific
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary';

-- Sync state
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- Metadata
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS raw_profile JSONB;
