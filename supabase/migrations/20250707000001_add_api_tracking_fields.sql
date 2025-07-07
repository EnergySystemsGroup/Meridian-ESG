-- Add API tracking fields to funding_opportunities table
-- This migration adds two critical fields needed for the EarlyDuplicateDetector optimization:
-- 1. opportunity_id - External API identifier for duplicate detection with ID + Title validation
-- 2. api_updated_at - API's last updated timestamp for freshness checking (4-scenario decision matrix)

-- Add the new columns to funding_opportunities table
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS opportunity_id TEXT;
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS api_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the new fields
COMMENT ON COLUMN funding_opportunities.opportunity_id IS 'External API identifier for the opportunity, used for duplicate detection with ID + Title validation';
COMMENT ON COLUMN funding_opportunities.api_updated_at IS 'API last updated timestamp for freshness checking in EarlyDuplicateDetector 4-scenario decision matrix';

-- Create indexes for the new fields to improve query performance
-- Composite index for efficient duplicate detection queries (source + opportunity_id)
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_opportunity_id ON funding_opportunities(funding_source_id, opportunity_id) WHERE opportunity_id IS NOT NULL;

-- Index for API timestamp freshness checks
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_api_updated_at ON funding_opportunities(api_updated_at) WHERE api_updated_at IS NOT NULL;

-- Index for opportunity_id lookups within same source (used by EarlyDuplicateDetector batch queries)
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_opportunity_id ON funding_opportunities(opportunity_id) WHERE opportunity_id IS NOT NULL;

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
    fo.eligible_activities,
    fo.enhanced_description,
    fo.scoring,
    fo.opportunity_id,
    fo.api_updated_at
FROM 
    funding_opportunities fo
LEFT JOIN 
    funding_sources fs ON fo.funding_source_id = fs.id;

-- Add comment to document the view update
COMMENT ON VIEW funding_opportunities_with_geography IS 'View that includes funding opportunities with geography and API tracking fields: opportunity_id and api_updated_at for EarlyDuplicateDetector optimization';