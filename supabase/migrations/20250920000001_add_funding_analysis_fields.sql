-- Add 4 new funding opportunity analysis fields for sales team intelligence
-- Migration: 20250920000001_add_funding_analysis_fields.sql

-- Add the 4 new analysis fields
ALTER TABLE funding_opportunities
ADD COLUMN program_overview TEXT,
ADD COLUMN program_use_cases TEXT,
ADD COLUMN application_summary TEXT,
ADD COLUMN program_insights TEXT;

-- Add comments for documentation
COMMENT ON COLUMN funding_opportunities.program_overview IS
  '2-3 sentence elevator pitch: what it funds, award amounts, who can apply, unique value';
COMMENT ON COLUMN funding_opportunities.program_use_cases IS
  '3-4 specific client scenarios showing how clients could use this funding';
COMMENT ON COLUMN funding_opportunities.application_summary IS
  'Concise summary of application process, timeline, key requirements, important submissions, and tips';
COMMENT ON COLUMN funding_opportunities.program_insights IS
  '2-3 important details: restrictions, guidelines, historical patterns, technical assistance, documentation challenges';

-- Add indexes for better text search performance on new fields
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_overview ON funding_opportunities USING GIN(to_tsvector('english', program_overview));
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_use_cases ON funding_opportunities USING GIN(to_tsvector('english', program_use_cases));
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_application_summary ON funding_opportunities USING GIN(to_tsvector('english', application_summary));
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_insights ON funding_opportunities USING GIN(to_tsvector('english', program_insights));