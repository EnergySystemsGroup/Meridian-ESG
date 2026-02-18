-- Migration: Make view universal (remove promotion_status filter) + expose review columns
-- Purpose: All records visible in view; consumers apply their own promotion_status filter.
--          This fixes the detail page coverage gap for pending_review records and lets
--          the admin review API use the view instead of manual enrichment joins.
-- Created: 2026-02-18

-- ============================================================================
-- Recreate view: remove WHERE filter, add promotion_status + review columns
-- ============================================================================
-- Using CREATE OR REPLACE to avoid CASCADE drop of dependent RPC functions.
-- RPCs already have their own independent promotion_status filters (from 20260216000001).
-- Previous definition: 20260216000001_add_promotion_status.sql

CREATE OR REPLACE VIEW funding_opportunities_with_geography
WITH (security_invoker = true)
AS
SELECT
    fo.id,
    fo.title,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
    fo.funding_source_id,
    fo.raw_response_id,
    fo.is_national,
    fo.agency_name,
    fo.funding_type,
    fo.actionable_summary,
    CASE
        WHEN fo.close_date IS NOT NULL AND fo.close_date < CURRENT_DATE THEN 'Closed'::text
        WHEN fo.open_date IS NOT NULL AND fo.open_date > CURRENT_DATE THEN 'Upcoming'::text
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
    fo.notes,
    fo.disbursement_type,
    fo.award_process,
    fo.eligible_activities,
    fo.enhanced_description,
    fo.scoring,
    fo.api_updated_at,
    fo.api_opportunity_id,
    fo.api_source_id,
    fo.program_overview,
    fo.program_use_cases,
    fo.application_summary,
    fo.program_insights,
    COALESCE(fs.name, 'Unknown Source'::text) AS source_display_name,
    COALESCE(fs.type::text, 'Unknown'::text) AS source_type_display,
    -- Legacy columns (deprecated - use coverage_state_codes instead)
    COALESCE(array_agg(DISTINCT s.code) FILTER (WHERE s.code IS NOT NULL), ARRAY[]::text[]::bpchar[]) AS eligible_states,
    COALESCE(array_agg(DISTINCT cs.code) FILTER (WHERE cs.code IS NOT NULL), ARRAY[]::text[]::bpchar[]) AS eligible_counties_states,
    COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), ARRAY[]::text[]) AS eligible_counties,
    -- Coverage area columns (current system)
    COALESCE(array_agg(DISTINCT ca.name) FILTER (WHERE ca.name IS NOT NULL), ARRAY[]::text[]) AS coverage_area_names,
    COALESCE(array_agg(DISTINCT ca.code) FILTER (WHERE ca.code IS NOT NULL), ARRAY[]::text[]) AS coverage_area_codes,
    COALESCE(array_agg(DISTINCT ca.kind) FILTER (WHERE ca.kind IS NOT NULL), ARRAY[]::text[]) AS coverage_area_types,
    -- State codes from coverage areas (replaces eligible_states)
    COALESCE(array_agg(DISTINCT ca.state_code) FILTER (WHERE ca.state_code IS NOT NULL), ARRAY[]::bpchar[]) AS coverage_state_codes,
    -- New columns appended at end (CREATE OR REPLACE requires new columns at end)
    fo.promotion_status,
    fo.reviewed_by,
    fo.reviewed_at,
    fo.review_notes
FROM funding_opportunities fo
LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
LEFT JOIN opportunity_state_eligibility se ON fo.id = se.opportunity_id
LEFT JOIN states s ON se.state_id = s.id
LEFT JOIN opportunity_county_eligibility ce ON fo.id = ce.opportunity_id
LEFT JOIN counties c ON ce.county_id = c.id
LEFT JOIN states cs ON c.state_id = cs.id
LEFT JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
GROUP BY fo.id, fs.name, fs.type;

COMMENT ON VIEW funding_opportunities_with_geography IS
    'Main opportunities view with geographic data. Includes ALL records regardless of promotion_status. Consumer queries must filter promotion_status themselves.';
