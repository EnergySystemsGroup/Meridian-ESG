-- Add a view to easily access opportunity data with agency names
CREATE OR REPLACE VIEW opportunity_details AS
SELECT 
    fo.*,
    fs.name AS agency_name,
    fs.agency_type,
    fs.website AS agency_website
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_sources fs ON fo.funding_source_id = fs.id;

-- Add a function to get opportunities with agency names
CREATE OR REPLACE FUNCTION get_opportunities_with_agency(
    limit_count INT DEFAULT 100,
    offset_count INT DEFAULT 0
) 
RETURNS TABLE (
    id UUID,
    title TEXT,
    opportunity_number TEXT,
    description TEXT,
    funding_type TEXT,
    status TEXT,
    open_date TIMESTAMPTZ,
    close_date TIMESTAMPTZ,
    minimum_award NUMERIC,
    maximum_award NUMERIC,
    total_funding_available NUMERIC,
    cost_share_required BOOLEAN,
    cost_share_percentage NUMERIC,
    agency_name TEXT,
    agency_type TEXT,
    source_id UUID,
    funding_source_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.title,
        o.opportunity_number,
        o.description,
        o.funding_type,
        o.status,
        o.open_date,
        o.close_date,
        o.minimum_award,
        o.maximum_award,
        o.total_funding_available,
        o.cost_share_required,
        o.cost_share_percentage,
        fs.name AS agency_name,
        fs.agency_type,
        o.source_id,
        o.funding_source_id,
        o.created_at,
        o.updated_at
    FROM 
        funding_opportunities o
    LEFT JOIN 
        funding_sources fs ON o.funding_source_id = fs.id
    ORDER BY 
        o.updated_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$; 