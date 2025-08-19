-- Clean up unnecessary FFR global state artifacts
-- Since global FFR is now computed from sources (not stored), we can remove:
-- 1. The global_force_full_reprocessing entry in system_config
-- 2. All triggers that sync between global and sources
-- 3. Functions that are no longer needed
-- We keep: source-level FFR flags and the disable function used by the processor

-- Drop triggers that sync global state
DROP TRIGGER IF EXISTS sync_global_ffr_trigger ON system_config;
DROP TRIGGER IF EXISTS sync_global_from_sources_trigger ON api_sources;

-- Drop functions that manage global state syncing
DROP FUNCTION IF EXISTS sync_global_force_full_reprocessing();
DROP FUNCTION IF EXISTS sync_global_from_sources();

-- Update the should_force_full_reprocessing function to only check source flag
-- (no longer checks global flag since it doesn't exist)
CREATE OR REPLACE FUNCTION should_force_full_reprocessing(source_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  source_flag BOOLEAN;
  validated_id UUID;
BEGIN
  -- Validate UUID input
  IF source_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure the UUID is valid format
  BEGIN
    validated_id := source_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format: %', source_id;
  END;
  
  -- Check source-specific flag only
  SELECT force_full_reprocessing INTO source_flag
  FROM api_sources
  WHERE id = validated_id;
  
  -- Return the source flag value (no global flag to check anymore)
  RETURN COALESCE(source_flag, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the disable function to not touch global state
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
  
  -- Disable the source-specific flag only
  UPDATE api_sources 
  SET force_full_reprocessing = FALSE,
      updated_at = NOW()
  WHERE id = validated_id 
    AND force_full_reprocessing = TRUE;
  
  RAISE NOTICE 'Disabled FFR for source %', source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the global FFR entry from system_config
-- (keeping it might cause confusion since it's no longer used)
DELETE FROM system_config 
WHERE key = 'global_force_full_reprocessing';

-- Add comments explaining the new architecture
COMMENT ON FUNCTION should_force_full_reprocessing(UUID) IS 
'Checks if a source should do full reprocessing. 
Only checks the source-specific flag since global state is now managed in the UI.';

COMMENT ON FUNCTION disable_force_full_reprocessing(UUID) IS 
'Disables FFR for a specific source after processing completes.
Global state is no longer stored in database - it is computed from sources in the UI.';

COMMENT ON COLUMN api_sources.force_full_reprocessing IS 
'When true, this source will bypass duplicate detection on next run.
Global FFR state is computed from all sources (not stored separately).';