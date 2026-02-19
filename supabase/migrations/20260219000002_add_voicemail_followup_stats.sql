-- Add voicemail and follow-up aggregate stats to agent_runs
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS voicemails_detected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voicemails_left INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_ups_scheduled INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_ups_completed INTEGER NOT NULL DEFAULT 0;
