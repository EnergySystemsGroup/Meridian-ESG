-- Enhanced Metrics Tracking Migration
-- Adds failure breakdown, SLA targets, and SLA breakdown tracking to pipeline_runs

-- Add new columns for enhanced metrics tracking
ALTER TABLE pipeline_runs 
  ADD COLUMN failure_breakdown JSONB DEFAULT '{}',
  ADD COLUMN sla_targets JSONB DEFAULT '{}',
  ADD COLUMN sla_breakdown JSONB DEFAULT '{}',
  ADD COLUMN sla_grade VARCHAR(1) DEFAULT NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN pipeline_runs.failure_breakdown IS 'Breakdown of failures by category (apiErrors, validationErrors, etc.)';
COMMENT ON COLUMN pipeline_runs.sla_targets IS 'SLA targets used for this run (maxProcessingTimeMinutes, minSuccessRate, etc.)';
COMMENT ON COLUMN pipeline_runs.sla_breakdown IS 'Detailed SLA compliance scores by category (timeCompliance, successCompliance, etc.)';
COMMENT ON COLUMN pipeline_runs.sla_grade IS 'Letter grade for overall SLA compliance (A, B, C, D, F)';

-- Add constraints for SLA grade
ALTER TABLE pipeline_runs
  ADD CONSTRAINT check_sla_grade 
  CHECK (sla_grade IS NULL OR sla_grade IN ('A', 'B', 'C', 'D', 'F'));

-- Create indexes for performance
CREATE INDEX idx_pipeline_runs_sla_grade ON pipeline_runs(sla_grade) WHERE sla_grade IS NOT NULL;
CREATE INDEX idx_pipeline_runs_failure_tracking ON pipeline_runs USING GIN (failure_breakdown) WHERE failure_breakdown != '{}';

-- Update the existing view to include new metrics if it exists
-- Note: This is safe to run even if view doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'pipeline_performance_summary') THEN
    DROP VIEW pipeline_performance_summary;
    
    CREATE VIEW pipeline_performance_summary AS
    SELECT 
      pr.id,
      pr.api_source_id,
      pr.status,
      pr.created_at,
      pr.completed_at,
      pr.total_execution_time_ms,
      pr.total_opportunities_processed,
      pr.opportunities_per_minute,
      pr.success_rate_percentage,
      pr.cost_per_opportunity_usd,
      pr.tokens_per_opportunity,
      pr.sla_compliance_percentage,
      pr.sla_grade,
      pr.failure_breakdown,
      pr.sla_breakdown,
      -- Calculate failure totals
      COALESCE(
        (pr.failure_breakdown->>'apiErrors')::int +
        (pr.failure_breakdown->>'validationErrors')::int +
        (pr.failure_breakdown->>'duplicateRejections')::int +
        (pr.failure_breakdown->>'processingErrors')::int +
        (pr.failure_breakdown->>'storageErrors')::int +
        (pr.failure_breakdown->>'timeoutErrors')::int,
        0
      ) as total_failures,
      -- Calculate success count
      GREATEST(0, pr.total_opportunities_processed - COALESCE(
        (pr.failure_breakdown->>'apiErrors')::int +
        (pr.failure_breakdown->>'validationErrors')::int +
        (pr.failure_breakdown->>'duplicateRejections')::int +
        (pr.failure_breakdown->>'processingErrors')::int +
        (pr.failure_breakdown->>'storageErrors')::int +
        (pr.failure_breakdown->>'timeoutErrors')::int,
        0
      )) as successful_opportunities
    FROM pipeline_runs pr
    WHERE pr.status IN ('completed', 'failed');
    
    COMMENT ON VIEW pipeline_performance_summary IS 'Enhanced performance summary with failure tracking and SLA metrics';
  END IF;
END $$;

-- Create a function to get failure category totals
CREATE OR REPLACE FUNCTION get_failure_totals(failure_data JSONB)
RETURNS TABLE (
  category TEXT,
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    key as category,
    (value::text)::integer as count
  FROM jsonb_each_text(failure_data)
  WHERE (value::text)::integer > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_failure_totals IS 'Extract failure counts by category from failure_breakdown JSONB';