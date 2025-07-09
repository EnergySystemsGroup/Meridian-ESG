-- Add data and metrics columns for RunManagerV2 stage tracking
-- This enables V2 pipeline to store stage results and performance metrics separately

-- Add data columns for stage results
ALTER TABLE api_source_runs 
ADD COLUMN IF NOT EXISTS source_manager_data JSONB,
ADD COLUMN IF NOT EXISTS api_handler_data JSONB,
ADD COLUMN IF NOT EXISTS detail_processor_data JSONB,
ADD COLUMN IF NOT EXISTS data_processor_data JSONB;

-- Add metrics columns for performance tracking
ALTER TABLE api_source_runs
ADD COLUMN IF NOT EXISTS source_manager_metrics JSONB,
ADD COLUMN IF NOT EXISTS api_handler_metrics JSONB,
ADD COLUMN IF NOT EXISTS detail_processor_metrics JSONB,
ADD COLUMN IF NOT EXISTS data_processor_metrics JSONB;

-- Add helpful comments
COMMENT ON COLUMN api_source_runs.source_manager_data IS 'Results data from SourceOrchestrator stage (V2)';
COMMENT ON COLUMN api_source_runs.source_manager_metrics IS 'Performance metrics from SourceOrchestrator stage (execution time, tokens, etc.)';
COMMENT ON COLUMN api_source_runs.api_handler_data IS 'Results data from DataExtraction stage (V2)';
COMMENT ON COLUMN api_source_runs.api_handler_metrics IS 'Performance metrics from DataExtraction stage (execution time, tokens, etc.)';
COMMENT ON COLUMN api_source_runs.detail_processor_data IS 'Results data from Filter stage (V2)';
COMMENT ON COLUMN api_source_runs.detail_processor_metrics IS 'Performance metrics from Filter stage (execution time, tokens, etc.)';
COMMENT ON COLUMN api_source_runs.data_processor_data IS 'Results data from Storage stage (V2)';
COMMENT ON COLUMN api_source_runs.data_processor_metrics IS 'Performance metrics from Storage stage (execution time, tokens, etc.)';