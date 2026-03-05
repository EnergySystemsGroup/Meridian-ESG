-- Add stale tracking to client_matches and create job logging infrastructure
-- Part of #38: Background match computation job with delta detection

-- 1. Add stale tracking columns to client_matches
ALTER TABLE client_matches ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE client_matches ADD COLUMN IF NOT EXISTS stale_at TIMESTAMPTZ;

-- Index for filtering active (non-stale) matches
CREATE INDEX IF NOT EXISTS idx_client_matches_active ON client_matches(client_id) WHERE is_stale = false;

-- 2. Create match_job_logs table for observability
CREATE TABLE IF NOT EXISTS match_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL,           -- 'cron', 'opportunity_stored', 'client_created', 'client_updated'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed'
  stats JSONB DEFAULT '{}'::jsonb, -- { clients_processed, opportunities_evaluated, new_matches, updated_matches, stale_matches, duration_ms }
  error TEXT,
  scope JSONB DEFAULT '{}'::jsonb  -- { client_ids: [...], opportunity_ids: [...] } for scoped runs
);

-- RLS: same pattern as client_matches
ALTER TABLE match_job_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'match_job_logs' AND policyname = 'authenticated_select'
  ) THEN
    CREATE POLICY "authenticated_select" ON match_job_logs FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'match_job_logs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON match_job_logs FOR ALL TO service_role USING (true);
  END IF;
END$$;

-- 3. Enable pg_net for async HTTP calls from pg_cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Schedule daily match computation via pg_cron + pg_net
-- Calls the Next.js API route asynchronously at 3 AM UTC daily.
-- Requires app.site_url and app.cron_secret to be set as Postgres config parameters:
--   ALTER DATABASE postgres SET app.site_url = 'https://your-app.vercel.app';
--   ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret';
SELECT cron.schedule(
  'daily-match-computation',
  '0 3 * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.site_url') || '/api/cron/compute-matches',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret')),
    timeout_milliseconds := 30000
  );
  $$
);
