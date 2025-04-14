-- Fix for the get_total_funding_available function to properly calculate funding
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
    state_id INTEGER := NULL;
BEGIN
    -- Get state ID if state code is provided
    IF p_state_code IS NOT NULL THEN
        SELECT id INTO state_id FROM states WHERE code = p_state_code;
    END IF;

    -- Calculate total funding available based on filtered opportunities
    WITH filtered_opportunities AS (
        SELECT 
            fo.id,
            fo.total_funding_available,
            fo.maximum_award,
            fo.minimum_award,
            fo.is_national
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            funding_sources fs ON fo.funding_source_id = fs.id
        -- Include state eligibility check if we're filtering by state
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND state_id IS NOT NULL
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
            -- State filtering: Either opportunity is national OR state is eligible
            (state_id IS NULL OR fo.is_national OR ose.state_id = state_id)
    )
    SELECT 
        SUM(
            CASE
                WHEN total_funding_available > 0 THEN total_funding_available
                WHEN maximum_award > 0 THEN maximum_award * 10  -- Estimate based on max award
                WHEN minimum_award > 0 THEN minimum_award * 10  -- Fallback to min award
                ELSE 0
            END
        )
    INTO 
        total
    FROM 
        filtered_opportunities;
    
    -- Debug output
    RAISE NOTICE 'Total funding calculated: %', total;
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- Fix for states with funding count to avoid always returning 51 states
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
BEGIN
    -- First check if we have any opportunities at all
    SELECT COUNT(*) INTO opp_count
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
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    -- If no opportunities match the filters, return 0
    IF opp_count = 0 THEN
        RETURN 0;
    END IF;

    -- Check if any national opportunities exist with these filters
    SELECT 
        EXISTS (
            SELECT 1 
            FROM funding_opportunities fo
            LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
            WHERE 
                fo.is_national = TRUE AND
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
        )
    INTO 
        has_national;
        
    -- If we have national opportunities, count all states
    IF has_national THEN
        SELECT COUNT(*) INTO state_count FROM states;
        RAISE NOTICE 'Found national opportunity, all states have funding: %', state_count;
    ELSE
        -- Otherwise, count states with at least one state-specific opportunity
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
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR 
                COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount
            ) AND
            (p_max_amount IS NULL OR 
                COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount
            ) AND
            -- Category filtering: Check for overlap if p_categories is provided and not empty
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
            
        RAISE NOTICE 'Found % states with state-specific funding', state_count;
    END IF;
    
    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql; 