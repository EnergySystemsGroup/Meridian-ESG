-- Migration: Fix get_funding_by_state_v3 function
-- Purpose: Fix function signature to match API calls, add $30M cap, add project_types filter
-- Created: 2026-01-03
--
-- Problem:
-- - API sends params function doesn't accept (p_source_type, p_min_amount, p_max_amount)
-- - Function missing $30M per-applicant cap (bond programs inflate totals)
-- - No project_types filter support
--
-- Fix:
-- - Accept: p_status, p_categories, p_project_types (matching API needs)
-- - Add $30M cap: LEAST(..., 30000000)
-- - Use SECURITY DEFINER to bypass RLS (anon key access)

-- Drop all possible old signatures (idempotent)
DROP FUNCTION IF EXISTS get_funding_by_state_v3(text,text[]);           -- old 2-param version
DROP FUNCTION IF EXISTS get_funding_by_state_v3(text,text[],text[]);    -- current 3-param version

CREATE OR REPLACE FUNCTION get_funding_by_state_v3(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state_code TEXT,
    state TEXT,
    value NUMERIC,
    opportunities BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
BEGIN
    -- Parse comma-separated status into array (e.g., "Open,Upcoming" -> ARRAY['Open','Upcoming'])
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    -- Get national funding totals (to add to each state) and combine with state-specific
    RETURN QUERY
    WITH national_totals AS (
        SELECT
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000))::NUMERIC AS national_value,
            COUNT(DISTINCT fo.id) AS national_count
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE
          AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
          AND (p_categories IS NULL OR fo.categories && p_categories)
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ),
    -- Get state-specific funding (state/county/utility coverage)
    state_totals AS (
        SELECT
            ca.state_code,
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000))::NUMERIC AS state_value,
            COUNT(DISTINCT fo.id) AS state_count
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind IN ('state', 'county', 'utility')
          AND ca.state_code IS NOT NULL
          AND fo.is_national = FALSE
          AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
          AND (p_categories IS NULL OR fo.categories && p_categories)
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        GROUP BY ca.state_code
    )
    -- Combine: state-specific + national for each state
    SELECT
        s.code::TEXT AS state_code,
        s.name::TEXT AS state,
        (COALESCE(st.state_value, 0) + COALESCE(nt.national_value, 0))::NUMERIC AS value,
        (COALESCE(st.state_count, 0) + COALESCE(nt.national_count, 0))::BIGINT AS opportunities
    FROM states s
    CROSS JOIN national_totals nt
    LEFT JOIN state_totals st ON s.code = st.state_code
    WHERE COALESCE(st.state_count, 0) + COALESCE(nt.national_count, 0) > 0;
END;
$$;

COMMENT ON FUNCTION get_funding_by_state_v3(TEXT, TEXT[], TEXT[]) IS
    'Returns funding totals by state with $30M per-applicant cap. Supports status, categories, and project_types filters.';
