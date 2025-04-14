-- Migration: 20240330000004_recreate_by_state_function.sql
-- Created on 2024-03-30
-- Recreates the get_opportunities_by_state function that was dropped during the cascade operation

-- Function to get opportunities by state
CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
RETURNS SETOF funding_opportunities_with_geography AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM funding_opportunities_with_geography
    WHERE 
        is_national = true 
        OR state_code = ANY(eligible_states);
END;
$$ LANGUAGE plpgsql; 