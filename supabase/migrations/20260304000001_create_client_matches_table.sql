-- Create client_matches table for persistent client-opportunity matching
-- Replaces on-the-fly matching with stored results for delta detection and notifications

CREATE TABLE IF NOT EXISTS client_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  match_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_new BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(client_id, opportunity_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_client_matches_client_id ON client_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_client_matches_opportunity_id ON client_matches(opportunity_id);

-- RLS: same pattern as other tables
ALTER TABLE client_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_matches' AND policyname = 'authenticated_select'
  ) THEN
    CREATE POLICY "authenticated_select" ON client_matches FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_matches' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON client_matches FOR ALL TO service_role USING (true);
  END IF;
END$$;

-- Document that match_client_to_opportunities RPC is superseded
-- The RPC only performs geographic matching (location criterion).
-- The shared module lib/matching/evaluateMatch.js performs full 4-criteria matching
-- (location + applicant type + project needs + activities) with scoring.
-- The RPC is retained for backward compatibility.
COMMENT ON FUNCTION match_client_to_opportunities(UUID) IS
  'SUPERSEDED by client_matches table + lib/matching/evaluateMatch.js. This RPC only performs geographic matching. The shared module performs full 4-criteria matching with scoring. Retained for backward compatibility.';
