-- ============================================================
-- Restore function signatures broken by security migrations
-- Migration 20260102000002 renamed parameters, breaking RPC calls
-- This restores original parameter names while keeping security fixes
-- ============================================================

-- 1. should_force_full_reprocessing (formalize bandaid)
DROP FUNCTION IF EXISTS should_force_full_reprocessing(uuid);

CREATE OR REPLACE FUNCTION should_force_full_reprocessing(source_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_flag BOOLEAN;
BEGIN
  IF source_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT force_full_reprocessing INTO source_flag
  FROM api_sources
  WHERE id = source_id;

  RETURN COALESCE(source_flag, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION should_force_full_reprocessing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION should_force_full_reprocessing(UUID) TO service_role;

-- 2. disable_force_full_reprocessing (restore source_id param name)
DROP FUNCTION IF EXISTS disable_force_full_reprocessing(uuid);

CREATE OR REPLACE FUNCTION disable_force_full_reprocessing(source_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE api_sources
  SET force_full_reprocessing = FALSE,
      updated_at = NOW()
  WHERE id = source_id;
END;
$$;

GRANT EXECUTE ON FUNCTION disable_force_full_reprocessing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_force_full_reprocessing(UUID) TO service_role;

-- Comments
COMMENT ON FUNCTION should_force_full_reprocessing(UUID) IS
'Checks if source should do full reprocessing. Parameter restored from security migration.';

COMMENT ON FUNCTION disable_force_full_reprocessing(UUID) IS
'Disables FFR for a source after processing. Parameter restored from security migration.';
