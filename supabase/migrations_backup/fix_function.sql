-- Drop the existing function
DROP FUNCTION IF EXISTS get_next_api_source_to_process();

-- Create a new function with dynamic prioritization
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