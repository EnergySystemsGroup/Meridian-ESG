-- Prune funding_opportunities table: remove program_id and other unused fields

-- Step 1: Drop dependent views and functions that reference program_id
DROP VIEW IF EXISTS funding_opportunities_with_geography CASCADE;
DROP FUNCTION IF EXISTS get_funding_by_state(text, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS get_funding_by_county(text, text, numeric, numeric) CASCADE;

-- Step 2: Drop the program_id column from funding_opportunities
ALTER TABLE IF EXISTS funding_opportunities
DROP COLUMN IF EXISTS program_id;

-- Step 3: Drop other redundant/unused columns
ALTER TABLE IF EXISTS funding_opportunities
DROP COLUMN IF EXISTS min_amount,
DROP COLUMN IF EXISTS max_amount,
DROP COLUMN IF EXISTS objectives,
DROP COLUMN IF EXISTS eligibility; 