-- Restore Original Tables Migration
-- This migration ensures that all original tables exist without dropping any existing data
-- Created on 2024-03-06

-- Create extension for UUID generation if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Restore funding_opportunities table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  title TEXT NOT NULL,
  opportunity_number TEXT,
  source_name TEXT NOT NULL,
  source_type TEXT,
  
  -- Funding Details
  min_amount NUMERIC,
  max_amount NUMERIC,
  cost_share_required BOOLEAN DEFAULT FALSE,
  cost_share_percentage NUMERIC,
  
  -- Dates
  posted_date TIMESTAMP WITH TIME ZONE,
  open_date TIMESTAMP WITH TIME ZONE,
  close_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Description and Details
  description TEXT,
  objectives TEXT,
  eligibility TEXT,
  
  -- Additional Metadata
  status TEXT,
  tags TEXT[],
  url TEXT,
  
  -- New columns that might have been added in later migrations
  minimum_award NUMERIC,
  maximum_award NUMERIC,
  is_national BOOLEAN DEFAULT FALSE,
  program_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore funding_sources table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  agency_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore funding_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  client_id UUID NOT NULL,
  status TEXT NOT NULL,
  next_deadline TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore funding_contacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore funding_eligibility_criteria table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_eligibility_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  entity_type TEXT NOT NULL,
  geographic_restriction TEXT,
  other_requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_close_date ON funding_opportunities(close_date);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_status ON funding_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_type ON funding_opportunities(source_type);
CREATE INDEX IF NOT EXISTS idx_funding_applications_client_id ON funding_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_funding_applications_opportunity_id ON funding_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_funding_contacts_opportunity_id ON funding_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_funding_eligibility_criteria_opportunity_id ON funding_eligibility_criteria(opportunity_id);

-- Create a function to update the updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_funding_opportunities_updated_at'
        AND tgrelid = 'funding_opportunities'::regclass
    ) THEN
        CREATE TRIGGER update_funding_opportunities_updated_at
        BEFORE UPDATE ON funding_opportunities
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_funding_sources_updated_at'
        AND tgrelid = 'funding_sources'::regclass
    ) THEN
        CREATE TRIGGER update_funding_sources_updated_at
        BEFORE UPDATE ON funding_sources
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_funding_applications_updated_at'
        AND tgrelid = 'funding_applications'::regclass
    ) THEN
        CREATE TRIGGER update_funding_applications_updated_at
        BEFORE UPDATE ON funding_applications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_funding_contacts_updated_at'
        AND tgrelid = 'funding_contacts'::regclass
    ) THEN
        CREATE TRIGGER update_funding_contacts_updated_at
        BEFORE UPDATE ON funding_contacts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_funding_eligibility_criteria_updated_at'
        AND tgrelid = 'funding_eligibility_criteria'::regclass
    ) THEN
        CREATE TRIGGER update_funding_eligibility_criteria_updated_at
        BEFORE UPDATE ON funding_eligibility_criteria
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Create or replace the view for funding opportunities with geography
-- This ensures compatibility with the API endpoints
CREATE OR REPLACE VIEW funding_opportunities_with_geography AS
SELECT 
    fo.*,
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    fo.source_name,
    COALESCE(fo.source_type, 'Unknown') AS source_type,
    COALESCE(fo.is_national, false) AS is_national,
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_programs fp ON fo.program_id = fp.id;

-- Create or replace the function to get opportunities by state
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

-- Create or replace the function to get funding by state
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
    -- If the states table exists, use it for the query
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'states') THEN
        RETURN QUERY
        WITH state_list AS (
            SELECT name AS state, code AS state_code FROM states
        ),
        opportunity_counts AS (
            SELECT 
                s.state_code,
                COUNT(DISTINCT fo.id) AS opp_count,
                COALESCE(SUM(fo.maximum_award), 0) AS total_value
            FROM 
                state_list s
            LEFT JOIN 
                opportunity_state_eligibility ose ON ose.state_id = (SELECT id FROM states WHERE code = s.state_code)
            LEFT JOIN 
                funding_opportunities fo ON ose.opportunity_id = fo.id
            WHERE 
                (status IS NULL OR fo.status = status) AND
                (source_type IS NULL OR fo.source_type = source_type) AND
                (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
                (max_amount IS NULL OR fo.maximum_award <= max_amount)
            GROUP BY 
                s.state_code
        )
        SELECT 
            s.state,
            s.state_code,
            COALESCE(oc.total_value, 0) AS value,
            COALESCE(oc.opp_count, 0) AS opportunities
        FROM 
            state_list s
        LEFT JOIN 
            opportunity_counts oc ON s.state_code = oc.state_code
        ORDER BY 
            s.state;
    ELSE
        -- Fallback to return empty result set with correct structure
        RETURN QUERY
        SELECT 
            NULL::TEXT AS state,
            NULL::TEXT AS state_code,
            0::NUMERIC AS value,
            0::INTEGER AS opportunities
        WHERE FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql; 