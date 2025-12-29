-- Migration: Map Geographic RPC Functions
-- Purpose: Support funding map drill-down to counties and utilities
-- Created: 2024-12-22

-- ============================================================================
-- Function 1: Get coverage areas as GeoJSON FeatureCollection
-- Returns all counties OR utilities for a given state with their geometries
-- ============================================================================
CREATE OR REPLACE FUNCTION get_coverage_areas_geojson(
  p_state_code TEXT,
  p_kind TEXT  -- 'county' or 'utility'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', ca.id,
        'properties', json_build_object(
          'id', ca.id,
          'name', ca.name,
          'code', ca.code,
          'kind', ca.kind,
          'state_code', ca.state_code
        ),
        'geometry', ST_AsGeoJSON(ca.geom)::json
      )
    ), '[]'::json)
  )
  INTO result
  FROM coverage_areas ca
  WHERE ca.state_code = p_state_code
    AND ca.kind = p_kind
    AND ca.geom IS NOT NULL;

  RETURN result;
END;
$$;

-- ============================================================================
-- Function 2: Get opportunity counts by coverage area
-- Returns aggregated counts for map coloring
-- ============================================================================
CREATE OR REPLACE FUNCTION get_opportunity_counts_by_coverage_area(
  p_state_code TEXT,
  p_kind TEXT,  -- 'county' or 'utility'
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
  WHERE ca.state_code = p_state_code
    AND ca.kind = p_kind
  GROUP BY ca.id, ca.name, ca.code
  ORDER BY ca.name;
END;
$$;

-- ============================================================================
-- Function 3: Get opportunities for a specific coverage area
-- Supports including parent scope opportunities (state-wide, national)
-- ============================================================================
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
AS $$
DECLARE
  v_state_code TEXT;
  v_area_kind TEXT;
  v_offset INT;
  result JSON;
  total_count BIGINT;
BEGIN
  -- Get the area's state code and kind
  SELECT state_code, kind INTO v_state_code, v_area_kind
  FROM coverage_areas WHERE id = p_area_id;

  v_offset := (p_page - 1) * p_page_size;

  -- Get total count first
  SELECT COUNT(DISTINCT fo.id) INTO total_count
  FROM funding_opportunities fo
  WHERE (
    -- Direct match to the area
    EXISTS (
      SELECT 1 FROM opportunity_coverage_areas oca
      WHERE oca.opportunity_id = fo.id AND oca.coverage_area_id = p_area_id
    )
    -- State-wide opportunities (if requested and area is county/utility)
    OR (p_include_state_scope AND v_area_kind IN ('county', 'utility') AND EXISTS (
      SELECT 1 FROM opportunity_coverage_areas oca
      JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
      WHERE oca.opportunity_id = fo.id
        AND ca.kind = 'state'
        AND ca.state_code = v_state_code
    ))
    -- National opportunities (if requested)
    OR (p_include_national_scope AND fo.is_national = TRUE)
  )
  AND (p_status IS NULL OR fo.status = ANY(p_status))
  AND (p_project_types IS NULL OR fo.project_types && p_project_types);

  -- Get paginated results
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
    WHERE (
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

-- ============================================================================
-- Function 4: Get scope breakdown for a state
-- Returns counts by scope type (national, state-wide, county, utility)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_state_scope_breakdown(
  p_state_code TEXT,
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
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
        AND ca.state_code = p_state_code
        AND fo.is_national = FALSE
        AND (p_status IS NULL OR fo.status = ANY(p_status))
        AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ),
    'county', (
      SELECT COUNT(DISTINCT fo.id)
      FROM funding_opportunities fo
      JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
      JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
      WHERE ca.kind = 'county'
        AND ca.state_code = p_state_code
        AND (p_status IS NULL OR fo.status = ANY(p_status))
        AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ),
    'utility', (
      SELECT COUNT(DISTINCT fo.id)
      FROM funding_opportunities fo
      JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
      JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
      WHERE ca.kind = 'utility'
        AND ca.state_code = p_state_code
        AND (p_status IS NULL OR fo.status = ANY(p_status))
        AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ),
    'state_code', p_state_code
  )
  INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- Function 5: Get national opportunities count
-- For the persistent national banner
-- ============================================================================
CREATE OR REPLACE FUNCTION get_national_opportunities_count(
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result BIGINT;
BEGIN
  SELECT COUNT(DISTINCT fo.id) INTO result
  FROM funding_opportunities fo
  WHERE fo.is_national = TRUE
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  RETURN result;
END;
$$;

-- ============================================================================
-- Function 6: Get national opportunities (paginated)
-- For the National View mode
-- ============================================================================
CREATE OR REPLACE FUNCTION get_national_opportunities(
  p_status TEXT[] DEFAULT NULL,
  p_project_types TEXT[] DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  result JSON;
  total_count BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Get total count
  SELECT COUNT(DISTINCT fo.id) INTO total_count
  FROM funding_opportunities fo
  WHERE fo.is_national = TRUE
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  -- Get paginated results
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
      AND (p_status IS NULL OR fo.status = ANY(p_status))
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    ORDER BY fo.relevance_score DESC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) opp;

  RETURN result;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_coverage_areas_geojson(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_opportunity_counts_by_coverage_area(TEXT, TEXT, TEXT[], TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_opportunities_for_coverage_area(UUID, BOOLEAN, BOOLEAN, TEXT[], TEXT[], INT, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_state_scope_breakdown(TEXT, TEXT[], TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_national_opportunities_count(TEXT[], TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_national_opportunities(TEXT[], TEXT[], INT, INT) TO authenticated, anon;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION get_coverage_areas_geojson IS 'Returns GeoJSON FeatureCollection of counties or utilities for a state';
COMMENT ON FUNCTION get_opportunity_counts_by_coverage_area IS 'Returns opportunity counts per coverage area for map coloring';
COMMENT ON FUNCTION get_opportunities_for_coverage_area IS 'Returns paginated opportunities for a specific area with optional parent scope inclusion';
COMMENT ON FUNCTION get_state_scope_breakdown IS 'Returns opportunity counts by scope type (national, state-wide, county, utility) for a state';
COMMENT ON FUNCTION get_national_opportunities_count IS 'Returns count of national opportunities for the banner';
COMMENT ON FUNCTION get_national_opportunities IS 'Returns paginated national opportunities';
