-- Drop the existing function
DROP FUNCTION IF EXISTS get_next_api_source_to_process();

-- Create a new function with dynamic prioritization
CREATE OR REPLACE FUNCTION get_next_api_source_to_process()
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  type api_source_type,
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
    s.configurations
  FROM active_api_sources_with_config s
  ORDER BY 
    -- First priority: sources that have never been checked
    CASE WHEN s.last_checked IS NULL THEN 0 ELSE 1 END,
    
    -- Second priority: sources based on their update frequency and time since last check
    CASE 
      -- Daily sources should be checked if more than 20 hours have passed
      WHEN s.update_frequency = 'daily' AND 
           (s.last_checked IS NULL OR 
            EXTRACT(EPOCH FROM (NOW() - s.last_checked))/3600 > 20) 
      THEN 1
      
      -- Weekly sources should be checked if more than 6 days have passed
      WHEN s.update_frequency = 'weekly' AND 
           (s.last_checked IS NULL OR 
            EXTRACT(EPOCH FROM (NOW() - s.last_checked))/3600/24 > 6) 
      THEN 2
      
      -- Monthly sources should be checked if more than 25 days have passed
      WHEN s.update_frequency = 'monthly' AND 
           (s.last_checked IS NULL OR 
            EXTRACT(EPOCH FROM (NOW() - s.last_checked))/3600/24 > 25) 
      THEN 3
      
      -- Other frequencies or if not enough time has passed
      ELSE 4
    END,
    
    -- Third priority: sources that were checked longest ago relative to their update frequency
    CASE 
      WHEN s.update_frequency = 'daily' THEN 
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone)))/3600/24
      WHEN s.update_frequency = 'weekly' THEN 
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone)))/3600/24/7
      WHEN s.update_frequency = 'monthly' THEN 
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone)))/3600/24/30
      ELSE
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_checked, '1970-01-01'::timestamp with time zone)))/3600/24
    END DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 