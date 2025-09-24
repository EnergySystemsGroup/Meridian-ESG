-- Fix unique constraint to use title+api_source_id instead of api_opportunity_id+api_source_id
-- This prevents duplicates when same opportunity gets different API IDs

-- Drop the existing unique constraint on (api_opportunity_id, api_source_id)
ALTER TABLE funding_opportunities
DROP CONSTRAINT IF EXISTS funding_opportunities_api_unique;

-- Clean up existing duplicates by keeping the most recent record for each title+api_source_id combination
-- First, clean up related records in foreign key tables, then delete duplicates
WITH duplicate_opportunities AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, api_source_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) as row_num
  FROM funding_opportunities
)
-- Delete related records first to avoid foreign key constraint violations
, duplicates_to_delete AS (
  SELECT id FROM duplicate_opportunities WHERE row_num > 1
)
DELETE FROM opportunity_processing_paths
WHERE existing_opportunity_id IN (SELECT id FROM duplicates_to_delete);

-- Delete the duplicate opportunity records
WITH duplicate_opportunities AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, api_source_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) as row_num
  FROM funding_opportunities
)
DELETE FROM funding_opportunities
WHERE id IN (
  SELECT id FROM duplicate_opportunities WHERE row_num > 1
);

-- Add new unique constraint on (title, api_source_id)
-- This ensures same-titled opportunities from same source are treated as duplicates
ALTER TABLE funding_opportunities
ADD CONSTRAINT funding_opportunities_title_source_unique
UNIQUE (title, api_source_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT funding_opportunities_title_source_unique ON funding_opportunities
IS 'Ensures no duplicate opportunities with same title from same API source - prevents issues when API IDs change';