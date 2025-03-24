-- Drop the view that depends on the priority field
DROP VIEW IF EXISTS active_api_sources_with_config;

-- Alter the table to remove the priority field
ALTER TABLE api_sources DROP COLUMN priority;

-- Recreate the view without the priority field
CREATE VIEW active_api_sources_with_config AS
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
  jsonb_object_agg(
    COALESCE(c.config_type, 'none'), 
    COALESCE(c.configuration, '{}'::jsonb)
  ) AS configurations
FROM 
  api_sources s
LEFT JOIN 
  api_source_configurations c ON s.id = c.source_id
WHERE 
  s.active = true
GROUP BY 
  s.id, s.name, s.organization, s.type, s.url, s.api_endpoint, 
  s.auth_type, s.auth_details, s.update_frequency, s.last_checked, 
  s.notes; 