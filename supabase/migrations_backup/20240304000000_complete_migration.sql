-- Create extension for UUID generation if not already done
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure funding_opportunities table exists before altering it
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  opportunity_number TEXT,
  source_name TEXT NOT NULL,
  source_type TEXT,
  min_amount NUMERIC, -- Older name, kept for compatibility if needed
  max_amount NUMERIC, -- Older name, kept for compatibility if needed
  cost_share_required BOOLEAN DEFAULT FALSE,
  cost_share_percentage NUMERIC,
  posted_date TIMESTAMP WITH TIME ZONE,
  open_date TIMESTAMP WITH TIME ZONE,
  close_date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  objectives TEXT,
  eligibility TEXT, -- Older field, might be replaced later
  status TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complete Migration for Map Enhancement
-- Created on 2024-03-04

-- First, let's fix the source_type column in funding_opportunities
-- (The CREATE TABLE above already includes it, but ADD IF NOT EXISTS is safe)
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Add missing columns to funding_opportunities
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS minimum_award NUMERIC,
ADD COLUMN IF NOT EXISTS maximum_award NUMERIC,
ADD COLUMN IF NOT EXISTS is_national BOOLEAN DEFAULT FALSE;

-- Ensure funding_sources table exists (as it's referenced soon)
CREATE TABLE IF NOT EXISTS funding_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    agency_type TEXT,
    jurisdiction TEXT,
    website TEXT,
    contact_info JSONB,
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create funding_programs table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    source_id UUID REFERENCES funding_sources(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add program_id to funding_opportunities
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES funding_programs(id);

-- Add source_id to funding_opportunities (important link)
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES funding_sources(id) ON DELETE SET NULL;

-- Add agency_type to funding_sources
ALTER TABLE funding_sources
ADD COLUMN IF NOT EXISTS agency_type TEXT;

-- Create reference table for US states
CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code CHAR(2) NOT NULL UNIQUE,
    region TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create reference table for US counties
CREATE TABLE IF NOT EXISTS counties (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    state_id INTEGER REFERENCES states(id) ON DELETE CASCADE NOT NULL,
    fips_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(name, state_id)
);

-- Create junction table for opportunity-state eligibility
CREATE TABLE IF NOT EXISTS opportunity_state_eligibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    state_id INTEGER REFERENCES states(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(opportunity_id, state_id)
);

-- Create junction table for opportunity-county eligibility
CREATE TABLE IF NOT EXISTS opportunity_county_eligibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    county_id INTEGER REFERENCES counties(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(opportunity_id, county_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_funding_programs_source_id ON funding_programs(source_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_id ON funding_opportunities(program_id);
CREATE INDEX IF NOT EXISTS idx_counties_state_id ON counties(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_opportunity_id ON opportunity_state_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_state_id ON opportunity_state_eligibility(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_opportunity_id ON opportunity_county_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_county_id ON opportunity_county_eligibility(county_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_is_national ON funding_opportunities(is_national);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_type ON funding_opportunities(source_type);

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for funding_programs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_funding_programs_updated_at'
    ) THEN
        CREATE TRIGGER update_funding_programs_updated_at
        BEFORE UPDATE ON funding_programs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Populate states table with all US states
INSERT INTO states (name, code, region)
VALUES
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
ON CONFLICT (code) DO NOTHING;

-- Drop all dependent functions first
DROP FUNCTION IF EXISTS get_opportunities_by_state(TEXT);
DROP FUNCTION IF EXISTS get_funding_by_state(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS get_funding_by_county(TEXT, TEXT, NUMERIC, NUMERIC);

-- Create the view (with potentially missing columns commented out)
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;

CREATE VIEW funding_opportunities_with_geography AS
SELECT 
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.description,
    fo.objectives,
    fo.status,
    fo.url,
    fo.created_at,
    fo.updated_at,
    fo.source_id,
    fo.program_id,
    fo.min_amount,          -- Older name
    fo.max_amount,          -- Older name
    fo.minimum_award,
    fo.maximum_award,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    -- fo.tags,             -- Commented out: Added in a later migration
    -- fo.eligible_applicants, -- Commented out: Added in a later migration
    -- fo.eligible_project_types, -- Commented out: Added in a later migration
    -- fo.eligible_locations, -- Commented out: Added in a later migration
    -- fo.categories,         -- Commented out: Added in a later migration
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    COALESCE(fs.name, 'Unknown Source') AS source_display_name, -- Renamed from source_name
    COALESCE(fs.agency_type, 'Unknown') AS agency_type,
    fo.is_national
    -- Note: eligible_states array part is removed as it depends on tables created later in this migration
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_programs fp ON fo.program_id = fp.id
LEFT JOIN 
    funding_sources fs ON fo.source_id = fs.id; -- Changed from fp.source_id to fo.source_id

-- Recreate the functions (adapted to the simplified view)
CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
RETURNS SETOF funding_opportunities_with_geography AS $$
BEGIN
    -- Simplified logic as eligible_states is not available yet
    RETURN QUERY
    SELECT *
    FROM funding_opportunities_with_geography
    WHERE is_national = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get aggregated funding data by state (adapted)
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
    -- Simplified logic as state/national breakdown is complex without eligibility tables
    RETURN QUERY
    SELECT 
        'All', 
        'US',
        SUM(COALESCE(fo.maximum_award, fo.max_amount, 0)),
        COUNT(fo.id)::INTEGER
    FROM 
        funding_opportunities fo
    LEFT JOIN 
        funding_sources fs ON fo.source_id = fs.id
    WHERE
        (status IS NULL OR fo.status = status) AND
        (source_type IS NULL OR fs.agency_type = source_type) AND
        (min_amount IS NULL OR COALESCE(fo.minimum_award, fo.min_amount, 0) >= min_amount) AND
        (max_amount IS NULL OR COALESCE(fo.maximum_award, fo.max_amount, 0) <= max_amount);
END;
$$ LANGUAGE plpgsql;

-- Function to get county-level funding data (placeholder)
CREATE OR REPLACE FUNCTION get_funding_by_county(
    target_state_code TEXT,
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
    -- Placeholder implementation as county eligibility is not available yet
    RETURN QUERY SELECT 'County', target_state_code, 0::NUMERIC, 0::INTEGER WHERE FALSE;
END;
$$ LANGUAGE plpgsql;