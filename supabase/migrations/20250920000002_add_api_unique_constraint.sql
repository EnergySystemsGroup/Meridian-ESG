-- Add unique constraint for api_opportunity_id and api_source_id
-- This is required for the upsert operation to work properly
-- Migration: 20250920000002_add_api_unique_constraint.sql

-- Add unique constraint on api_opportunity_id and api_source_id combination
-- This allows the storage agent to upsert opportunities based on these fields
ALTER TABLE funding_opportunities
ADD CONSTRAINT funding_opportunities_api_unique
UNIQUE (api_opportunity_id, api_source_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT funding_opportunities_api_unique ON funding_opportunities IS
  'Ensures unique combination of API opportunity ID and source ID for upsert operations';