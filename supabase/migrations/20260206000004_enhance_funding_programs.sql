-- Migration: Enhance funding_programs table for Phase 2 (Program Discovery)
-- Date: 2026-02-06
-- Purpose: Add 10 new columns and 4 indexes to the existing funding_programs
--   table. Existing columns (id, source_id, name, description, created_at,
--   updated_at) are unchanged. New columns support program URLs, taxonomy
--   classification, lifecycle tracking, and pipeline metadata.
--
-- Idempotent: safe to run multiple times (IF NOT EXISTS on all additions).
-- Reference: architecture proposal Section 3b (lines 220-311).

-- ============================================================================
-- 1. Add program data columns
-- ============================================================================

-- 1a. program_urls: JSONB array of URLs associated with this program.
--     Typically 1-3 URLs per program. Each entry has url, type, and notes.
--     Example: [{"url": "https://...", "type": "main", "notes": "Program page"}]
--     These URLs serve dual purpose:
--       1. Skill 2 crawls them to extract program info (static)
--       2. Skill 3 crawls them to check for open opportunities (temporal)
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS program_urls JSONB DEFAULT '[]';

-- 1b. categories: aligned with TAXONOMIES.CATEGORIES from lib/constants/taxonomies.js.
--     e.g., ARRAY['Energy', 'Sustainability']
--     General categories for the program — opportunity may inherit or narrow these.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS categories TEXT[];

-- 1c. eligible_applicants: general applicant types at the program level.
--     e.g., ARRAY['Commercial', 'Residential', 'Municipal']
--     Specific opportunity may narrow this further.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS eligible_applicants TEXT[];

-- 1d. eligible_project_types: general project types the program covers.
--     e.g., ARRAY['HVAC', 'Lighting', 'EV Charging']
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS eligible_project_types TEXT[];

-- 1e. funding_type: primary funding mechanism.
--     Values: 'Grant', 'Rebate', 'Loan', 'Tax Credit', 'Technical Assistance', etc.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS funding_type TEXT;

-- ============================================================================
-- 2. Add lifecycle columns
-- ============================================================================

-- 2a. status: tracks whether the program EXISTS (not whether it's currently open).
--     'active' = program exists and runs (may or may not have open opportunity now)
--     'inactive' = program discontinued
--     'unknown' = not yet verified
--     NOTE: "is it open?" is answered by existence of an Open opportunity, not this field.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unknown';

-- 2b. recurrence: how often the program runs.
--     'one-time' = single offering
--     'recurring' = repeats periodically (annual, seasonal, etc.)
--     'continuous' = always accepting (rolling)
--     'unknown' = not yet determined
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'unknown';

-- 2c. last_checked_at: when Skill 3 last crawled this program's URLs.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- 2d. next_check_at: when to next check for opportunities. Smart scheduling:
--     Skill 3 sets this based on what it learns during crawling:
--       "Opens March 2026" → next_check_at = '2026-02-25'
--       "Currently open through August" → next_check_at = '2026-09-01'
--       No info → next_check_at = NOW() + 30 days (default monthly)
--     Initial value from Phase 2: NOW() (check immediately after discovery)
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;

-- ============================================================================
-- 3. Add pipeline tracking columns
-- ============================================================================

-- 3a. pipeline: which pipeline created this program.
--     'manual' = discovered via manual pipeline (Phase 2)
--     'api' = discovered via automated API pipeline
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS pipeline TEXT DEFAULT 'manual';

-- 3b. api_program_id: external program identifier for API pipeline.
--     e.g., CFDA number. NULL for manual pipeline.
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS api_program_id TEXT;

-- ============================================================================
-- 4. Add column comments
-- ============================================================================

COMMENT ON COLUMN funding_programs.program_urls IS
  'JSONB array of URLs for this program. Each entry: {"url": "...", "type": "main|application|aggregator", "notes": "..."}. Crawled by Skill 2 (static info) and Skill 3 (opportunity status).';

COMMENT ON COLUMN funding_programs.categories IS
  'Program categories from TAXONOMIES.CATEGORIES. e.g., {Energy, Sustainability}. General defaults — opportunity may narrow.';

COMMENT ON COLUMN funding_programs.eligible_applicants IS
  'General applicant types. e.g., {Commercial, Residential, Municipal}. Opportunity may narrow.';

COMMENT ON COLUMN funding_programs.eligible_project_types IS
  'General project types. e.g., {HVAC, Lighting, EV Charging}. Opportunity may narrow.';

COMMENT ON COLUMN funding_programs.funding_type IS
  'Primary funding mechanism: Grant, Rebate, Loan, Tax Credit, Technical Assistance, etc.';

COMMENT ON COLUMN funding_programs.status IS
  'Program existence status: active (exists), inactive (discontinued), unknown (unverified). Open/closed tracked via linked opportunities.';

COMMENT ON COLUMN funding_programs.recurrence IS
  'Program cadence: one-time, recurring, continuous, unknown.';

COMMENT ON COLUMN funding_programs.last_checked_at IS
  'When Skill 3 last crawled this program URLs to check for opportunities.';

COMMENT ON COLUMN funding_programs.next_check_at IS
  'Smart-scheduled next check time. Set by Skill 3 based on crawling insights. Initial: NOW() (immediate eligibility).';

COMMENT ON COLUMN funding_programs.pipeline IS
  'Origin pipeline: manual (Phase 2 discovery) or api (automated pipeline). Default: manual.';

COMMENT ON COLUMN funding_programs.api_program_id IS
  'External program identifier for API pipeline (e.g., CFDA number). NULL for manual pipeline.';

-- ============================================================================
-- 5. Create indexes for common query patterns
-- ============================================================================

-- 5a. Source lookup: "What programs does this source run?"
CREATE INDEX IF NOT EXISTS idx_funding_programs_source
  ON funding_programs(source_id);

-- 5b. Status filter: "All active programs"
CREATE INDEX IF NOT EXISTS idx_funding_programs_status
  ON funding_programs(status);

-- 5c. Category search: "Programs in the Energy category"
CREATE INDEX IF NOT EXISTS idx_funding_programs_categories
  ON funding_programs USING GIN(categories);

-- 5d. Scheduling: "Which active programs need checking?"
--     Partial index — only active programs with a scheduled check time.
CREATE INDEX IF NOT EXISTS idx_funding_programs_next_check
  ON funding_programs(next_check_at)
  WHERE status = 'active' AND next_check_at IS NOT NULL;

-- ============================================================================
-- 6. Ensure claude_writer role has correct permissions
-- ============================================================================

-- claude_writer already has INSERT, SELECT, UPDATE on funding_programs.
-- Re-grant to ensure idempotency (GRANT is a no-op if already granted).
GRANT SELECT, INSERT, UPDATE ON funding_programs TO claude_writer;
