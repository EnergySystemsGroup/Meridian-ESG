-- Migration: Fix get_state_scope_breakdown for nationwide view
-- Purpose: Handle 'US' state_code to aggregate across all states instead of filtering
-- Created: 2026-01-03
--
-- Problem: When stateCode='US', function filters by ca.state_code='US' which matches nothing
-- Fix: When p_state_code = 'US' or NULL, aggregate across all states

DROP FUNCTION IF EXISTS get_state_scope_breakdown(text, text[], text[]);

CREATE OR REPLACE FUNCTION get_state_scope_breakdown(
    p_state_code TEXT,
    p_status TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    is_nationwide BOOLEAN;
BEGIN
    -- Check if this is a nationwide query
    is_nationwide := (p_state_code IS NULL OR p_state_code = 'US');

    SELECT json_build_object(
        'national', (
            SELECT COUNT(DISTINCT fo.id)
            FROM funding_opportunities fo
            WHERE fo.is_national = TRUE
              AND (p_status IS NULL OR fo.status = ANY(p_status))
              AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        ),
        'state_wide', (
            SELECT COUNT(DISTINCT fo.id)
            FROM funding_opportunities fo
            JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
            JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
            WHERE ca.kind = 'state'
              AND fo.is_national = FALSE
              AND (is_nationwide OR ca.state_code = p_state_code)
              AND (p_status IS NULL OR fo.status = ANY(p_status))
              AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        ),
        'county', (
            SELECT COUNT(DISTINCT fo.id)
            FROM funding_opportunities fo
            JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
            JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
            WHERE ca.kind = 'county'
              AND (is_nationwide OR ca.state_code = p_state_code)
              AND (p_status IS NULL OR fo.status = ANY(p_status))
              AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        ),
        'utility', (
            SELECT COUNT(DISTINCT fo.id)
            FROM funding_opportunities fo
            JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
            JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
            WHERE ca.kind = 'utility'
              AND (is_nationwide OR ca.state_code = p_state_code)
              AND (p_status IS NULL OR fo.status = ANY(p_status))
              AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        ),
        'state_code', p_state_code
    )
    INTO result;

    RETURN result;
END;
$$;

COMMENT ON FUNCTION get_state_scope_breakdown(TEXT, TEXT[], TEXT[]) IS
    'Returns opportunity counts by scope type. When state_code is US or NULL, aggregates across all states.';
