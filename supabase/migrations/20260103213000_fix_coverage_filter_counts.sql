-- Migration: Fix get_coverage_filter_counts function
-- Purpose: Restore original working logic that was broken by security advisor migration
-- Created: 2026-01-03
--
-- Problem: Security fix (20260102000002) replaced working function with broken version:
--   1. Changed column name from 'opportunity_count' to 'count' (broke API)
--   2. Removed NULL state handling (broke nationwide view)
--   3. Removed national opportunities counting
--
-- Fix: Restore original logic from 20251210000002 + keep security improvements

DROP FUNCTION IF EXISTS get_coverage_filter_counts(text);

CREATE OR REPLACE FUNCTION get_coverage_filter_counts(
    p_state_code TEXT DEFAULT NULL
)
RETURNS TABLE(
    coverage_type TEXT,
    opportunity_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_state_code IS NOT NULL AND p_state_code <> '' THEN
        -- Counts for a specific state
        RETURN QUERY
        SELECT 'national'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE

        UNION ALL

        SELECT 'state'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state' AND ca.state_code = p_state_code

        UNION ALL

        SELECT 'local'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind IN ('county', 'utility') AND ca.state_code = p_state_code;
    ELSE
        -- Counts for nationwide (no state filter)
        RETURN QUERY
        SELECT 'national'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE

        UNION ALL

        SELECT 'state'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state'

        UNION ALL

        SELECT 'local'::TEXT, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind IN ('county', 'utility');
    END IF;
END;
$$;

COMMENT ON FUNCTION get_coverage_filter_counts(TEXT) IS
    'Returns opportunity counts by coverage type (national, state, local). Supports both state-specific and nationwide queries.';
