-- Fix UPDATE requires WHERE clause error in trigger function

CREATE OR REPLACE FUNCTION sync_global_force_full_reprocessing()
RETURNS TRIGGER AS $$
BEGIN
  -- Act when global FFR flag is being changed
  IF NEW.key = 'global_force_full_reprocessing' THEN
    IF NEW.value = 'true'::jsonb THEN
      -- Enable FFR for all sources (with explicit WHERE TRUE to satisfy safety requirements)
      UPDATE api_sources 
      SET force_full_reprocessing = TRUE,
          updated_at = NOW()
      WHERE TRUE;  -- Explicit WHERE clause to update all rows
      
      RAISE NOTICE 'Global FFR enabled - activated FFR for all sources';
    ELSIF NEW.value = 'false'::jsonb THEN
      -- Disable FFR for all sources (manual toggle off)
      UPDATE api_sources 
      SET force_full_reprocessing = FALSE,
          updated_at = NOW()
      WHERE TRUE;  -- Explicit WHERE clause to update all rows
      
      RAISE NOTICE 'Global FFR disabled - deactivated FFR for all sources';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_global_force_full_reprocessing() IS 
'Trigger function that syncs all source FFR flags when global flag is manually toggled.
Works like a checkbox UI: checking global checks all, unchecking global unchecks all.
Uses WHERE TRUE to explicitly indicate updating all rows.';