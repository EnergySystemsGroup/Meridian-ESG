-- Drop the view first
DROP VIEW IF EXISTS active_api_sources_with_config;

-- Recreate the view without the priority field
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
    s.active,
    s.notes,
    s.created_at,
    s.updated_at,
    c.configuration
FROM 
    api_sources s
LEFT JOIN 
    api_source_configurations c ON s.id = c.source_id AND c.config_type = 'default'
WHERE 
    s.active = true; 