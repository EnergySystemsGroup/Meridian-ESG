-- Fix the active_api_sources_with_config view to include the handler_type column

-- Drop the existing view
DROP VIEW IF EXISTS active_api_sources_with_config;

-- Recreate the view with the handler_type column
CREATE OR REPLACE VIEW active_api_sources_with_config AS
SELECT 
    s.id,
    s.name,
    s.organization,
    s.type,
    s.url,
    s.api_endpoint,
    s.api_documentation_url,
    s.auth_type,
    s.auth_details,
    s.update_frequency,
    s.last_checked,
    s.handler_type,
    s.active,
    s.notes,
    s.created_at,
    s.updated_at,
    jsonb_object_agg(
      c.config_type::text, 
      c.configuration
    ) AS configuration
FROM 
    api_sources s
LEFT JOIN 
    api_source_configurations c ON s.id = c.source_id
WHERE 
    s.active = true
GROUP BY 
    s.id, s.name, s.organization, s.type, s.url, s.api_endpoint, 
    s.api_documentation_url, s.auth_type, s.auth_details, s.update_frequency, 
    s.last_checked, s.handler_type, s.active, s.notes, s.created_at, s.updated_at; 