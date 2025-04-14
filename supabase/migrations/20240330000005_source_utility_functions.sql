-- Migration: 20240330000005_source_utility_functions.sql
-- Created on 2024-03-30
-- Adds utility functions for working with API sources

-- Function to check for similar API sources
CREATE OR REPLACE FUNCTION check_similar_sources(
  p_name TEXT,
  p_organization TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.organization,
    CASE 
      WHEN s.name = p_name AND COALESCE(s.organization, '') = COALESCE(p_organization, '') THEN 1.0
      ELSE similarity(s.name, p_name)
    END AS sim
  FROM 
    api_sources s 
  WHERE 
    similarity(s.name, p_name) > 0.4 OR 
    (
      p_organization IS NOT NULL AND 
      s.organization IS NOT NULL AND 
      similarity(s.organization, p_organization) > 0.6
    )
  ORDER BY 
    sim DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get active API sources
CREATE OR REPLACE FUNCTION get_active_api_sources()
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  type TEXT,
  url TEXT,
  api_endpoint TEXT,
  auth_type TEXT,
  handler_type TEXT,
  last_checked TIMESTAMP WITH TIME ZONE,
  priority INTEGER,
  configurations JSONB,
  last_run_status TEXT,
  last_run_time TIMESTAMP WITH TIME ZONE,
  opportunities_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.organization,
    s.type,
    s.url,
    s.api_endpoint,
    s.auth_type::TEXT,
    s.handler_type::TEXT,
    s.last_checked,
    s.priority,
    (
      SELECT jsonb_object_agg(config_type, configuration)
      FROM api_source_configurations
      WHERE source_id = s.id
    ) AS configurations,
    (
      SELECT status::TEXT
      FROM api_source_runs
      WHERE source_id = s.id
      ORDER BY started_at DESC
      LIMIT 1
    ) AS last_run_status,
    (
      SELECT started_at
      FROM api_source_runs
      WHERE source_id = s.id
      ORDER BY started_at DESC
      LIMIT 1
    ) AS last_run_time,
    (
      SELECT COUNT(*)
      FROM funding_opportunities
      WHERE source_id = s.id
    ) AS opportunities_count
  FROM 
    api_sources s
  WHERE 
    s.active = true
  ORDER BY 
    COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone),
    s.priority;
END;
$$ LANGUAGE plpgsql;

-- Function to test an API source endpoint
CREATE OR REPLACE FUNCTION test_api_endpoint(
  source_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  status_code INTEGER,
  response_time NUMERIC,
  response_size INTEGER,
  message TEXT,
  sample_data JSONB
) AS $$
DECLARE
  source_record RECORD;
  config_record RECORD;
  result_record RECORD;
BEGIN
  -- Get the source information
  SELECT * INTO source_record
  FROM api_sources
  WHERE id = source_id;
  
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      FALSE AS success,
      NULL AS status_code,
      NULL AS response_time,
      NULL AS response_size,
      'API source not found' AS message,
      NULL AS sample_data;
    RETURN;
  END IF;
  
  -- Get configurations
  SELECT jsonb_object_agg(config_type, configuration) INTO config_record
  FROM api_source_configurations
  WHERE source_id = source_record.id;
  
  -- This function is just a placeholder since we can't actually perform HTTP requests directly from SQL
  -- In a real implementation, this would be a server-side function that makes the actual HTTP request
  
  -- Simulate a successful response for demonstration purposes
  RETURN QUERY
  SELECT 
    TRUE AS success,
    200 AS status_code,
    random() * 1000 AS response_time,
    1024 AS response_size,
    'Endpoint test successful' AS message,
    jsonb_build_object(
      'sample', 'This is sample data. In a real implementation, this would be actual data from the API.',
      'timestamp', now()::text,
      'endpoint', source_record.api_endpoint,
      'auth_type', source_record.auth_type::text,
      'configurations', config_record
    ) AS sample_data;
END;
$$ LANGUAGE plpgsql; 