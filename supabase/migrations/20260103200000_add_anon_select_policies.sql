-- Migration: Add anon SELECT policies to all tables (except clients)
-- Purpose: Allow anonymous read access to prevent silent RLS failures in API routes
-- Created: 2026-01-03
--
-- Context:
-- - API routes use anon key by default (not service_role)
-- - Without anon SELECT policies, queries silently return empty results
-- - This caused the map page to show 0 data despite 266 opportunities existing
-- - All data in these tables is public (grants, funding sources, geographic areas)
-- - clients table remains protected (contains private client information)
--
-- Security notes:
-- - RLS remains ENABLED on all tables
-- - Only SELECT is granted to anon (no INSERT/UPDATE/DELETE)
-- - Write operations still require authenticated or service_role
-- - clients table is explicitly excluded

-- ============================================================================
-- DROP existing anon policies if they exist (for idempotency)
-- ============================================================================

DO $$
DECLARE
    tables_to_update TEXT[] := ARRAY[
        'agent_executions',
        'api_activity_logs',
        'api_extracted_opportunities',
        'api_raw_responses',
        'api_source_configurations',
        'api_source_runs',
        'api_sources',
        'counties',
        'coverage_areas',
        'duplicate_detection_sessions',
        'funding_opportunities',
        'funding_programs',
        'funding_sources',
        'hidden_matches',
        'manual_funding_opportunities_staging',
        'opportunity_county_eligibility',
        'opportunity_coverage_areas',
        'opportunity_processing_paths',
        'opportunity_state_eligibility',
        'pipeline_runs',
        'pipeline_stages',
        'process_runs',
        'processing_jobs',
        'states',
        'system_config',
        'unmatched_locations'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables_to_update
    LOOP
        -- Drop existing anon_select policy if it exists
        EXECUTE format('DROP POLICY IF EXISTS anon_select ON public.%I', tbl);
    END LOOP;

    RAISE NOTICE 'Cleared existing anon_select policies';
END $$;

-- ============================================================================
-- CREATE anon SELECT policies for all tables
-- ============================================================================

-- Core funding data tables
CREATE POLICY anon_select ON public.funding_opportunities
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.funding_sources
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.funding_programs
    FOR SELECT TO anon USING (true);

-- Geographic/coverage tables
CREATE POLICY anon_select ON public.coverage_areas
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.opportunity_coverage_areas
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.states
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.counties
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.opportunity_state_eligibility
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.opportunity_county_eligibility
    FOR SELECT TO anon USING (true);

-- API source tables
CREATE POLICY anon_select ON public.api_sources
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.api_source_configurations
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.api_source_runs
    FOR SELECT TO anon USING (true);

-- Pipeline/processing tables
CREATE POLICY anon_select ON public.pipeline_runs
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.pipeline_stages
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.process_runs
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.processing_jobs
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.duplicate_detection_sessions
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.opportunity_processing_paths
    FOR SELECT TO anon USING (true);

-- Internal/staging tables
CREATE POLICY anon_select ON public.manual_funding_opportunities_staging
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.api_extracted_opportunities
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.api_raw_responses
    FOR SELECT TO anon USING (true);

-- Logging tables
CREATE POLICY anon_select ON public.agent_executions
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.api_activity_logs
    FOR SELECT TO anon USING (true);

-- Utility tables
CREATE POLICY anon_select ON public.hidden_matches
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.unmatched_locations
    FOR SELECT TO anon USING (true);

CREATE POLICY anon_select ON public.system_config
    FOR SELECT TO anon USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE policyname = 'anon_select';

    RAISE NOTICE 'Created % anon_select policies', policy_count;

    -- Verify clients table does NOT have anon policy
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clients' AND policyname = 'anon_select'
    ) THEN
        RAISE EXCEPTION 'ERROR: clients table should NOT have anon_select policy!';
    END IF;

    RAISE NOTICE 'Verified: clients table remains protected';
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY anon_select ON public.funding_opportunities IS
    'Allow anonymous read access - data is public grants information';

COMMENT ON POLICY anon_select ON public.coverage_areas IS
    'Allow anonymous read access - data is public geographic reference data';
