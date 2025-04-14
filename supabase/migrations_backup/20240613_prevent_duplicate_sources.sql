-- Migration to prevent duplicate API sources
-- This adds a unique constraint on the name and organization columns

-- First, let's clean up existing duplicates
-- We'll keep the most recently updated record for each name+organization combination
WITH duplicates AS (
  SELECT 
    name, 
    organization,
    COUNT(*) as count
  FROM api_sources
  GROUP BY name, organization
  HAVING COUNT(*) > 1
),
ranked_duplicates AS (
  SELECT 
    s.id,
    s.name,
    s.organization,
    ROW_NUMBER() OVER (PARTITION BY s.name, s.organization ORDER BY s.updated_at DESC) as rn
  FROM api_sources s
  JOIN duplicates d ON s.name = d.name AND COALESCE(s.organization, '') = COALESCE(d.organization, '')
)
DELETE FROM api_sources
WHERE id IN (
  SELECT id FROM ranked_duplicates WHERE rn > 1
);

-- Now add the unique constraint
ALTER TABLE api_sources 
ADD CONSTRAINT api_sources_name_organization_unique 
UNIQUE (name, COALESCE(organization, ''));

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT api_sources_name_organization_unique ON api_sources IS 
'Prevents duplicate API sources with the same name and organization';

-- Create a function to check for similar sources before insertion
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