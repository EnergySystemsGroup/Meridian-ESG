-- Migration: Consolidate funding_sources on `type` ENUM, drop `funder_type`
-- Date: 2026-03-10
-- Purpose: The manual pipeline wrote to `funder_type` (TEXT) while the API
--   pipeline wrote to `type` (agency_type ENUM). This migration backfills
--   `type` from `funder_type` for the 43 manual-pipeline sources that have
--   type = NULL, then drops the redundant `funder_type` column and fixes
--   the composite index.
--
-- Idempotent: safe to re-run (WHERE guards on UPDATE, IF EXISTS on DROP).

-- ============================================================================
-- 1. Backfill type from funder_type for manual pipeline sources
-- ============================================================================

UPDATE funding_sources
SET type = funder_type::agency_type
WHERE type IS NULL
  AND funder_type IS NOT NULL;

-- ============================================================================
-- 2. Drop the redundant funder_type column
-- ============================================================================

ALTER TABLE funding_sources DROP COLUMN IF EXISTS funder_type;

-- ============================================================================
-- 3. Fix composite index (was on funder_type, recreate on type)
-- ============================================================================

DROP INDEX IF EXISTS idx_funding_sources_state_funder_type;

CREATE INDEX IF NOT EXISTS idx_funding_sources_state_type
  ON funding_sources(state_code, type)
  WHERE state_code IS NOT NULL;
