-- Remove redundant timestamp fields from api_raw_responses
-- The 'timestamp' field is redundant with 'created_at' and 'last_seen_at'
-- The 'first_seen_at' field is redundant with 'created_at'

-- Drop the view first to avoid dependency issues
DROP VIEW IF EXISTS api_response_summary;

-- Remove redundant columns
ALTER TABLE api_raw_responses 
DROP COLUMN IF EXISTS timestamp,
DROP COLUMN IF EXISTS first_seen_at;

-- Recreate the view without the redundant fields
CREATE VIEW api_response_summary AS
SELECT 
    arr.id,
    arr.source_id,
    aps.name as source_name,
    arr.api_endpoint,
    arr.call_type,
    arr.execution_time_ms,
    arr.opportunity_count,
    arr.created_at,
    arr.last_seen_at,
    arr.call_count,
    arr.processed
FROM api_raw_responses arr
LEFT JOIN api_sources aps ON arr.source_id = aps.id
ORDER BY arr.last_seen_at DESC;

-- Grant permissions
GRANT SELECT ON api_response_summary TO authenticated;

-- Add comment to document the purpose of remaining timestamp fields
COMMENT ON COLUMN api_raw_responses.created_at IS 'Timestamp when the record was first created';
COMMENT ON COLUMN api_raw_responses.last_seen_at IS 'Timestamp when the record was last updated (duplicate response received)';