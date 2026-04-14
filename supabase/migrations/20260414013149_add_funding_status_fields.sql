-- Migration: Add funding status fields to funding_opportunities
-- Purpose: Distinguish rolling vs dated programs, track funding availability,
--          and give the pipeline explicit signals about program health.
--
-- Fields added:
--   application_window_type: How the program accepts applications (dated/rolling/cycle_based)
--   funding_status: Current funding availability assessment
--   funding_note: Short evidence-based explanation (max 150 chars)
--   funding_verified_at: When funding status was last verified by a pipeline agent

-- Create the application_window_type enum
DO $$ BEGIN
  CREATE TYPE application_window_type AS ENUM ('dated', 'rolling', 'cycle_based');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create the funding_status enum
DO $$ BEGIN
  CREATE TYPE funding_status_type AS ENUM (
    'verified_active',    -- Explicit evidence of current acceptance (Apply Now, live portal)
    'presumed_active',    -- Looks normal, no red flags, but no explicit confirmation
    'limited_funding',    -- Known finite pool that could exhaust (first-come-first-served)
    'oversubscribed',     -- Demand signals: waitlists, paused, limited availability
    'exhausted'           -- Definitively confirmed: all funds awarded, program closed
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to funding_opportunities
ALTER TABLE funding_opportunities
  ADD COLUMN IF NOT EXISTS application_window_type application_window_type,
  ADD COLUMN IF NOT EXISTS funding_status funding_status_type DEFAULT 'presumed_active',
  ADD COLUMN IF NOT EXISTS funding_note VARCHAR(150),
  ADD COLUMN IF NOT EXISTS funding_verified_at TIMESTAMPTZ;

-- Add comment documentation
COMMENT ON COLUMN funding_opportunities.application_window_type IS
  'How this program accepts applications: dated (specific open/close dates), rolling (perpetual, no window), cycle_based (recurring cycles like annual CDBG)';

COMMENT ON COLUMN funding_opportunities.funding_status IS
  'Current funding availability: verified_active (confirmed accepting), presumed_active (no red flags), limited_funding (finite pool), oversubscribed (demand signals), exhausted (definitively closed)';

COMMENT ON COLUMN funding_opportunities.funding_note IS
  'Short evidence-based explanation for funding_status assessment, max 150 chars. Example: "Page shows Apply Now with FY2026 dates as of 4/13/2026"';

COMMENT ON COLUMN funding_opportunities.funding_verified_at IS
  'When the funding_status was last verified by a pipeline Phase 3 checker agent';

-- Also add to the staging table so it flows through the pipeline
ALTER TABLE manual_funding_opportunities_staging
  ADD COLUMN IF NOT EXISTS application_window_type application_window_type,
  ADD COLUMN IF NOT EXISTS funding_status funding_status_type DEFAULT 'presumed_active',
  ADD COLUMN IF NOT EXISTS funding_note VARCHAR(150),
  ADD COLUMN IF NOT EXISTS funding_verified_at TIMESTAMPTZ;
