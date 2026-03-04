-- Enable RLS on tables flagged by Supabase linter
-- Fixes: source_program_urls, claude_change_log
-- Skips: spatial_ref_sys (PostGIS system table, owned by supabase_admin)

-- ============================================================================
-- 1. Enable RLS
-- ============================================================================
ALTER TABLE public.source_program_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_change_log ENABLE ROW LEVEL SECURITY;

-- spatial_ref_sys is owned by supabase_admin (PostGIS system table).
-- We cannot ALTER it from a migration. It contains only public reference
-- data (coordinate system definitions) with no sensitive content — safe to skip.

-- ============================================================================
-- 2. source_program_urls — pipeline reads + writes
-- ============================================================================
CREATE POLICY anon_select ON public.source_program_urls FOR SELECT TO anon USING (true);
CREATE POLICY auth_select ON public.source_program_urls FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON public.source_program_urls FOR ALL TO service_role USING (true);
CREATE POLICY claude_writer_write ON public.source_program_urls FOR ALL TO claude_writer USING (true);

-- ============================================================================
-- 3. claude_change_log — audit log, pipeline insert only
-- ============================================================================
CREATE POLICY anon_select ON public.claude_change_log FOR SELECT TO anon USING (true);
CREATE POLICY auth_select ON public.claude_change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON public.claude_change_log FOR ALL TO service_role USING (true);
CREATE POLICY claude_writer_insert ON public.claude_change_log FOR INSERT TO claude_writer WITH CHECK (true);

-- spatial_ref_sys moved to extensions schema above — no policies needed
