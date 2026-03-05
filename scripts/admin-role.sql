-- ============================================================
-- Admin Role Management via Supabase app_metadata
-- ============================================================
--
-- Supabase stores role in auth.users.raw_app_meta_data (JSONB).
-- The JS SDK exposes it as user.app_metadata.role.
-- Only service_role operations can modify app_metadata — users
-- cannot self-assign roles.
--
-- IMPORTANT: After granting or revoking admin, the user must
-- sign out and back in (or wait for JWT refresh, ~60 min) for
-- the change to take effect in their browser session.
--
-- Run via:
--   psql "$PROD_CLAUDE_URL" -f scripts/admin-role.sql
--   psql "$STAGING_CLAUDE_URL" -f scripts/admin-role.sql
--   Or: Supabase Dashboard > SQL Editor
-- ============================================================

-- -----------------------------------------------
-- GRANT ADMIN
-- Replace 'user@example.com' with the target email
-- -----------------------------------------------
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'user@example.com';

-- -----------------------------------------------
-- VERIFY
-- -----------------------------------------------
SELECT id, email, raw_app_meta_data->>'role' AS role
FROM auth.users
WHERE email = 'user@example.com';

-- -----------------------------------------------
-- REVOKE ADMIN (uncomment to use)
-- -----------------------------------------------
-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data - 'role'
-- WHERE email = 'user@example.com';

-- ============================================================
-- Alternative: Supabase Admin API (cURL)
-- ============================================================
--
-- # Grant admin
-- curl -X PUT \
--   "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
--   -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
--   -H "Content-Type: application/json" \
--   -d '{"app_metadata": {"role": "admin"}}'
--
-- # Revoke admin
-- curl -X PUT \
--   "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
--   -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
--   -H "Content-Type: application/json" \
--   -d '{"app_metadata": {"role": null}}'
-- ============================================================
