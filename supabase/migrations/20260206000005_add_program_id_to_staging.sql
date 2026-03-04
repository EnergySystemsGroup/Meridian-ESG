-- Migration: Add program_id to manual_funding_opportunities_staging
-- Date: 2026-02-06
-- Purpose: Link staging records to their parent program in funding_programs.
--   This FK enables Phase 3 (Opportunity Discovery) to associate discovered
--   opportunities with the program they belong to.
--
-- Idempotent: safe to run multiple times (IF NOT EXISTS).
-- Depends on: 20260206000004_enhance_funding_programs.sql (funding_programs must exist)

-- ============================================================================
-- 1. Add program_id column
-- ============================================================================

-- Nullable FK — staging records created before Phase 2 won't have a program_id.
-- Phase 3+ sets this when creating staging records from a known program.
ALTER TABLE manual_funding_opportunities_staging
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES funding_programs(id);

-- ============================================================================
-- 2. Add index for program lookups
-- ============================================================================

-- "All staging records for this program"
CREATE INDEX IF NOT EXISTS idx_staging_program_id
  ON manual_funding_opportunities_staging(program_id)
  WHERE program_id IS NOT NULL;

-- ============================================================================
-- 3. Column comment
-- ============================================================================

COMMENT ON COLUMN manual_funding_opportunities_staging.program_id IS
  'FK to funding_programs. Links this staging opportunity to its parent program. Set by Phase 3 (Opportunity Discovery). NULL for legacy records.';

-- ============================================================================
-- 4. Grant claude_writer permissions (column inherits table grants)
-- ============================================================================

-- claude_writer already has INSERT, SELECT, UPDATE on the staging table.
-- New column inherits those permissions automatically. No additional GRANT needed.
