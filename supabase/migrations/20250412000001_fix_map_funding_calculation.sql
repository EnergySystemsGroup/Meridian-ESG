-- Fix map funding calculation to use sum instead of average
-- And properly include national opportunities

-- Drop the existing function
DROP FUNCTION IF EXISTS get_funding_by_state(TEXT, TEXT, NUMERIC, NUMERIC);

-- Recreate the function with corrected calculations
CREATE OR REPLACE FUNCTION get_funding_by_state(
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
    WITH state_specific_data AS (
        -- Get state-specific opportunities
        SELECT 
            s.name AS state_name,
            s.code AS state_code,
            COUNT(DISTINCT fo.id) AS state_opp_count,
            SUM(COALESCE(fo.maximum_award, 0)) AS state_funding
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
    ),
    national_data AS (
        -- Get national opportunities that apply to all states
        SELECT
            COUNT(DISTINCT fo.id) AS national_opp_count,
            SUM(COALESCE(fo.maximum_award, 0)) AS national_funding
        FROM
            funding_opportunities fo
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            fo.is_national = true AND
            (status IS NULL OR fo.status = status) AND
            (source_type IS NULL OR fs.agency_type::TEXT = source_type) AND
            (min_award_val IS NULL OR 
                COALESCE(fo.minimum_award, fo.maximum_award) >= min_award_val
            ) AND
            (max_award_val IS NULL OR 
                COALESCE(fo.minimum_award, 0) <= max_award_val
            )
    ),
    combined_data AS (
        -- Combine state-specific and national data
        SELECT
            sd.state_name,
            sd.state_code,
            sd.state_funding + COALESCE((SELECT national_funding FROM national_data), 0) AS total_funding,
            sd.state_opp_count + COALESCE((SELECT national_opp_count FROM national_data), 0) AS total_opp_count
        FROM
            state_specific_data sd
    )
    SELECT
        state_name AS state,
        state_code,
        COALESCE(total_funding, 0) AS value,
        COALESCE(total_opp_count, 0)::INTEGER AS opportunities
    FROM
        combined_data
    ORDER BY
        state_name;
END;
$$ LANGUAGE plpgsql; 