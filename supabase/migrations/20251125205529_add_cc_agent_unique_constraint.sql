-- Add unique constraint for CC agent records (where api_source_id IS NULL)
-- This enables UPSERT with ON CONFLICT (funding_source_id, title) for manual/CC pipeline

CREATE UNIQUE INDEX IF NOT EXISTS funding_opportunities_cc_agent_unique
ON funding_opportunities (funding_source_id, title)
WHERE api_source_id IS NULL;

COMMENT ON INDEX funding_opportunities_cc_agent_unique IS
'Unique constraint for CC agent records. Enables UPSERT deduplication by funding_source + title when api_source_id is NULL.';
