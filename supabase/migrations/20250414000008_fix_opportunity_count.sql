-- Fix opportunity count in per-applicant funding calculation
CREATE OR REPLACE FUNCTION get_funding_by_state_per_applicant(
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
    WITH 
    -- Get all opportunities for counting purposes (without award filter)
    all_filtered_opportunities AS (
        SELECT 
            fo.id, 
            fo.is_national
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_sources fs ON fo.funding_source_id = fs.id
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
    -- Get opportunities with award values for funding calculation
    award_filtered_opportunities AS (
        SELECT 
            fo.id, 
            fo.maximum_award, 
            fo.minimum_award, 
            fo.is_national
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_sources fs ON fo.funding_source_id = fs.id
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
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
            -- Only include opportunities with award amounts for funding calculation
            (fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL)
    ),
    state_specific_counts AS (
        -- Get state-specific opportunity counts
        SELECT 
            s.name AS state_name,
            s.code::TEXT AS state_code,
            COUNT(DISTINCT fo.id) AS state_opp_count
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN 
            all_filtered_opportunities fo ON ose.opportunity_id = fo.id
        WHERE 
            fo.is_national = false
        GROUP BY
            s.name, s.code
    ),
    state_specific_funding AS (
        -- Get state-specific funding
        SELECT 
            s.name AS state_name,
            s.code::TEXT AS state_code,
            SUM(COALESCE(fo.maximum_award, fo.minimum_award, 0)) AS state_funding
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN 
            award_filtered_opportunities fo ON ose.opportunity_id = fo.id
        WHERE 
            fo.is_national = false
        GROUP BY
            s.name, s.code
    ),
    national_counts AS (
        -- Get national opportunity counts
        SELECT
            COUNT(DISTINCT id) AS national_opp_count
        FROM
            all_filtered_opportunities
        WHERE
            is_national = true
    ),
    national_funding AS (
        -- Get national funding
        SELECT
            SUM(COALESCE(fo.maximum_award, fo.minimum_award, 0)) AS national_funding
        FROM
            award_filtered_opportunities fo
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        -- Ensure all states are represented
        SELECT name, code::TEXT FROM states
    ),
    combined_data AS (
        -- Combine all the data
        SELECT
            als.name AS state_name,
            als.code AS state_code,
            COALESCE(ssf.state_funding, 0) + COALESCE((SELECT national_funding FROM national_funding), 0) AS total_funding,
            COALESCE(ssc.state_opp_count, 0) + COALESCE((SELECT national_opp_count FROM national_counts), 0) AS total_opp_count
        FROM
            all_states als
        LEFT JOIN
            state_specific_funding ssf ON als.code = ssf.state_code
        LEFT JOIN
            state_specific_counts ssc ON als.code = ssc.state_code
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