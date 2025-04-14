-- Add stage status columns to api_source_runs
ALTER TABLE api_source_runs
ADD COLUMN source_manager_status text DEFAULT 'pending',
ADD COLUMN api_handler_status text DEFAULT 'pending',
ADD COLUMN detail_processor_status text DEFAULT 'pending',
ADD COLUMN data_processor_status text DEFAULT 'pending'; 