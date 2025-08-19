-- Add advisory lock functions for preventing concurrent processing
-- These functions wrap PostgreSQL's advisory lock functionality for use via RPC

-- Note: PostgreSQL has built-in pg_try_advisory_lock and pg_advisory_unlock functions
-- We'll just grant permissions to use them via RPC through wrapper functions

-- Create wrapper function for acquiring an advisory lock (non-blocking)
CREATE OR REPLACE FUNCTION public.try_advisory_lock(lock_key INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create wrapper function for releasing an advisory lock
CREATE OR REPLACE FUNCTION public.release_advisory_lock(lock_key INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.try_advisory_lock TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_advisory_lock TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.try_advisory_lock IS 'Try to acquire an advisory lock for preventing concurrent processing. Returns true if lock was acquired, false if already held by another session.';
COMMENT ON FUNCTION public.release_advisory_lock IS 'Release a previously acquired advisory lock. Returns true if lock was released, false if lock was not held by this session.';