-- Enable the pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Recreate the check_similar_sources function
DROP FUNCTION IF EXISTS check_similar_sources;

CREATE OR REPLACE FUNCTION check_similar_sources(
  p_name TEXT,
  p_organization TEXT DEFAULT NULL
) 
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.organization,
    GREATEST(
      similarity(s.name, p_name),
      similarity(COALESCE(s.organization, ''), COALESCE(p_organization, ''))
    ) as similarity
  FROM api_sources s
  WHERE 
    similarity(s.name, p_name) > 0.6 OR
    similarity(COALESCE(s.organization, ''), COALESCE(p_organization, '')) > 0.8
  ORDER BY similarity DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql; 