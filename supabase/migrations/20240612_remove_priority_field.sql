-- Migration to remove the priority field from the api_sources table
-- This field is being removed as we're implementing a dynamic prioritization algorithm
-- that will calculate priority based on update_frequency and last_checked

ALTER TABLE api_sources DROP COLUMN IF EXISTS priority;

-- Update the active_api_sources_with_config view to remove the priority field
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