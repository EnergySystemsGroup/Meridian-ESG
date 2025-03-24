-- Complete Migration for Map Enhancement
-- Created on 2024-03-04

-- First, let's fix the source_type column in funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Add missing columns to funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN IF NOT EXISTS minimum_award NUMERIC,
ADD COLUMN IF NOT EXISTS maximum_award NUMERIC,
ADD COLUMN IF NOT EXISTS is_national BOOLEAN DEFAULT FALSE;

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

-- Create the view
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
    fo.min_amount,
    fo.max_amount,
    fo.minimum_award,
    fo.maximum_award,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.tags,
    fo.eligible_applicants,
    fo.eligible_project_types,
    fo.eligible_locations,
    fo.categories,
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    COALESCE(fs.name, 'Unknown Source') AS source_display_name,
    COALESCE(fs.agency_type, 'Unknown') AS agency_type,
    fo.is_national,
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
    funding_sources fs ON fp.source_id = fs.id;

-- Recreate the functions
CREATE FUNCTION get_opportunities_by_state(state_code TEXT)
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
CREATE FUNCTION get_funding_by_state(
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
    WITH eligible_opportunities AS (
        SELECT 
            fo.id,
            fo.minimum_award,
            fo.maximum_award,
            fo.is_national,
            s.name AS state_name,
            s.code AS state_code
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_programs fp ON fo.program_id = fp.id
        LEFT JOIN 
            funding_sources fs ON fp.source_id = fs.id
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
        LEFT JOIN 
            states s ON ose.state_id = s.id
        WHERE 
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type = source_type) AND
            (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
            (max_amount IS NULL OR fo.maximum_award <= max_amount)
    ),
    national_opportunities AS (
        SELECT 
            id,
            minimum_award,
            maximum_award
        FROM 
            eligible_opportunities
        WHERE 
            is_national = true
    ),
    state_counts AS (
        SELECT 
            state_name AS state,
            state_code,
            COUNT(DISTINCT id) AS state_opportunities,
            COALESCE(SUM(maximum_award), 0) AS state_value
        FROM 
            eligible_opportunities
        WHERE 
            state_name IS NOT NULL
        GROUP BY 
            state_name, state_code
    ),
    national_counts AS (
        SELECT 
            COUNT(DISTINCT id) AS national_count,
            COALESCE(SUM(maximum_award), 0) AS national_value
        FROM 
            national_opportunities
    ),
    all_states AS (
        SELECT 
            name AS state,
            code AS state_code
        FROM 
            states
    )
    SELECT 
        a.state,
        a.state_code,
        COALESCE(s.state_value, 0) + (COALESCE(n.national_value, 0) / 51) AS value,
        COALESCE(s.state_opportunities, 0) + COALESCE(n.national_count, 0) AS opportunities
    FROM 
        all_states a
    LEFT JOIN 
        state_counts s ON a.state = s.state
    CROSS JOIN 
        national_counts n
    ORDER BY 
        a.state;
END;
$$ LANGUAGE plpgsql;

-- Function to get county-level funding data (for future use)
CREATE FUNCTION get_funding_by_county(
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
    RETURN QUERY
    WITH eligible_opportunities AS (
        SELECT 
            fo.id,
            fo.minimum_award,
            fo.maximum_award,
            fo.is_national,
            c.name AS county_name,
            s.code AS state_code
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_programs fp ON fo.program_id = fp.id
        LEFT JOIN 
            funding_sources fs ON fp.source_id = fs.id
        LEFT JOIN 
            opportunity_county_eligibility oce ON fo.id = oce.opportunity_id
        LEFT JOIN 
            counties c ON oce.county_id = c.id
        LEFT JOIN 
            states s ON c.state_id = s.id
        WHERE 
            s.code = target_state_code AND
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type = source_type) AND
            (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
            (max_amount IS NULL OR fo.maximum_award <= max_amount)
    ),
    state_opportunities AS (
        SELECT 
            fo.id,
            fo.minimum_award,
            fo.maximum_award
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_programs fp ON fo.program_id = fp.id
        LEFT JOIN 
            funding_sources fs ON fp.source_id = fs.id
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
        LEFT JOIN 
            states s ON ose.state_id = s.id
        WHERE 
            s.code = target_state_code AND
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type = source_type) AND
            (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
            (max_amount IS NULL OR fo.maximum_award <= max_amount) AND
            fo.id NOT IN (
                SELECT id FROM eligible_opportunities WHERE county_name IS NOT NULL
            )
    ),
    national_opportunities AS (
        SELECT 
            id,
            minimum_award,
            maximum_award
        FROM 
            funding_opportunities
        WHERE 
            is_national = true AND
            (status IS NULL OR status = status) AND
            (min_amount IS NULL OR minimum_award >= min_amount) AND
            (max_amount IS NULL OR maximum_award <= max_amount)
    ),
    county_counts AS (
        SELECT 
            county_name,
            state_code,
            COUNT(DISTINCT id) AS county_opportunities,
            COALESCE(SUM(maximum_award), 0) AS county_value
        FROM 
            eligible_opportunities
        WHERE 
            county_name IS NOT NULL
        GROUP BY 
            county_name, state_code
    ),
    state_counts AS (
        SELECT 
            COUNT(DISTINCT id) AS state_count,
            COALESCE(SUM(maximum_award), 0) AS state_value
        FROM 
            state_opportunities
    ),
    national_counts AS (
        SELECT 
            COUNT(DISTINCT id) AS national_count,
            COALESCE(SUM(maximum_award), 0) AS national_value
        FROM 
            national_opportunities
    ),
    all_counties AS (
        SELECT 
            c.name AS county_name,
            s.code AS state_code
        FROM 
            counties c
        JOIN 
            states s ON c.state_id = s.id
        WHERE 
            s.code = target_state_code
    )
    SELECT 
        a.county_name,
        a.state_code,
        COALESCE(c.county_value, 0) +
        (COALESCE(s.state_value, 0) / (SELECT COUNT(*) FROM all_counties)) +
        (COALESCE(n.national_value, 0) / (SELECT COUNT(*) FROM all_counties)) AS value,
        COALESCE(c.county_opportunities, 0) +
        COALESCE(s.state_count, 0) +
        COALESCE(n.national_count, 0) AS opportunities
    FROM 
        all_counties a
    LEFT JOIN 
        county_counts c ON a.county_name = c.county_name
    CROSS JOIN 
        state_counts s
    CROSS JOIN 
        national_counts n
    ORDER BY 
        a.county_name;
END;
$$ LANGUAGE plpgsql;