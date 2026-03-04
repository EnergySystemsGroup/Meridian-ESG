-- ============================================================================
-- Create claude_writer role for pipeline agents
-- ============================================================================
-- This role gives the manual funding pipeline limited write access to specific
-- tables instead of using the postgres superuser. It was previously created
-- manually on staging/prod — this migration codifies it so local dev and any
-- new environment gets it automatically.
--
-- IF NOT EXISTS prevents errors on environments where it already exists.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'claude_writer') THEN
    CREATE ROLE claude_writer WITH LOGIN PASSWORD 'claude_writer';
  END IF;
END $$;
