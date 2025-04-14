-- Drop existing views if they exist
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;
DROP VIEW IF EXISTS funding_opportunities_with_source CASCADE;

-- Create the funding_opportunities_with_source view
CREATE VIEW funding_opportunities_with_source AS
SELECT 
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.description,
    fo.objectives,
    fo.status,
    fo.url,
    fo.created_at,
    fo.updated_at,
    fo.source_id,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.tags,
    fo.eligible_applicants,
    fo.eligible_project_types,
    fo.eligible_locations,
    fo.categories,
    fo.actionable_summary,
    fo.is_national,
    s.name as source_name,
    s.organization as source_organization,
    s.type as source_type,
    s.url as source_url,
    s.api_endpoint as source_api_endpoint,
    s.api_documentation_url as source_documentation_url,
    s.auth_type as source_auth_type,
    s.update_frequency as source_update_frequency,
    s.last_checked as source_last_checked,
    s.active as source_active,
    s.notes as source_notes,
    s.handler_type as source_handler_type
FROM funding_opportunities fo
LEFT JOIN api_sources s ON fo.source_id = s.id;

-- Create the funding_opportunities_with_geography view
CREATE VIEW funding_opportunities_with_geography AS
SELECT 
    fo.*,
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM funding_opportunities fo;

-- Add comments to explain the views
COMMENT ON VIEW funding_opportunities_with_source IS 'Combines funding opportunities with their source information';
COMMENT ON VIEW funding_opportunities_with_geography IS 'Combines funding opportunities with their geographic eligibility information'; 