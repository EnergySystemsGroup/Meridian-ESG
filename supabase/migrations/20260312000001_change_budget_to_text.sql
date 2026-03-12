-- Migration: Change budget column from NUMERIC back to TEXT for tier-based values
-- Reason: UI redesign now uses tier strings (small, medium, large, very_large)
-- instead of raw numeric values. The API routes and display components all work
-- in tier-string terms.

-- Step 1: Convert existing numeric values to tier strings based on the original ranges
ALTER TABLE clients ALTER COLUMN budget TYPE TEXT USING
  CASE
    WHEN budget IS NULL THEN NULL
    WHEN budget < 500000 THEN 'small'
    WHEN budget < 5000000 THEN 'medium'
    WHEN budget < 50000000 THEN 'large'
    ELSE 'very_large'
  END;

-- Step 2: Add a CHECK constraint for valid tier values
ALTER TABLE clients ADD CONSTRAINT clients_budget_tier_check
  CHECK (budget IS NULL OR budget IN ('small', 'medium', 'large', 'very_large'));

-- Step 3: Update column comment
COMMENT ON COLUMN clients.budget IS 'Client budget tier: small ($50K-$500K), medium ($500K-$5M), large ($5M-$50M), very_large ($50M+)';
