-- Migration: Switch from Anon to Authenticated Policies
-- Purpose: Remove anon policies (public access) and add authenticated policies (login required)
-- Created: 2026-01-02
-- Reason: All data should require authentication. API routes use secret key to bypass RLS.

-- ============================================================================
-- STEP 1: REMOVE ANON POLICIES (added in migrations 6 and 7)
-- ============================================================================

-- From migration 20260102000006
DROP POLICY IF EXISTS anon_select ON funding_opportunities;

-- From migration 20260102000007
DROP POLICY IF EXISTS anon_select ON funding_sources;
DROP POLICY IF EXISTS anon_select ON states;
DROP POLICY IF EXISTS anon_select ON counties;
DROP POLICY IF EXISTS anon_select ON coverage_areas;
DROP POLICY IF EXISTS anon_select ON opportunity_coverage_areas;
DROP POLICY IF EXISTS anon_select ON opportunity_state_eligibility;
DROP POLICY IF EXISTS anon_select ON opportunity_county_eligibility;

-- ============================================================================
-- STEP 2: ADD AUTHENTICATED POLICIES
-- These allow logged-in users to read data via client-side Supabase calls
-- API routes with secret key bypass RLS entirely
-- ============================================================================

-- Core Data Tables
DROP POLICY IF EXISTS auth_select ON funding_opportunities;
CREATE POLICY auth_select ON funding_opportunities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON funding_sources;
CREATE POLICY auth_select ON funding_sources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON coverage_areas;
CREATE POLICY auth_select ON coverage_areas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON opportunity_coverage_areas;
CREATE POLICY auth_select ON opportunity_coverage_areas
  FOR SELECT TO authenticated USING (true);

-- Reference Tables
DROP POLICY IF EXISTS auth_select ON states;
CREATE POLICY auth_select ON states
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON counties;
CREATE POLICY auth_select ON counties
  FOR SELECT TO authenticated USING (true);

-- Client Tables
DROP POLICY IF EXISTS auth_select ON clients;
CREATE POLICY auth_select ON clients
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON hidden_matches;
CREATE POLICY auth_select ON hidden_matches
  FOR SELECT TO authenticated USING (true);

-- API & Pipeline Tables (admin pages query these client-side)
DROP POLICY IF EXISTS auth_select ON api_sources;
CREATE POLICY auth_select ON api_sources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON api_source_configurations;
CREATE POLICY auth_select ON api_source_configurations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON api_source_runs;
CREATE POLICY auth_select ON api_source_runs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON pipeline_runs;
CREATE POLICY auth_select ON pipeline_runs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON pipeline_stages;
CREATE POLICY auth_select ON pipeline_stages
  FOR SELECT TO authenticated USING (true);

-- Legacy Tables (keep policies in case views still reference them)
DROP POLICY IF EXISTS auth_select ON opportunity_state_eligibility;
CREATE POLICY auth_select ON opportunity_state_eligibility
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON opportunity_county_eligibility;
CREATE POLICY auth_select ON opportunity_county_eligibility
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY auth_select ON funding_opportunities IS
'Authenticated users can read all opportunities. API routes bypass RLS with secret key.';

COMMENT ON POLICY auth_select ON funding_sources IS
'Authenticated users can read funding sources. API routes bypass RLS with secret key.';

COMMENT ON POLICY auth_select ON api_sources IS
'Authenticated users can read API source configs. Admin pages use client-side Supabase.';

COMMENT ON POLICY auth_select ON api_source_runs IS
'Authenticated users can read run history. Admin pages use client-side Supabase.';

COMMENT ON POLICY auth_select ON pipeline_runs IS
'Authenticated users can read V2 pipeline runs. Admin pages use client-side Supabase.';
