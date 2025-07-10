-- Migration: Consolidate opportunity_number and opportunity_id into api_opportunity_id
-- This migration creates a clear api_opportunity_id field to store the external API identifier
-- and removes the confusion between opportunity_number and opportunity_id

-- Step 1: Add the new api_opportunity_id column
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS api_opportunity_id TEXT;

-- Add comment for clarity
COMMENT ON COLUMN funding_opportunities.api_opportunity_id IS 'External API identifier for the opportunity from the funding source';

-- Step 2: Migrate existing data
-- First, copy from opportunity_id (v2 data) where it exists
UPDATE funding_opportunities
SET api_opportunity_id = opportunity_id
WHERE opportunity_id IS NOT NULL 
  AND opportunity_id != '';

-- Then, for records that only have opportunity_number (v1 data), use that
UPDATE funding_opportunities
SET api_opportunity_id = opportunity_number
WHERE api_opportunity_id IS NULL 
  AND opportunity_number IS NOT NULL 
  AND opportunity_number != '';

-- Step 3: Drop old indexes
DROP INDEX IF EXISTS idx_funding_opportunities_opportunity_id;
DROP INDEX IF EXISTS idx_funding_opportunities_source_opportunity_id;

-- Step 4: Create new indexes for api_opportunity_id
CREATE INDEX idx_funding_opportunities_api_opportunity_id 
ON funding_opportunities(api_opportunity_id) 
WHERE api_opportunity_id IS NOT NULL;

CREATE INDEX idx_funding_opportunities_source_api_opportunity_id 
ON funding_opportunities(funding_source_id, api_opportunity_id) 
WHERE api_opportunity_id IS NOT NULL;

-- Step 5: Update the view to use api_opportunity_id
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;

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

-- Step 6: Functions will be recreated by subsequent migrations if needed
-- Skip recreating get_funding_opportunities_dynamic_sort to avoid schema mismatch

-- Step 7: Keep old columns for now - will be dropped in a future migration
-- The old columns (opportunity_number, opportunity_id) are left in place for backward compatibility
-- They should be removed once all references are updated

-- Step 8: Add a comment about the migration
COMMENT ON TABLE funding_opportunities IS 'Funding opportunities table. Migrated on 2025-07-10 to use api_opportunity_id instead of opportunity_number and opportunity_id for clarity. Old columns kept for backward compatibility.';