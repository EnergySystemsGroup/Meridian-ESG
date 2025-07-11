-- Migration: Create Clean V2 Pipeline Metrics System
-- This migration creates semantic database tables for V2 pipeline metrics
-- optimized for dashboard analytics and future extensibility.
-- 
-- Tables created:
-- 1. pipeline_runs - Core run tracking with optimization metrics
-- 2. pipeline_stages - Individual stage execution tracking
-- 3. opportunity_processing_paths - Track how opportunities flow through pipeline
-- 4. duplicate_detection_sessions - Duplicate detection analytics
-- 5. pipeline_performance_baselines - Performance baseline measurements

-- =============================================================================
-- 1. PIPELINE_RUNS - Core run tracking
-- =============================================================================
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_source_id UUID NOT NULL REFERENCES api_sources(id) ON DELETE CASCADE,
  
  -- Run Metadata
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'processing', 'completed', 'failed', 'cancelled')),
  pipeline_version TEXT NOT NULL DEFAULT 'v2.0',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Overall Metrics
  total_execution_time_ms INTEGER,
  total_opportunities_processed INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4),
  
  -- V2 Optimization Impact
  opportunities_bypassed_llm INTEGER DEFAULT 0,
  token_savings_percentage DECIMAL(5,2),
  time_savings_percentage DECIMAL(5,2),
  efficiency_score DECIMAL(5,2), -- Overall pipeline efficiency rating
  
  -- Configuration and Results
  run_configuration JSONB DEFAULT '{}',
  final_results JSONB DEFAULT '{}',
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_pipeline_runs_api_source_id ON pipeline_runs(api_source_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
CREATE INDEX idx_pipeline_runs_completed_at ON pipeline_runs(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Add comments for clarity
COMMENT ON TABLE pipeline_runs IS 'V2 pipeline run tracking with optimization metrics and dashboard analytics';
COMMENT ON COLUMN pipeline_runs.opportunities_bypassed_llm IS 'Number of opportunities that skipped expensive LLM processing due to early duplicate detection';
COMMENT ON COLUMN pipeline_runs.token_savings_percentage IS 'Percentage of tokens saved compared to full pipeline processing';
COMMENT ON COLUMN pipeline_runs.efficiency_score IS 'Overall pipeline efficiency score (0-100)';

-- =============================================================================
-- 2. PIPELINE_STAGES - Individual stage execution tracking
-- =============================================================================
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  
  -- Stage Identity
  stage_name TEXT NOT NULL CHECK (stage_name IN (
    'source_orchestrator',
    'data_extraction', 
    'early_duplicate_detector',
    'analysis',
    'filter',
    'storage',
    'direct_update'
  )),
  stage_order INTEGER NOT NULL,
  
  -- Execution Details
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  
  -- Resource Usage
  api_calls_made INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(8,4),
  memory_usage_mb INTEGER,
  
  -- Input/Output Counts
  input_count INTEGER DEFAULT 0,
  output_count INTEGER DEFAULT 0,
  
  -- Results and Performance
  stage_results JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_pipeline_stages_run_id ON pipeline_stages(run_id);
CREATE INDEX idx_pipeline_stages_stage_name ON pipeline_stages(stage_name);
CREATE INDEX idx_pipeline_stages_status ON pipeline_stages(status);
CREATE INDEX idx_pipeline_stages_started_at ON pipeline_stages(started_at DESC);
CREATE INDEX idx_pipeline_stages_run_stage ON pipeline_stages(run_id, stage_order);

-- Add comments
COMMENT ON TABLE pipeline_stages IS 'Individual pipeline stage execution tracking with detailed performance metrics';
COMMENT ON COLUMN pipeline_stages.stage_order IS 'Order of stage execution within the pipeline run';
COMMENT ON COLUMN pipeline_stages.performance_metrics IS 'Stage-specific performance data (throughput, latency, etc.)';

-- =============================================================================
-- 3. OPPORTUNITY_PROCESSING_PATHS - Track opportunity flow through pipeline
-- =============================================================================
CREATE TABLE opportunity_processing_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  
  -- Opportunity Identity
  api_opportunity_id TEXT NOT NULL,
  opportunity_title TEXT,
  funding_source_id UUID REFERENCES funding_sources(id),
  
  -- Path Classification
  path_type TEXT NOT NULL CHECK (path_type IN ('NEW', 'UPDATE', 'SKIP')),
  path_reason TEXT, -- e.g., 'no_duplicate_found', 'api_timestamp_newer', 'no_critical_changes'
  
  -- Stage Journey
  stages_processed TEXT[] DEFAULT '{}', -- Array of stage names the opportunity went through
  final_outcome TEXT NOT NULL CHECK (final_outcome IN (
    'stored', 'updated', 'skipped', 'filtered_out', 'failed'
  )),
  
  -- Performance Impact
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  cost_usd DECIMAL(8,4),
  
  -- Duplicate Detection Details
  duplicate_detected BOOLEAN DEFAULT FALSE,
  existing_opportunity_id UUID REFERENCES funding_opportunities(id),
  changes_detected TEXT[] DEFAULT '{}', -- Array of fields that changed
  duplicate_detection_method TEXT, -- 'id_match', 'title_match', 'none'
  
  -- Quality Metrics
  processing_quality_score DECIMAL(5,2), -- Quality score for this opportunity's processing
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for analytics
CREATE INDEX idx_opportunity_paths_run_id ON opportunity_processing_paths(run_id);
CREATE INDEX idx_opportunity_paths_path_type ON opportunity_processing_paths(path_type);
CREATE INDEX idx_opportunity_paths_final_outcome ON opportunity_processing_paths(final_outcome);
CREATE INDEX idx_opportunity_paths_api_opp_id ON opportunity_processing_paths(api_opportunity_id);
CREATE INDEX idx_opportunity_paths_duplicate_detected ON opportunity_processing_paths(duplicate_detected);
CREATE INDEX idx_opportunity_paths_created_at ON opportunity_processing_paths(created_at DESC);

-- Add comments
COMMENT ON TABLE opportunity_processing_paths IS 'Track how individual opportunities flow through the V2 pipeline for analytics';
COMMENT ON COLUMN opportunity_processing_paths.path_type IS 'NEW: Full pipeline, UPDATE: Direct update, SKIP: No processing needed';
COMMENT ON COLUMN opportunity_processing_paths.stages_processed IS 'Array of pipeline stages this opportunity went through';

-- =============================================================================
-- 4. DUPLICATE_DETECTION_SESSIONS - Duplicate detection analytics
-- =============================================================================
CREATE TABLE duplicate_detection_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  
  -- Detection Input
  total_opportunities_checked INTEGER NOT NULL,
  api_source_id UUID NOT NULL REFERENCES api_sources(id),
  
  -- Detection Results
  new_opportunities INTEGER NOT NULL DEFAULT 0,
  duplicates_to_update INTEGER NOT NULL DEFAULT 0,
  duplicates_to_skip INTEGER NOT NULL DEFAULT 0,
  
  -- Performance Metrics
  detection_time_ms INTEGER NOT NULL,
  database_queries_made INTEGER NOT NULL DEFAULT 0,
  
  -- Efficiency Impact
  llm_processing_bypassed INTEGER NOT NULL DEFAULT 0,
  estimated_tokens_saved INTEGER NOT NULL DEFAULT 0,
  estimated_cost_saved_usd DECIMAL(8,4),
  efficiency_improvement_percentage DECIMAL(5,2),
  
  -- Detection Method Breakdown
  id_matches INTEGER DEFAULT 0,
  title_matches INTEGER DEFAULT 0,
  validation_failures INTEGER DEFAULT 0,
  freshness_skips INTEGER DEFAULT 0, -- Opportunities skipped due to freshness check
  
  -- Quality Metrics
  detection_accuracy_score DECIMAL(5,2), -- Accuracy of duplicate detection
  false_positive_rate DECIMAL(5,2),
  false_negative_rate DECIMAL(5,2),
  
  -- Configuration
  detection_config JSONB DEFAULT '{}', -- Configuration used for this detection session
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for analytics
CREATE INDEX idx_duplicate_sessions_run_id ON duplicate_detection_sessions(run_id);
CREATE INDEX idx_duplicate_sessions_api_source_id ON duplicate_detection_sessions(api_source_id);
CREATE INDEX idx_duplicate_sessions_created_at ON duplicate_detection_sessions(created_at DESC);
CREATE INDEX idx_duplicate_sessions_efficiency ON duplicate_detection_sessions(efficiency_improvement_percentage DESC);

-- Add comments
COMMENT ON TABLE duplicate_detection_sessions IS 'Detailed analytics for each duplicate detection session';
COMMENT ON COLUMN duplicate_detection_sessions.llm_processing_bypassed IS 'Number of opportunities that bypassed expensive LLM processing';
COMMENT ON COLUMN duplicate_detection_sessions.detection_accuracy_score IS 'Measured accuracy of duplicate detection (0-100)';

-- =============================================================================
-- 5. PIPELINE_PERFORMANCE_BASELINES - Performance baseline measurements
-- =============================================================================
CREATE TABLE pipeline_performance_baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_source_id UUID NOT NULL REFERENCES api_sources(id),
  
  -- Baseline Metadata
  baseline_type TEXT NOT NULL CHECK (baseline_type IN ('v1_equivalent', 'no_optimization', 'full_processing')),
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Baseline Metrics
  opportunities_count INTEGER NOT NULL,
  estimated_total_tokens INTEGER NOT NULL,
  estimated_total_time_ms INTEGER NOT NULL,
  estimated_total_cost_usd DECIMAL(10,4),
  estimated_memory_usage_mb INTEGER,
  
  -- Performance Characteristics
  avg_tokens_per_opportunity DECIMAL(10,2),
  avg_processing_time_per_opportunity_ms INTEGER,
  avg_cost_per_opportunity_usd DECIMAL(8,4),
  
  -- Methodology
  measurement_methodology TEXT, -- How this baseline was measured/calculated
  assumptions JSONB DEFAULT '{}', -- Assumptions made in baseline calculation
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_baselines_api_source_id ON pipeline_performance_baselines(api_source_id);
CREATE INDEX idx_baselines_type ON pipeline_performance_baselines(baseline_type);
CREATE INDEX idx_baselines_measurement_date ON pipeline_performance_baselines(measurement_date DESC);

-- Add comments
COMMENT ON TABLE pipeline_performance_baselines IS 'Performance baselines for measuring V2 pipeline improvements';
COMMENT ON COLUMN pipeline_performance_baselines.baseline_type IS 'Type of baseline: v1_equivalent, no_optimization, or full_processing';

-- =============================================================================
-- 6. UTILITY VIEWS FOR DASHBOARD ANALYTICS
-- =============================================================================

-- Real-time pipeline progress view
CREATE VIEW pipeline_progress AS
SELECT 
  pr.id as run_id,
  pr.api_source_id,
  pr.status,
  pr.started_at,
  pr.total_opportunities_processed,
  pr.opportunities_bypassed_llm,
  pr.token_savings_percentage,
  pr.efficiency_score,
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
         pr.token_savings_percentage, pr.efficiency_score;

-- Pipeline performance summary view
CREATE VIEW pipeline_performance_summary AS
SELECT 
  pr.api_source_id,
  DATE_TRUNC('day', pr.started_at) as date,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE pr.status = 'completed') as successful_runs,
  COUNT(*) FILTER (WHERE pr.status = 'failed') as failed_runs,
  AVG(pr.total_execution_time_ms) as avg_execution_time_ms,
  AVG(pr.token_savings_percentage) as avg_token_savings_percentage,
  AVG(pr.efficiency_score) as avg_efficiency_score,
  SUM(pr.total_opportunities_processed) as total_opportunities,
  SUM(pr.opportunities_bypassed_llm) as total_opportunities_optimized
FROM pipeline_runs pr
WHERE pr.completed_at IS NOT NULL
GROUP BY pr.api_source_id, DATE_TRUNC('day', pr.started_at);

-- Duplicate detection effectiveness view
CREATE VIEW duplicate_detection_effectiveness AS
SELECT 
  dds.api_source_id,
  DATE_TRUNC('day', dds.created_at) as date,
  COUNT(*) as total_sessions,
  AVG(dds.detection_accuracy_score) as avg_accuracy_score,
  AVG(dds.efficiency_improvement_percentage) as avg_efficiency_improvement,
  SUM(dds.estimated_tokens_saved) as total_tokens_saved,
  SUM(dds.estimated_cost_saved_usd) as total_cost_saved_usd,
  AVG(dds.false_positive_rate) as avg_false_positive_rate
FROM duplicate_detection_sessions dds
GROUP BY dds.api_source_id, DATE_TRUNC('day', dds.created_at);

-- =============================================================================
-- 7. ENABLE REALTIME FOR DASHBOARD UPDATES
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE opportunity_processing_paths;
ALTER PUBLICATION supabase_realtime ADD TABLE duplicate_detection_sessions;

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Enable RLS on all tables
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_processing_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_detection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_performance_baselines ENABLE ROW LEVEL SECURITY;

-- Basic read/write policies (adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON pipeline_runs FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON pipeline_runs FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON pipeline_stages FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON opportunity_processing_paths FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON opportunity_processing_paths FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON duplicate_detection_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON duplicate_detection_sessions FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON pipeline_performance_baselines FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON pipeline_performance_baselines FOR ALL USING (true);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Created semantic V2 pipeline metrics schema with:
-- ✅ pipeline_runs - Core run tracking with optimization metrics
-- ✅ pipeline_stages - Individual stage execution tracking  
-- ✅ opportunity_processing_paths - Opportunity flow analytics
-- ✅ duplicate_detection_sessions - Duplicate detection analytics
-- ✅ pipeline_performance_baselines - Performance baseline measurements
-- ✅ Utility views for dashboard consumption
-- ✅ Proper indexes for performance
-- ✅ RLS policies for security
-- ✅ Realtime subscriptions for live updates