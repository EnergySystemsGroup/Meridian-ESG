-- API Integration Schema for Funding Intelligence System
-- Migration file created on 2024-07-01

-- Enable necessary extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
CREATE TYPE api_auth_type AS ENUM ('none', 'apikey', 'oauth', 'basic');
CREATE TYPE api_handler_type AS ENUM ('standard', 'document', 'statePortal');
CREATE TYPE api_action_type AS ENUM ('api_check', 'processing', 'error');
CREATE TYPE api_status_type AS ENUM ('success', 'failure', 'partial');
CREATE TYPE data_action_type AS ENUM ('insert', 'update', 'ignore');

-- 1. API Sources Table
CREATE TABLE api_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization TEXT,
  type TEXT NOT NULL, -- federal, state, local, utility, private
  url TEXT NOT NULL,
  api_endpoint TEXT,
  api_documentation_url TEXT,
  auth_type api_auth_type NOT NULL DEFAULT 'none',
  auth_details JSONB,
  update_frequency TEXT, -- daily, weekly, monthly
  last_checked TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1-10 scale
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. API Source Configurations
CREATE TABLE api_source_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  config_type TEXT NOT NULL, -- query_params, headers, parser_config
  configuration JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Raw API Responses
CREATE TABLE api_raw_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  content JSONB NOT NULL,
  request_details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_errors TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. API Activity Logs
CREATE TABLE api_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  action api_action_type NOT NULL,
  status api_status_type NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Extracted Funding Opportunities (before processing)
CREATE TABLE api_extracted_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_response_id UUID REFERENCES api_raw_responses(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
  processed BOOLEAN DEFAULT false,
  processing_result data_action_type,
  processing_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Agent Execution Records
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL, -- source_manager, api_handler, data_processor
  input JSONB,
  output JSONB,
  execution_time NUMERIC, -- in milliseconds
  token_usage JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_api_sources_active ON api_sources(active);
CREATE INDEX idx_api_sources_last_checked ON api_sources(last_checked);
CREATE INDEX idx_api_source_configurations_source_id ON api_source_configurations(source_id);
CREATE INDEX idx_api_raw_responses_source_id ON api_raw_responses(source_id);
CREATE INDEX idx_api_raw_responses_processed ON api_raw_responses(processed);
CREATE INDEX idx_api_activity_logs_source_id ON api_activity_logs(source_id);
CREATE INDEX idx_api_activity_logs_created_at ON api_activity_logs(created_at);
CREATE INDEX idx_api_extracted_opportunities_raw_response_id ON api_extracted_opportunities(raw_response_id);
CREATE INDEX idx_api_extracted_opportunities_source_id ON api_extracted_opportunities(source_id);
CREATE INDEX idx_api_extracted_opportunities_processed ON api_extracted_opportunities(processed);
CREATE INDEX idx_agent_executions_agent_type ON agent_executions(agent_type);
CREATE INDEX idx_agent_executions_created_at ON agent_executions(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_api_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_sources_modtime
BEFORE UPDATE ON api_sources
FOR EACH ROW EXECUTE FUNCTION update_api_modified_column();

CREATE TRIGGER update_api_source_configurations_modtime
BEFORE UPDATE ON api_source_configurations
FOR EACH ROW EXECUTE FUNCTION update_api_modified_column();

-- Create a view for active API sources with their configurations
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
  s.priority,
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
  s.priority, s.notes;

-- Create a function to get the next API source to process
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
  priority INTEGER,
  notes TEXT,
  configurations JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM active_api_sources_with_config
  ORDER BY 
    -- First priority: sources that have never been checked
    CASE WHEN last_checked IS NULL THEN 0 ELSE 1 END,
    -- Second priority: sources with higher priority (lower number)
    priority,
    -- Third priority: sources that were checked longest ago
    COALESCE(last_checked, '1970-01-01'::timestamp with time zone)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
