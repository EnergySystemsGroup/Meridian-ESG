-- Geographic Eligibility Tables for Funding Opportunities
-- Migration file created on 2024-03-04

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

-- Add is_national flag to funding_opportunities table
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS is_national BOOLEAN DEFAULT FALSE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_counties_state_id ON counties(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_opportunity_id ON opportunity_state_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_state_eligibility_state_id ON opportunity_state_eligibility(state_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_opportunity_id ON opportunity_county_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_county_eligibility_county_id ON opportunity_county_eligibility(county_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_is_national ON funding_opportunities(is_national);

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

-- Drop the existing view if it exists, before attempting to replace it
DROP VIEW IF EXISTS public.funding_opportunities_with_geography CASCADE;

-- Create a view for funding opportunities with geographic eligibility
-- Only create this if the funding_programs and funding_sources tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_programs'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_sources'
    ) THEN
        EXECUTE '
        CREATE OR REPLACE VIEW funding_opportunities_with_geography AS
        SELECT 
            -- Core columns from funding_opportunities that definitely exist at this point
            fo.id,
            fo.title,
            fo.opportunity_number,
            fo.source_name,
            fo.source_type,
            fo.min_amount,
            fo.max_amount,
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
            fo.status,
            fo.url,
            fo.created_at,
            fo.updated_at,
            
            -- Add the derived columns
            COALESCE(fp.name, ''Unknown Program'') AS program_name,
            COALESCE(fs.name, ''Unknown Source'') AS source_display_name,
            COALESCE(fs.agency_type::text, ''Unknown'') AS source_type_display,
            
            -- Handle is_national
            CASE
                WHEN fo.is_national THEN true
                ELSE false
            END AS is_national_flag,
            
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
            funding_sources fs ON fp.source_id = fs.id';
    END IF;
END
$$;

-- Create a function to get funding opportunities by state
-- Only create this if the view exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public' 
        AND table_name = 'funding_opportunities_with_geography'
    ) THEN
        EXECUTE 
        'CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
        RETURNS SETOF funding_opportunities_with_geography AS $FUNC$
        BEGIN
            RETURN QUERY
            SELECT *
            FROM funding_opportunities_with_geography
            WHERE 
                is_national_flag = true 
                OR state_code = ANY(eligible_states);
        END;
        $FUNC$ LANGUAGE plpgsql';
    END IF;
END
$$;