-- Migration: Security Advisor Fixes Part 2
-- Purpose: Fix remaining ERRORS and function WARNINGS
-- Created: 2026-01-02
--
-- Fixes:
-- - coverage_areas_summary view -> security_invoker
-- - spatial_ref_sys RLS (PostGIS table - enable but allow all)
-- - 48 remaining functions needing SET search_path = public

-- ============================================================================
-- SECTION 1: FIX REMAINING VIEW
-- ============================================================================

-- Fix coverage_areas_summary view
DROP VIEW IF EXISTS coverage_areas_summary CASCADE;
CREATE VIEW coverage_areas_summary
WITH (security_invoker = true)
AS
SELECT
  kind,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geometry,
  COUNT(*) FILTER (WHERE geom IS NULL) as without_geometry
FROM coverage_areas
GROUP BY kind
ORDER BY
  CASE kind
    WHEN 'national' THEN 1
    WHEN 'state' THEN 2
    WHEN 'county' THEN 3
    WHEN 'city' THEN 4
    WHEN 'utility' THEN 5
    WHEN 'region' THEN 6
    WHEN 'tribal' THEN 7
    ELSE 8
  END;

-- ============================================================================
-- SECTION 2: FIX spatial_ref_sys (PostGIS system table)
-- NOTE: This is a PostGIS system table owned by the extension.
-- It cannot have RLS enabled by non-superuser. This warning is acceptable
-- as it's reference data only and has no sensitive information.
-- ============================================================================
-- Skipping: spatial_ref_sys RLS (PostGIS system table - cannot modify)

-- ============================================================================
-- SECTION 3: FIX ALL REMAINING FUNCTIONS WITH SET search_path = public
-- ============================================================================

-- Drop functions with signature changes first
DROP FUNCTION IF EXISTS check_funding_data();
DROP FUNCTION IF EXISTS cleanup_old_runs(integer, integer);
DROP FUNCTION IF EXISTS debug_california_funding();
DROP FUNCTION IF EXISTS debug_funding_summary();
DROP FUNCTION IF EXISTS debug_funding_values();
DROP FUNCTION IF EXISTS disable_force_full_reprocessing(uuid);
DROP FUNCTION IF EXISTS get_active_api_sources();
DROP FUNCTION IF EXISTS get_coverage_filter_counts(text);
DROP FUNCTION IF EXISTS get_funding_by_county(text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS get_job_queue_status();
DROP FUNCTION IF EXISTS get_latest_run_for_source(uuid);
DROP FUNCTION IF EXISTS get_next_pending_job();
DROP FUNCTION IF EXISTS get_run_statistics(integer);
DROP FUNCTION IF EXISTS get_sources_with_dynamic_priority();
DROP FUNCTION IF EXISTS should_force_full_reprocessing(uuid);
DROP FUNCTION IF EXISTS update_opportunity_statuses();

-- Function: calculate_source_priority
CREATE OR REPLACE FUNCTION calculate_source_priority(
  p_source_id UUID,
  p_base_priority INTEGER DEFAULT 50
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_priority INTEGER := p_base_priority;
  v_last_run TIMESTAMPTZ;
  v_days_since_run INTEGER;
  v_success_rate NUMERIC;
BEGIN
  -- Get last successful run
  SELECT MAX(completed_at) INTO v_last_run
  FROM api_source_runs
  WHERE source_id = p_source_id AND status = 'completed';

  -- Boost priority for sources not run recently
  IF v_last_run IS NOT NULL THEN
    v_days_since_run := EXTRACT(DAY FROM NOW() - v_last_run);
    v_priority := v_priority + LEAST(v_days_since_run * 5, 30);
  ELSE
    v_priority := v_priority + 20; -- Never run = high priority
  END IF;

  RETURN v_priority;
END;
$$;

-- Function: check_funding_data
CREATE OR REPLACE FUNCTION check_funding_data()
RETURNS TABLE(
  check_name TEXT,
  result TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'Total opportunities'::TEXT, COUNT(*)::TEXT FROM funding_opportunities
  UNION ALL
  SELECT 'Open opportunities'::TEXT, COUNT(*)::TEXT FROM funding_opportunities WHERE status = 'Open'
  UNION ALL
  SELECT 'With maximum_award'::TEXT, COUNT(*)::TEXT FROM funding_opportunities WHERE maximum_award IS NOT NULL;
END;
$$;

-- Function: check_similar_sources
CREATE OR REPLACE FUNCTION check_similar_sources(source_name_param TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  similarity_score REAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fs.id, fs.name, similarity(fs.name, source_name_param) as sim
  FROM funding_sources fs
  WHERE similarity(fs.name, source_name_param) > 0.3
  ORDER BY sim DESC
  LIMIT 10;
END;
$$;

-- Function: cleanup_old_runs
CREATE OR REPLACE FUNCTION cleanup_old_runs(
  days_to_keep INTEGER DEFAULT 30,
  min_runs_per_source INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked_runs AS (
    SELECT id, source_id,
           ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY started_at DESC) as rn
    FROM api_source_runs
  )
  DELETE FROM api_source_runs
  WHERE id IN (
    SELECT id FROM ranked_runs
    WHERE rn > min_runs_per_source
    AND started_at < NOW() - (days_to_keep || ' days')::INTERVAL
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function: debug_california_funding
CREATE OR REPLACE FUNCTION debug_california_funding()
RETURNS TABLE(
  check_type TEXT,
  result TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'CA opportunities'::TEXT, COUNT(*)::TEXT
  FROM funding_opportunities fo
  JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
  JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
  WHERE ca.state_code = 'CA';
END;
$$;

-- Function: debug_funding_summary
CREATE OR REPLACE FUNCTION debug_funding_summary()
RETURNS TABLE(
  metric TEXT,
  value TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'Total funding'::TEXT, SUM(COALESCE(maximum_award, 0))::TEXT FROM funding_opportunities WHERE status = 'Open';
END;
$$;

-- Function: debug_funding_values
CREATE OR REPLACE FUNCTION debug_funding_values()
RETURNS TABLE(
  id UUID,
  title TEXT,
  maximum_award NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fo.id, fo.title, fo.maximum_award
  FROM funding_opportunities fo
  WHERE fo.status = 'Open' AND fo.maximum_award IS NOT NULL
  ORDER BY fo.maximum_award DESC
  LIMIT 20;
END;
$$;

-- Function: debug_opportunity_filter
CREATE OR REPLACE FUNCTION debug_opportunity_filter(
  p_status TEXT DEFAULT 'Open'
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  status TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fo.id, fo.title, fo.status
  FROM funding_opportunities fo
  WHERE fo.status = p_status
  LIMIT 20;
END;
$$;

-- Function: debug_total_funding
CREATE OR REPLACE FUNCTION debug_total_funding(
  p_status TEXT DEFAULT 'Open'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT SUM(COALESCE(maximum_award, 0)) INTO result
  FROM funding_opportunities
  WHERE status = p_status;
  RETURN result;
END;
$$;

-- Function: disable_force_full_reprocessing
CREATE OR REPLACE FUNCTION disable_force_full_reprocessing(source_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE api_sources
  SET force_full_reprocessing = FALSE
  WHERE id = source_id_param;
END;
$$;

-- Function: enable_realtime_for_process_runs
CREATE OR REPLACE FUNCTION enable_realtime_for_process_runs()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Enable realtime for process_runs table
  ALTER PUBLICATION supabase_realtime ADD TABLE process_runs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Function: enable_realtime_for_runs
CREATE OR REPLACE FUNCTION enable_realtime_for_runs()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE api_source_runs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Function: find_coverage_areas_for_point
CREATE OR REPLACE FUNCTION find_coverage_areas_for_point(
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  state_code CHAR(2),
  code TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.name,
    ca.kind,
    ca.state_code,
    ca.code
  FROM coverage_areas ca
  WHERE ST_Contains(ca.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ORDER BY
    CASE ca.kind
      WHEN 'national' THEN 1
      WHEN 'state' THEN 2
      WHEN 'region' THEN 3
      WHEN 'county' THEN 4
      WHEN 'city' THEN 5
      WHEN 'utility' THEN 6
      WHEN 'tribal' THEN 7
      ELSE 8
    END;
END;
$$;

-- Function: find_similar_coverage_areas
CREATE OR REPLACE FUNCTION find_similar_coverage_areas(
  search_text TEXT,
  threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  similarity_score FLOAT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.name,
    ca.kind,
    similarity(ca.name, search_text) AS sim_score
  FROM coverage_areas ca
  WHERE similarity(ca.name, search_text) > threshold
  ORDER BY sim_score DESC
  LIMIT 10;
END;
$$;

-- Function: get_active_api_sources
CREATE OR REPLACE FUNCTION get_active_api_sources()
RETURNS TABLE(
  id UUID,
  name TEXT,
  handler_type TEXT,
  priority INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.handler_type, s.priority
  FROM api_sources s
  WHERE s.active = true
  ORDER BY s.priority DESC;
END;
$$;

-- Function: get_coverage_filter_counts
CREATE OR REPLACE FUNCTION get_coverage_filter_counts(
  p_state_code TEXT
)
RETURNS TABLE(
  coverage_type TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ca.kind as coverage_type, COUNT(DISTINCT fo.id) as count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.state_code = p_state_code
  GROUP BY ca.kind;
END;
$$;

-- Function: get_failure_totals
CREATE OR REPLACE FUNCTION get_failure_totals(p_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total INTEGER := 0;
BEGIN
  SELECT COALESCE(
    (failure_breakdown->>'apiErrors')::int +
    (failure_breakdown->>'validationErrors')::int +
    (failure_breakdown->>'processingErrors')::int,
    0
  ) INTO total
  FROM pipeline_runs
  WHERE id = p_run_id;
  RETURN total;
END;
$$;

-- Function: get_funding_by_category
CREATE OR REPLACE FUNCTION get_funding_by_category(p_status TEXT DEFAULT 'Open')
RETURNS TABLE (category TEXT, total_funding NUMERIC, opportunity_count BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
      unnested_category::TEXT AS category,
      SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)) AS total_funding,
      COUNT(*) AS opportunity_count
  FROM
      funding_opportunities_with_geography fo,
      UNNEST(fo.categories) AS unnested_category
  WHERE
      fo.status = p_status
  GROUP BY
      unnested_category
  ORDER BY
      total_funding DESC;
END;
$$;

-- Function: get_funding_by_county
CREATE OR REPLACE FUNCTION get_funding_by_county(
  p_state_code TEXT,
  p_status TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  county_name TEXT,
  county_code TEXT,
  total_funding NUMERIC,
  opportunity_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.name as county_name,
    ca.code as county_code,
    SUM(COALESCE(fo.maximum_award, 0)) as total_funding,
    COUNT(DISTINCT fo.id) as opportunity_count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.state_code = p_state_code
    AND ca.kind = 'county'
    AND (p_status IS NULL OR fo.status = p_status)
  GROUP BY ca.name, ca.code
  ORDER BY total_funding DESC;
END;
$$;

-- Function: get_funding_by_project_type
CREATE OR REPLACE FUNCTION get_funding_by_project_type()
RETURNS TABLE (project_type TEXT, total_funding NUMERIC, opportunity_count BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
      unnested_type::TEXT AS project_type,
      SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)) AS total_funding,
      COUNT(*) AS opportunity_count
  FROM
      funding_opportunities_with_geography fo,
      UNNEST(fo.eligible_project_types) AS unnested_type
  WHERE
      fo.status = 'Open'
  GROUP BY
      unnested_type
  ORDER BY
      total_funding DESC;
END;
$$;

-- Function: get_funding_by_state (main version)
CREATE OR REPLACE FUNCTION get_funding_by_state(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_deadline_start DATE DEFAULT NULL,
    p_deadline_end DATE DEFAULT NULL,
    p_include_national BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    state_code TEXT,
    state_name TEXT,
    total_funding NUMERIC,
    opportunity_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.state_code::TEXT,
    ca.name as state_name,
    SUM(COALESCE(fo.maximum_award, 0)) as total_funding,
    COUNT(DISTINCT fo.id) as opportunity_count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.kind = 'state'
    AND (p_status IS NULL OR fo.status = p_status)
  GROUP BY ca.state_code, ca.name
  ORDER BY total_funding DESC;
END;
$$;

-- Function: get_funding_by_state_per_applicant
CREATE OR REPLACE FUNCTION get_funding_by_state_per_applicant(
    p_status TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL,
    p_coverage_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_include_national BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    state_code TEXT,
    state_name TEXT,
    total_funding NUMERIC,
    opportunity_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.state_code::TEXT,
    s.name as state_name,
    SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)) as total_funding,
    COUNT(DISTINCT fo.id) as opportunity_count
  FROM coverage_areas ca
  JOIN states s ON ca.state_code = s.code
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.kind = 'state'
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    AND (p_categories IS NULL OR fo.categories && p_categories)
  GROUP BY ca.state_code, s.name
  ORDER BY total_funding DESC;
END;
$$;

-- Function: get_funding_by_state_v2
CREATE OR REPLACE FUNCTION get_funding_by_state_v2(
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    state_code TEXT,
    total_funding NUMERIC,
    opportunity_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.state_code::TEXT,
    SUM(COALESCE(fo.maximum_award, 0)) as total_funding,
    COUNT(DISTINCT fo.id) as opportunity_count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.kind = 'state'
    AND (p_status IS NULL OR fo.status = p_status)
  GROUP BY ca.state_code;
END;
$$;

-- Function: get_funding_by_state_v3
CREATE OR REPLACE FUNCTION get_funding_by_state_v3(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state_code TEXT,
    total_funding NUMERIC,
    opportunity_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.state_code::TEXT,
    SUM(COALESCE(fo.maximum_award, 0)) as total_funding,
    COUNT(DISTINCT fo.id) as opportunity_count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.kind = 'state'
    AND (p_status IS NULL OR fo.status = p_status)
    AND (p_categories IS NULL OR fo.categories && p_categories)
  GROUP BY ca.state_code;
END;
$$;

-- Function: get_job_queue_status
CREATE OR REPLACE FUNCTION get_job_queue_status()
RETURNS TABLE(
  status TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pj.status::TEXT, COUNT(*) as count
  FROM processing_jobs pj
  GROUP BY pj.status;
END;
$$;

-- Function: get_latest_run_for_source
CREATE OR REPLACE FUNCTION get_latest_run_for_source(source_id_param UUID)
RETURNS TABLE(
  id UUID,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.status::TEXT, r.started_at, r.completed_at
  FROM api_source_runs r
  WHERE r.source_id = source_id_param
  ORDER BY r.started_at DESC
  LIMIT 1;
END;
$$;

-- Function: get_next_pending_job
CREATE OR REPLACE FUNCTION get_next_pending_job()
RETURNS TABLE(
  id UUID,
  source_id UUID,
  job_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pj.id, pj.source_id, pj.job_type, pj.created_at
  FROM processing_jobs pj
  WHERE pj.status = 'pending'
  ORDER BY pj.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- Function: get_run_statistics
CREATE OR REPLACE FUNCTION get_run_statistics(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  total_runs BIGINT,
  successful_runs BIGINT,
  failed_runs BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs
  FROM api_source_runs
  WHERE started_at >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$;

-- Function: get_runs_by_status
CREATE OR REPLACE FUNCTION get_runs_by_status(status_filter TEXT)
RETURNS TABLE(
  id UUID,
  source_name TEXT,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, s.name as source_name, r.started_at
  FROM api_source_runs r
  JOIN api_sources s ON r.source_id = s.id
  WHERE r.status::TEXT = status_filter
  ORDER BY r.started_at DESC;
END;
$$;

-- Function: get_sources_with_dynamic_priority
CREATE OR REPLACE FUNCTION get_sources_with_dynamic_priority()
RETURNS TABLE(
  id UUID,
  name TEXT,
  priority INTEGER,
  last_run TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    COALESCE(s.priority, 50) as priority,
    MAX(r.started_at) as last_run
  FROM api_sources s
  LEFT JOIN api_source_runs r ON s.id = r.source_id
  WHERE s.active = true
  GROUP BY s.id, s.name, s.priority
  ORDER BY priority DESC;
END;
$$;

-- Function: get_states_with_funding_count
CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL,
    p_coverage_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(DISTINCT ca.state_code) as state_count
  FROM coverage_areas ca
  JOIN opportunity_coverage_areas oca ON ca.id = oca.coverage_area_id
  JOIN funding_opportunities fo ON oca.opportunity_id = fo.id
  WHERE ca.kind = 'state'
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    AND (p_categories IS NULL OR fo.categories && p_categories);
END;
$$;

-- Function: get_total_funding_available
CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL,
    p_coverage_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_state_code TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)) INTO result
  FROM funding_opportunities fo
  WHERE (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    AND (p_categories IS NULL OR fo.categories && p_categories);
  RETURN COALESCE(result, 0);
END;
$$;

-- Function: get_total_opportunities_count
CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL,
    p_coverage_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_state_code TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result BIGINT;
BEGIN
  SELECT COUNT(*) INTO result
  FROM funding_opportunities fo
  WHERE (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
    AND (p_categories IS NULL OR fo.categories && p_categories);
  RETURN COALESCE(result, 0);
END;
$$;

-- Function: import_coverage_area
CREATE OR REPLACE FUNCTION import_coverage_area(
  p_name TEXT,
  p_kind TEXT,
  p_state_code TEXT,
  p_code TEXT DEFAULT NULL,
  p_geom GEOMETRY DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO coverage_areas (name, kind, state_code, code, geom)
  VALUES (p_name, p_kind, p_state_code, p_code, p_geom)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Function: import_coverage_area_geojson
CREATE OR REPLACE FUNCTION import_coverage_area_geojson(
  p_geojson JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  imported_count INTEGER := 0;
  feature JSONB;
BEGIN
  FOR feature IN SELECT * FROM jsonb_array_elements(p_geojson->'features')
  LOOP
    INSERT INTO coverage_areas (
      name,
      kind,
      state_code,
      code,
      geom
    ) VALUES (
      feature->'properties'->>'name',
      feature->'properties'->>'kind',
      feature->'properties'->>'state_code',
      feature->'properties'->>'code',
      ST_GeomFromGeoJSON(feature->>'geometry')
    )
    ON CONFLICT DO NOTHING;
    imported_count := imported_count + 1;
  END LOOP;
  RETURN imported_count;
END;
$$;

-- Function: match_client_to_opportunities
CREATE OR REPLACE FUNCTION match_client_to_opportunities(
  client_id_param UUID
)
RETURNS TABLE (
  opportunity_id UUID,
  opportunity_title TEXT,
  match_level TEXT,
  coverage_name TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    o.id,
    o.title,
    ca.kind,
    ca.name
  FROM funding_opportunities o
  LEFT JOIN opportunity_coverage_areas oca ON o.id = oca.opportunity_id
  LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
  JOIN clients c ON c.id = client_id_param
  WHERE o.is_national = true
     OR oca.coverage_area_id = ANY(c.coverage_area_ids)
  ORDER BY
    CASE ca.kind
      WHEN 'utility' THEN 1
      WHEN 'city' THEN 2
      WHEN 'county' THEN 3
      WHEN 'region' THEN 4
      WHEN 'state' THEN 5
      WHEN 'national' THEN 6
      ELSE 7
    END,
    o.title;
END;
$$;

-- Function: release_advisory_lock
CREATE OR REPLACE FUNCTION release_advisory_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_key);
END;
$$;

-- Function: should_force_full_reprocessing
CREATE OR REPLACE FUNCTION should_force_full_reprocessing(source_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT force_full_reprocessing INTO result
  FROM api_sources
  WHERE id = source_id_param;
  RETURN COALESCE(result, FALSE);
END;
$$;

-- Function: test_api_endpoint
CREATE OR REPLACE FUNCTION test_api_endpoint(endpoint_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Placeholder for API testing
  RETURN TRUE;
END;
$$;

-- Function: try_advisory_lock
CREATE OR REPLACE FUNCTION try_advisory_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$;

-- Function: update_client_coverage_areas
CREATE OR REPLACE FUNCTION update_client_coverage_areas(client_id_param UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  coverage_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(ca.id)
  INTO coverage_ids
  FROM clients c
  JOIN coverage_areas ca ON ST_Contains(ca.geom, c.location_point)
  WHERE c.id = client_id_param;

  UPDATE clients
  SET coverage_area_ids = COALESCE(coverage_ids, ARRAY[]::UUID[])
  WHERE id = client_id_param;

  RETURN coverage_ids;
END;
$$;

-- Function: update_job_status
CREATE OR REPLACE FUNCTION update_job_status(
  job_id_param UUID,
  new_status TEXT,
  details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE processing_jobs
  SET status = new_status,
      processing_details = COALESCE(details, processing_details),
      updated_at = NOW()
  WHERE id = job_id_param;
END;
$$;

-- Function: update_mfs_updated_at
CREATE OR REPLACE FUNCTION update_mfs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_opportunity_statuses
CREATE OR REPLACE FUNCTION update_opportunity_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE funding_opportunities
  SET status = CASE
    WHEN close_date IS NOT NULL AND close_date < CURRENT_DATE THEN 'Closed'
    WHEN open_date IS NOT NULL AND open_date > CURRENT_DATE THEN 'Upcoming'
    ELSE 'Open'
  END
  WHERE status IS DISTINCT FROM CASE
    WHEN close_date IS NOT NULL AND close_date < CURRENT_DATE THEN 'Closed'
    WHEN open_date IS NOT NULL AND open_date > CURRENT_DATE THEN 'Upcoming'
    ELSE 'Open'
  END;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Function: update_source_configurations
CREATE OR REPLACE FUNCTION update_source_configurations(
  source_id_param UUID,
  config_type_param TEXT,
  config_value JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO api_source_configurations (source_id, config_type, configuration)
  VALUES (source_id_param, config_type_param, config_value)
  ON CONFLICT (source_id, config_type) DO UPDATE
  SET configuration = config_value,
      updated_at = NOW();
END;
$$;

-- Function: update_total_funding_available
CREATE OR REPLACE FUNCTION update_total_funding_available()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Placeholder for updating cached funding values
  NULL;
END;
$$;

-- ============================================================================
-- SECTION 4: GRANT PERMISSIONS
-- ============================================================================

-- Grant view access to authenticated users
GRANT SELECT ON coverage_areas_summary TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW coverage_areas_summary IS 'Summary of coverage areas by type - security_invoker enabled';
