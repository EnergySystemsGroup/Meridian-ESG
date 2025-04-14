-- Add the remaining missing columns based on RunManager usage

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS source_manager_status text DEFAULT 'pending';

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS data_processor_status text DEFAULT 'pending';

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS total_processing_time numeric; 