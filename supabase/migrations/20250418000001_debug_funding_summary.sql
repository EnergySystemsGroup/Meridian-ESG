-- Debug function to test funding calculations with verbose output
CREATE OR REPLACE FUNCTION debug_funding_summary()
RETURNS TABLE(
    test_name TEXT,
    total_opportunities INTEGER,
    total_funding NUMERIC,
    states_with_funding INTEGER,
    has_national BOOLEAN,
    opp_count INTEGER
) AS $$
DECLARE
    has_national_opps BOOLEAN;
    opportunity_count INTEGER;
BEGIN
    -- Check if we have any opportunities at all
    SELECT COUNT(*) INTO opportunity_count FROM funding_opportunities;
    RAISE NOTICE 'Total opportunities in database: %', opportunity_count;
    
    -- Check if we have any national opportunities 
    SELECT EXISTS(
        SELECT 1 FROM funding_opportunities WHERE is_national = TRUE
    ) INTO has_national_opps;
    RAISE NOTICE 'Database has national opportunities: %', has_national_opps;
    
    -- Output base case - no filters
    test_name := 'No filters';
    total_opportunities := get_total_opportunities_count();
    total_funding := get_total_funding_available();
    states_with_funding := get_states_with_funding_count();
    has_national := has_national_opps;
    opp_count := opportunity_count;
    RETURN NEXT;
    
    -- Test with status filter
    test_name := 'Status = Open';
    total_opportunities := get_total_opportunities_count('Open');
    total_funding := get_total_funding_available('Open');
    states_with_funding := get_states_with_funding_count('Open');
    SELECT EXISTS(
        SELECT 1 FROM funding_opportunities WHERE is_national = TRUE AND status = 'Open'
    ) INTO has_national;
    SELECT COUNT(*) INTO opp_count FROM funding_opportunities WHERE status = 'Open';
    RETURN NEXT;
    
    -- Test with source type filter
    test_name := 'Source = Federal';
    total_opportunities := get_total_opportunities_count(NULL, 'Federal');
    total_funding := get_total_funding_available(NULL, 'Federal');
    states_with_funding := get_states_with_funding_count(NULL, 'Federal');
    SELECT EXISTS(
        SELECT 1 FROM funding_opportunities fo
        JOIN funding_sources fs ON fo.funding_source_id = fs.id
        WHERE fo.is_national = TRUE AND fs.agency_type::TEXT = 'Federal'
    ) INTO has_national;
    SELECT COUNT(*) INTO opp_count FROM funding_opportunities fo
    JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE fs.agency_type::TEXT = 'Federal';
    RETURN NEXT;
    
    -- Test with amount filter
    test_name := 'Min Amount = 100000';
    total_opportunities := get_total_opportunities_count(NULL, NULL, 100000);
    total_funding := get_total_funding_available(NULL, NULL, 100000);
    states_with_funding := get_states_with_funding_count(NULL, NULL, 100000);
    SELECT EXISTS(
        SELECT 1 FROM funding_opportunities 
        WHERE is_national = TRUE AND 
        COALESCE(minimum_award, maximum_award, 0) >= 100000
    ) INTO has_national;
    SELECT COUNT(*) INTO opp_count FROM funding_opportunities
    WHERE COALESCE(minimum_award, maximum_award, 0) >= 100000;
    RETURN NEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Update the main functions with better debugging

-- Fix the total funding calculation with enhanced debugging
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
    debug_count INTEGER;
    debug_total NUMERIC;
BEGIN
    -- Debug logging
    RAISE NOTICE 'get_total_funding_available called with: status=%, source=%, min=%, max=%, categories=%, state=%', 
        p_status, p_source_type, p_min_amount, p_max_amount, p_categories, p_state_code;
    
    -- Get state ID if state code is provided
    IF p_state_code IS NOT NULL THEN
        SELECT id INTO state_id FROM states WHERE code = p_state_code;
    END IF;

    -- First get a count of matching opportunities for debug
    SELECT COUNT(*) INTO debug_count
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR fo.status = p_status) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    RAISE NOTICE 'Found % opportunities matching filters', debug_count;
    
    -- Debug sample of opportunities
    IF debug_count > 0 THEN
        RAISE NOTICE 'Sample opportunities matching filters:';
        FOR i IN 1..LEAST(5, debug_count) LOOP
            RAISE NOTICE 'Opportunity %: ID=%, total_funding=%, min=%, max=%', 
                i, 
                (SELECT id FROM funding_opportunities 
                WHERE (p_status IS NULL OR status = p_status) 
                LIMIT 1 OFFSET i-1),
                (SELECT total_funding_available FROM funding_opportunities 
                WHERE (p_status IS NULL OR status = p_status) 
                LIMIT 1 OFFSET i-1),
                (SELECT minimum_award FROM funding_opportunities 
                WHERE (p_status IS NULL OR status = p_status) 
                LIMIT 1 OFFSET i-1),
                (SELECT maximum_award FROM funding_opportunities 
                WHERE (p_status IS NULL OR status = p_status) 
                LIMIT 1 OFFSET i-1);
        END LOOP;
    END IF;
    
    -- Calculate total funding directly for debugging
    SELECT SUM(COALESCE(total_funding_available, maximum_award * 10, minimum_award * 10, 0))
    INTO debug_total
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR fo.status = p_status) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    RAISE NOTICE 'Direct calculation of total funding: %', COALESCE(debug_total, 0);

    -- Regular calculation with CTE
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
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND state_id IS NOT NULL
        WHERE
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
            (state_id IS NULL OR fo.is_national OR ose.state_id = state_id)
    )
    SELECT 
        SUM(
            CASE
                WHEN total_funding_available > 0 THEN total_funding_available
                WHEN maximum_award > 0 THEN maximum_award * 10
                WHEN minimum_award > 0 THEN minimum_award * 10
                ELSE 0
            END
        )
    INTO 
        total
    FROM 
        filtered_opportunities;
    
    RAISE NOTICE 'Final calculated total funding: %', COALESCE(total, 0);
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- Fix the states with funding count function with enhanced debugging
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
    -- Debug logging
    RAISE NOTICE 'get_states_with_funding_count called with: status=%, source=%, min=%, max=%, categories=%', 
        p_status, p_source_type, p_min_amount, p_max_amount, p_categories;
        
    -- Get count of all states for reference
    SELECT COUNT(*) INTO states_count FROM states;
    RAISE NOTICE 'Total number of states in database: %', states_count;
    
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
    
    RAISE NOTICE 'Total opportunities matching filters: %', opp_count;
    
    -- If no opportunities match, return 0
    IF opp_count = 0 THEN
        RAISE NOTICE 'No opportunities match filters, returning 0 states';
        RETURN 0;
    END IF;
    
    -- Count states with at least one eligible opportunity
    SELECT COUNT(DISTINCT s.id) INTO eligible_states_count
    FROM states s
    JOIN opportunity_state_eligibility ose ON s.id = ose.state_id
    JOIN funding_opportunities fo ON ose.opportunity_id = fo.id
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR fo.status = p_status) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
        
    RAISE NOTICE 'States with state-specific opportunities: %', eligible_states_count;
    
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
    
    RAISE NOTICE 'Has national opportunities matching filters: %', has_national;
    
    -- Calculate final count based on if we have national opportunities
    IF has_national THEN
        -- If there are national opportunities, all states have funding
        state_count := states_count;
        RAISE NOTICE 'Using all states count due to national opportunities: %', state_count;
    ELSE
        -- Otherwise, only count states with state-specific funding
        state_count := eligible_states_count;
        RAISE NOTICE 'Using only states with state-specific funding: %', state_count;
    END IF;
    
    RETURN state_count;
END;
$$ LANGUAGE plpgsql;

-- Create a special debugging function that checks the actual data
CREATE OR REPLACE FUNCTION check_funding_data()
RETURNS TABLE(
    id UUID,
    title TEXT,
    total_funding NUMERIC,
    maximum_award NUMERIC,
    minimum_award NUMERIC,
    has_national BOOLEAN,
    status TEXT,
    funding_source TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fo.id, 
        fo.title,
        fo.total_funding_available,
        fo.maximum_award,
        fo.minimum_award,
        fo.is_national,
        fo.status,
        fs.name
    FROM 
        funding_opportunities fo
    LEFT JOIN
        funding_sources fs ON fo.funding_source_id = fs.id
    LIMIT 10;
END;
$$ LANGUAGE plpgsql; 