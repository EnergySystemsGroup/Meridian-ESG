-- Recreate the get_opportunities_by_state function
CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
RETURNS SETOF funding_opportunities_with_geography AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM funding_opportunities_with_geography
    WHERE state_code = ANY(eligible_states) OR is_national = true
    ORDER BY close_date;
END;
$$ LANGUAGE plpgsql; 