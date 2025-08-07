-- Add force_full_reprocessing flag to api_sources table
-- This flag allows administrators to force all opportunities from a source
-- through the full pipeline, bypassing duplicate detection
-- Useful when schema changes require reprocessing to populate new fields

-- Add column to api_sources table
ALTER TABLE api_sources 
ADD COLUMN IF NOT EXISTS force_full_reprocessing BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN api_sources.force_full_reprocessing IS 
'When true, forces all opportunities from this source through the full pipeline on next run, bypassing duplicate detection. Auto-disables after processing completes.';

-- Create system_config table for global settings if it doesn't exist
CREATE TABLE IF NOT EXISTS system_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for system_config
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read system config
CREATE POLICY "Authenticated users can read system config" ON system_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can modify system config
CREATE POLICY "Service role can modify system config" ON system_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert global force reprocessing flag if it doesn't exist
INSERT INTO system_config (key, value, description)
VALUES (
  'global_force_full_reprocessing',
  'false'::jsonb,
  'When true, forces all sources to do full reprocessing on next run, bypassing duplicate detection'
)
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_sources_force_full_reprocessing 
ON api_sources(force_full_reprocessing) 
WHERE force_full_reprocessing = true;

-- Create function to check if force full reprocessing is needed
CREATE OR REPLACE FUNCTION should_force_full_reprocessing(source_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  source_flag BOOLEAN;
  global_flag BOOLEAN;
  validated_id UUID;
BEGIN
  -- Validate UUID input
  IF source_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure the UUID is valid format (this will throw an error if invalid)
  BEGIN
    validated_id := source_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format: %', source_id;
  END;
  
  -- Check source-specific flag with validated UUID
  SELECT force_full_reprocessing INTO source_flag
  FROM api_sources
  WHERE id = validated_id;
  
  -- Check global flag
  SELECT (value)::boolean INTO global_flag
  FROM system_config
  WHERE key = 'global_force_full_reprocessing';
  
  -- Return true if either flag is true
  RETURN COALESCE(source_flag, FALSE) OR COALESCE(global_flag, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to auto-disable force full reprocessing after run
CREATE OR REPLACE FUNCTION disable_force_full_reprocessing(source_id UUID)
RETURNS VOID AS $$
DECLARE
  validated_id UUID;
BEGIN
  -- Validate UUID input
  IF source_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Ensure the UUID is valid format
  BEGIN
    validated_id := source_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format: %', source_id;
  END;
  
  UPDATE api_sources 
  SET force_full_reprocessing = FALSE,
      updated_at = NOW()
  WHERE id = validated_id 
    AND force_full_reprocessing = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION should_force_full_reprocessing TO authenticated;
GRANT EXECUTE ON FUNCTION disable_force_full_reprocessing TO authenticated;