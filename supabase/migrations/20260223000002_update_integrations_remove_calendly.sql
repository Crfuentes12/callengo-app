-- ============================================================================
-- UPDATE CALENDAR INTEGRATIONS: Remove Calendly, Add Microsoft Outlook
-- Add video call support, availability checking fields
-- ============================================================================

-- 1. Update provider CHECK constraint to replace calendly with microsoft_outlook
ALTER TABLE calendar_integrations DROP CONSTRAINT IF EXISTS calendar_integrations_provider_check;
ALTER TABLE calendar_integrations ADD CONSTRAINT calendar_integrations_provider_check
  CHECK (provider IN ('google_calendar', 'microsoft_outlook'));

-- 2. Add Microsoft-specific columns
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS microsoft_tenant_id TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS microsoft_calendar_id TEXT;

-- 3. Remove Calendly-specific columns (keep data integrity - mark as inactive first)
UPDATE calendar_integrations SET is_active = false WHERE provider = 'calendly';

-- Drop Calendly columns
ALTER TABLE calendar_integrations DROP COLUMN IF EXISTS calendly_organization_uri;
ALTER TABLE calendar_integrations DROP COLUMN IF EXISTS calendly_webhook_uri;

-- 4. Update calendar_events source to include microsoft_outlook
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_source_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_source_check
  CHECK (source IN (
    'manual', 'campaign', 'google_calendar', 'microsoft_outlook',
    'ai_agent', 'follow_up_queue', 'webhook'
  ));

-- 5. Add video call fields to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS video_link TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS video_provider TEXT
  CHECK (video_provider IN ('google_meet', 'zoom', 'microsoft_teams'));

-- 6. Add index for video provider lookups
CREATE INDEX IF NOT EXISTS idx_cal_events_video_provider
  ON calendar_events(video_provider) WHERE video_provider IS NOT NULL;

-- 7. Clean up any orphaned Calendly integration data
DELETE FROM calendar_sync_log WHERE integration_id IN (
  SELECT id FROM calendar_integrations WHERE provider = 'calendly'
);
DELETE FROM calendar_integrations WHERE provider = 'calendly';

-- 8. Update calendar_events to change calendly source to webhook for any existing records
UPDATE calendar_events SET source = 'webhook' WHERE source = 'calendly';
