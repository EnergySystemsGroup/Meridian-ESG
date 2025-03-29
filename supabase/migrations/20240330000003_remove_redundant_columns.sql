-- Migration: 20240330000003_remove_redundant_columns.sql
-- Created on 2024-03-30
-- Removes redundant source_name and source_type columns from funding_opportunities table

-- First, drop the view that references these columns
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;

-- Recreate the view without references to the columns being removed
CREATE OR REPLACE VIEW funding_opportunities_with_geography AS
SELECT 
    -- Explicitly list each column from funding_opportunities to avoid conflicts
    fo.id,
    fo.title,
    fo.opportunity_number,
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
    COALESCE(fs.agency_type::text, 'Unknown') AS source_type_display,
    
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

-- Update the get_funding_by_state function to use funding_source_id and agency_type
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
            (source_type IS NULL OR fs.agency_type::TEXT = source_type OR fo.funding_type = source_type) AND
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

-- Update the county function to use funding_source_id and agency_type
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
            (source_type IS NULL OR fs.agency_type::TEXT = source_type OR fo.funding_type = source_type) AND
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

-- Remove the columns from the funding_opportunities table
ALTER TABLE funding_opportunities DROP COLUMN IF EXISTS source_name;
ALTER TABLE funding_opportunities DROP COLUMN IF EXISTS source_type; 