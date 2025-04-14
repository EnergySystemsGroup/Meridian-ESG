-- Create a diagnostic test function to help debug
CREATE OR REPLACE FUNCTION debug_opportunity_filter(
    p_max_amount NUMERIC DEFAULT NULL
) RETURNS TABLE (
    id INTEGER,
    title TEXT,
    maximum_award NUMERIC,
    is_included BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fo.id,
        fo.title,
        fo.maximum_award,
        CASE 
            WHEN p_max_amount IS NULL OR p_max_amount = 0 THEN TRUE
            WHEN fo.maximum_award IS NULL THEN TRUE  -- Always include NULL award values
            WHEN fo.maximum_award >= p_max_amount THEN TRUE
            ELSE FALSE
        END AS is_included
    FROM 
        funding_opportunities fo
    ORDER BY 
        fo.maximum_award DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total unique opportunities count
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
        (p_status IS NULL OR fo.status ILIKE p_status) AND
        (p_source_type IS NULL OR fs.agency_type::TEXT ILIKE p_source_type) AND
        
        -- For p_min_amount, only apply the filter if it's non-null and > 0
        (p_min_amount IS NULL OR p_min_amount = 0 OR
            (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
        ) AND
        
        -- For p_max_amount, only apply if it's non-null and > 0 AND max_award is NOT NULL
        -- NULL max_award values are ALWAYS included regardless of p_max_amount
        (p_max_amount IS NULL OR p_max_amount = 0 OR
            fo.maximum_award IS NULL OR  -- ALWAYS include NULL maximum_award values
            fo.maximum_award >= p_max_amount
        ) AND
        
        -- Category filtering: Check for overlap if p_categories is provided and not empty
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    
    RETURN COALESCE(opp_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Make sure other functions also handle NULL maximum_award values consistently
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
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND ose.state_id = state_id
        WHERE
            (p_status IS NULL OR fo.status ILIKE p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT ILIKE p_source_type) AND
            
            -- For p_min_amount, only apply the filter if it's non-null and > 0
            (p_min_amount IS NULL OR p_min_amount = 0 OR
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            
            -- For p_max_amount, only apply if it's non-null and > 0 AND max_award is NOT NULL
            -- NULL max_award values are ALWAYS included regardless of p_max_amount
            (p_max_amount IS NULL OR p_max_amount = 0 OR
                fo.maximum_award IS NULL OR  -- ALWAYS include NULL maximum_award values
                fo.maximum_award >= p_max_amount
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
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to count states with funding
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
BEGIN
    -- First check if any national opportunities exist with these filters
    SELECT 
        EXISTS (
            SELECT 1 
            FROM funding_opportunities fo
            LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
            WHERE 
                fo.is_national = TRUE AND
                (p_status IS NULL OR fo.status ILIKE p_status) AND
                (p_source_type IS NULL OR fs.agency_type::TEXT ILIKE p_source_type) AND
                
                -- For p_min_amount, only apply the filter if it's non-null and > 0
                (p_min_amount IS NULL OR p_min_amount = 0 OR
                    (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
                ) AND
                
                -- For p_max_amount, only apply if it's non-null and > 0 AND max_award is NOT NULL
                -- NULL max_award values are ALWAYS included regardless of p_max_amount
                (p_max_amount IS NULL OR p_max_amount = 0 OR
                    fo.maximum_award IS NULL OR  -- ALWAYS include NULL maximum_award values
                    fo.maximum_award >= p_max_amount
                ) AND
                
                -- Category filtering: Check for overlap if p_categories is provided and not empty
                (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
        )
    INTO 
        has_national;
        
    -- If we have national opportunities, count all states except DC
    IF has_national THEN
        SELECT COUNT(*) INTO state_count 
        FROM states
        WHERE code != 'DC';  -- Exclude Washington DC
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
            s.code != 'DC' AND  -- Exclude Washington DC
            (p_status IS NULL OR fo.status ILIKE p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT ILIKE p_source_type) AND
            
            -- For p_min_amount, only apply the filter if it's non-null and > 0
            (p_min_amount IS NULL OR p_min_amount = 0 OR
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            
            -- For p_max_amount, only apply if it's non-null and > 0 AND max_award is NOT NULL
            -- NULL max_award values are ALWAYS included regardless of p_max_amount
            (p_max_amount IS NULL OR p_max_amount = 0 OR
                fo.maximum_award IS NULL OR  -- ALWAYS include NULL maximum_award values
                fo.maximum_award >= p_max_amount
            ) AND
            
            -- Category filtering: Check for overlap if p_categories is provided and not empty
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;
    
    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql; 