-- Migration: Add Anon Policies for Public Dashboard
-- Purpose: Ensure anonymous users can read all data needed for public dashboard/map
-- Created: 2026-01-02
-- Reason: Views join multiple tables; all need anon SELECT for data to be visible

-- ============================================================================
-- CORE DATA TABLES (needed for dashboard view to show complete data)
-- ============================================================================

-- funding_sources: Shows source name/type in opportunity listings
DROP POLICY IF EXISTS anon_select ON funding_sources;
CREATE POLICY anon_select ON funding_sources
  FOR SELECT TO anon USING (true);

-- states: Reference data for geographic filtering
DROP POLICY IF EXISTS anon_select ON states;
CREATE POLICY anon_select ON states
  FOR SELECT TO anon USING (true);

-- counties: Reference data for geographic filtering
DROP POLICY IF EXISTS anon_select ON counties;
CREATE POLICY anon_select ON counties
  FOR SELECT TO anon USING (true);

-- coverage_areas: Geographic coverage for opportunities
DROP POLICY IF EXISTS anon_select ON coverage_areas;
CREATE POLICY anon_select ON coverage_areas
  FOR SELECT TO anon USING (true);

-- opportunity_coverage_areas: Junction table for opportunity ↔ coverage
DROP POLICY IF EXISTS anon_select ON opportunity_coverage_areas;
CREATE POLICY anon_select ON opportunity_coverage_areas
  FOR SELECT TO anon USING (true);

-- ============================================================================
-- LEGACY TABLES (deprecated but still referenced in view)
-- ============================================================================

-- opportunity_state_eligibility: Legacy state eligibility (view still joins)
DROP POLICY IF EXISTS anon_select ON opportunity_state_eligibility;
CREATE POLICY anon_select ON opportunity_state_eligibility
  FOR SELECT TO anon USING (true);

-- opportunity_county_eligibility: Legacy county eligibility (view still joins)
DROP POLICY IF EXISTS anon_select ON opportunity_county_eligibility;
CREATE POLICY anon_select ON opportunity_county_eligibility
  FOR SELECT TO anon USING (true);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY anon_select ON funding_sources IS
'Public read access for dashboard source name display';

COMMENT ON POLICY anon_select ON states IS
'Public read access for geographic filtering reference data';

COMMENT ON POLICY anon_select ON counties IS
'Public read access for geographic filtering reference data';

COMMENT ON POLICY anon_select ON coverage_areas IS
'Public read access for opportunity coverage display on map/dashboard';

COMMENT ON POLICY anon_select ON opportunity_coverage_areas IS
'Public read access for opportunity ↔ coverage area joins';

COMMENT ON POLICY anon_select ON opportunity_state_eligibility IS
'Public read access for legacy state eligibility (deprecated but view depends on it)';

COMMENT ON POLICY anon_select ON opportunity_county_eligibility IS
'Public read access for legacy county eligibility (deprecated but view depends on it)';
