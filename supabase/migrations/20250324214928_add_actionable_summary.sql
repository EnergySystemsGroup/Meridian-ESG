-- Add actionable_summary column to funding_opportunities table
ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS actionable_summary text;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN funding_opportunities.actionable_summary IS 'A single concise paragraph (2-3 sentences) that clearly states: 1) the funding source, 2) the amount available, 3) who can apply, 4) specifically what the money is for, and 5) when applications are due.';

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
    fo.min_amount,
    fo.max_amount,
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
