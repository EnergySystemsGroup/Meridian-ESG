-- Add content_hash column to api_raw_responses table
ALTER TABLE IF EXISTS api_raw_responses
ADD COLUMN IF NOT EXISTS content_hash text; 