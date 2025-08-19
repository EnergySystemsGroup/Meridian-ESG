-- Fix global checkbox to automatically turn ON when all sources have FFR enabled
-- This completes the standard checkbox behavior pattern

CREATE OR REPLACE FUNCTION sync_global_from_sources()
RETURNS TRIGGER AS $$
DECLARE
  any_source_has_ffr BOOLEAN;
  all_sources_have_ffr BOOLEAN;
  current_global_value BOOLEAN;
BEGIN
  -- Only act on changes to force_full_reprocessing column
  IF OLD.force_full_reprocessing IS DISTINCT FROM NEW.force_full_reprocessing THEN
    
    -- Check if any source has FFR enabled
    SELECT EXISTS(
      SELECT 1 FROM api_sources 
      WHERE force_full_reprocessing = TRUE
    ) INTO any_source_has_ffr;
    
    -- Check if ALL sources have FFR enabled
    SELECT NOT EXISTS(
      SELECT 1 FROM api_sources 
      WHERE force_full_reprocessing = FALSE OR force_full_reprocessing IS NULL
    ) AND EXISTS(
      SELECT 1 FROM api_sources
    ) INTO all_sources_have_ffr;
    
    -- Get current global flag value
    SELECT (value)::boolean INTO current_global_value
    FROM system_config
    WHERE key = 'global_force_full_reprocessing';
    
    -- If no sources have FFR but global is still on, turn it off
    IF NOT any_source_has_ffr AND current_global_value = TRUE THEN
      UPDATE system_config
      SET value = 'false'::jsonb,
          updated_at = NOW()
      WHERE key = 'global_force_full_reprocessing';
      
      RAISE NOTICE 'No sources have FFR enabled - disabled global flag';
      
    -- If ALL sources have FFR but global is off, turn it on
    ELSIF all_sources_have_ffr AND current_global_value = FALSE THEN
      UPDATE system_config
      SET value = 'true'::jsonb,
          updated_at = NOW()
      WHERE key = 'global_force_full_reprocessing';
      
      RAISE NOTICE 'All sources have FFR enabled - enabled global flag';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_global_from_sources() IS 
'Automatically syncs global FFR flag based on source states.
- Turns OFF global when no sources have FFR enabled
- Turns ON global when ALL sources have FFR enabled
Implements standard checkbox behavior where parent reflects children state.';