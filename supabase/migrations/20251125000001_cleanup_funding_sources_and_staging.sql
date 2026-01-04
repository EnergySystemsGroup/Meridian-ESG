-- Migration: 20251125000001_cleanup_funding_sources_and_staging.sql
-- Clean up funding_sources table, refactor manual_funding_sources → manual_funding_opportunities_staging

-- ============================================================================
-- MIGRATION 1: Clean up funding_sources table
-- ============================================================================

-- 1a. Add table comment explaining purpose
COMMENT ON TABLE funding_sources IS 'Entities responsible for distributing funding: government agencies, utilities, private foundations, counties, municipalities, etc.';

-- 1b. Delete bad entries (Grants.gov, California Grants Portal) and dedupe PG&E
-- First, update opportunities to remove FK reference (set to NULL)
UPDATE funding_opportunities
SET funding_source_id = NULL
WHERE funding_source_id IN (
  SELECT id FROM funding_sources
  WHERE name ILIKE '%grants.gov%' OR name = 'California Grants Portal '
);

-- Delete the bad funding_sources (102 records: 35 Grants.gov + 67 CA Portal)
DELETE FROM funding_sources
WHERE name ILIKE '%grants.gov%' OR name = 'California Grants Portal ';

-- Dedupe PG&E: keep older record, delete newer duplicate
DELETE FROM funding_sources
WHERE id = 'a408b05e-1f64-4a03-9805-ec3b39182430';

-- 1c. Drop redundant 'type' column, rename 'agency_type' to 'type'
-- First, add new enum values to agency_type
ALTER TYPE agency_type ADD VALUE IF NOT EXISTS 'Utility';
ALTER TYPE agency_type ADD VALUE IF NOT EXISTS 'County';
ALTER TYPE agency_type ADD VALUE IF NOT EXISTS 'Municipality';
ALTER TYPE agency_type ADD VALUE IF NOT EXISTS 'Foundation';

-- Drop the text 'type' column
ALTER TABLE funding_sources DROP COLUMN type;

-- Rename agency_type to type
ALTER TABLE funding_sources RENAME COLUMN agency_type TO type;

-- Update comment
COMMENT ON COLUMN funding_sources.type IS 'Source type: Federal, State, Utility, County, Municipality, Foundation';

-- ============================================================================
-- MIGRATION 2: Rename and refactor staging table
-- ============================================================================

-- 2a. Rename table
ALTER TABLE manual_funding_sources RENAME TO manual_funding_opportunities_staging;

-- 2b. Add table comment
COMMENT ON TABLE manual_funding_opportunities_staging IS 'Staging table for non-API funding opportunities. Links to funding_sources via source_id FK.';

-- 2c. Rename indexes and constraints to match new table name
ALTER INDEX idx_mfs_extraction_pending RENAME TO idx_mfos_extraction_pending;
ALTER INDEX idx_mfs_analysis_pending RENAME TO idx_mfos_analysis_pending;
ALTER INDEX idx_mfs_storage_pending RENAME TO idx_mfos_storage_pending;
ALTER INDEX idx_mfs_needs_refresh RENAME TO idx_mfos_needs_refresh;
DROP INDEX idx_mfs_source_type;
DROP INDEX idx_mfs_source_name;

ALTER TABLE manual_funding_opportunities_staging
  RENAME CONSTRAINT mfs_unique_url TO mfos_unique_url;
ALTER TABLE manual_funding_opportunities_staging
  DROP CONSTRAINT mfs_unique_source_title;

-- 2d. Add index on source_id for efficient joins
CREATE INDEX idx_mfos_source_id ON manual_funding_opportunities_staging(source_id);

-- 2e. Add new unique constraint (source_id + title) for records with source_id
CREATE UNIQUE INDEX idx_mfos_unique_source_title
  ON manual_funding_opportunities_staging(source_id, title)
  WHERE source_id IS NOT NULL;

-- ============================================================================
-- MIGRATION 3: Create funding_sources from staging table sources
-- ============================================================================

-- 3a. Add unique constraint on name (required for ON CONFLICT)
ALTER TABLE funding_sources ADD CONSTRAINT funding_sources_name_unique UNIQUE (name);

-- 3b. Insert unique sources from staging table into funding_sources
-- Strip parenthetical suffix to get clean utility name
INSERT INTO funding_sources (name, type)
SELECT DISTINCT
  split_part(source_name, ' (', 1) as name,
  'Utility'::agency_type as type
FROM manual_funding_opportunities_staging
WHERE source_name IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MIGRATION 4: Update ALL staging records with source_id
-- ============================================================================

-- 4a. Update all staging records with their source_id
UPDATE manual_funding_opportunities_staging mfos
SET source_id = fs.id
FROM funding_sources fs
WHERE fs.name = split_part(mfos.source_name, ' (', 1)
  AND mfos.source_id IS NULL;

-- ============================================================================
-- MIGRATION 5: Drop redundant columns (now safe - all records have source_id)
-- ============================================================================

ALTER TABLE manual_funding_opportunities_staging DROP COLUMN source_type;
ALTER TABLE manual_funding_opportunities_staging DROP COLUMN source_name;
