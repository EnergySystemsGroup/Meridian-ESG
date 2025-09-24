-- Change opportunity_processing_paths foreign key to CASCADE delete
-- This allows automatic cleanup of processing path records when opportunities are deleted

-- Drop the existing foreign key constraint with NO ACTION
ALTER TABLE opportunity_processing_paths
DROP CONSTRAINT opportunity_processing_paths_existing_opportunity_id_fkey;

-- Re-add the constraint with CASCADE delete
ALTER TABLE opportunity_processing_paths
ADD CONSTRAINT opportunity_processing_paths_existing_opportunity_id_fkey
FOREIGN KEY (existing_opportunity_id)
REFERENCES funding_opportunities(id)
ON DELETE CASCADE;

-- Add comment explaining the change
COMMENT ON CONSTRAINT opportunity_processing_paths_existing_opportunity_id_fkey ON opportunity_processing_paths
IS 'Foreign key to funding_opportunities with CASCADE delete - processing paths are automatically removed when opportunity is deleted';