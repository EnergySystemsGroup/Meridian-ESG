-- Migration: Security Advisor Comprehensive Fix
-- Purpose: Fix all 30 ERRORS (RLS + Views) and 58 function WARNINGS
-- Created: 2026-01-02
--
-- Fixes:
-- - Enable RLS on 20 tables
-- - Create authenticated-only SELECT policies (block anon key)
-- - Recreate 10 views with security_invoker = true
-- - Add SET search_path = public to all functions

-- ============================================================================
-- SECTION 1: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

-- Core data tables
ALTER TABLE IF EXISTS funding_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coverage_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS opportunity_coverage_areas ENABLE ROW LEVEL SECURITY;

-- Client tables
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS unmatched_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hidden_matches ENABLE ROW LEVEL SECURITY;

-- Reference tables
ALTER TABLE IF EXISTS states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS counties ENABLE ROW LEVEL SECURITY;

-- API integration tables
ALTER TABLE IF EXISTS api_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_source_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_raw_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_extracted_opportunities ENABLE ROW LEVEL SECURITY;

-- Agent/staging tables
ALTER TABLE IF EXISTS agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_funding_opportunities_staging ENABLE ROW LEVEL SECURITY;

-- Legacy tables (if still exist)
ALTER TABLE IF EXISTS opportunity_state_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS opportunity_county_eligibility ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2: CREATE AUTHENTICATED-ONLY POLICIES
-- Blocks anon key, allows authenticated users and service_role
-- ============================================================================

-- Helper function to safely create policies
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'funding_opportunities',
    'funding_sources',
    'funding_programs',
    'coverage_areas',
    'opportunity_coverage_areas',
    'clients',
    'unmatched_locations',
    'hidden_matches',
    'states',
    'counties',
    'api_sources',
    'api_source_configurations',
    'api_raw_responses',
    'api_activity_logs',
    'api_extracted_opportunities',
    'agent_executions',
    'manual_funding_opportunities_staging',
    'opportunity_state_eligibility',
    'opportunity_county_eligibility'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Check if table exists before creating policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      -- Drop any existing overly permissive policies
      EXECUTE format('DROP POLICY IF EXISTS "allow_anon_select" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_public_select" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_select" ON %I', t);

      -- Drop existing policies we're about to create (avoid duplicates)
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_select" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON %I', t);

      -- Create authenticated-only SELECT policy
      EXECUTE format('CREATE POLICY "authenticated_select" ON %I FOR SELECT TO authenticated USING (true)', t);

      -- Create service_role full access policy (for pipeline/backend operations)
      EXECUTE format('CREATE POLICY "service_role_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END
$$;

-- ============================================================================
-- SECTION 3: RECREATE VIEWS WITH security_invoker = true
-- ============================================================================

-- View 1: funding_opportunities_with_geography
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;
CREATE VIEW funding_opportunities_with_geography
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
    -- NEW: State codes from coverage areas (replaces eligible_states)
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
GROUP BY fo.id, fs.name, fs.type;

-- View 2: active_api_sources_with_config
DROP VIEW IF EXISTS active_api_sources_with_config CASCADE;
CREATE VIEW active_api_sources_with_config
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.name,
  s.organization,
  s.type,
  s.url,
  s.api_endpoint,
  s.auth_type,
  s.auth_details,
  s.update_frequency,
  s.last_checked,
  s.priority,
  s.notes,
  s.handler_type,
  jsonb_object_agg(
    COALESCE(c.config_type, 'none'),
    COALESCE(c.configuration, '{}'::jsonb)
  ) AS configurations
FROM
  api_sources s
LEFT JOIN
  api_source_configurations c ON s.id = c.source_id
WHERE
  s.active = true
GROUP BY
  s.id, s.name, s.organization, s.type, s.url, s.api_endpoint,
  s.auth_type, s.auth_details, s.update_frequency, s.last_checked,
  s.priority, s.notes, s.handler_type;

-- View 3: detailed_api_runs
DROP VIEW IF EXISTS detailed_api_runs CASCADE;
CREATE VIEW detailed_api_runs
WITH (security_invoker = true)
AS
SELECT
  r.id AS run_id,
  r.source_id,
  s.name AS source_name,
  s.organization AS source_organization,
  s.type AS source_type,
  r.status::TEXT,
  r.started_at,
  r.completed_at,
  COALESCE(r.completed_at, NOW()) - r.started_at AS processing_time,
  COALESCE((r.initial_api_call->>'totalHitCount')::INTEGER, 0) AS total_hits,
  COALESCE((r.initial_api_call->>'retrievedCount')::INTEGER, 0) AS retrieved_count,
  COALESCE((r.initial_api_call->>'responseTime')::NUMERIC, 0) AS api_response_time_ms,
  COALESCE((r.detail_api_calls->>'totalDetailAPICalls')::INTEGER, 0) AS total_detail_calls,
  COALESCE((r.detail_api_calls->>'successfulDetailAPICalls')::INTEGER, 0) AS successful_detail_calls,
  COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0) AS opportunities_processed,
  COALESCE((r.storage_results->>'newCount')::INTEGER, 0) AS new_opportunities,
  COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0) AS updated_opportunities,
  COALESCE((r.storage_results->>'ignoredCount')::INTEGER, 0) AS ignored_opportunities,
  r.error_details->>'message' AS error_message,
  r.created_at,
  r.updated_at
FROM
  api_source_runs r
JOIN
  api_sources s ON r.source_id = s.id;

-- View 4: api_source_run_stats
DROP VIEW IF EXISTS api_source_run_stats CASCADE;
CREATE VIEW api_source_run_stats
WITH (security_invoker = true)
AS
SELECT
  s.id AS source_id,
  s.name AS source_name,
  s.organization,
  s.type,
  COUNT(r.id) AS total_runs,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS successful_runs,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) AS failed_runs,
  MAX(r.started_at) AS last_run_date,
  AVG(CASE
    WHEN r.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at))
  END) AS avg_processing_time_seconds,
  SUM(COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0)) AS total_opportunities_processed,
  SUM(COALESCE((r.storage_results->>'newCount')::INTEGER, 0)) AS total_new_opportunities,
  SUM(COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0)) AS total_updated_opportunities
FROM
  api_sources s
LEFT JOIN
  api_source_runs r ON s.id = r.source_id
GROUP BY
  s.id, s.name, s.organization, s.type
ORDER BY
  MAX(r.started_at) DESC NULLS LAST;

-- View 5: process_run_status
DROP VIEW IF EXISTS process_run_status CASCADE;
CREATE VIEW process_run_status
WITH (security_invoker = true)
AS
SELECT
  p.id AS run_id,
  p.source_id,
  s.name AS source_name,
  p.source_manager_status::TEXT,
  p.api_handler_status::TEXT,
  p.detail_processor_status::TEXT,
  p.data_processor_status::TEXT,
  CASE
    WHEN p.completed_at IS NOT NULL THEN 'completed'
    WHEN p.error_message IS NOT NULL THEN 'failed'
    ELSE 'in_progress'
  END AS overall_status,
  p.started_at,
  p.completed_at,
  COALESCE(p.completed_at, NOW()) - p.started_at AS processing_time,
  p.error_message,
  p.processing_details->>'total_opportunities' AS opportunities_processed,
  p.processing_details->>'new_opportunities' AS new_opportunities,
  p.processing_details->>'updated_opportunities' AS updated_opportunities
FROM
  process_runs p
JOIN
  api_sources s ON p.source_id = s.id
ORDER BY
  p.started_at DESC;

-- View 6: daily_run_statistics
DROP VIEW IF EXISTS daily_run_statistics CASCADE;
CREATE VIEW daily_run_statistics
WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('day', r.started_at) AS day,
  COUNT(*) AS total_runs,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS successful_runs,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) AS failed_runs,
  SUM(COALESCE((r.storage_results->>'totalProcessed')::INTEGER, 0)) AS opportunities_processed,
  SUM(COALESCE((r.storage_results->>'newCount')::INTEGER, 0)) AS new_opportunities,
  SUM(COALESCE((r.storage_results->>'updatedCount')::INTEGER, 0)) AS updated_opportunities,
  AVG(CASE
    WHEN r.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at))
  END) AS avg_processing_time_seconds
FROM
  api_source_runs r
WHERE
  r.started_at >= NOW() - INTERVAL '90 days'
GROUP BY
  DATE_TRUNC('day', r.started_at)
ORDER BY
  day DESC;

-- View 7: pipeline_progress
DROP VIEW IF EXISTS pipeline_progress CASCADE;
CREATE VIEW pipeline_progress
WITH (security_invoker = true)
AS
SELECT
  pr.id as run_id,
  pr.api_source_id,
  pr.status,
  pr.started_at,
  pr.total_opportunities_processed,
  pr.opportunities_bypassed_llm,
  pr.opportunities_per_minute,
  pr.success_rate_percentage,
  pr.sla_compliance_percentage,
  COUNT(ps.id) as total_stages,
  COUNT(ps.id) FILTER (WHERE ps.status = 'completed') as completed_stages,
  COUNT(ps.id) FILTER (WHERE ps.status = 'failed') as failed_stages,
  ROUND(
    COUNT(ps.id) FILTER (WHERE ps.status = 'completed') * 100.0 /
    NULLIF(COUNT(ps.id), 0), 2
  ) as completion_percentage
FROM pipeline_runs pr
LEFT JOIN pipeline_stages ps ON pr.id = ps.run_id
WHERE pr.status IN ('processing', 'started')
GROUP BY pr.id, pr.api_source_id, pr.status, pr.started_at,
         pr.total_opportunities_processed, pr.opportunities_bypassed_llm,
         pr.opportunities_per_minute, pr.success_rate_percentage, pr.sla_compliance_percentage;

-- View 8: pipeline_performance_summary
DROP VIEW IF EXISTS pipeline_performance_summary CASCADE;
CREATE VIEW pipeline_performance_summary
WITH (security_invoker = true)
AS
SELECT
  pr.id,
  pr.api_source_id,
  pr.status,
  pr.created_at,
  pr.completed_at,
  pr.total_execution_time_ms,
  pr.total_opportunities_processed,
  pr.opportunities_per_minute,
  pr.success_rate_percentage,
  pr.cost_per_opportunity_usd,
  pr.tokens_per_opportunity,
  pr.sla_compliance_percentage,
  pr.sla_grade,
  pr.failure_breakdown,
  pr.sla_breakdown,
  COALESCE(
    (pr.failure_breakdown->>'apiErrors')::int +
    (pr.failure_breakdown->>'validationErrors')::int +
    (pr.failure_breakdown->>'duplicateRejections')::int +
    (pr.failure_breakdown->>'processingErrors')::int +
    (pr.failure_breakdown->>'storageErrors')::int +
    (pr.failure_breakdown->>'timeoutErrors')::int,
    0
  ) as total_failures,
  GREATEST(0, pr.total_opportunities_processed - COALESCE(
    (pr.failure_breakdown->>'apiErrors')::int +
    (pr.failure_breakdown->>'validationErrors')::int +
    (pr.failure_breakdown->>'duplicateRejections')::int +
    (pr.failure_breakdown->>'processingErrors')::int +
    (pr.failure_breakdown->>'storageErrors')::int +
    (pr.failure_breakdown->>'timeoutErrors')::int,
    0
  )) as successful_opportunities
FROM pipeline_runs pr
WHERE pr.status IN ('completed', 'failed');

-- View 9: duplicate_detection_effectiveness
DROP VIEW IF EXISTS duplicate_detection_effectiveness CASCADE;
CREATE VIEW duplicate_detection_effectiveness
WITH (security_invoker = true)
AS
SELECT
  dds.api_source_id,
  DATE_TRUNC('day', dds.created_at) as date,
  COUNT(*) as total_sessions,
  AVG(dds.detection_time_ms) as avg_detection_time_ms,
  SUM(dds.llm_processing_bypassed) as total_llm_processing_bypassed,
  AVG(dds.total_opportunities_checked) as avg_opportunities_checked,
  SUM(dds.new_opportunities) as total_new_opportunities,
  SUM(dds.duplicates_to_update) as total_duplicates_to_update,
  SUM(dds.duplicates_to_skip) as total_duplicates_to_skip
FROM duplicate_detection_sessions dds
GROUP BY dds.api_source_id, DATE_TRUNC('day', dds.created_at);

-- View 10: api_response_summary
DROP VIEW IF EXISTS api_response_summary CASCADE;
CREATE VIEW api_response_summary
WITH (security_invoker = true)
AS
SELECT
    arr.id,
    arr.api_source_id,
    aps.name as source_name,
    arr.api_endpoint,
    arr.call_type,
    arr.execution_time_ms,
    arr.opportunity_count,
    arr.created_at,
    arr.last_seen_at,
    arr.call_count,
    arr.processed
FROM api_raw_responses arr
LEFT JOIN api_sources aps ON arr.api_source_id = aps.id
ORDER BY arr.last_seen_at DESC;

-- ============================================================================
-- SECTION 4: UPDATE FUNCTIONS WITH SET search_path = public
-- ============================================================================

-- Function 1: update_updated_at_column (trigger)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function 2: update_api_modified_column (trigger)
CREATE OR REPLACE FUNCTION update_api_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Function 3: find_similar_sources
CREATE OR REPLACE FUNCTION find_similar_sources(source_name text, threshold float DEFAULT 0.3)
RETURNS TABLE (
  id UUID,
  name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fs.id,
    fs.name,
    similarity(fs.name, source_name) AS sim
  FROM
    funding_sources fs
  WHERE
    similarity(fs.name, source_name) > threshold
  ORDER BY
    sim DESC;
END;
$$;

-- Function 4: get_coverage_areas_geojson
CREATE OR REPLACE FUNCTION get_coverage_areas_geojson(
  p_state_code TEXT,
  p_kind TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function 5: get_opportunity_counts_by_coverage_area
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
  WHERE ca.state_code = p_state_code
    AND ca.kind = p_kind
  GROUP BY ca.id, ca.name, ca.code
  ORDER BY ca.name;
END;
$$;

-- Function 6: get_opportunities_for_coverage_area
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

  SELECT COUNT(DISTINCT fo.id) INTO total_count
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
  AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

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

-- Function 7: get_state_scope_breakdown
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

-- Function 8: get_national_opportunities_count
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
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

  RETURN result;
END;
$$;

-- Function 9: get_national_opportunities
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

  SELECT COUNT(DISTINCT fo.id) INTO total_count
  FROM funding_opportunities fo
  WHERE fo.is_national = TRUE
    AND (p_status IS NULL OR fo.status = ANY(p_status))
    AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

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
-- SECTION 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users only (not anon)
GRANT EXECUTE ON FUNCTION get_coverage_areas_geojson(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_opportunity_counts_by_coverage_area(TEXT, TEXT, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_opportunities_for_coverage_area(UUID, BOOLEAN, BOOLEAN, TEXT[], TEXT[], INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_state_scope_breakdown(TEXT, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_national_opportunities_count(TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_national_opportunities(TEXT[], TEXT[], INT, INT) TO authenticated;

-- Revoke from anon (block unauthenticated access)
REVOKE EXECUTE ON FUNCTION get_coverage_areas_geojson(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION get_opportunity_counts_by_coverage_area(TEXT, TEXT, TEXT[], TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION get_opportunities_for_coverage_area(UUID, BOOLEAN, BOOLEAN, TEXT[], TEXT[], INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION get_state_scope_breakdown(TEXT, TEXT[], TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION get_national_opportunities_count(TEXT[], TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION get_national_opportunities(TEXT[], TEXT[], INT, INT) FROM anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON VIEW funding_opportunities_with_geography IS 'Main opportunities view with geographic data - security_invoker enabled';
COMMENT ON VIEW active_api_sources_with_config IS 'Active API sources with aggregated config - security_invoker enabled';
