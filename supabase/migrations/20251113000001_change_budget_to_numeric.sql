-- Migration: Change budget field from TEXT to NUMERIC
-- Date: 2025-11-13
-- Purpose: Enable proper numeric operations and budget categorization

-- Step 1: Add a new numeric column
ALTER TABLE clients ADD COLUMN budget_numeric NUMERIC;

-- Step 2: Convert existing TEXT budget values to NUMERIC
-- Handle common text patterns and convert to numeric
UPDATE clients SET budget_numeric =
  CASE
    -- If already numeric, cast directly
    WHEN budget ~ '^[0-9]+(\.[0-9]+)?$' THEN budget::numeric
    -- If empty or null, set to null
    WHEN budget IS NULL OR budget = '' THEN NULL
    -- Default to null for any other case
    ELSE NULL
  END
WHERE budget IS NOT NULL;

-- Step 3: Drop the old TEXT column
ALTER TABLE clients DROP COLUMN budget;

-- Step 4: Rename the new column to budget
ALTER TABLE clients RENAME COLUMN budget_numeric TO budget;

-- Step 5: Add a comment for documentation
COMMENT ON COLUMN clients.budget IS 'Client budget in numeric format (e.g., 1000000 for $1M). Used for budget tier categorization: Large (≥$1M), Medium ($100K-$999K), Small (<$100K)';
