-- Migration: Add Multi-User Support
-- Description: Adds user_id column to enable data isolation per MentraOS user
-- Date: 2025-01-04
--
-- This migration:
-- 1. Adds user_id column to people and conversation_entries tables
-- 2. Migrates existing data to 'legacy_user_001'
-- 3. Updates constraints to allow name collisions across users
-- 4. Adds indexes for efficient user-scoped queries
-- 5. Updates storage_stats view to show per-user statistics

-- =============================================================================
-- STEP 1: Add user_id columns (nullable initially for migration)
-- =============================================================================

ALTER TABLE people
ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE conversation_entries
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- =============================================================================
-- STEP 2: Migrate existing data to legacy user
-- =============================================================================

-- Assign all existing people to legacy user
UPDATE people
SET user_id = 'legacy_user_001'
WHERE user_id IS NULL;

-- Propagate user_id to conversation entries based on person ownership
UPDATE conversation_entries
SET user_id = (
  SELECT user_id
  FROM people
  WHERE people.id = conversation_entries.person_id
)
WHERE user_id IS NULL;

-- =============================================================================
-- STEP 3: Make user_id NOT NULL (now that data is migrated)
-- =============================================================================

ALTER TABLE people
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE conversation_entries
ALTER COLUMN user_id SET NOT NULL;

-- =============================================================================
-- STEP 4: Update constraints for multi-user support
-- =============================================================================

-- Drop the global UNIQUE constraint on name (if exists)
-- This allows different users to have contacts with the same name
ALTER TABLE people
DROP CONSTRAINT IF EXISTS people_name_key;

-- Add composite UNIQUE constraint: name must be unique PER USER
-- User A can have "John Smith" and User B can have a different "John Smith"
ALTER TABLE people
ADD CONSTRAINT people_name_user_unique UNIQUE (name, user_id);

-- =============================================================================
-- STEP 5: Add indexes for efficient user-scoped queries
-- =============================================================================

-- Index for filtering people by user_id
CREATE INDEX IF NOT EXISTS idx_people_user_id
ON people(user_id);

-- Composite index for user + name lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_people_user_name
ON people(user_id, name);

-- Index for filtering conversations by user
CREATE INDEX IF NOT EXISTS idx_conversations_user
ON conversation_entries(user_id);

-- Composite index for user + person_id lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_person
ON conversation_entries(user_id, person_id);

-- =============================================================================
-- STEP 6: Update storage_stats view for per-user statistics
-- =============================================================================

-- Drop the old view
DROP VIEW IF EXISTS storage_stats;

-- Create new view with per-user stats
CREATE OR REPLACE VIEW storage_stats AS
SELECT
  p.user_id,
  COUNT(DISTINCT p.id) as total_people,
  COUNT(ce.id) as total_conversations,
  COUNT(DISTINCT CASE WHEN p.voice_reference IS NOT NULL THEN p.id END) as people_with_voices,
  COALESCE(
    ROUND(AVG(ce_count.conversation_count), 1),
    0
  ) as avg_conversations_per_person
FROM people p
LEFT JOIN (
  SELECT person_id, COUNT(*) as conversation_count
  FROM conversation_entries
  GROUP BY person_id
) ce_count ON p.id = ce_count.person_id
LEFT JOIN conversation_entries ce ON p.id = ce.person_id
GROUP BY p.user_id;

-- =============================================================================
-- STEP 7: Add comment documentation
-- =============================================================================

COMMENT ON COLUMN people.user_id IS
  'MentraOS user ID - isolates data per user account';

COMMENT ON COLUMN conversation_entries.user_id IS
  'MentraOS user ID - denormalized for faster filtering';

COMMENT ON CONSTRAINT people_name_user_unique ON people IS
  'Allows multiple users to have contacts with the same name';

-- =============================================================================
-- Migration Complete!
-- =============================================================================

-- Verification queries (run these manually to confirm):
--
-- Check user_id is populated:
-- SELECT user_id, COUNT(*) FROM people GROUP BY user_id;
--
-- Check constraints:
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'people'::regclass;
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('people', 'conversation_entries');
--
-- Check stats view:
-- SELECT * FROM storage_stats;
