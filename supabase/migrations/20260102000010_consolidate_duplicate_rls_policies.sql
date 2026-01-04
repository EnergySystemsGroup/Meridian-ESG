-- Migration: Consolidate Duplicate RLS Policies
-- Purpose: Remove duplicate authenticated_select policies, keeping only auth_select
-- Created: 2026-01-02
-- Reason: Migration 1 created authenticated_select, Migration 8 created auth_select
--         Both do the same thing (SELECT TO authenticated USING (true))
--         We keep auth_select as the standard naming convention

-- ============================================================================
-- DROP DUPLICATE authenticated_select POLICIES
-- These were created in migration 20260102000001_security_advisor_fixes.sql
-- We keep auth_select from migration 20260102000008
-- ============================================================================

-- Core Data Tables
DROP POLICY IF EXISTS authenticated_select ON funding_opportunities;
DROP POLICY IF EXISTS authenticated_select ON funding_sources;
DROP POLICY IF EXISTS authenticated_select ON funding_programs;
DROP POLICY IF EXISTS authenticated_select ON coverage_areas;
DROP POLICY IF EXISTS authenticated_select ON opportunity_coverage_areas;

-- Client Tables
DROP POLICY IF EXISTS authenticated_select ON clients;
DROP POLICY IF EXISTS authenticated_select ON unmatched_locations;
DROP POLICY IF EXISTS authenticated_select ON hidden_matches;

-- Reference Tables
DROP POLICY IF EXISTS authenticated_select ON states;
DROP POLICY IF EXISTS authenticated_select ON counties;

-- API Integration Tables
DROP POLICY IF EXISTS authenticated_select ON api_sources;
DROP POLICY IF EXISTS authenticated_select ON api_source_configurations;
DROP POLICY IF EXISTS authenticated_select ON api_raw_responses;
DROP POLICY IF EXISTS authenticated_select ON api_activity_logs;
DROP POLICY IF EXISTS authenticated_select ON api_extracted_opportunities;

-- Agent/Staging Tables
DROP POLICY IF EXISTS authenticated_select ON agent_executions;
DROP POLICY IF EXISTS authenticated_select ON manual_funding_opportunities_staging;

-- Legacy Tables
DROP POLICY IF EXISTS authenticated_select ON opportunity_state_eligibility;
DROP POLICY IF EXISTS authenticated_select ON opportunity_county_eligibility;

-- ============================================================================
-- ENSURE auth_select EXISTS ON ALL TABLES
-- Some tables from migration 1 don't have auth_select yet
-- ============================================================================

-- Tables that only had authenticated_select (not auth_select)
DROP POLICY IF EXISTS auth_select ON funding_programs;
CREATE POLICY auth_select ON funding_programs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON unmatched_locations;
CREATE POLICY auth_select ON unmatched_locations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON api_raw_responses;
CREATE POLICY auth_select ON api_raw_responses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON api_activity_logs;
CREATE POLICY auth_select ON api_activity_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON api_extracted_opportunities;
CREATE POLICY auth_select ON api_extracted_opportunities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON agent_executions;
CREATE POLICY auth_select ON agent_executions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON manual_funding_opportunities_staging;
CREATE POLICY auth_select ON manual_funding_opportunities_staging
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY auth_select ON funding_programs IS
'Authenticated users can read funding programs. Standard auth_select policy.';

COMMENT ON POLICY auth_select ON unmatched_locations IS
'Authenticated users can read unmatched locations. Standard auth_select policy.';
