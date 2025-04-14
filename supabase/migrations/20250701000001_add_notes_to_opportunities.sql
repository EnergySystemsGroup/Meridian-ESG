-- Add notes field to funding_opportunities for explanations about min, max and total funding amounts
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add a comment to the notes column
COMMENT ON COLUMN funding_opportunities.notes IS 'Text field for explanatory notes about funding amounts and other details';

-- Create a new view with the updated schema that includes the notes field
CREATE OR REPLACE VIEW funding_opportunities_with_geography AS 
SELECT 
    fo.id,
    fo.title,
    fo.opportunity_number,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
    fo.source_id,
    fo.funding_source_id,
    fo.raw_response_id,
    fo.is_national,
    fo.agency_name,
    fo.funding_type,
    fo.actionable_summary,
    CASE
        WHEN (fo.close_date IS NOT NULL AND fo.close_date < CURRENT_DATE) THEN 'Closed'::text
        WHEN (fo.open_date IS NOT NULL AND fo.open_date > CURRENT_DATE) THEN 'Upcoming'::text
        ELSE 'Open'::text
    END AS status,
    fo.tags,
    fo.url,
    fo.eligible_applicants,
    fo.eligible_project_types,
    fo.eligible_locations,
    fo.categories,
    fo.created_at,
    fo.updated_at,
    fo.relevance_score,
    fo.relevance_reasoning,
    COALESCE(fs.name, 'Unknown Source'::text) AS source_display_name,
    COALESCE(fs.agency_type::text, 'Unknown'::text) AS source_type_display,
    ARRAY(
        SELECT s.code 
        FROM opportunity_state_eligibility ose
        JOIN states s ON ose.state_id = s.id
        WHERE ose.opportunity_id = fo.id
    ) AS eligible_states,
    fo.notes
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_sources fs ON fo.funding_source_id = fs.id;

-- Add a comment to explain the migration
COMMENT ON VIEW funding_opportunities_with_geography IS 'View that includes the funding opportunities with their eligible states, including the notes field'; 