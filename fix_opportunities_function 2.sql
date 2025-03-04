-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_opportunities_by_state(text);

-- Create the fixed function
CREATE OR REPLACE FUNCTION public.get_opportunities_by_state(p_state_code text)
 RETURNS TABLE(id uuid, title text, opportunity_number text, source_name text, source_type text, min_amount numeric, max_amount numeric, cost_share_required boolean, cost_share_percentage numeric, posted_date timestamp with time zone, open_date timestamp with time zone, close_date timestamp with time zone, description text, objectives text, eligibility text, status text, tags text[], url text, minimum_award numeric, maximum_award numeric, is_national boolean, program_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, program_name text, eligible_states character(2)[])
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM funding_opportunities_with_geography fo
    WHERE 
        fo.is_national = true 
        OR p_state_code = ANY(fo.eligible_states);
END;
$function$; 