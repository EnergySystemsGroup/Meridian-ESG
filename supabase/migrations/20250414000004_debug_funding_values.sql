-- Create a debug function to check values in the database
CREATE OR REPLACE FUNCTION debug_funding_values()
RETURNS TABLE (
    id UUID, 
    title TEXT,
    maximum_award NUMERIC, 
    total_funding_available NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fo.id, 
        fo.title,
        fo.maximum_award, 
        fo.total_funding_available
    FROM 
        funding_opportunities fo
    LIMIT 10;
END;
$$ LANGUAGE plpgsql; 