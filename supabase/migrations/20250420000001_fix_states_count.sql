-- Fix the states with funding count function to exclude DC and count only 50 states
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
    eligible_states_count INTEGER;
BEGIN
    -- Get count of all states (excluding DC)
    SELECT COUNT(*) INTO states_count FROM states WHERE code != 'DC';
    
    -- Check if we have any eligible opportunities at all based on the filters
    SELECT COUNT(DISTINCT fo.id) INTO opp_count
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR fo.status = p_status) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
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
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
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
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;
    
    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql; 