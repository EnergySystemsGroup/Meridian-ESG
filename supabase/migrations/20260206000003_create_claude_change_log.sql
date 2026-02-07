-- Migration: Create claude_change_log audit table
-- Purpose: Track all changes made by Claude Code pipeline agents
-- Reference: docs/prd/db-security/production-database-configuration.md (Audit Trail section)

CREATE TABLE IF NOT EXISTS claude_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,                -- nullable for batch operations
  operation TEXT NOT NULL,       -- 'INSERT' or 'UPDATE'
  change_details JSONB,
  change_reason TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pipeline_phase TEXT,           -- source_registry, program_discovery, extraction, analysis, storage, review
  batch_id TEXT,                 -- groups all ops from one pipeline run, format: run-YYYYMMDD-HHMM
  record_count INTEGER           -- for batch summaries
);

-- Index on batch_id for querying by pipeline run
CREATE INDEX IF NOT EXISTS idx_claude_change_log_batch_id
  ON claude_change_log (batch_id);

-- Index on executed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_claude_change_log_executed_at
  ON claude_change_log (executed_at);

-- Index on pipeline_phase for phase-level queries
CREATE INDEX IF NOT EXISTS idx_claude_change_log_pipeline_phase
  ON claude_change_log (pipeline_phase);
