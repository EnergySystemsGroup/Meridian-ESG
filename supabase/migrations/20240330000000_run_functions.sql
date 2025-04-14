-- Migration: 20240330000000_run_functions.sql
-- Created on 2024-03-30
-- Adds utility functions for working with API source runs and process runs

-- Function to get the most recent run for a specific API source
CREATE OR REPLACE FUNCTION get_latest_run_for_source(source_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  initial_api_call JSONB,
  detail_api_calls JSONB,
  storage_results JSONB,
  error_details JSONB,
  processing_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.status::TEXT,
    r.started_at,
    r.completed_at,
    r.initial_api_call,
    r.detail_api_calls,
    r.storage_results,
    r.error_details,
    COALESCE(r.completed_at, NOW()) - r.started_at AS processing_time
  FROM 
    api_source_runs r
  WHERE 
    r.source_id = get_latest_run_for_source.source_id
  ORDER BY 
    r.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get runs with a specific status
CREATE OR REPLACE FUNCTION get_runs_by_status(status_filter run_status)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  source_name TEXT,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.source_id,
    s.name AS source_name,
    r.status::TEXT,
    r.started_at,
    r.completed_at,
    COALESCE(r.completed_at, NOW()) - r.started_at AS processing_time
  FROM 
    api_source_runs r
  JOIN
    api_sources s ON r.source_id = s.id
  WHERE 
    r.status = status_filter
  ORDER BY 
    r.started_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get summary statistics for runs
CREATE OR REPLACE FUNCTION get_run_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  total_runs INTEGER,
  successful_runs INTEGER,
  failed_runs INTEGER,
  pending_runs INTEGER,
  avg_processing_time INTERVAL,
  total_opportunities INTEGER,
  new_opportunities INTEGER,
  updated_opportunities INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH run_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
      COUNT(CASE WHEN status = 'started' OR status = 'processing' THEN 1 END) AS pending,
      AVG(CASE 
        WHEN completed_at IS NOT NULL 
        THEN completed_at - started_at 
        ELSE NOW() - started_at 
      END) AS avg_time,
      SUM(COALESCE((storage_results->>'totalProcessed')::INTEGER, 0)) AS total_opps,
      SUM(COALESCE((storage_results->>'newCount')::INTEGER, 0)) AS new_opps,
      SUM(COALESCE((storage_results->>'updatedCount')::INTEGER, 0)) AS updated_opps
    FROM
      api_source_runs
    WHERE
      started_at >= NOW() - (days_back * INTERVAL '1 day')
  )
  SELECT
    COALESCE(total, 0) AS total_runs,
    COALESCE(completed, 0) AS successful_runs,
    COALESCE(failed, 0) AS failed_runs,
    COALESCE(pending, 0) AS pending_runs,
    COALESCE(avg_time, INTERVAL '0') AS avg_processing_time,
    COALESCE(total_opps, 0) AS total_opportunities,
    COALESCE(new_opps, 0) AS new_opportunities,
    COALESCE(updated_opps, 0) AS updated_opportunities
  FROM
    run_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old runs while keeping a minimum history
CREATE OR REPLACE FUNCTION cleanup_old_runs(
  days_to_keep INTEGER DEFAULT 90,
  min_runs_per_source INTEGER DEFAULT 5
)
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  deleted INTEGER;
BEGIN
  -- For each source, keep the most recent N runs and delete older ones beyond the days threshold
  WITH runs_to_keep AS (
    SELECT id
    FROM (
      SELECT 
        id,
        source_id,
        started_at,
        ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY started_at DESC) AS rn
      FROM 
        api_source_runs
    ) ranked
    WHERE 
      rn <= min_runs_per_source 
      OR started_at >= NOW() - (days_to_keep * INTERVAL '1 day')
  )
  DELETE FROM api_source_runs
  WHERE id NOT IN (SELECT id FROM runs_to_keep)
  AND started_at < NOW() - (days_to_keep * INTERVAL '1 day')
  RETURNING COUNT(*) INTO deleted;

  RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql; 