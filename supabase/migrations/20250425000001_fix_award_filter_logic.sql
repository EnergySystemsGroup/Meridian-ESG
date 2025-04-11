-- Correcting the "bottom-up" filtering logic for maximum award
CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL, 
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    opp_count INTEGER := 0;
BEGIN
    -- Get count of unique opportunities that match all filters
    SELECT 
        COUNT(DISTINCT fo.id)
    INTO 
        opp_count
    FROM 
        funding_opportunities fo
    LEFT JOIN 
        funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        -- Filter by minimum amount - proper bottom-up filtering
        -- Only apply the filter if p_min_amount is non-null and > 0
        (p_min_amount IS NULL OR p_min_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
        ) AND
        -- Filter by maximum amount if needed
        (p_max_amount IS NULL OR p_max_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
        ) AND
        -- Category filtering: Check for overlap if p_categories is provided and not empty
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    RETURN COALESCE(opp_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Update the total funding available function
CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL, 
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_state_code CHARACTER(2) DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC := 0;
    state_id_var INTEGER := NULL;
BEGIN
    -- Get state ID if state code is provided (using distinct variable name to avoid ambiguity)
    IF p_state_code IS NOT NULL THEN
        SELECT id INTO state_id_var FROM states WHERE code = p_state_code;
    END IF;

    -- Direct simple calculation method that is more reliable
    SELECT 
        SUM(
            CASE
                WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
                WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10
                WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10
                ELSE 0
            END
        )
    INTO 
        total
    FROM 
        funding_opportunities fo
    LEFT JOIN 
        funding_sources fs ON fo.funding_source_id = fs.id
    -- State filtering: either no state filter, or opportunity is national, or the opportunity is eligible for the state
    LEFT JOIN 
        opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND state_id_var IS NOT NULL
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        -- Filter by minimum amount - proper bottom-up filtering
        -- Only apply the filter if p_min_amount is non-null and > 0
        (p_min_amount IS NULL OR p_min_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
        ) AND
        -- Filter by maximum amount if needed
        (p_max_amount IS NULL OR p_max_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
        ) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
        (state_id_var IS NULL OR fo.is_national OR ose.state_id = state_id_var);
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- Update the states with funding count function
CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL, 
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    state_count INTEGER := 0;
    has_national BOOLEAN := FALSE;
    opp_count INTEGER := 0;
    states_count INTEGER;
BEGIN
    -- Get count of all states (excluding DC)
    SELECT COUNT(*) INTO states_count FROM states WHERE code != 'DC';
    
    -- Check if we have any eligible opportunities at all based on the filters
    SELECT COUNT(DISTINCT fo.id) INTO opp_count
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        -- Filter by minimum amount - proper bottom-up filtering
        -- Only apply the filter if p_min_amount is non-null and > 0
        (p_min_amount IS NULL OR p_min_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
        ) AND
        -- Filter by maximum amount if needed
        (p_max_amount IS NULL OR p_max_amount = 0 OR 
            (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
        ) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    -- If no opportunities match, return 0
    IF opp_count = 0 THEN
        RETURN 0;
    END IF;
    
    -- Check if any national opportunities match these filters
    SELECT EXISTS (
        SELECT 1 
        FROM funding_opportunities fo
        LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
        WHERE 
            fo.is_national = TRUE AND
            (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            -- Filter by minimum amount - proper bottom-up filtering
            -- Only apply the filter if p_min_amount is non-null and > 0  
            (p_min_amount IS NULL OR p_min_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            -- Filter by maximum amount if needed
            (p_max_amount IS NULL OR p_max_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ) INTO has_national;
    
    -- If we have national opportunities, count all states (excluding DC)
    IF has_national THEN
        state_count := states_count; -- This is now 50 since we excluded DC
    ELSE
        -- Otherwise, only count states with state-specific funding (excluding DC)
        SELECT 
            COUNT(DISTINCT s.id)
        INTO 
            state_count
        FROM 
            states s
        JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN 
            funding_opportunities fo ON ose.opportunity_id = fo.id
        LEFT JOIN 
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            s.code != 'DC' AND -- Exclude DC
            (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            -- Filter by minimum amount - proper bottom-up filtering
            -- Only apply the filter if p_min_amount is non-null and > 0
            (p_min_amount IS NULL OR p_min_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            -- Filter by maximum amount if needed
            (p_max_amount IS NULL OR p_max_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;
    
    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Update the map-data function
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
    WITH filtered_opportunities AS (
        -- Pre-filter opportunities based on all criteria including categories
        SELECT 
            fo.id, 
            fo.maximum_award, 
            fo.minimum_award, 
            fo.is_national,
            fo.total_funding_available
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            (p_status IS NULL OR LOWER(fo.status) = LOWER(p_status)) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            -- Filter by minimum amount - proper bottom-up filtering
            -- Only apply the filter if p_min_amount is non-null and > 0
            (p_min_amount IS NULL OR p_min_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            -- Filter by maximum amount if needed
            (p_max_amount IS NULL OR p_max_amount = 0 OR 
                (fo.maximum_award IS NOT NULL AND fo.maximum_award <= p_max_amount)
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
            SUM(
                CASE
                    WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
                    WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10
                    WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10
                    ELSE 0
                END
            ) AS state_funding
        FROM 
            states s
        LEFT JOIN 
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN 
            filtered_opportunities fo ON ose.opportunity_id = fo.id -- Join with pre-filtered ops
        WHERE 
            fo.is_national = false AND
            s.code != 'DC' -- Only count non-national here and exclude DC
        GROUP BY
            s.name, s.code
    ),
    national_data AS (
        -- Get national opportunities that apply to all states
        SELECT
            COUNT(DISTINCT fo.id) AS national_opp_count,
            SUM(
                CASE
                    WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
                    WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10
                    WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10
                    ELSE 0
                END
            ) AS national_funding
        FROM
            filtered_opportunities fo -- Use pre-filtered ops
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        -- Ensure all states are represented, even with zero funding/opps (excluding DC)
        SELECT name, code::TEXT FROM states WHERE code != 'DC'
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