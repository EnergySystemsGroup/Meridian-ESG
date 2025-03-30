-- Migration to mark agency_name as DEPRECATED rather than removing it
-- This preserves backward compatibility while discouraging its use

-- Add a descriptive comment to the column indicating it's deprecated
COMMENT ON COLUMN funding_opportunities.agency_name IS 'DEPRECATED: This field is redundant with funding_sources.name. Use funding_source_id to join with funding_sources table or source_display_name from the funding_opportunities_with_geography view instead.'; 