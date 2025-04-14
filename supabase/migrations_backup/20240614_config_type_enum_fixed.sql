-- Migration to create an ENUM type for config_type in api_source_configurations
-- This standardizes the configuration types and prevents invalid types

-- Create the ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_config_type') THEN
        CREATE TYPE api_config_type AS ENUM (
          'query_params',      -- Parameters sent in the URL query string
          'request_body',      -- Parameters sent in the request body (for POST/PUT)
          'request_config',    -- Configuration for the request (method, headers, etc.)
          'pagination_config', -- Configuration for pagination
          'detail_config',     -- Configuration for secondary detail requests
          'response_mapping',  -- Mapping of response fields to standard fields
          'auth_config',       -- Additional authentication configuration
          'handler_config'     -- Configuration for the specific handler type
        );
    END IF;
END$$;

-- Add a comment explaining the ENUM
COMMENT ON TYPE api_config_type IS 'Standardized types of API source configurations';

-- Create a temporary table to store existing configurations
CREATE TEMP TABLE temp_configurations AS
SELECT * FROM api_source_configurations;

-- Drop dependent views
DROP VIEW IF EXISTS active_api_sources_with_config CASCADE;

-- Alter the table to change the column type
ALTER TABLE api_source_configurations 
  ALTER COLUMN config_type TYPE api_config_type 
  USING CASE 
    WHEN config_type = 'default' THEN 'query_params'::api_config_type
    ELSE config_type::api_config_type
  END;

-- Recreate the view
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
    s.last_checked, s.active, s.notes, s.created_at, s.updated_at;

-- Drop the temporary table
DROP TABLE temp_configurations; 