-- Add API Response Tracking Fields for Update-on-Duplicate Logic
-- Enhances existing api_raw_responses table with tracking capabilities

-- Add tracking fields for deduplication and update logic
ALTER TABLE api_raw_responses 
ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS call_count integer DEFAULT 1;

-- Add indexes for performance on tracking fields
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_first_seen_at ON api_raw_responses(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_last_seen_at ON api_raw_responses(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_call_count ON api_raw_responses(call_count);

-- Drop and recreate the view to include tracking fields
DROP VIEW IF EXISTS api_response_summary;
CREATE VIEW api_response_summary AS
SELECT 
    arr.id,
    arr.source_id,
    aps.name as source_name,
    arr.api_endpoint,
    arr.call_type,
    arr.execution_time_ms,
    arr.opportunity_count,
    arr.first_seen_at,
    arr.last_seen_at,
    arr.call_count,
    arr.timestamp,
    arr.created_at,
    arr.processed
FROM api_raw_responses arr
LEFT JOIN api_sources aps ON arr.source_id = aps.id
ORDER BY arr.last_seen_at DESC;

-- Grant permissions
GRANT SELECT ON api_response_summary TO authenticated;