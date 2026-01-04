-- Add favorite voices tracking to users table
-- Run this migration to enable user-specific voice favorites

-- Add new column for favorite voices
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fav_voices JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for fav_voices JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_fav_voices ON users USING gin(fav_voices);

-- Add comment for documentation
COMMENT ON COLUMN users.fav_voices IS 'Array of favorite voice IDs selected by the user';

-- Sample fav_voices structure:
-- [
--   "37b3f1c8-a01e-4d70-b251-294733f08371",
--   "ff2c405b-3dba-41e0-9261-bc8ee3f91f46",
--   "13843c96-ab9e-4938-baf3-ad53fcee541d"
-- ]
