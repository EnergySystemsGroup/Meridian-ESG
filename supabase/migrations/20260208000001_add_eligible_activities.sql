-- Migration: Add eligible_activities to funding_programs
-- Date: 2026-02-08
-- Purpose: Activity-based relevance filtering for Phase 2 Program Discovery.
--   Programs are tagged with funded activities from TAXONOMIES.ELIGIBLE_ACTIVITIES
--   (hot/strong/mild tiers). Programs with zero matching activities are low-relevance
--   for ESCO work and skipped in Phase 3.
--
-- Idempotent: safe to run multiple times (IF NOT EXISTS).

-- 1. Add eligible_activities column
ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS eligible_activities TEXT[];

-- 2. GIN index for array overlap queries (&&)
CREATE INDEX IF NOT EXISTS idx_fp_eligible_activities
  ON funding_programs USING GIN (eligible_activities);

-- 3. Column comment
COMMENT ON COLUMN funding_programs.eligible_activities IS
  'Funded activities from TAXONOMIES.ELIGIBLE_ACTIVITIES (hot/strong/mild tiers only). Empty = low relevance for ESCO work.';
