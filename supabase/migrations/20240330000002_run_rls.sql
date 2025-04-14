-- Migration: 20240330000002_run_rls.sql
-- Created on 2024-03-30
-- Adds RLS policies for API source runs and process runs tables

-- Enable RLS on the api_source_runs table
ALTER TABLE api_source_runs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on the process_runs table
ALTER TABLE process_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS
ALTER TABLE api_source_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE process_runs FORCE ROW LEVEL SECURITY;

-- Create policies for api_source_runs
-- Anonymous users can read but not modify
CREATE POLICY "Allow anonymous read access to api_source_runs"
  ON api_source_runs
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated users can read all
CREATE POLICY "Allow authenticated read access to api_source_runs"
  ON api_source_runs
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Allow authenticated users to insert api_source_runs"
  ON api_source_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update their own api_source_runs
CREATE POLICY "Allow authenticated users to update api_source_runs"
  ON api_source_runs
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create policies for process_runs
-- Anonymous users can read but not modify
CREATE POLICY "Allow anonymous read access to process_runs"
  ON process_runs
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated users can read all
CREATE POLICY "Allow authenticated read access to process_runs"
  ON process_runs
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Allow authenticated users to insert process_runs"
  ON process_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update their own process_runs
CREATE POLICY "Allow authenticated users to update process_runs"
  ON process_runs
  FOR UPDATE
  TO authenticated
  USING (true);

-- Grant permissions to the anon and authenticated roles for our newly created views
GRANT SELECT ON detailed_api_runs TO anon, authenticated;
GRANT SELECT ON api_source_run_stats TO anon, authenticated;
GRANT SELECT ON process_run_status TO anon, authenticated;
GRANT SELECT ON daily_run_statistics TO anon, authenticated; 