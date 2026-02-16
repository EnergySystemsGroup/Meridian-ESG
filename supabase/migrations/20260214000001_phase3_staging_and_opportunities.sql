-- Migration: Phase 3 — Prepare staging table and funding_opportunities for opportunity discovery
-- Date: 2026-02-14
-- Purpose:
--   1. Drop UNIQUE constraints on staging (staging is a pure processing inbox, not a dedup layer)
--   2. Add non-unique replacement indexes for query performance
--   3. Add program_urls JSONB to staging (carry URLs through pipeline)
--   4. Add program_id FK to funding_opportunities (production) for smart scheduling NOT EXISTS
--   5. Grant permissions
--
-- Idempotent: safe to run multiple times.
-- Depends on: 20260206000005_add_program_id_to_staging.sql

-- ============================================================================
-- 1. Drop UNIQUE constraint on url
-- ============================================================================

-- Staging records are created per-check-round. The same program URL may produce
-- multiple staging records across different check cycles. Smart scheduling on
-- funding_programs.next_check_at prevents spam; dedup happens at Phase 6 storage.
ALTER TABLE manual_funding_opportunities_staging
  DROP CONSTRAINT IF EXISTS mfos_unique_url;

-- ============================================================================
-- 2. Drop UNIQUE index on (source_id, title)
-- ============================================================================

-- Same rationale: re-checks of the same source+title combination are expected.
DROP INDEX IF EXISTS idx_mfos_unique_source_title;

-- ============================================================================
-- 3. Add non-unique replacement indexes for query performance
-- ============================================================================

-- "Find staging records by URL" (non-unique)
CREATE INDEX IF NOT EXISTS idx_mfos_url
  ON manual_funding_opportunities_staging(url);

-- "Find staging records by source + title" (non-unique)
CREATE INDEX IF NOT EXISTS idx_mfos_source_title
  ON manual_funding_opportunities_staging(source_id, title);

-- ============================================================================
-- 4. Add program_urls JSONB to staging
-- ============================================================================

-- Carries the program's URL array through the pipeline so extraction/analysis
-- agents have access to all program URLs without re-querying funding_programs.
ALTER TABLE manual_funding_opportunities_staging
  ADD COLUMN IF NOT EXISTS program_urls JSONB DEFAULT '[]';

COMMENT ON COLUMN manual_funding_opportunities_staging.program_urls IS
  'Copy of funding_programs.program_urls at discovery time. Carried through pipeline so downstream agents have URL context. Set by Phase 3.';

-- ============================================================================
-- 5. Add program_id FK to funding_opportunities (production)
-- ============================================================================

-- Links production opportunities back to their parent program.
-- Required for the smart scheduling NOT EXISTS clause:
--   WHERE NOT EXISTS (SELECT 1 FROM funding_opportunities fo
--                     WHERE fo.program_id = fp.id AND fo.status = 'Open')
ALTER TABLE funding_opportunities
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES funding_programs(id);

COMMENT ON COLUMN funding_opportunities.program_id IS
  'FK to funding_programs. Links this opportunity to its parent program. Set by Phase 6 storage agent for manual pipeline records. NULL for API-sourced records.';

-- ============================================================================
-- 6. Add index on funding_opportunities.program_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fo_program_id
  ON funding_opportunities(program_id)
  WHERE program_id IS NOT NULL;

-- ============================================================================
-- 7. Grant permissions to claude_writer
-- ============================================================================

-- claude_writer already has INSERT, SELECT, UPDATE on both tables.
-- New columns inherit those permissions automatically.
-- Explicit grant on funding_opportunities to ensure claude_writer can set program_id.
GRANT SELECT, INSERT, UPDATE ON funding_opportunities TO claude_writer;
