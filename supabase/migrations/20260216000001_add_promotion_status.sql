-- Migration: Add promotion_status column + filter view & RPCs
-- Purpose: Gate manual pipeline records from dashboard until admin review
-- Created: 2026-02-16
--
-- promotion_status values:
--   NULL           = API records (visible by default)
--   'pending_review' = manual pipeline records awaiting review (hidden)
--   'promoted'     = manually approved records (visible)
--   'rejected'     = manually rejected records (hidden)
--
-- Strategy:
--   1. Add column to funding_opportunities
--   2. Recreate view with WHERE filter (CREATE OR REPLACE — no CASCADE needed)
--   3. Recreate all RPC functions that query funding_opportunities directly
--      (get_funding_opportunities_dynamic_sort queries the view, so it auto-filters)

-- ============================================================================
-- PART A: Add promotion_status column
-- ============================================================================

ALTER TABLE funding_opportunities
ADD COLUMN IF NOT EXISTS promotion_status text DEFAULT NULL;

COMMENT ON COLUMN funding_opportunities.promotion_status IS
  'Review gate for manual pipeline. NULL=API (visible), pending_review=manual (hidden), promoted=approved (visible), rejected=rejected (hidden)';

-- ============================================================================
-- PART B: Recreate view with promotion_status filter
-- ============================================================================
-- Using CREATE OR REPLACE to avoid CASCADE drop of dependent functions.
-- Column list is unchanged; only adding WHERE filter before GROUP BY.
-- Latest definition from: 20260102000001_security_advisor_fixes.sql

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
    COALESCE(array_agg(DISTINCT ca.state_code) FILTER (WHERE ca.state_code IS NOT NULL), ARRAY[]::bpchar[]) AS coverage_state_codes
FROM funding_opportunities fo
LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
LEFT JOIN opportunity_state_eligibility se ON fo.id = se.opportunity_id
LEFT JOIN states s ON se.state_id = s.id
LEFT JOIN opportunity_county_eligibility ce ON fo.id = ce.opportunity_id
LEFT JOIN counties c ON ce.county_id = c.id
LEFT JOIN states cs ON c.state_id = cs.id
LEFT JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
WHERE (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
GROUP BY fo.id, fs.name, fs.type;

-- ============================================================================
-- PART C: Update RPC functions with promotion_status filter
-- ============================================================================

-- ----------------------------------------------------------------------------
-- C1: get_funding_by_state_v3
-- Latest from: 20260103210000_fix_funding_by_state_v3.sql
-- ----------------------------------------------------------------------------

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
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    RETURN QUERY
    WITH national_totals AS (
        SELECT
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000))::NUMERIC AS national_value,
            COUNT(DISTINCT fo.id) AS national_count
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE
          AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
          AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
          AND (p_categories IS NULL OR fo.categories && p_categories)
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ),
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
          AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
          AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
          AND (p_categories IS NULL OR fo.categories && p_categories)
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
        GROUP BY ca.state_code
    )
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
    'Returns funding totals by state with $30M cap and promotion_status filter.';

-- ----------------------------------------------------------------------------
-- C2: get_total_funding_available
-- Latest from: 20260103211000_fix_summary_functions.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_total NUMERIC;
BEGIN
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    SELECT COALESCE(SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)), 0)
    INTO v_total
    FROM funding_opportunities fo
    WHERE (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
      AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION get_total_funding_available(TEXT, TEXT[], TEXT[]) IS
    'Returns total funding available with $30M cap and promotion_status filter.';

-- ----------------------------------------------------------------------------
-- C3: get_total_opportunities_count
-- Latest from: 20260103211000_fix_summary_functions.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_count BIGINT;
BEGIN
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    SELECT COUNT(DISTINCT fo.id)
    INTO v_count
    FROM funding_opportunities fo
    WHERE (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
      AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_total_opportunities_count(TEXT, TEXT[], TEXT[]) IS
    'Returns total count of funding opportunities with promotion_status filter.';

-- ----------------------------------------------------------------------------
-- C4: get_states_with_funding_count
-- Latest from: 20260103211000_fix_summary_functions.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_count BIGINT;
BEGIN
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    SELECT COUNT(DISTINCT ca.state_code)
    INTO v_count
    FROM funding_opportunities fo
    JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
    JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
    WHERE ca.state_code IS NOT NULL
      AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
      AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_states_with_funding_count(TEXT, TEXT[], TEXT[]) IS
    'Returns count of states with funding opportunities with promotion_status filter.';

-- ----------------------------------------------------------------------------
-- C5: get_opportunity_counts_by_coverage_area
-- Latest from: 20260102000001_security_advisor_fixes.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_opportunity_counts_by_coverage_area(
  p_state_code TEXT,
  p_kind TEXT,
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  area_id UUID,
  area_name TEXT,
  area_code TEXT,
  opportunity_count BIGINT,
  total_funding NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id as area_id,
    ca.name as area_name,
    ca.code as area_code,
    COUNT(DISTINCT fo.id) as opportunity_count,
    COALESCE(SUM(fo.maximum_award), 0) as total_funding
  FROM coverage_areas ca
  LEFT JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  LEFT JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
  WHERE ca.state_code = p_state_code
    AND ca.kind = p_kind
  GROUP BY ca.id, ca.name, ca.code
  ORDER BY ca.name;
END;
$$;

-- ----------------------------------------------------------------------------
-- C6: get_opportunities_for_coverage_area
-- Latest from: 20260102000001_security_advisor_fixes.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_opportunities_for_coverage_area(
  p_area_id UUID,
  p_include_state_scope BOOLEAN DEFAULT TRUE,
  p_include_national_scope BOOLEAN DEFAULT TRUE,
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state_code TEXT;
  v_area_kind TEXT;
  v_offset INT;
  result JSON;
  total_count BIGINT;
BEGIN
  SELECT state_code, kind INTO v_state_code, v_area_kind
  FROM coverage_areas WHERE id = p_area_id;

  v_offset := (p_page - 1) * p_page_size;

  -- Count query with promotion_status filter
  SELECT COUNT(DISTINCT fo.id) INTO total_count
  FROM funding_opportunities fo
  WHERE (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
    AND (
      EXISTS (
        SELECT 1 FROM opportunity_coverage_areas oca
        WHERE oca.opportunity_id = fo.id AND oca.coverage_area_id = p_area_id
      )
      OR (p_include_state_scope AND v_area_kind IN ('county', 'utility') AND EXISTS (
        SELECT 1 FROM opportunity_coverage_areas oca
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE oca.opportunity_id = fo.id
          AND ca.kind = 'state'
          AND ca.state_code = v_state_code
      ))
      OR (p_include_national_scope AND fo.is_national = TRUE)
    )
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  -- Data query with promotion_status filter
  SELECT json_build_object(
    'opportunities', COALESCE(json_agg(opp ORDER BY opp.relevance_score DESC NULLS LAST), '[]'::json),
    'total', total_count,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(total_count::FLOAT / p_page_size)
  )
  INTO result
  FROM (
    SELECT DISTINCT ON (fo.id)
      fo.id,
      fo.title,
      fo.actionable_summary as summary,
      fo.status,
      fo.close_date,
      fo.minimum_award,
      fo.maximum_award,
      fo.eligible_project_types as project_types,
      fo.is_national,
      fo.relevance_score,
      fo.url as source_url,
      fo.created_at,
      CASE
        WHEN fo.is_national THEN 'national'
        WHEN EXISTS (
          SELECT 1 FROM opportunity_coverage_areas oca
          JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
          WHERE oca.opportunity_id = fo.id AND ca.id = p_area_id
        ) THEN v_area_kind
        ELSE 'state'
      END as scope
    FROM funding_opportunities fo
    WHERE (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
      AND (
        EXISTS (
          SELECT 1 FROM opportunity_coverage_areas oca
          WHERE oca.opportunity_id = fo.id AND oca.coverage_area_id = p_area_id
        )
        OR (p_include_state_scope AND v_area_kind IN ('county', 'utility') AND EXISTS (
          SELECT 1 FROM opportunity_coverage_areas oca
          JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
          WHERE oca.opportunity_id = fo.id
            AND ca.kind = 'state'
            AND ca.state_code = v_state_code
        ))
        OR (p_include_national_scope AND fo.is_national = TRUE)
      )
      AND (p_status IS NULL OR fo.status = ANY(p_status))
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ORDER BY fo.id, fo.relevance_score DESC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) opp;

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- C7: get_state_scope_breakdown
-- Latest from: 20260103212000_fix_scope_breakdown_nationwide.sql
-- ----------------------------------------------------------------------------

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
    is_nationwide := (p_state_code IS NULL OR p_state_code = 'US');

    SELECT json_build_object(
        'national', (
            SELECT COUNT(DISTINCT fo.id)
            FROM funding_opportunities fo
            WHERE fo.is_national = TRUE
              AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
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
              AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
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
              AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
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
              AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
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
    'Returns opportunity counts by scope type with promotion_status filter. When state_code is US or NULL, aggregates across all states.';

-- ----------------------------------------------------------------------------
-- C8: get_national_opportunities_count
-- Latest from: 20260102000001_security_advisor_fixes.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_national_opportunities_count(
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BIGINT;
BEGIN
  SELECT COUNT(DISTINCT fo.id) INTO result
  FROM funding_opportunities fo
  WHERE fo.is_national = TRUE
    AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- C9: get_national_opportunities
-- Latest from: 20260102000001_security_advisor_fixes.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_national_opportunities(
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  result JSON;
  total_count BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Count with promotion_status filter
  SELECT COUNT(DISTINCT fo.id) INTO total_count
  FROM funding_opportunities fo
  WHERE fo.is_national = TRUE
    AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  -- Data with promotion_status filter
  SELECT json_build_object(
    'opportunities', COALESCE(json_agg(opp ORDER BY opp.relevance_score DESC NULLS LAST), '[]'::json),
    'total', total_count,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(total_count::FLOAT / p_page_size)
  )
  INTO result
  FROM (
    SELECT
      fo.id,
      fo.title,
      fo.actionable_summary as summary,
      fo.status,
      fo.close_date,
      fo.minimum_award,
      fo.maximum_award,
      fo.eligible_project_types as project_types,
      fo.is_national,
      fo.relevance_score,
      fo.url as source_url,
      fo.created_at,
      'national' as scope
    FROM funding_opportunities fo
    WHERE fo.is_national = TRUE
      AND (fo.promotion_status IS NULL OR fo.promotion_status = 'promoted')
      AND (p_status IS NULL OR fo.status = ANY(p_status))
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ORDER BY fo.relevance_score DESC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) opp;

  RETURN result;
END;
$$;

-- ============================================================================
-- PART D: Comments
-- ============================================================================
COMMENT ON VIEW funding_opportunities_with_geography IS
    'Main opportunities view with geographic data - filters out pending_review/rejected records via promotion_status';
