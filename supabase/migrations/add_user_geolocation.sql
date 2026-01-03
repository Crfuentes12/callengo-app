-- Add geolocation and currency tracking to users table
-- Run this migration to enable automatic currency detection

-- Add new columns for location tracking
ALTER TABLE users
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS country_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS location_logs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_currency ON users(currency);
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);
CREATE INDEX IF NOT EXISTS idx_users_location_updated ON users(location_updated_at);

-- Create GIN index for location_logs JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_location_logs ON users USING gin(location_logs);

-- Add comment for documentation
COMMENT ON COLUMN users.currency IS 'User currency based on geolocation (USD, EUR, GBP)';
COMMENT ON COLUMN users.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN users.ip_address IS 'Last known IP address';
COMMENT ON COLUMN users.location_logs IS 'Array of location history with timestamps';
COMMENT ON COLUMN users.location_updated_at IS 'Last time location was updated';

-- Sample location_logs structure:
-- [
--   {
--     "timestamp": "2026-01-03T10:00:00Z",
--     "ip": "203.0.113.1",
--     "country": "US",
--     "city": "New York",
--     "currency": "USD"
--   }
-- ]
