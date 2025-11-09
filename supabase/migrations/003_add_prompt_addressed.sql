-- Migration: Add prompt_addressed field to track if conversation addressed the prompt
-- Created: 2025-11-09
-- Purpose: Prevent showing the same prompt repeatedly if user already responded to it

-- Add prompt_addressed column to people table
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS prompt_addressed BOOLEAN DEFAULT false;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_people_prompt_addressed
  ON people(user_id, prompt_addressed);

-- Add comment for documentation
COMMENT ON COLUMN people.prompt_addressed IS 'Whether the user has responded to/addressed the current conversation prompt topic';

-- Update existing rows to false (default)
UPDATE people SET prompt_addressed = false WHERE prompt_addressed IS NULL;
