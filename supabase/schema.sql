-- Nametag Database Schema for Supabase
-- This schema supports the voice biometric memory app for smart glasses

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: people
-- Stores person information including voice biometrics
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  speaker_id TEXT NOT NULL,
  voice_reference TEXT,  -- Base64 encoded audio clip (2-10 seconds)
  last_met TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
CREATE INDEX IF NOT EXISTS idx_people_speaker_id ON people(speaker_id);
CREATE INDEX IF NOT EXISTS idx_people_last_met ON people(last_met DESC);

-- Table: conversation_entries
-- Stores individual conversation records linked to people
CREATE TABLE IF NOT EXISTS conversation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  transcript TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',  -- PostgreSQL array of topic strings
  key_points TEXT[] DEFAULT '{}',  -- Key points for quick context
  duration INTEGER,  -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_person ON conversation_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversation_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_person_date ON conversation_entries(person_id, date DESC);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on people table
CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Disabled by default for service role access
-- Enable if you need multi-tenant support in the future
-- ALTER TABLE people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversation_entries ENABLE ROW LEVEL SECURITY;

-- Storage statistics view (optional - for performance)
CREATE OR REPLACE VIEW storage_stats AS
SELECT
  COUNT(DISTINCT p.id) as total_people,
  COUNT(ce.id) as total_conversations,
  COUNT(DISTINCT CASE WHEN p.voice_reference IS NOT NULL THEN p.id END) as people_with_voices,
  ROUND(AVG(conversation_count), 1) as avg_conversations_per_person
FROM people p
LEFT JOIN (
  SELECT person_id, COUNT(*) as conversation_count
  FROM conversation_entries
  GROUP BY person_id
) ce_count ON p.id = ce_count.person_id
LEFT JOIN conversation_entries ce ON p.id = ce.person_id;

-- Comments for documentation
COMMENT ON TABLE people IS 'Stores person information including voice biometric references';
COMMENT ON TABLE conversation_entries IS 'Stores conversation history linked to people';
COMMENT ON COLUMN people.voice_reference IS 'Base64 encoded audio clip used for voice recognition';
COMMENT ON COLUMN people.speaker_id IS 'Speaker identifier from audio processing service';
COMMENT ON COLUMN conversation_entries.topics IS 'Array of conversation topics extracted by AI';
COMMENT ON COLUMN conversation_entries.key_points IS 'Array of key points for quick context retrieval';
