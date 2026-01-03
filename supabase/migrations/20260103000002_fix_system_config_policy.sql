-- Fix system_config multiple permissive policies warning
--
-- The "Service role can modify system config" policy is unnecessary because:
-- 1. Service role KEY bypasses RLS entirely (PostgreSQL BYPASSRLS attribute)
-- 2. All system_config operations use createAdminClient (service role)
-- 3. This policy is never actually evaluated
--
-- Dropping it leaves only one SELECT policy, resolving the warning.

DROP POLICY IF EXISTS "Service role can modify system config" ON public.system_config;
