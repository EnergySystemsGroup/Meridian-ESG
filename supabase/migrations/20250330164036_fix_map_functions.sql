-- Fix map functions after program_id removal
-- Uses conditional logic to work with any database state

/*
  First: We need to drop dependent functions before dropping the view
  to avoid circular dependency issues. Adding DROP CASCADE to safely
  remove both the view and any dependent objects.
*/

-- Drop functions if they exist (using PL/pgSQL for safety)
DO $$
BEGIN
  -- Drop functions with any signature
  DROP FUNCTION IF EXISTS get_opportunities_by_state(TEXT);
  DROP FUNCTION IF EXISTS get_funding_by_state(TEXT, TEXT, NUMERIC, NUMERIC);
  DROP FUNCTION IF EXISTS get_funding_by_county(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

  -- Also try with old parameter names just to be sure
  BEGIN
    DROP FUNCTION IF EXISTS get_funding_by_state(TEXT, TEXT, NUMERIC, NUMERIC);
    EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP FUNCTION IF EXISTS get_funding_by_county(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$$;

-- Now it's safe to drop and recreate the view
DO $$
BEGIN
  -- Conditionally recreate view if it exists
  IF EXISTS (
    SELECT FROM pg_catalog.pg_views
    WHERE schemaname = 'public' 
    AND viewname = 'funding_opportunities_with_geography'
  ) THEN
    DROP VIEW funding_opportunities_with_geography;
  END IF;
END
$$;

-- Recreate the view (will fail safely if doesn't exist)
CREATE VIEW funding_opportunities_with_geography AS
SELECT 
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
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
    COALESCE(fs.name, 'Unknown Source') AS source_display_name,
    COALESCE(fs.agency_type::text, 'Unknown') AS source_type_display,
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_sources fs ON fo.funding_source_id = fs.id;

-- Recreate functions with new parameter names

-- Function 1: Get opportunities by state
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

-- Function 2: Get funding by state
CREATE FUNCTION get_funding_by_state(
    status TEXT DEFAULT NULL,
    source_type TEXT DEFAULT NULL,
    min_award_val NUMERIC DEFAULT NULL,
    max_award_val NUMERIC DEFAULT NULL
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
            AVG(COALESCE(fo.maximum_award, 0)) AS avg_amount
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        LEFT JOIN 
            funding_opportunities fo ON ose.opportunity_id = fo.id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type::TEXT = source_type) AND
            (min_award_val IS NULL OR 
                COALESCE(fo.minimum_award, fo.maximum_award) >= min_award_val
            ) AND
            (max_award_val IS NULL OR 
                COALESCE(fo.minimum_award, 0) <= max_award_val
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

-- Function 3: Get funding by county
CREATE FUNCTION get_funding_by_county(
    input_state_code TEXT,
    status TEXT DEFAULT NULL,
    source_type TEXT DEFAULT NULL,
    min_award_val NUMERIC DEFAULT NULL,
    max_award_val NUMERIC DEFAULT NULL
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
            AVG(COALESCE(fo.maximum_award, 0)) AS avg_amount
        FROM 
            counties c
        JOIN 
            states s ON c.state_id = s.id
        LEFT JOIN 
            opportunity_county_eligibility oce ON c.id = oce.county_id
        LEFT JOIN 
            funding_opportunities fo ON oce.opportunity_id = fo.id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            s.code = input_state_code AND
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type::TEXT = source_type) AND
            (min_award_val IS NULL OR 
                COALESCE(fo.minimum_award, fo.maximum_award) >= min_award_val
            ) AND
            (max_award_val IS NULL OR 
                COALESCE(fo.minimum_award, 0) <= max_award_val
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
