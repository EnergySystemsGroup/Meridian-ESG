-- Migration: Add api_fetch stage to pipeline_stages table
-- This migration adds the 'api_fetch' stage name to the existing CHECK constraint
-- to support the new RouteV3 job queue implementation.
--
-- The api_fetch stage represents raw data collection from external APIs,
-- distinct from data_extraction which involves LLM-powered processing.

-- Drop the existing check constraint
ALTER TABLE pipeline_stages DROP CONSTRAINT pipeline_stages_stage_name_check;

-- Add the new check constraint with api_fetch included
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_stage_name_check 
  CHECK (stage_name IN (
    'source_orchestrator',
    'api_fetch',              -- NEW: Raw data collection and chunking (RouteV3)
    'data_extraction',        -- LLM-powered extraction and standardization
    'early_duplicate_detector',
    'analysis',
    'filter',
    'storage',
    'direct_update'
  ));

-- Add comment for the new stage
COMMENT ON CONSTRAINT pipeline_stages_stage_name_check ON pipeline_stages IS 
  'Allowed pipeline stage names. api_fetch is for raw data collection (pre-LLM), data_extraction is for LLM-powered processing.';

-- Migration complete
-- ✅ Added api_fetch stage to pipeline_stages CHECK constraint
-- ✅ Updated constraint comment for clarity