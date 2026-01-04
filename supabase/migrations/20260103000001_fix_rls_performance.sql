-- Fix RLS Performance Warnings
-- 1. Fix auth_rls_initplan: wrap auth.role() in (select ...)
-- 2. Fix multiple_permissive_policies: remove redundant SELECT policies

-- ============================================================
-- SYSTEM_CONFIG: Fix auth.role() calls (wrap in select)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read system config" ON public.system_config;
DROP POLICY IF EXISTS "Service role can modify system config" ON public.system_config;

CREATE POLICY "Authenticated users can read system config" ON public.system_config
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Service role can modify system config" ON public.system_config
  FOR ALL USING ((select auth.role()) = 'service_role');

-- ============================================================
-- API_SOURCE_RUNS: Remove duplicate auth_select
-- ============================================================
DROP POLICY IF EXISTS "auth_select" ON public.api_source_runs;

-- ============================================================
-- DUPLICATE_DETECTION_SESSIONS: Remove redundant SELECT (ALL covers it)
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.duplicate_detection_sessions;

-- ============================================================
-- OPPORTUNITY_PROCESSING_PATHS: Remove redundant SELECT
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.opportunity_processing_paths;

-- ============================================================
-- PIPELINE_RUNS: Remove redundant SELECT + auth_select
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pipeline_runs;
DROP POLICY IF EXISTS "auth_select" ON public.pipeline_runs;

-- ============================================================
-- PIPELINE_STAGES: Remove redundant SELECT + auth_select
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pipeline_stages;
DROP POLICY IF EXISTS "auth_select" ON public.pipeline_stages;

-- ============================================================
-- PROCESS_RUNS: Remove duplicate auth_select
-- ============================================================
DROP POLICY IF EXISTS "auth_select" ON public.process_runs;

-- ============================================================
-- PROCESSING_JOBS: Remove redundant SELECT
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.processing_jobs;
