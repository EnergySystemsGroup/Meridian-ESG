-- Migration: Add review metadata columns to funding_opportunities
-- Purpose: Track who approved/rejected records and why (Phase 7 admin review)
-- Applied via: supabase migration up

-- Add review metadata columns
ALTER TABLE funding_opportunities
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

COMMENT ON COLUMN funding_opportunities.reviewed_by IS 'Admin identifier who approved/rejected this record';
COMMENT ON COLUMN funding_opportunities.reviewed_at IS 'Timestamp when the review action occurred';
COMMENT ON COLUMN funding_opportunities.review_notes IS 'Optional notes from admin, typically rejection reason';

-- Partial index for review page queries (only non-null promotion_status records)
CREATE INDEX IF NOT EXISTS idx_fo_promotion_status
  ON funding_opportunities (promotion_status)
  WHERE promotion_status IS NOT NULL;
