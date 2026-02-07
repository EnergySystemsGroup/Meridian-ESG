-- Migration: Create source_program_urls table
-- Purpose: Stores program catalog/listing URLs per funding source.
-- These are the entry points for program discovery — pages where a source
-- lists its programs, rebates, incentives, etc.
-- Spec: docs/prd/opp_staging/manual-claude-code-pipeline-architecture-proposal.md Section 3a-2

-- Table
CREATE TABLE IF NOT EXISTS source_program_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES funding_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
    -- Human-readable description: "Main rebate catalog", "Commercial programs",
    -- "Third-party implementer portal", etc.
  last_crawled_at TIMESTAMPTZ,
    -- When this URL was last crawled for program discovery
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(source_id, url)  -- No duplicate URLs per source
);

-- Index on source_id for FK lookups
CREATE INDEX IF NOT EXISTS idx_source_program_urls_source
  ON source_program_urls(source_id);

-- Partial index on last_crawled_at for stale crawl detection
-- Note: cannot use NOW() in partial index predicate (not IMMUTABLE).
-- Staleness threshold (90 days) is checked at query time.
CREATE INDEX IF NOT EXISTS idx_source_program_urls_stale
  ON source_program_urls(last_crawled_at)
  WHERE last_crawled_at IS NULL;
