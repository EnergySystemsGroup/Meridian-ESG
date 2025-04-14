-- First drop the existing functions
DROP FUNCTION IF EXISTS debug_total_funding;
DROP FUNCTION IF EXISTS debug_opportunity_filter;

-- Fix the debugging functions to handle UUID ids properly
CREATE OR REPLACE FUNCTION debug_total_funding(
    p_max_amount NUMERIC DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    title TEXT,
    maximum_award NUMERIC,
    total_funding_available NUMERIC,
    is_included BOOLEAN,
    calculated_funding NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fo.id,
        fo.title,
        fo.maximum_award,
        fo.total_funding_available,
        CASE 
            WHEN p_max_amount IS NULL OR p_max_amount = 0 THEN TRUE
            WHEN fo.maximum_award IS NULL THEN TRUE  -- Always include NULL award values
            WHEN fo.maximum_award >= p_max_amount THEN TRUE
            ELSE FALSE
        END AS is_included,
        CASE
            WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
            WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10  -- Estimate based on max award
            WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10  -- Fallback to min award
            ELSE 0
        END AS calculated_funding
    FROM 
        funding_opportunities fo
    ORDER BY 
        calculated_funding DESC;
END;
$$ LANGUAGE plpgsql;

-- Also fix the opportunity debug function
CREATE OR REPLACE FUNCTION debug_opportunity_filter(
    p_max_amount NUMERIC DEFAULT NULL
) RETURNS TABLE (
    id UUID,
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