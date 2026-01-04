# Database Migrations

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file you want to run (e.g., `20260104000001_add_fav_voices.sql`)
4. Copy the SQL content
5. Paste it into the SQL Editor
6. Click **Run**

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

## Pending Migrations

### 20260104000001_add_fav_voices.sql

**Purpose**: Adds `fav_voices` column to the `users` table to store user-specific voice favorites.

**SQL to run**:
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fav_voices JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_fav_voices ON users USING gin(fav_voices);

COMMENT ON COLUMN users.fav_voices IS 'Array of favorite voice IDs selected by the user';
```

**Note**: The app will work without this migration, but favorites won't be persisted. Users will see a warning in the console if they try to save favorites before the migration is applied.
