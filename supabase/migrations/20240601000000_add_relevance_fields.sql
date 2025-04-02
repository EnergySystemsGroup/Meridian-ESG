-- Add relevance score and reasoning columns to funding_opportunities
ALTER TABLE IF EXISTS funding_opportunities 
ADD COLUMN IF NOT EXISTS relevance_score NUMERIC,
ADD COLUMN IF NOT EXISTS relevance_reasoning TEXT;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_relevance_score ON funding_opportunities(relevance_score);

-- Add comment to document the migration
COMMENT ON COLUMN funding_opportunities.relevance_score IS 'Numeric score indicating the relevance of the opportunity to organization needs (0-100)';
COMMENT ON COLUMN funding_opportunities.relevance_reasoning IS 'Explanation of why the opportunity received its relevance score'; 