-- Migration: Add Anon Select Policy
-- Purpose: Allow unauthenticated (anon) users to read funding opportunities
-- Created: 2026-01-02
-- Reason: Dashboard and public API routes use anon key for read access

-- Add SELECT policy for anon role (public read access)
-- Drop first in case it exists (we already applied it manually)
DROP POLICY IF EXISTS anon_select ON funding_opportunities;

CREATE POLICY anon_select ON funding_opportunities
  FOR SELECT
  TO anon
  USING (true);

-- Document the policy
COMMENT ON POLICY anon_select ON funding_opportunities IS
'Allows anonymous (unauthenticated) users to read funding opportunities. Required for public dashboard and API routes using NEXT_PUBLIC_SUPABASE_ANON_KEY.';
