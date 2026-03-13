-- Unify cross-pipeline deduplication: replace separate API and manual pipeline
-- constraints with a single UNIQUE (funding_source_id, title) constraint.
--
-- Old constraints:
--   funding_opportunities_title_source_unique  UNIQUE (title, api_source_id)
--   funding_opportunities_cc_agent_unique       UNIQUE (funding_source_id, title) WHERE api_source_id IS NULL
--
-- New constraint:
--   funding_opportunities_unified_dedup         UNIQUE (funding_source_id, title)

BEGIN;

-- Step 1: Clean up cross-pipeline duplicates before adding the unified constraint.
-- Keep the most recently updated record for each (funding_source_id, title) pair.

-- Nullify staging references to duplicates (FK without CASCADE)
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY funding_source_id, title
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM funding_opportunities
  WHERE funding_source_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM duplicates WHERE row_num > 1
)
UPDATE manual_funding_opportunities_staging
SET opportunity_id = NULL
WHERE opportunity_id IN (SELECT id FROM to_delete);

-- Delete related processing_paths first to avoid FK violations
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY funding_source_id, title
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM funding_opportunities
  WHERE funding_source_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM duplicates WHERE row_num > 1
)
DELETE FROM opportunity_processing_paths
WHERE existing_opportunity_id IN (SELECT id FROM to_delete);

-- Delete related coverage area links
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY funding_source_id, title
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM funding_opportunities
  WHERE funding_source_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM duplicates WHERE row_num > 1
)
DELETE FROM opportunity_coverage_areas
WHERE opportunity_id IN (SELECT id FROM to_delete);

-- Now delete the duplicate opportunity rows
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY funding_source_id, title
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM funding_opportunities
  WHERE funding_source_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM duplicates WHERE row_num > 1
)
DELETE FROM funding_opportunities
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Drop old constraints
ALTER TABLE funding_opportunities
DROP CONSTRAINT IF EXISTS funding_opportunities_title_source_unique;

DROP INDEX IF EXISTS funding_opportunities_cc_agent_unique;

-- Step 3: Create unified constraint
ALTER TABLE funding_opportunities
ADD CONSTRAINT funding_opportunities_unified_dedup
UNIQUE (funding_source_id, title);

COMMENT ON CONSTRAINT funding_opportunities_unified_dedup ON funding_opportunities
IS 'Unified dedup: one record per funding source + title, regardless of pipeline origin (API or manual).';

-- Step 4: Cover the NULL funding_source_id case.
-- PostgreSQL treats NULLs as distinct in unique constraints, so the above
-- constraint won't prevent duplicates when funding_source_id IS NULL.
-- This partial index enforces one row per title for those orphaned records.
CREATE UNIQUE INDEX funding_opportunities_null_source_dedup
ON funding_opportunities (title)
WHERE funding_source_id IS NULL;

COMMIT;
