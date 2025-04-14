-- Fix the view issue
-- Created on 2024-03-06

-- Drop the view and dependent objects if they exist
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;

-- Create or replace the view for funding opportunities with geography
CREATE VIEW funding_opportunities_with_geography AS
SELECT 
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.source_name,
    fo.source_type,
    fo.min_amount,
    fo.max_amount,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
    fo.objectives,
    fo.eligibility,
    fo.status,
    fo.tags,
    fo.url,
    fo.minimum_award,
    fo.maximum_award,
    fo.is_national,
    fo.program_id,
    fo.created_at,
    fo.updated_at,
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_programs fp ON fo.program_id = fp.id;

-- Recreate the function to get opportunities by state
CREATE OR REPLACE FUNCTION get_opportunities_by_state(state_code TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    opportunity_number TEXT,
    source_name TEXT,
    source_type TEXT,
    min_amount NUMERIC,
    max_amount NUMERIC,
    cost_share_required BOOLEAN,
    cost_share_percentage NUMERIC,
    posted_date TIMESTAMP WITH TIME ZONE,
    open_date TIMESTAMP WITH TIME ZONE,
    close_date TIMESTAMP WITH TIME ZONE,
    description TEXT,
    objectives TEXT,
    eligibility TEXT,
    status TEXT,
    tags TEXT[],
    url TEXT,
    minimum_award NUMERIC,
    maximum_award NUMERIC,
    is_national BOOLEAN,
    program_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    program_name TEXT,
    eligible_states TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM funding_opportunities_with_geography
    WHERE 
        is_national = true 
        OR state_code = ANY(eligible_states);
END;
$$ LANGUAGE plpgsql; 