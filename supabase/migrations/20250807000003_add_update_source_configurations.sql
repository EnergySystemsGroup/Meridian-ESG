-- Create a function to update source configurations transactionally
-- This prevents potential deadlocks from delete + insert operations

CREATE OR REPLACE FUNCTION update_source_configurations(
  p_source_id UUID,
  p_configurations JSONB
)
RETURNS VOID AS $$
DECLARE
  config_key TEXT;
  config_value JSONB;
BEGIN
  -- Validate input
  IF p_source_id IS NULL THEN
    RAISE EXCEPTION 'Source ID cannot be null';
  END IF;
  
  -- Start a subtransaction
  BEGIN
    -- Delete existing configurations in a single operation
    DELETE FROM api_source_configurations
    WHERE source_id = p_source_id;
    
    -- Insert new configurations if provided
    IF p_configurations IS NOT NULL AND p_configurations != '{}'::jsonb THEN
      FOR config_key, config_value IN 
        SELECT key, value FROM jsonb_each(p_configurations)
      LOOP
        -- Only insert non-empty configurations
        IF config_value IS NOT NULL AND config_value != '{}'::jsonb THEN
          INSERT INTO api_source_configurations (
            source_id,
            config_type,
            configuration,
            created_at,
            updated_at
          ) VALUES (
            p_source_id,
            config_key,
            config_value,
            NOW(),
            NOW()
          );
        END IF;
      END LOOP;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Re-raise the exception with context
      RAISE EXCEPTION 'Failed to update configurations for source %: %', p_source_id, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_source_configurations TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_source_configurations IS 
'Transactionally updates source configurations by deleting existing and inserting new ones. Prevents deadlock issues from concurrent operations.';