-- Create trigger to automatically update global FFR flag based on source states
-- When any source FFR changes, check if global should be updated

CREATE OR REPLACE FUNCTION sync_global_from_sources()
RETURNS TRIGGER AS $$
DECLARE
  any_source_has_ffr BOOLEAN;
  current_global_value BOOLEAN;
BEGIN
  -- Only act on changes to force_full_reprocessing column
  IF OLD.force_full_reprocessing IS DISTINCT FROM NEW.force_full_reprocessing THEN
    
    -- Check if any source still has FFR enabled
    SELECT EXISTS(
      SELECT 1 FROM api_sources 
      WHERE force_full_reprocessing = TRUE
    ) INTO any_source_has_ffr;
    
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
    END IF;
    
    -- Note: We don't turn global ON when a source is enabled individually
    -- Global should only turn ON when explicitly toggled by the user
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on api_sources table
DROP TRIGGER IF EXISTS sync_global_from_sources_trigger ON api_sources;
CREATE TRIGGER sync_global_from_sources_trigger
  AFTER UPDATE ON api_sources
  FOR EACH ROW
  EXECUTE FUNCTION sync_global_from_sources();

COMMENT ON FUNCTION sync_global_from_sources() IS 
'Automatically turns off global FFR flag when no sources have FFR enabled.
Does not turn on global flag - that only happens via explicit user action.
Maintains checkbox UI behavior where global unchecks when all individuals are unchecked.';