-- Migration to simplify the funding model by removing the dependency on funding_programs
-- This adds a source_id column to funding_opportunities and updates the foreign key constraint

-- Add source_id column to funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN source_id UUID;

-- Update existing records to set source_id based on the program's source_id
UPDATE funding_opportunities fo
SET source_id = fp.source_id
FROM funding_programs fp
WHERE fo.program_id = fp.id;

-- For any records that still have null source_id, set a default value
-- This is a temporary fix for development purposes
UPDATE funding_opportunities 
SET source_id = '00000000-0000-0000-0000-000000000000'
WHERE source_id IS NULL;

-- Make source_id NOT NULL for new records
ALTER TABLE funding_opportunities 
ALTER COLUMN source_id SET NOT NULL;

-- Add foreign key constraint to funding_sources
ALTER TABLE funding_opportunities
ADD CONSTRAINT funding_opportunities_source_id_fkey
FOREIGN KEY (source_id) REFERENCES funding_sources(id);

-- Note: We're keeping the program_id column for backward compatibility
-- but it's no longer required for new records

-- Update the dataProcessorAgent to use source_id directly
-- This is done in the JavaScript code, not in this migration

-- Add a comment explaining the change
COMMENT ON COLUMN funding_opportunities.source_id IS 
'Direct reference to the funding source, replacing the need for a funding program'; 