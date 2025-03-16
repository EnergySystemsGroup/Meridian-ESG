-- Drop the existing view
DROP VIEW IF EXISTS active_api_sources_with_config;

-- Recreate the view with proper handling of NULL values
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
    COALESCE(
        jsonb_object_agg(
            c.config_type::text, 
            c.configuration
        ) FILTER (WHERE c.config_type IS NOT NULL),
        '{}'::jsonb
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