-- Migration: Cleanup Remaining Anon Policies
-- Purpose: Remove leftover anon policies from earlier migrations
-- Created: 2026-01-02

-- Remove anon policies that were missed
DROP POLICY IF EXISTS "Allow anonymous read access to api_source_runs" ON api_source_runs;
DROP POLICY IF EXISTS "Allow anonymous read access to process_runs" ON process_runs;

-- Ensure these tables have authenticated policies (they should from migration 8, but just in case)
DROP POLICY IF EXISTS auth_select ON api_source_runs;
CREATE POLICY auth_select ON api_source_runs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_select ON process_runs;
CREATE POLICY auth_select ON process_runs
  FOR SELECT TO authenticated USING (true);
