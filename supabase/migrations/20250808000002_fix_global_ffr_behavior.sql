-- Fix global FFR behavior to work like checkbox UI pattern
-- Global ON → All sources ON
-- Global OFF (manual) → All sources OFF
-- Source completes → That source OFF, global OFF only if no sources remain

-- Update trigger function to sync sources when global is manually toggled on OR off
CREATE OR REPLACE FUNCTION sync_global_force_full_reprocessing()
RETURNS TRIGGER AS $$
BEGIN
  -- Act when global FFR flag is being changed
  IF NEW.key = 'global_force_full_reprocessing' THEN
    IF NEW.value = 'true'::jsonb THEN
      -- Enable FFR for all sources
      UPDATE api_sources 
      SET force_full_reprocessing = TRUE,
          updated_at = NOW();
      
      RAISE NOTICE 'Global FFR enabled - activated FFR for all sources';
    ELSIF NEW.value = 'false'::jsonb THEN
      -- Disable FFR for all sources (manual toggle off)
      UPDATE api_sources 
      SET force_full_reprocessing = FALSE,
          updated_at = NOW();
      
      RAISE NOTICE 'Global FFR disabled - deactivated FFR for all sources';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update disable function to only turn off global when no sources remain with FFR
CREATE OR REPLACE FUNCTION disable_force_full_reprocessing(source_id UUID)
RETURNS VOID AS $$
DECLARE
  validated_id UUID;
  remaining_ffr_count INTEGER;
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
  
  -- Check if any sources still have FFR enabled
  SELECT COUNT(*) INTO remaining_ffr_count
  FROM api_sources
  WHERE force_full_reprocessing = TRUE;
  
  -- Only disable global if no sources remain with FFR
  IF remaining_ffr_count = 0 THEN
    UPDATE system_config
    SET value = 'false'::jsonb,
        updated_at = NOW()
    WHERE key = 'global_force_full_reprocessing'
      AND value = 'true'::jsonb;
    
    RAISE NOTICE 'Disabled FFR for source % and global flag (no sources remaining)', source_id;
  ELSE
    RAISE NOTICE 'Disabled FFR for source % (% sources still have FFR enabled)', source_id, remaining_ffr_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments to explain the checkbox-like behavior
COMMENT ON FUNCTION sync_global_force_full_reprocessing() IS 
'Trigger function that syncs all source FFR flags when global flag is manually toggled.
Works like a checkbox UI: checking global checks all, unchecking global unchecks all.';

COMMENT ON FUNCTION disable_force_full_reprocessing(UUID) IS 
'Disables FFR for a specific source after processing completes.
Only disables global flag if no sources remain with FFR enabled (like unchecking last checkbox).';