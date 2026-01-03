-- Add missing indexes for foreign key columns
-- These improve performance for JOINs and when deleting/updating parent records

-- manual_funding_opportunities_staging.opportunity_id
CREATE INDEX IF NOT EXISTS idx_mfos_opportunity_id
  ON public.manual_funding_opportunities_staging(opportunity_id);

-- opportunity_processing_paths.existing_opportunity_id
CREATE INDEX IF NOT EXISTS idx_opp_paths_existing_opportunity_id
  ON public.opportunity_processing_paths(existing_opportunity_id);

-- opportunity_processing_paths.funding_source_id
CREATE INDEX IF NOT EXISTS idx_opp_paths_funding_source_id
  ON public.opportunity_processing_paths(funding_source_id);

-- unmatched_locations.opportunity_id
CREATE INDEX IF NOT EXISTS idx_unmatched_locations_opportunity_id
  ON public.unmatched_locations(opportunity_id);
