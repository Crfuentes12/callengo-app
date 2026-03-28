-- TTS Voice Sample Caching & Cost Tracking
-- Global cache for generated voice samples + per-generation cost logging
-- Used by /api/voices/sample and Admin Command Center → Finances tab

-- ── 1. Storage bucket for cached voice samples ─────────────────────
-- Global cache: one audio file per voice, shared across all companies.
-- File naming: {voiceId}.wav
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-samples',
  'voice-samples',
  true,
  10485760,  -- 10MB max per file
  NULL       -- Allow all mime types (Bland returns varying content types)
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = NULL;

-- Public read access (anyone can download cached samples)
CREATE POLICY "voice_samples_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-samples');

-- Service role write access (only server can upload)
CREATE POLICY "voice_samples_service_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-samples');

CREATE POLICY "voice_samples_service_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'voice-samples');

CREATE POLICY "voice_samples_service_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'voice-samples');

-- ── 2. TTS usage tracking table ────────────────────────────────────
-- Logs every TTS generation (not cached plays) for cost visibility.
-- Pattern follows openai_usage_logs.

CREATE TABLE IF NOT EXISTS tts_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  characters_count INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  bland_request_id TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for admin queries
CREATE INDEX idx_tts_usage_logs_created_at ON tts_usage_logs(created_at DESC);
CREATE INDEX idx_tts_usage_logs_company_id ON tts_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_tts_usage_logs_voice_id ON tts_usage_logs(voice_id);

-- RLS: only admin/owner can read usage logs
ALTER TABLE tts_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tts_usage_admin_read" ON tts_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'owner')
    )
  );

-- Service role inserts (server-side via service role key)
CREATE POLICY "tts_usage_service_insert" ON tts_usage_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE tts_usage_logs IS 'Tracks every Bland AI TTS generation for cost analysis. Cached plays are not logged. Inserted server-side via service role.';
COMMENT ON COLUMN tts_usage_logs.voice_id IS 'Bland AI voice UUID.';
COMMENT ON COLUMN tts_usage_logs.characters_count IS 'Number of characters in the sample text sent to Bland.';
COMMENT ON COLUMN tts_usage_logs.cost_usd IS 'Actual cost in USD from Bland x-cost response header.';
COMMENT ON COLUMN tts_usage_logs.cached IS 'Whether this was served from cache (always false for new generations; true entries are optional for auditing).';
