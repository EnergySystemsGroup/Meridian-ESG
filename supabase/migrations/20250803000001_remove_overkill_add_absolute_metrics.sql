-- Migration: Remove Overkill Analytics and Add Absolute Performance Metrics
-- This migration removes theoretical/unmeasurable fields and adds practical absolute performance metrics
-- 
-- Changes:
-- 1. Remove overkill fields from duplicate_detection_sessions
-- 2. Remove comparison fields from pipeline_runs (keeping opportunities_bypassed_llm)
-- 3. Add absolute performance fields to pipeline_runs
-- 4. Update related views

-- =============================================================================
-- 1. DROP DEPENDENT VIEWS FIRST
-- =============================================================================

-- Drop views that depend on columns we're about to remove
DROP VIEW IF EXISTS duplicate_detection_effectiveness;
DROP VIEW IF EXISTS pipeline_performance_summary;
DROP VIEW IF EXISTS pipeline_progress;

-- =============================================================================
-- 2. REMOVE OVERKILL FIELDS FROM duplicate_detection_sessions
-- =============================================================================

-- Remove theoretical/unmeasurable fields from duplicate_detection_sessions
ALTER TABLE duplicate_detection_sessions 
  DROP COLUMN IF EXISTS estimated_tokens_saved,
  DROP COLUMN IF EXISTS estimated_cost_saved_usd,
  DROP COLUMN IF EXISTS efficiency_improvement_percentage,
  DROP COLUMN IF EXISTS detection_accuracy_score,
  DROP COLUMN IF EXISTS false_positive_rate,
  DROP COLUMN IF EXISTS false_negative_rate,
  DROP COLUMN IF EXISTS detection_config;

-- =============================================================================
-- 3. REMOVE COMPARISON FIELDS FROM pipeline_runs (KEEP opportunities_bypassed_llm)
-- =============================================================================

-- Remove V1 vs V2 comparison fields from pipeline_runs
ALTER TABLE pipeline_runs 
  DROP COLUMN IF EXISTS token_savings_percentage,
  DROP COLUMN IF EXISTS time_savings_percentage,
  DROP COLUMN IF EXISTS efficiency_score;

-- Note: Keeping opportunities_bypassed_llm as it's a real count from duplicate detection

-- =============================================================================
-- 4. ADD ABSOLUTE PERFORMANCE FIELDS TO pipeline_runs
-- =============================================================================

-- Add absolute performance tracking fields to pipeline_runs
ALTER TABLE pipeline_runs 
  ADD COLUMN opportunities_per_minute DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN tokens_per_opportunity DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN cost_per_opportunity_usd DECIMAL(8,4) DEFAULT NULL,
  ADD COLUMN success_rate_percentage DECIMAL(5,2) DEFAULT NULL 
    CHECK (success_rate_percentage IS NULL OR (success_rate_percentage >= 0 AND success_rate_percentage <= 100)),
  ADD COLUMN sla_compliance_percentage DECIMAL(5,2) DEFAULT NULL 
    CHECK (sla_compliance_percentage IS NULL OR (sla_compliance_percentage >= 0 AND sla_compliance_percentage <= 100));

-- Add column comments for clarity
COMMENT ON COLUMN pipeline_runs.opportunities_per_minute IS 'Absolute throughput metric: opportunities processed per minute';
COMMENT ON COLUMN pipeline_runs.tokens_per_opportunity IS 'Efficiency metric: average tokens consumed per opportunity processed';
COMMENT ON COLUMN pipeline_runs.cost_per_opportunity_usd IS 'Cost efficiency metric: average USD cost per opportunity processed';
COMMENT ON COLUMN pipeline_runs.success_rate_percentage IS 'Quality metric: percentage of opportunities processed without errors (0-100)';
COMMENT ON COLUMN pipeline_runs.sla_compliance_percentage IS 'SLA tracking: percentage compliance with processing time targets (0-100)';

-- Add indexes for performance analytics queries
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_opportunities_per_minute 
  ON pipeline_runs(opportunities_per_minute DESC) WHERE opportunities_per_minute IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_cost_per_opportunity 
  ON pipeline_runs(cost_per_opportunity_usd ASC) WHERE cost_per_opportunity_usd IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_success_rate 
  ON pipeline_runs(success_rate_percentage DESC) WHERE success_rate_percentage IS NOT NULL;

-- =============================================================================
-- 5. RECREATE VIEWS WITH UPDATED FIELDS
-- =============================================================================

-- Recreate pipeline_progress view to use new fields
CREATE VIEW pipeline_progress AS
SELECT 
  pr.id as run_id,
  pr.api_source_id,
  pr.status,
  pr.started_at,
  pr.total_opportunities_processed,
  pr.opportunities_bypassed_llm,
  pr.opportunities_per_minute,
  pr.success_rate_percentage,
  pr.sla_compliance_percentage,
  COUNT(ps.id) as total_stages,
  COUNT(ps.id) FILTER (WHERE ps.status = 'completed') as completed_stages,
  COUNT(ps.id) FILTER (WHERE ps.status = 'failed') as failed_stages,
  ROUND(
    COUNT(ps.id) FILTER (WHERE ps.status = 'completed') * 100.0 / 
    NULLIF(COUNT(ps.id), 0), 2
  ) as completion_percentage
FROM pipeline_runs pr
LEFT JOIN pipeline_stages ps ON pr.id = ps.run_id
WHERE pr.status IN ('processing', 'started')
GROUP BY pr.id, pr.api_source_id, pr.status, pr.started_at, 
         pr.total_opportunities_processed, pr.opportunities_bypassed_llm,
         pr.opportunities_per_minute, pr.success_rate_percentage, pr.sla_compliance_percentage;

-- Recreate pipeline_performance_summary view to use absolute metrics
CREATE VIEW pipeline_performance_summary AS
SELECT 
  pr.api_source_id,
  DATE_TRUNC('day', pr.started_at) as date,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE pr.status = 'completed') as successful_runs,
  COUNT(*) FILTER (WHERE pr.status = 'failed') as failed_runs,
  AVG(pr.total_execution_time_ms) as avg_execution_time_ms,
  AVG(pr.opportunities_per_minute) as avg_opportunities_per_minute,
  AVG(pr.tokens_per_opportunity) as avg_tokens_per_opportunity,
  AVG(pr.cost_per_opportunity_usd) as avg_cost_per_opportunity_usd,
  AVG(pr.success_rate_percentage) as avg_success_rate_percentage,
  AVG(pr.sla_compliance_percentage) as avg_sla_compliance_percentage,
  SUM(pr.total_opportunities_processed) as total_opportunities,
  SUM(pr.opportunities_bypassed_llm) as total_opportunities_optimized
FROM pipeline_runs pr
WHERE pr.completed_at IS NOT NULL
GROUP BY pr.api_source_id, DATE_TRUNC('day', pr.started_at);

-- Recreate duplicate_detection_effectiveness view without deleted fields
CREATE VIEW duplicate_detection_effectiveness AS
SELECT 
  dds.api_source_id,
  DATE_TRUNC('day', dds.created_at) as date,
  COUNT(*) as total_sessions,
  AVG(dds.detection_time_ms) as avg_detection_time_ms,
  SUM(dds.llm_processing_bypassed) as total_llm_processing_bypassed,
  AVG(dds.total_opportunities_checked) as avg_opportunities_checked,
  SUM(dds.new_opportunities) as total_new_opportunities,
  SUM(dds.duplicates_to_update) as total_duplicates_to_update,
  SUM(dds.duplicates_to_skip) as total_duplicates_to_skip
FROM duplicate_detection_sessions dds
GROUP BY dds.api_source_id, DATE_TRUNC('day', dds.created_at);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Summary of changes:
-- ✅ Removed 7 overkill fields from duplicate_detection_sessions
-- ✅ Removed 3 comparison fields from pipeline_runs (kept opportunities_bypassed_llm)
-- ✅ Added 5 absolute performance fields to pipeline_runs
-- ✅ Updated views to use new metrics
-- ✅ Added proper constraints and indexes
-- ✅ Added descriptive column comments