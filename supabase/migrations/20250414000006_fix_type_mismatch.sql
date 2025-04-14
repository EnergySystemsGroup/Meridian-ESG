-- Fix type mismatch in get_funding_by_state_v3
CREATE OR REPLACE FUNCTION get_funding_by_state_v3(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL, 
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_opportunities AS (
        -- Pre-filter opportunities based on all criteria including categories
        SELECT fo.id, fo.total_funding_available, fo.maximum_award, fo.minimum_award, fo.is_national
        FROM funding_opportunities fo
        LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR 
                COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount
            ) AND
            (p_max_amount IS NULL OR 
                COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount
            ) AND
            -- Category filtering: Check for overlap if p_categories is provided and not empty
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ),
    state_specific_data AS (
        -- Get state-specific opportunities
        SELECT 
            s.name AS state_name,
            s.code::TEXT AS state_code,
            COUNT(DISTINCT fo.id) AS state_opp_count,
            SUM(COALESCE(fo.total_funding_available, fo.maximum_award, 0)) AS state_funding
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN 
            filtered_opportunities fo ON ose.opportunity_id = fo.id -- Join with pre-filtered ops
        WHERE fo.is_national = false -- Only count non-national here
        GROUP BY
            s.name, s.code
    ),
    national_data AS (
        -- Get national opportunities that apply to all states
        SELECT
            COUNT(DISTINCT fo.id) AS national_opp_count,
            SUM(COALESCE(fo.total_funding_available, fo.maximum_award, 0)) AS national_funding
        FROM
            filtered_opportunities fo -- Use pre-filtered ops
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        -- Ensure all states are represented, even with zero funding/opps
        SELECT name, code::TEXT FROM states
    ),
    combined_data AS (
        -- Combine state-specific and national data
        SELECT
            als.name AS state_name,
            als.code AS state_code,
            COALESCE(ssd.state_funding, 0) + COALESCE((SELECT national_funding FROM national_data), 0) AS total_funding,
            COALESCE(ssd.state_opp_count, 0) + COALESCE((SELECT national_opp_count FROM national_data), 0) AS total_opp_count
        FROM
            all_states als
        LEFT JOIN
            state_specific_data ssd ON als.code = ssd.state_code
    )
    SELECT
        cd.state_name AS state,
        cd.state_code,
        cd.total_funding AS value,
        cd.total_opp_count::INTEGER AS opportunities
    FROM
        combined_data cd
    ORDER BY
        cd.state_name;
END;
$$ LANGUAGE plpgsql; 