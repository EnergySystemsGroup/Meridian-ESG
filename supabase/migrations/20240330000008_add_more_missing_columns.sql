-- Add all potentially missing status columns to api_source_runs table

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS detail_processor_status text DEFAULT 'pending';

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS opportunities_count integer DEFAULT 0;

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS filtered_opportunities_count integer DEFAULT 0;

ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS stored_opportunities_count integer DEFAULT 0; 