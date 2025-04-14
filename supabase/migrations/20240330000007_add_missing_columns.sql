-- Add missing columns needed for API source processing

-- Add api_handler_status column to api_source_runs table
ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS api_handler_status text DEFAULT 'pending';

-- Add data_processor_status column to api_source_runs table
ALTER TABLE IF EXISTS api_source_runs
ADD COLUMN IF NOT EXISTS data_processor_status text DEFAULT 'pending'; 