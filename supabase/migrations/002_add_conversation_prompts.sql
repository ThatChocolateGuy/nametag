-- Migration: Add conversation prompt fields to people table
-- Created: 2025-11-07
-- Purpose: Support AI-generated conversation prompts for G1 display

-- Add conversation prompt columns to people table
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS conversation_prompt TEXT,
  ADD COLUMN IF NOT EXISTS prompt_generated_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS prompt_shown_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_prompt_shown TIMESTAMP WITH TIME ZONE;

-- Add index for efficient prompt queries
CREATE INDEX IF NOT EXISTS idx_people_prompt_generated
  ON people(user_id, prompt_generated_date);

-- Add comment for documentation
COMMENT ON COLUMN people.conversation_prompt IS 'AI-generated conversation starter based on conversation history';
COMMENT ON COLUMN people.prompt_generated_date IS 'Timestamp when the current prompt was generated';
COMMENT ON COLUMN people.prompt_shown_count IS 'Number of times the current prompt has been displayed';
COMMENT ON COLUMN people.last_prompt_shown IS 'Timestamp when the prompt was last shown to the user';

-- Update storage_stats view to include prompt statistics
DROP VIEW IF EXISTS storage_stats;

CREATE VIEW storage_stats AS
SELECT
  user_id,
  COUNT(DISTINCT people.id) as total_people,
  COUNT(DISTINCT conversation_entries.id) as total_conversations,
  COUNT(DISTINCT CASE WHEN people.voice_reference IS NOT NULL THEN people.id END) as people_with_voices,
  COUNT(DISTINCT CASE WHEN people.conversation_prompt IS NOT NULL THEN people.id END) as people_with_prompts,
  ROUND(AVG(conv_counts.count)::numeric, 2) as avg_conversations_per_person
FROM people
LEFT JOIN conversation_entries ON people.id = conversation_entries.person_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as count
  FROM conversation_entries ce
  WHERE ce.person_id = people.id
) conv_counts ON true
GROUP BY user_id;

COMMENT ON VIEW storage_stats IS 'Statistics view including conversation prompt metrics';
