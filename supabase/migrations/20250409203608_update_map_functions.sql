-- Migration to update the get_funding_by_state function to include national opportunities and deadline filters.

-- Drop the existing function if it exists (using old parameter types for safety)
DROP FUNCTION IF EXISTS public.get_funding_by_state(text, text, numeric, numeric);

-- Create the updated function
CREATE OR REPLACE FUNCTION public.get_funding_by_state(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL, 
    p_max_amount NUMERIC DEFAULT NULL,
    p_include_national BOOLEAN DEFAULT true,
    p_deadline_start DATE DEFAULT NULL,
    p_deadline_end DATE DEFAULT NULL
)
RETURNS TABLE (
    state TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH relevant_opportunities AS (
        -- Select opportunities based on filters, handling state-specific and national
        SELECT 
            fo.id,
            fo.maximum_award,
            fo.minimum_award,
            ose.state_id
        FROM 
            funding_opportunities fo
        LEFT JOIN 
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            -- Basic Filters
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.agency_type::TEXT = p_source_type) AND
            -- Amount Filters (handle NULLs carefully)
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) <= p_max_amount) AND
            -- Deadline Filters
            (p_deadline_start IS NULL OR fo.close_date >= p_deadline_start) AND
            (p_deadline_end IS NULL OR fo.close_date <= p_deadline_end) AND
            -- Geographic Filter (State-specific OR National based on flag)
            (
                ose.state_id IS NOT NULL -- Explicitly linked to a state
                OR 
                (fo.is_national = true AND p_include_national = true) -- Is national and we want to include them
            )
    ),
    state_aggregation AS (
        -- Aggregate counts and sums per state
        SELECT 
            s.id AS state_id,
            s.name AS state_name,
            s.code AS state_code,
            COUNT(DISTINCT ro.id) AS opp_count,
            SUM(COALESCE(ro.maximum_award, 0)) AS total_value
        FROM 
            states s
        LEFT JOIN 
            relevant_opportunities ro ON s.id = ro.state_id -- Join based on explicit state link
        GROUP BY
            s.id, s.name, s.code
    ),
    national_aggregation AS (
        -- Separately aggregate count and value for national opportunities if included
        SELECT 
            COUNT(DISTINCT ro.id) AS national_opp_count,
            SUM(COALESCE(ro.maximum_award, 0)) AS national_total_value
        FROM 
            funding_opportunities fo
        JOIN relevant_opportunities ro ON fo.id = ro.id -- Join to reuse filters
        WHERE fo.is_national = true AND ro.state_id IS NULL -- Only count national ones not already linked to a state implicitly
    )
    -- Final select combining state data and distributing national counts/values
    SELECT
        sa.state_name AS state,
        sa.state_code AS state_code,
        -- Add the state's direct value + a share of the national value (simple distribution for now)
        COALESCE(sa.total_value, 0) + COALESCE((SELECT national_total_value FROM national_aggregation) / (SELECT COUNT(*) FROM states), 0) AS value,
        -- Add the state's direct count + a share of the national count
        COALESCE(sa.opp_count, 0)::INTEGER + COALESCE((SELECT national_opp_count FROM national_aggregation) / (SELECT COUNT(*) FROM states), 0)::INTEGER AS opportunities
    FROM
        state_aggregation sa
    ORDER BY
        sa.state_name;

END;
$function$;

-- Optional: Add comment to the function
COMMENT ON FUNCTION public.get_funding_by_state(text, text, numeric, numeric, boolean, date, date) 
IS 'Aggregates funding opportunity counts and total maximum award values by state, with filters for status, source type, amount, deadlines, and inclusion of national opportunities.'; 