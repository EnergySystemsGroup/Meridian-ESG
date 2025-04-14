-- Add actionable_summary column to funding_opportunities table
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS actionable_summary text;

-- Add total_funding_available column
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS total_funding_available NUMERIC;

-- Remove redundant columns
ALTER TABLE funding_opportunities
DROP COLUMN IF EXISTS min_amount;
ALTER TABLE funding_opportunities
DROP COLUMN IF EXISTS max_amount;

-- Drop and recreate the view to fix the duplicate column issue
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;

CREATE VIEW funding_opportunities_with_geography AS
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
    fo.program_id,
    fo.minimum_award,
    fo.maximum_award,
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
    COALESCE(fp.name, 'Unknown Program') AS program_name,
    COALESCE(fs.name, 'Unknown Source') AS source_display_name,
    COALESCE(fs.agency_type, 'Unknown') AS agency_type,
    fo.is_national,
    ARRAY(
        SELECT s.code
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_programs fp ON fo.program_id = fp.id
LEFT JOIN 
    funding_sources fs ON fp.source_id = fs.id;

-- Update view to handle new columns
DROP VIEW IF EXISTS funding_opportunities_with_source;
CREATE VIEW funding_opportunities_with_source AS
SELECT 
    fo.*,
    s.name as source_name,
    s.type as source_type
FROM funding_opportunities fo
LEFT JOIN api_sources s ON fo.source_id = s.id;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN funding_opportunities.actionable_summary IS 'A concise summary of the key details of the funding opportunity';
COMMENT ON COLUMN funding_opportunities.total_funding_available IS 'The total amount of funding available for the entire program/opportunity';
