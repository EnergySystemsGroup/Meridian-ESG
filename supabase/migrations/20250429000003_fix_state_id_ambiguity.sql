-- Fix the state_id ambiguity in the get_total_funding_available function
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
    v_state_id INTEGER := NULL;
BEGIN
    -- Get state ID if state code is provided (renamed to avoid ambiguity)
    IF p_state_code IS NOT NULL THEN
        SELECT id INTO v_state_id FROM states WHERE code = p_state_code;
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
        -- Include state eligibility check if we're filtering by state (fixed ambiguity)
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND (v_state_id IS NULL OR ose.state_id = v_state_id)
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
            
            -- State filtering: Either opportunity is national OR state is eligible (fixed ambiguity)
            (v_state_id IS NULL OR fo.is_national OR ose.state_id = v_state_id)
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
    
    -- Double-check if total is NULL (e.g., if no opportunities matched), default to 0
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql; 