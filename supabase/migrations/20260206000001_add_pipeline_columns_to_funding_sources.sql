-- Migration: Add pipeline columns to funding_sources
-- Date: 2026-02-06
-- Purpose: Enhance funding_sources table for the manual pipeline.
--   Adds funder_type (TEXT replacement for ENUM type column),
--   sectors (TEXT[]), state_code (CHAR(2)), pipeline (TEXT),
--   and programs_last_searched_at (TIMESTAMPTZ).
--   Also migrates existing data from the current type (agency_type ENUM)
--   into funder_type, and creates supporting indexes.
--
-- Idempotent: safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS).
-- Does NOT drop the old type column — that is a future migration step.

-- ============================================================================
-- 1. Add new columns
-- ============================================================================

-- 1a. funder_type: TEXT replacement for the ENUM agency_type/type column.
--     Values: 'Federal', 'State', 'Utility', 'Foundation', 'County',
--             'Municipality', 'Other'
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS funder_type TEXT;

-- 1b. sectors: what domains this source focuses on.
--     Example values: 'energy', 'water', 'agriculture', 'commerce',
--       'environment', 'transportation', 'housing', 'electricity',
--       'sustainability'
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS sectors TEXT[];

-- 1c. state_code: two-letter state abbreviation.
--     NULL for federal/national sources.
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS state_code CHAR(2);

-- 1d. pipeline: records the origin pipeline that first created this source.
--     'api' = populated via automated API pipeline (default for existing rows).
--     'manual' = populated via manual discovery pipeline.
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS pipeline TEXT DEFAULT 'api';

-- 1e. programs_last_searched_at: when we last ran program discovery for
--     this source. NULL means never searched (delinquent).
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS programs_last_searched_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Migrate existing data from type (agency_type ENUM) → funder_type (TEXT)
-- ============================================================================

-- Only backfill rows where funder_type is still NULL and type has a value.
-- This preserves any funder_type values that might already be set
-- (idempotency for re-runs).
UPDATE funding_sources
SET funder_type = type::TEXT
WHERE type IS NOT NULL
  AND funder_type IS NULL;

-- ============================================================================
-- 3. Add column comments
-- ============================================================================

COMMENT ON COLUMN funding_sources.funder_type IS
  'Source classification: Federal, State, Utility, Foundation, County, Municipality, Other. TEXT replacement for the legacy agency_type ENUM.';

COMMENT ON COLUMN funding_sources.sectors IS
  'Domain sectors this source focuses on. Array of: energy, water, agriculture, commerce, environment, transportation, housing, electricity, sustainability.';

COMMENT ON COLUMN funding_sources.state_code IS
  'Two-letter state code (e.g. AZ, CA). NULL for federal/national sources.';

COMMENT ON COLUMN funding_sources.pipeline IS
  'Origin pipeline: api (default, automated API pipeline) or manual (manual discovery pipeline).';

COMMENT ON COLUMN funding_sources.programs_last_searched_at IS
  'When program discovery was last run for this source. NULL = never searched (delinquent). Delinquency threshold: ~90 days.';

-- ============================================================================
-- 4. Create indexes for common query patterns
-- ============================================================================

-- 4a. Composite index: "all utility sources in Arizona" queries.
--     Partial index — only rows that have a state_code.
CREATE INDEX IF NOT EXISTS idx_funding_sources_state_funder_type
  ON funding_sources(state_code, funder_type)
  WHERE state_code IS NOT NULL;

-- 4b. GIN index on sectors array: "which sources focus on energy?" queries.
CREATE INDEX IF NOT EXISTS idx_funding_sources_sectors
  ON funding_sources USING GIN(sectors);

-- 4c. Index for delinquent source queries (never searched or stale).
--     Note: cannot use NOW() in partial index predicate (not IMMUTABLE).
--     The delinquency threshold (90 days) is checked at query time instead.
CREATE INDEX IF NOT EXISTS idx_funding_sources_delinquent
  ON funding_sources(programs_last_searched_at)
  WHERE programs_last_searched_at IS NULL;
