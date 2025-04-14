-- Consolidated Schema Migration
-- Created on 2025-03-29
-- This is a comprehensive migration that brings the entire database schema into a coherent state
-- It creates all necessary tables, views, functions and relationships in the correct order

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text similarity searches

-- Drop any problematic views and functions first to avoid dependency issues
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;
DROP FUNCTION IF EXISTS get_opportunities_by_state(text) CASCADE;
DROP FUNCTION IF EXISTS get_funding_by_state(text, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS get_funding_by_county(text, text, numeric, numeric) CASCADE;

-- =====================================
-- Create ENUM Types
-- =====================================

-- Create them if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_type') THEN
        CREATE TYPE agency_type AS ENUM ('Federal', 'State', 'Utility', 'Foundation', 'Other');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_status') THEN
        CREATE TYPE opportunity_status AS ENUM ('Anticipated', 'Open', 'Closed', 'Awarded');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
        CREATE TYPE source_type AS ENUM ('API', 'Website', 'Document', 'Email');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_auth_type') THEN
        CREATE TYPE api_auth_type AS ENUM ('none', 'apikey', 'oauth', 'basic');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_handler_type') THEN
        CREATE TYPE api_handler_type AS ENUM ('standard', 'document', 'statePortal');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_action_type') THEN
        CREATE TYPE api_action_type AS ENUM ('api_check', 'processing', 'error');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_status_type') THEN
        CREATE TYPE api_status_type AS ENUM ('success', 'failure', 'partial');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_action_type') THEN
        CREATE TYPE data_action_type AS ENUM ('insert', 'update', 'ignore');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_status') THEN
        CREATE TYPE stage_status AS ENUM ('pending', 'processing', 'success', 'failure', 'skipped');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
        CREATE TYPE run_status AS ENUM ('started', 'processing', 'completed', 'failed');
    END IF;
END$$;

-- =====================================
-- API Integration Schema
-- =====================================

-- 1. API Sources Table
CREATE TABLE IF NOT EXISTS api_sources (
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
  handler_type api_handler_type DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. API Source Configurations
CREATE TABLE IF NOT EXISTS api_source_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  config_type TEXT NOT NULL, -- query_params, headers, parser_config
  configuration JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. API Source Runs
CREATE TABLE IF NOT EXISTS api_source_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  status run_status DEFAULT 'started',
  status_details JSONB,
  initial_api_call JSONB,
  first_stage_filter JSONB,
  detail_api_calls JSONB,
  second_stage_filter JSONB,
  storage_results JSONB,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Process Runs Table
CREATE TABLE IF NOT EXISTS process_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE,
  source_manager_status stage_status DEFAULT 'pending',
  api_handler_status stage_status DEFAULT 'pending',
  detail_processor_status stage_status DEFAULT 'pending',
  data_processor_status stage_status DEFAULT 'pending',
  processing_details JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Raw API Responses - crucial for raw_response_id field
CREATE TABLE IF NOT EXISTS api_raw_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  content JSONB NOT NULL,
  request_details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_errors TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. API Activity Logs
CREATE TABLE IF NOT EXISTS api_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES api_sources(id) ON DELETE CASCADE NOT NULL,
  action api_action_type NOT NULL,
  status api_status_type NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Extracted Funding Opportunities (before processing)
CREATE TABLE IF NOT EXISTS api_extracted_opportunities (
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

-- 8. Agent Execution Records
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL, -- source_manager, api_handler, data_processor
  input JSONB,
  output JSONB,
  execution_time NUMERIC, -- in milliseconds
  token_usage JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =====================================
-- Core Funding Schema
-- =====================================

-- 1. Funding Sources
CREATE TABLE IF NOT EXISTS funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  agency_type agency_type,
  type TEXT, -- For backward compatibility
  description TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Funding Programs
CREATE TABLE IF NOT EXISTS funding_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES funding_sources(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. States Table
CREATE TABLE IF NOT EXISTS states (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code CHAR(2) NOT NULL UNIQUE,
  region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Counties Table
CREATE TABLE IF NOT EXISTS counties (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state_id INTEGER REFERENCES states(id) ON DELETE CASCADE NOT NULL,
  fips_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(name, state_id)
);

-- 5. Funding Opportunities (primary data table)
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  title TEXT NOT NULL,
  opportunity_number TEXT,
  source_name TEXT,
  source_type TEXT,
  
  -- Funding Details
  min_amount NUMERIC,
  max_amount NUMERIC,
  minimum_award NUMERIC, -- Alternative naming
  maximum_award NUMERIC, -- Alternative naming
  total_funding_available NUMERIC, -- Total funding pool amount
  cost_share_required BOOLEAN DEFAULT FALSE,
  cost_share_percentage NUMERIC,
  
  -- Dates
  posted_date TIMESTAMP WITH TIME ZONE,
  open_date TIMESTAMP WITH TIME ZONE,
  close_date TIMESTAMP WITH TIME ZONE,
  
  -- Description and Details
  description TEXT,
  objectives TEXT,
  eligibility TEXT,
  
  -- New/Additional fields from later migrations
  program_id UUID REFERENCES funding_programs(id) ON DELETE SET NULL,
  source_id UUID REFERENCES api_sources(id) ON DELETE SET NULL,
  funding_source_id UUID REFERENCES funding_sources(id) ON DELETE SET NULL,
  raw_response_id UUID REFERENCES api_raw_responses(id) ON DELETE SET NULL,
  is_national BOOLEAN DEFAULT FALSE,
  agency_name TEXT,
  funding_type TEXT,
  actionable_summary TEXT,
  
  -- Additional Metadata
  status TEXT,
  tags TEXT[],
  url TEXT,
  eligible_applicants TEXT[],
  eligible_project_types TEXT[],
  eligible_locations TEXT[],
  categories TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Geography Junction Tables
CREATE TABLE IF NOT EXISTS opportunity_state_eligibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
  state_id INTEGER REFERENCES states(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(opportunity_id, state_id)
);

CREATE TABLE IF NOT EXISTS opportunity_county_eligibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
  county_id INTEGER REFERENCES counties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(opportunity_id, county_id)
);

-- =====================================
-- Create Functions
-- =====================================

-- Function to update timestamp on update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for API modified timestamp handling
CREATE OR REPLACE FUNCTION update_api_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar funding sources to prevent duplicates
CREATE OR REPLACE FUNCTION find_similar_sources(source_name text, threshold float DEFAULT 0.3)
RETURNS TABLE (
  id UUID,
  name TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.id, 
    fs.name,
    similarity(fs.name, source_name) AS sim
  FROM 
    funding_sources fs
  WHERE 
    similarity(fs.name, source_name) > threshold
  ORDER BY 
    sim DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- Create Indexes
-- =====================================

-- API Schema Indexes
CREATE INDEX IF NOT EXISTS idx_api_sources_active ON api_sources(active);
CREATE INDEX IF NOT EXISTS idx_api_sources_last_checked ON api_sources(last_checked);
CREATE INDEX IF NOT EXISTS idx_api_sources_handler_type ON api_sources(handler_type);
CREATE INDEX IF NOT EXISTS idx_api_source_configurations_source_id ON api_source_configurations(source_id);
CREATE INDEX IF NOT EXISTS idx_api_source_runs_source_id ON api_source_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_api_source_runs_status ON api_source_runs(status);
CREATE INDEX IF NOT EXISTS idx_process_runs_source_id ON process_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_process_runs_started_at ON process_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_source_id ON api_raw_responses(source_id);
CREATE INDEX IF NOT EXISTS idx_api_raw_responses_processed ON api_raw_responses(processed);
CREATE INDEX IF NOT EXISTS idx_api_activity_logs_source_id ON api_activity_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_api_activity_logs_created_at ON api_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_extracted_opportunities_raw_response_id ON api_extracted_opportunities(raw_response_id);
CREATE INDEX IF NOT EXISTS idx_api_extracted_opportunities_source_id ON api_extracted_opportunities(source_id);
CREATE INDEX IF NOT EXISTS idx_api_extracted_opportunities_processed ON api_extracted_opportunities(processed);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_type ON agent_executions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at);

-- Core Schema Indexes
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_close_date ON funding_opportunities(close_date);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_status ON funding_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_type ON funding_opportunities(source_type);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_raw_response_id ON funding_opportunities(raw_response_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_id ON funding_opportunities(program_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_id ON funding_opportunities(source_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_funding_source_id ON funding_opportunities(funding_source_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_is_national ON funding_opportunities(is_national);
CREATE INDEX IF NOT EXISTS idx_funding_programs_source_id ON funding_programs(source_id);

-- Geographic Eligibility Indexes
CREATE INDEX IF NOT EXISTS idx_counties_state_id ON counties(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_opportunity_id ON opportunity_state_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_state_id ON opportunity_state_eligibility(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_opportunity_id ON opportunity_county_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_county_id ON opportunity_county_eligibility(county_id);

-- =====================================
-- Create Triggers
-- =====================================

-- Funding Opportunities update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_funding_opportunities_updated_at') THEN
        CREATE TRIGGER update_funding_opportunities_updated_at
        BEFORE UPDATE ON funding_opportunities
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Funding Sources update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_funding_sources_updated_at') THEN
        CREATE TRIGGER update_funding_sources_updated_at
        BEFORE UPDATE ON funding_sources
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Funding Programs update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_funding_programs_updated_at') THEN
        CREATE TRIGGER update_funding_programs_updated_at
        BEFORE UPDATE ON funding_programs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Process Runs update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_runs_updated_at') THEN
        CREATE TRIGGER update_process_runs_updated_at
        BEFORE UPDATE ON process_runs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- API Source Runs update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_source_runs_updated_at') THEN
        CREATE TRIGGER update_api_source_runs_updated_at
        BEFORE UPDATE ON api_source_runs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- API Sources update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_sources_modtime') THEN
        CREATE TRIGGER update_api_sources_modtime
        BEFORE UPDATE ON api_sources
        FOR EACH ROW
        EXECUTE FUNCTION update_api_modified_column();
    END IF;
END
$$;

-- API Configurations update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_source_configurations_modtime') THEN
        CREATE TRIGGER update_api_source_configurations_modtime
        BEFORE UPDATE ON api_source_configurations
        FOR EACH ROW
        EXECUTE FUNCTION update_api_modified_column();
    END IF;
END
$$;

-- =====================================
-- Populate Reference Tables
-- =====================================

-- Populate states table with all US states if empty
INSERT INTO states (name, code, region)
SELECT d.name, d.code, d.region
FROM (VALUES
    ('Alabama', 'AL', 'South'),
    ('Alaska', 'AK', 'West'),
    ('Arizona', 'AZ', 'West'),
    ('Arkansas', 'AR', 'South'),
    ('California', 'CA', 'West'),
    ('Colorado', 'CO', 'West'),
    ('Connecticut', 'CT', 'Northeast'),
    ('Delaware', 'DE', 'South'),
    ('Florida', 'FL', 'South'),
    ('Georgia', 'GA', 'South'),
    ('Hawaii', 'HI', 'West'),
    ('Idaho', 'ID', 'West'),
    ('Illinois', 'IL', 'Midwest'),
    ('Indiana', 'IN', 'Midwest'),
    ('Iowa', 'IA', 'Midwest'),
    ('Kansas', 'KS', 'Midwest'),
    ('Kentucky', 'KY', 'South'),
    ('Louisiana', 'LA', 'South'),
    ('Maine', 'ME', 'Northeast'),
    ('Maryland', 'MD', 'South'),
    ('Massachusetts', 'MA', 'Northeast'),
    ('Michigan', 'MI', 'Midwest'),
    ('Minnesota', 'MN', 'Midwest'),
    ('Mississippi', 'MS', 'South'),
    ('Missouri', 'MO', 'Midwest'),
    ('Montana', 'MT', 'West'),
    ('Nebraska', 'NE', 'Midwest'),
    ('Nevada', 'NV', 'West'),
    ('New Hampshire', 'NH', 'Northeast'),
    ('New Jersey', 'NJ', 'Northeast'),
    ('New Mexico', 'NM', 'West'),
    ('New York', 'NY', 'Northeast'),
    ('North Carolina', 'NC', 'South'),
    ('North Dakota', 'ND', 'Midwest'),
    ('Ohio', 'OH', 'Midwest'),
    ('Oklahoma', 'OK', 'South'),
    ('Oregon', 'OR', 'West'),
    ('Pennsylvania', 'PA', 'Northeast'),
    ('Rhode Island', 'RI', 'Northeast'),
    ('South Carolina', 'SC', 'South'),
    ('South Dakota', 'SD', 'Midwest'),
    ('Tennessee', 'TN', 'South'),
    ('Texas', 'TX', 'South'),
    ('Utah', 'UT', 'West'),
    ('Vermont', 'VT', 'Northeast'),
    ('Virginia', 'VA', 'South'),
    ('Washington', 'WA', 'West'),
    ('West Virginia', 'WV', 'South'),
    ('Wisconsin', 'WI', 'Midwest'),
    ('Wyoming', 'WY', 'West'),
    ('District of Columbia', 'DC', 'South')
) AS d(name, code, region)
WHERE NOT EXISTS (SELECT 1 FROM states);

-- =====================================
-- Create Views
-- =====================================

-- Create view for funding opportunities with geography
CREATE OR REPLACE VIEW funding_opportunities_with_geography AS
SELECT 
    -- Explicitly list each column from funding_opportunities to avoid conflicts
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.source_name,
    fo.source_type,
    fo.min_amount,
    fo.max_amount,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
    fo.objectives,
    fo.eligibility,
    fo.program_id,
    fo.source_id,
    fo.funding_source_id,
    fo.raw_response_id,
    fo.is_national,
    fo.agency_name,
    fo.funding_type,
    fo.actionable_summary,
    fo.status,
    fo.tags,
    fo.url,
    fo.eligible_applicants,
    fo.eligible_project_types,
    fo.eligible_locations,
    fo.categories,
    fo.created_at,
    fo.updated_at,
    
    -- Add the derived columns
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    COALESCE(fs.name, 'Unknown Source') AS source_display_name,
    COALESCE(fs.agency_type::text, fo.source_type, 'Unknown') AS source_type_display,
    
    -- Add the eligibility array
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_programs fp ON fo.program_id = fp.id
LEFT JOIN 
    funding_sources fs ON COALESCE(fp.source_id, fo.funding_source_id) = fs.id;

-- Create view for active API sources
CREATE OR REPLACE VIEW active_api_sources_with_config AS
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
  s.handler_type,
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
  s.priority, s.notes, s.handler_type;

-- =====================================
-- Create Helper Functions
-- =====================================

-- Function to get opportunities by state
CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
RETURNS SETOF funding_opportunities_with_geography AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM funding_opportunities_with_geography
    WHERE 
        is_national = true 
        OR state_code = ANY(eligible_states);
END;
$$ LANGUAGE plpgsql;

-- Function to get aggregated funding data by state
CREATE OR REPLACE FUNCTION get_funding_by_state(
    status TEXT DEFAULT NULL,
    source_type TEXT DEFAULT NULL,
    min_amount NUMERIC DEFAULT NULL,
    max_amount NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    state TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH state_data AS (
        SELECT 
            s.name AS state_name,
            s.code AS state_code,
            COUNT(DISTINCT fo.id) AS opp_count,
            AVG(COALESCE(fo.max_amount, fo.maximum_award, 0)) AS avg_amount
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        LEFT JOIN 
            funding_opportunities fo ON ose.opportunity_id = fo.id
        LEFT JOIN
            funding_programs fp ON fo.program_id = fp.id
        LEFT JOIN
            funding_sources fs ON COALESCE(fp.source_id, fo.funding_source_id) = fs.id
        WHERE
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type::TEXT = source_type OR fo.source_type = source_type) AND
            (min_amount IS NULL OR 
                COALESCE(fo.min_amount, fo.minimum_award) >= min_amount OR 
                COALESCE(fo.max_amount, fo.maximum_award) >= min_amount
            ) AND
            (max_amount IS NULL OR 
                COALESCE(fo.min_amount, fo.minimum_award) <= max_amount
            )
        GROUP BY
            s.name, s.code
    )
    SELECT
        state_name AS state,
        state_code,
        COALESCE(ROUND(avg_amount::NUMERIC, 2), 0) AS value,
        COALESCE(opp_count, 0)::INTEGER AS opportunities
    FROM
        state_data
    ORDER BY
        state_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get county-level funding data 
CREATE OR REPLACE FUNCTION get_funding_by_county(
    input_state_code TEXT,
    status TEXT DEFAULT NULL,
    source_type TEXT DEFAULT NULL,
    min_amount NUMERIC DEFAULT NULL,
    max_amount NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    county_name TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH county_data AS (
        SELECT 
            c.name AS county_name,
            s.code AS state_code,
            COUNT(DISTINCT fo.id) AS opp_count,
            AVG(COALESCE(fo.max_amount, fo.maximum_award, 0)) AS avg_amount
        FROM 
            counties c
        JOIN 
            states s ON c.state_id = s.id
        LEFT JOIN 
            opportunity_county_eligibility oce ON c.id = oce.county_id
        LEFT JOIN 
            funding_opportunities fo ON oce.opportunity_id = fo.id
        LEFT JOIN
            funding_programs fp ON fo.program_id = fp.id
        LEFT JOIN
            funding_sources fs ON COALESCE(fp.source_id, fo.funding_source_id) = fs.id
        WHERE
            s.code = input_state_code AND
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type::TEXT = source_type OR fo.source_type = source_type) AND
            (min_amount IS NULL OR 
                COALESCE(fo.min_amount, fo.minimum_award) >= min_amount OR 
                COALESCE(fo.max_amount, fo.maximum_award) >= min_amount
            ) AND
            (max_amount IS NULL OR 
                COALESCE(fo.min_amount, fo.minimum_award) <= max_amount
            )
        GROUP BY
            c.name, s.code
    )
    SELECT
        county_name,
        state_code,
        COALESCE(ROUND(avg_amount::NUMERIC, 2), 0) AS value,
        COALESCE(opp_count, 0)::INTEGER AS opportunities
    FROM
        county_data
    ORDER BY
        county_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get the next API source to process
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
  handler_type api_handler_type,
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
