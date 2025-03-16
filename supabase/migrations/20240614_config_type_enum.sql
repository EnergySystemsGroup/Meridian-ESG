-- Migration to create an ENUM type for config_type in api_source_configurations
-- This standardizes the configuration types and prevents invalid types

-- Create the ENUM type
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

-- Create a temporary table to store existing configurations
CREATE TEMP TABLE temp_configurations AS
SELECT * FROM api_source_configurations;

-- Drop existing constraints and indexes that depend on the table
ALTER TABLE api_source_configurations DROP CONSTRAINT IF EXISTS api_source_configurations_source_id_fkey;
DROP INDEX IF EXISTS idx_api_source_configurations_source_id;

-- Drop the existing table
DROP TABLE api_source_configurations;

-- Recreate the table with the ENUM type
CREATE TABLE api_source_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  config_type api_config_type NOT NULL,
  configuration JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Reinsert the data, converting config_type to the new ENUM
-- We need to handle the 'default' type which is not in our new ENUM
INSERT INTO api_source_configurations (id, source_id, config_type, configuration, created_at, updated_at)
SELECT 
  id, 
  source_id, 
  CASE 
    WHEN config_type = 'default' THEN 'query_params'::api_config_type
    ELSE config_type::api_config_type
  END,
  configuration,
  created_at,
  updated_at
FROM temp_configurations
WHERE config_type != 'default' OR NOT EXISTS (
  SELECT 1 FROM temp_configurations tc 
  WHERE tc.source_id = temp_configurations.source_id AND tc.config_type = 'query_params'
);

-- For 'default' configs that don't have a corresponding 'query_params', insert them as 'query_params'
INSERT INTO api_source_configurations (id, source_id, config_type, configuration, created_at, updated_at)
SELECT 
  id, 
  source_id, 
  'query_params'::api_config_type,
  configuration,
  created_at,
  updated_at
FROM temp_configurations
WHERE config_type = 'default' 
AND NOT EXISTS (
  SELECT 1 FROM temp_configurations tc 
  WHERE tc.source_id = temp_configurations.source_id AND tc.config_type = 'query_params'
);

-- Recreate the index
CREATE INDEX idx_api_source_configurations_source_id ON api_source_configurations(source_id);

-- Add a trigger for updated_at
CREATE TRIGGER update_api_source_configurations_modtime
BEFORE UPDATE ON api_source_configurations
FOR EACH ROW EXECUTE FUNCTION update_api_modified_column();

-- Add a comment explaining the ENUM
COMMENT ON TYPE api_config_type IS 'Standardized types of API source configurations';

-- Drop the temporary table
DROP TABLE temp_configurations; 