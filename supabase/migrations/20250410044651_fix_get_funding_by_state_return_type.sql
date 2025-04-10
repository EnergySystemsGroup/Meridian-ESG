-- Function 2: Get funding by state
-- Recreate with corrected return type cast for state_code
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
        state_code::text, -- Cast to TEXT to match RETURNS TABLE definition
        COALESCE(ROUND(avg_amount::NUMERIC, 2), 0) AS value,
        COALESCE(opp_count, 0)::INTEGER AS opportunities
    FROM
        state_data
    ORDER BY
        state_name;
END;
$$ LANGUAGE plpgsql;
