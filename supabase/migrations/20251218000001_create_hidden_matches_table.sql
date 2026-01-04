-- Create hidden_matches junction table
-- Tracks client-opportunity pairs that have been hidden from view

CREATE TABLE IF NOT EXISTS hidden_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  hidden_by TEXT,                    -- Username or system identifier
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,                       -- Optional reason for hiding

  -- Ensure unique client-opportunity pairs
  UNIQUE(client_id, opportunity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hidden_matches_client_id ON hidden_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_hidden_matches_opportunity_id ON hidden_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_hidden_matches_hidden_at ON hidden_matches(hidden_at);

-- Add comment for documentation
COMMENT ON TABLE hidden_matches IS 'Junction table tracking client-opportunity matches that have been hidden from view';
