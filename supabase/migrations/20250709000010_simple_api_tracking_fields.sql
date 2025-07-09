-- Simple API Response Tracking Enhancement
-- Add minimal fields to existing api_raw_responses table

-- Add new columns for basic API tracking
ALTER TABLE api_raw_responses 
ADD COLUMN IF NOT EXISTS api_endpoint text,
ADD COLUMN IF NOT EXISTS call_type text CHECK (call_type IN ('list', 'detail', 'single')),
ADD COLUMN IF NOT EXISTS execution_time_ms integer,
ADD COLUMN IF NOT EXISTS opportunity_count integer DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_api_endpoint ON api_raw_responses(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_call_type ON api_raw_responses(call_type);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_timestamp ON api_raw_responses(timestamp);

-- Create a simple view for API call monitoring
CREATE OR REPLACE VIEW api_response_summary AS
SELECT 
    arr.id,
    arr.source_id,
    aps.name as source_name,
    arr.api_endpoint,
    arr.call_type,
    arr.execution_time_ms,
    arr.opportunity_count,
    arr.timestamp,
    arr.created_at,
    arr.processed
FROM api_raw_responses arr
LEFT JOIN api_sources aps ON arr.source_id = aps.id
ORDER BY arr.timestamp DESC;

-- Grant permissions
GRANT SELECT ON api_response_summary TO authenticated;