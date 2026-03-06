-- Add owner_id to clients and create client_users join table
-- Issue #34: User-client association for audit trail and assignment

-- =============================================================================
-- 1. Add owner_id to clients (audit-only: who created the record)
-- =============================================================================
ALTER TABLE clients ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_owner_id ON clients(owner_id) WHERE owner_id IS NOT NULL;

COMMENT ON COLUMN clients.owner_id IS 'Audit-only: UUID of the user who created this client. Not used for access control.';

-- =============================================================================
-- 2. Create client_users join table (many-to-many assignment)
-- =============================================================================
CREATE TABLE client_users (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, user_id)
);

CREATE INDEX idx_client_users_user_id ON client_users(user_id);

COMMENT ON TABLE client_users IS 'Many-to-many assignment of users to clients. Used for "my clients" filtering.';

-- =============================================================================
-- 3. RLS policies for client_users
-- =============================================================================
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select ON client_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY service_role_all ON client_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);
