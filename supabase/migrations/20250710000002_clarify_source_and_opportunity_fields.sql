-- Migration: Clarify source and opportunity field naming
-- This migration fixes field naming confusion:
-- 1. Renames source_id to api_source_id for clarity
-- 2. Drops old opportunity_id and opportunity_number columns that were left behind
-- 3. Updates all related indexes and constraints

-- Step 1: Add the new api_source_id column to both tables
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS api_source_id UUID;

ALTER TABLE api_raw_responses
ADD COLUMN IF NOT EXISTS api_source_id UUID;

-- Add comments for clarity
COMMENT ON COLUMN funding_opportunities.api_source_id IS 'Reference to the API source (api_sources table) where this opportunity was fetched from';
COMMENT ON COLUMN api_raw_responses.api_source_id IS 'Reference to the API source (api_sources table) where this response was fetched from';

-- Step 2: Migrate existing data from source_id to api_source_id
UPDATE funding_opportunities
SET api_source_id = source_id
WHERE source_id IS NOT NULL;

UPDATE api_raw_responses
SET api_source_id = source_id
WHERE source_id IS NOT NULL;

-- Step 3: Drop old indexes related to source_id
DROP INDEX IF EXISTS idx_funding_opportunities_source_id;
DROP INDEX IF EXISTS idx_funding_opportunities_source_api_opportunity_id;
DROP INDEX IF EXISTS idx_api_raw_responses_source_id;

-- Step 4: Create new indexes for api_source_id
CREATE INDEX idx_funding_opportunities_api_source_id 
ON funding_opportunities(api_source_id) 
WHERE api_source_id IS NOT NULL;

CREATE INDEX idx_funding_opportunities_api_source_opportunity_id 
ON funding_opportunities(api_source_id, api_opportunity_id) 
WHERE api_source_id IS NOT NULL AND api_opportunity_id IS NOT NULL;

CREATE INDEX idx_api_raw_responses_api_source_id 
ON api_raw_responses(api_source_id) 
WHERE api_source_id IS NOT NULL;

-- Step 5: Update foreign key constraints
-- First drop the old constraints
ALTER TABLE funding_opportunities
DROP CONSTRAINT IF EXISTS funding_opportunities_source_id_fkey;

ALTER TABLE api_raw_responses
DROP CONSTRAINT IF EXISTS api_raw_responses_source_id_fkey;

-- Add new constraints for api_source_id
ALTER TABLE funding_opportunities
ADD CONSTRAINT funding_opportunities_api_source_id_fkey 
FOREIGN KEY (api_source_id) REFERENCES api_sources(id) ON DELETE SET NULL;

ALTER TABLE api_raw_responses
ADD CONSTRAINT api_raw_responses_api_source_id_fkey 
FOREIGN KEY (api_source_id) REFERENCES api_sources(id) ON DELETE CASCADE;

-- Step 6: Drop views first before dropping columns
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;
DROP VIEW IF EXISTS api_response_summary CASCADE;

-- Step 7: Drop the old columns
ALTER TABLE funding_opportunities
DROP COLUMN IF EXISTS source_id,
DROP COLUMN IF EXISTS opportunity_id,
DROP COLUMN IF EXISTS opportunity_number;

ALTER TABLE api_raw_responses
DROP COLUMN IF EXISTS source_id;

-- Step 8: Recreate the view with new field names
CREATE VIEW funding_opportunities_with_geography AS
SELECT 
  fo.*,
  -- Geographic eligibility aggregations
  COALESCE(
    array_agg(DISTINCT s.code) FILTER (WHERE s.code IS NOT NULL),
    ARRAY[]::text[]
  ) AS eligible_states,
  COALESCE(
    array_agg(DISTINCT cs.code) FILTER (WHERE cs.code IS NOT NULL),
    ARRAY[]::text[]
  ) AS eligible_counties_states,
  COALESCE(
    array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
    ARRAY[]::text[]
  ) AS eligible_counties
FROM funding_opportunities fo
LEFT JOIN opportunity_state_eligibility se ON fo.id = se.opportunity_id
LEFT JOIN states s ON se.state_id = s.id
LEFT JOIN opportunity_county_eligibility ce ON fo.id = ce.opportunity_id
LEFT JOIN counties c ON ce.county_id = c.id
LEFT JOIN states cs ON c.state_id = cs.id
GROUP BY fo.id;

-- Step 9: Add comment about the migration
COMMENT ON TABLE funding_opportunities IS 'Funding opportunities table. Migrated on 2025-07-10 to use api_source_id (instead of source_id) and api_opportunity_id (instead of opportunity_number/opportunity_id) for clarity.';