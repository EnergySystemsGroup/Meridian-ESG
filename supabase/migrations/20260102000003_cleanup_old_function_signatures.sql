-- Migration: Cleanup Old Function Signatures
-- Purpose: Drop old function versions that have different signatures and no search_path
-- Created: 2026-01-02
--
-- These old functions were superseded by newer versions with updated signatures

-- Drop old function signatures (different from current versions)
DROP FUNCTION IF EXISTS calculate_source_priority(text, timestamp with time zone);
DROP FUNCTION IF EXISTS check_similar_sources(text, text);
DROP FUNCTION IF EXISTS debug_opportunity_filter(numeric);
DROP FUNCTION IF EXISTS debug_total_funding(numeric);
DROP FUNCTION IF EXISTS get_failure_totals(jsonb);
DROP FUNCTION IF EXISTS get_funding_by_state(text, text, numeric, numeric, text[]);
DROP FUNCTION IF EXISTS get_funding_by_state_per_applicant(text, text, numeric, numeric, text[]);
DROP FUNCTION IF EXISTS get_funding_by_state_v2(text, text, numeric, numeric);
DROP FUNCTION IF EXISTS get_funding_by_state_v3(text, text, numeric, numeric, text[]);
DROP FUNCTION IF EXISTS get_runs_by_status(run_status);
DROP FUNCTION IF EXISTS get_states_with_funding_count(text, text, numeric, numeric, text[]);
DROP FUNCTION IF EXISTS get_total_funding_available(text, text, numeric, numeric, text[], character);
DROP FUNCTION IF EXISTS get_total_opportunities_count(text, text, numeric, numeric, text[]);
DROP FUNCTION IF EXISTS import_coverage_area(text, text, text, character, text, jsonb);
DROP FUNCTION IF EXISTS import_coverage_area_geojson(text, text, text, character, text, jsonb);
DROP FUNCTION IF EXISTS import_coverage_area_geojson(text, text, text, character, text, jsonb, integer);
DROP FUNCTION IF EXISTS release_advisory_lock(integer);
DROP FUNCTION IF EXISTS test_api_endpoint(uuid);
DROP FUNCTION IF EXISTS try_advisory_lock(integer);
DROP FUNCTION IF EXISTS update_job_status(uuid, text, jsonb, integer, integer, numeric);
DROP FUNCTION IF EXISTS update_source_configurations(uuid, jsonb);

-- Note: The current correct versions of these functions already exist with
-- SET search_path = public from migration 20260102000002
