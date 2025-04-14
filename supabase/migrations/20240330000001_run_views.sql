-- Migration: 20240330000001_run_views.sql
-- Created on 2024-03-30
-- Adds views for monitoring API source runs and process runs

-- View for detailed API source run information
CREATE OR REPLACE VIEW detailed_api_runs AS
SELECT 
  r.id AS run_id,
  r.source_id,
  s.name AS source_name,
  s.organization AS source_organization,
  s.type AS source_type,
  r.status::TEXT,
  r.started_at,
  r.completed_at,
  COALESCE(r.completed_at, NOW()) - r.started_at AS processing_time,
  -- Initial API call stats
  COALESCE((r.initial_api_call->>'totalHitCount')::INTEGER, 0) AS total_hits,
  COALESCE((r.initial_api_call->>'retrievedCount')::INTEGER, 0) AS retrieved_count,
  COALESCE((r.initial_api_call->>'responseTime')::NUMERIC, 0) AS api_response_time_ms,
  -- Detail API calls stats  
  COALESCE((r.detail_api_calls->>'totalDetailAPICalls')::INTEGER, 0) AS total_detail_calls,
  COALESCE((r.detail_api_calls->>'successfulDetailAPICalls')::INTEGER, 0) AS successful_detail_calls,
  -- Storage results
  COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0) AS opportunities_processed,
  COALESCE((r.storage_results->>'newCount')::INTEGER, 0) AS new_opportunities,
  COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0) AS updated_opportunities,
  COALESCE((r.storage_results->>'ignoredCount')::INTEGER, 0) AS ignored_opportunities,
  -- Error information
  r.error_details->>'message' AS error_message,
  r.created_at,
  r.updated_at
FROM 
  api_source_runs r
JOIN
  api_sources s ON r.source_id = s.id;

-- View for summarized API source run statistics by source
CREATE OR REPLACE VIEW api_source_run_stats AS
SELECT 
  s.id AS source_id,
  s.name AS source_name,
  s.organization,
  s.type,
  COUNT(r.id) AS total_runs,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS successful_runs,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) AS failed_runs,
  MAX(r.started_at) AS last_run_date,
  AVG(CASE 
    WHEN r.completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) 
  END) AS avg_processing_time_seconds,
  SUM(COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0)) AS total_opportunities_processed,
  SUM(COALESCE((r.storage_results->>'newCount')::INTEGER, 0)) AS total_new_opportunities,
  SUM(COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0)) AS total_updated_opportunities
FROM
  api_sources s
LEFT JOIN
  api_source_runs r ON s.id = r.source_id
GROUP BY
  s.id, s.name, s.organization, s.type
ORDER BY
  MAX(r.started_at) DESC NULLS LAST;

-- View for process run status tracking
CREATE OR REPLACE VIEW process_run_status AS
SELECT
  p.id AS run_id,
  p.source_id,
  s.name AS source_name,
  p.source_manager_status::TEXT,
  p.api_handler_status::TEXT,
  p.detail_processor_status::TEXT,
  p.data_processor_status::TEXT,
  CASE
    WHEN p.completed_at IS NOT NULL THEN 'completed'
    WHEN p.error_message IS NOT NULL THEN 'failed'
    ELSE 'in_progress'
  END AS overall_status,
  p.started_at,
  p.completed_at,
  COALESCE(p.completed_at, NOW()) - p.started_at AS processing_time,
  p.error_message,
  p.processing_details->>'total_opportunities' AS opportunities_processed,
  p.processing_details->>'new_opportunities' AS new_opportunities,
  p.processing_details->>'updated_opportunities' AS updated_opportunities
FROM
  process_runs p
JOIN
  api_sources s ON p.source_id = s.id
ORDER BY
  p.started_at DESC;

-- View for daily run statistics
CREATE OR REPLACE VIEW daily_run_statistics AS
SELECT
  DATE_TRUNC('day', r.started_at) AS day,
  COUNT(*) AS total_runs,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS successful_runs,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) AS failed_runs,
  SUM(COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0)) AS opportunities_processed,
  SUM(COALESCE((r.storage_results->>'newCount')::INTEGER, 0)) AS new_opportunities,
  SUM(COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0)) AS updated_opportunities,
  AVG(CASE 
    WHEN r.completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) 
  END) AS avg_processing_time_seconds
FROM
  api_source_runs r
WHERE
  r.started_at >= NOW() - INTERVAL '90 days'
GROUP BY
  DATE_TRUNC('day', r.started_at)
ORDER BY
  day DESC; 