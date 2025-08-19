-- Add funding process and activity fields to funding_opportunities table
-- This migration adds three new fields to capture additional funding opportunity details:
-- 1. disbursement_type - How funding is distributed (e.g., lump sum, installments, reimbursement)
-- 2. award_process - The award selection process (e.g., competitive, first-come-first-served, formula-based)
-- 3. eligible_activities - Array of activities that can be funded (captured from LLM analysis)

-- Add the new columns to funding_opportunities table
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS disbursement_type TEXT;
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS award_process TEXT;
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS eligible_activities TEXT[];

-- Add comments to document the new fields
COMMENT ON COLUMN funding_opportunities.disbursement_type IS 'How funding is distributed: lump sum, installments, reimbursement, performance-based, etc.';
COMMENT ON COLUMN funding_opportunities.award_process IS 'Award selection process: competitive, first-come-first-served, formula-based, rolling, etc.';
COMMENT ON COLUMN funding_opportunities.eligible_activities IS 'Array of specific activities that can be funded, extracted from opportunity descriptions';

-- Create indexes for the new fields to improve query performance
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_disbursement_type ON funding_opportunities(disbursement_type);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_award_process ON funding_opportunities(award_process);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_eligible_activities ON funding_opportunities USING GIN(eligible_activities);

-- Update the funding_opportunities_with_geography view to include the new fields
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
    fo.notes,
    fo.disbursement_type,
    fo.award_process,
    fo.eligible_activities
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_sources fs ON fo.funding_source_id = fs.id;

-- Add comment to document the view update
COMMENT ON VIEW funding_opportunities_with_geography IS 'View that includes funding opportunities with geography and new process fields: disbursement_type, award_process, and eligible_activities';
