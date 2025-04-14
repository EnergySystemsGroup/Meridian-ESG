-- Migration to update the get_next_api_source_to_process function to use dynamic prioritization
-- This replaces the static priority field with a dynamic calculation based on update_frequency and last_checked

-- Create a function to calculate dynamic priority based on update frequency and last checked time
CREATE OR REPLACE FUNCTION calculate_source_priority(
  update_frequency TEXT,
  last_checked TIMESTAMP WITH TIME ZONE
)
RETURNS FLOAT AS $$
DECLARE
  now_time TIMESTAMP WITH TIME ZONE := NOW();
  elapsed_hours FLOAT;
  expected_interval FLOAT;
BEGIN
  -- If the source has never been checked, give it highest priority
  IF last_checked IS NULL THEN
    RETURN 100;
  END IF;
  
  -- Calculate elapsed hours since last check
  elapsed_hours := EXTRACT(EPOCH FROM (now_time - last_checked)) / 3600;
  
  -- Define expected update intervals in hours
  CASE update_frequency
    WHEN 'hourly' THEN expected_interval := 1;
    WHEN 'daily' THEN expected_interval := 24;
    WHEN 'weekly' THEN expected_interval := 168; -- 7 days * 24 hours
    WHEN 'monthly' THEN expected_interval := 720; -- 30 days * 24 hours
    ELSE expected_interval := 24; -- Default to daily if not specified
  END CASE;
  
  -- Calculate priority as a ratio of elapsed time to expected interval
  -- This means sources that are more overdue get higher priority
  RETURN LEAST(100, GREATEST(1, (elapsed_hours / expected_interval) * 10));
END;
$$ LANGUAGE plpgsql;

-- Update the get_next_api_source_to_process function to use the dynamic priority calculation
DROP FUNCTION IF EXISTS get_next_api_source_to_process();

CREATE OR REPLACE FUNCTION get_next_api_source_to_process()
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  type TEXT,
  url TEXT,
  api_endpoint TEXT,
  auth_type api_auth_type,
  auth_details JSONB,
  update_frequency TEXT,
  last_checked TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  configurations JSONB
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
    s.auth_type,
    s.auth_details,
    s.update_frequency,
    s.last_checked,
    s.notes,
    s.configuration as configurations
  FROM active_api_sources_with_config s
  ORDER BY 
    -- First priority: sources that have never been checked
    CASE WHEN s.last_checked IS NULL THEN 0 ELSE 1 END,
    -- Second priority: sources with higher dynamic priority score
    calculate_source_priority(s.update_frequency, s.last_checked) DESC,
    -- Third priority: sources that were checked longest ago
    COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 