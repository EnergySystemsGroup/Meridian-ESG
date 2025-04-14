-- Function to calculate total funding available across all opportunities
CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL, 
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC := 0;
BEGIN
    -- Calculate total funding available based on filtered opportunities
    WITH filtered_opportunities AS (
        SELECT 
            fo.id,
            fo.total_funding_available,
            fo.maximum_award,
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
    )
    SELECT 
        SUM(COALESCE(total_funding_available, maximum_award * 10, 0))
    INTO 
        total
    FROM 
        filtered_opportunities;
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql; 