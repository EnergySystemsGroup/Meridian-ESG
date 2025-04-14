-- Migration to add handler_type field to api_sources table
-- This allows the sourceManagerAgent to pass appropriate handler information to the apiHandlerAgent

-- First, ensure the api_handler_type ENUM exists (it should already be defined in the schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_handler_type') THEN
        CREATE TYPE api_handler_type AS ENUM ('standard', 'document', 'statePortal');
    END IF;
END$$;

-- Add the handler_type column with a default value of 'standard'
ALTER TABLE api_sources 
ADD COLUMN IF NOT EXISTS handler_type api_handler_type NOT NULL DEFAULT 'standard';

-- Add a comment explaining the field
COMMENT ON COLUMN api_sources.handler_type IS 
'Specifies the type of handler to use for processing this API source. 
- standard: Regular API with JSON response
- document: Document-based API (PDFs, etc.)
- statePortal: State portal websites requiring special handling';

-- Update the active_api_sources_with_config view to include the handler_type
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
    c.configuration
FROM 
    api_sources s
LEFT JOIN 
    api_source_configurations c ON s.id = c.source_id AND c.config_type = 'query_params'
WHERE 
    s.active = true; 