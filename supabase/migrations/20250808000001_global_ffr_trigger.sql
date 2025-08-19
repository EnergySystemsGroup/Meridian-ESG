-- Create trigger function to enable all source FFR flags when global is enabled
CREATE OR REPLACE FUNCTION sync_global_force_full_reprocessing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when global flag is being set to true
  IF NEW.key = 'global_force_full_reprocessing' AND NEW.value = 'true'::jsonb THEN
    -- Enable FFR for all sources
    UPDATE api_sources 
    SET force_full_reprocessing = TRUE,
        updated_at = NOW();
    
    RAISE NOTICE 'Global FFR enabled - activated FFR for all sources';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on system_config table
DROP TRIGGER IF EXISTS sync_global_ffr_trigger ON system_config;
CREATE TRIGGER sync_global_ffr_trigger
  AFTER INSERT OR UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION sync_global_force_full_reprocessing();

-- Update the disable_force_full_reprocessing function to also disable global flag
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
  
  -- Disable the source-specific flag
  UPDATE api_sources 
  SET force_full_reprocessing = FALSE,
      updated_at = NOW()
  WHERE id = validated_id 
    AND force_full_reprocessing = TRUE;
  
  -- Also disable the global flag (since not all sources are pending anymore)
  UPDATE system_config
  SET value = 'false'::jsonb,
      updated_at = NOW()
  WHERE key = 'global_force_full_reprocessing'
    AND value = 'true'::jsonb;
    
  RAISE NOTICE 'Disabled FFR for source % and global flag', source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the behavior
COMMENT ON FUNCTION sync_global_force_full_reprocessing() IS 
'Trigger function that enables FFR for all sources when global flag is set to true. 
The global flag acts as a batch enable switch.';

COMMENT ON FUNCTION disable_force_full_reprocessing(UUID) IS 
'Disables FFR for a specific source after processing completes. 
Also disables the global flag since the batch operation has started.';