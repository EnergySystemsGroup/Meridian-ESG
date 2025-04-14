-- Drop the ambiguous function with OID 26048 that doesn't have the ::text cast
-- This function has parameters in order (..., p_include_national, p_deadline_start, p_deadline_end)
DROP FUNCTION IF EXISTS public.get_funding_by_state(
    p_status text, 
    p_source_type text, 
    p_min_amount numeric, 
    p_max_amount numeric, 
    p_include_national boolean, 
    p_deadline_start date, 
    p_deadline_end date
);
