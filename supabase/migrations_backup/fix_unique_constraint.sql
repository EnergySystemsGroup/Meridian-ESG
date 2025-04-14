-- Fix the unique constraint syntax

-- Add a unique constraint using a different approach
ALTER TABLE api_sources 
ADD CONSTRAINT api_sources_name_organization_unique 
UNIQUE (name, organization);

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT api_sources_name_organization_unique ON api_sources IS 
'Prevents duplicate API sources with the same name and organization'; 