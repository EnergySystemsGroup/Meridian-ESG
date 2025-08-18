-- Migration: Create Processing Jobs Table for V2 Pipeline Job Queue System
-- This migration creates the job queue infrastructure for chunked V2 pipeline processing
-- to solve Vercel timeout issues by processing opportunities in small batches.
-- 
-- Table created:
-- 1. processing_jobs - Job queue for chunked opportunity processing

-- =============================================================================
-- 1. PROCESSING_JOBS - Job queue for chunked opportunity processing
-- =============================================================================
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES api_sources(id) ON DELETE CASCADE,
  master_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  
  -- Job Identity and Ordering
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  
  -- Job Status Management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Job created, waiting to be processed
    'processing',    -- Currently being processed by job processor
    'completed',     -- Successfully processed and stored
    'failed',        -- Processing failed
    'retrying'       -- Failed job being retried
  )),
  
  -- Chunk Data Storage (5 opportunities per chunk by default)
  raw_data JSONB NOT NULL,                    -- The chunk of opportunities to process
  processing_config JSONB NOT NULL,           -- Source configuration and processing instructions
  
  -- Error Handling and Retry Logic
  error_details JSONB,                        -- Error information if processing failed
  retry_count INTEGER NOT NULL DEFAULT 0,     -- Number of retry attempts
  max_retries INTEGER NOT NULL DEFAULT 3,     -- Maximum retry attempts allowed
  
  -- Performance and Timing Tracking
  processing_time_ms INTEGER,                 -- Time taken to process this chunk
  tokens_used INTEGER DEFAULT 0,              -- Token usage for this chunk
  estimated_cost_usd DECIMAL(8,4),           -- Estimated cost for processing this chunk
  
  -- Timestamps for Job Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,                     -- When job processing started
  completed_at TIMESTAMPTZ,                   -- When job processing completed
  
  -- Constraints to ensure data integrity
  CONSTRAINT chunk_index_positive CHECK (chunk_index >= 0),
  CONSTRAINT total_chunks_positive CHECK (total_chunks > 0),
  CONSTRAINT chunk_index_valid CHECK (chunk_index < total_chunks),
  CONSTRAINT retry_count_positive CHECK (retry_count >= 0),
  CONSTRAINT max_retries_positive CHECK (max_retries >= 0)
);

-- =============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary indexes for job queue operations
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at ASC);
CREATE INDEX idx_processing_jobs_pending_queue ON processing_jobs(status, created_at ASC) 
  WHERE status = 'pending';

-- Indexes for job tracking and analytics
CREATE INDEX idx_processing_jobs_master_run ON processing_jobs(master_run_id);
CREATE INDEX idx_processing_jobs_source_id ON processing_jobs(source_id);
CREATE INDEX idx_processing_jobs_chunk_progress ON processing_jobs(master_run_id, chunk_index);

-- Index for retry and error tracking
CREATE INDEX idx_processing_jobs_failed_retries ON processing_jobs(status, retry_count) 
  WHERE status IN ('failed', 'retrying');

-- Index for performance analytics
CREATE INDEX idx_processing_jobs_completed_at ON processing_jobs(completed_at DESC) 
  WHERE completed_at IS NOT NULL;

-- =============================================================================
-- 3. TABLE COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE processing_jobs IS 'Job queue for chunked V2 pipeline processing to handle long-running operations within Vercel timeout limits';

COMMENT ON COLUMN processing_jobs.chunk_index IS 'Zero-based index of this chunk within the total chunks for the master run';
COMMENT ON COLUMN processing_jobs.total_chunks IS 'Total number of chunks created for the master run';
COMMENT ON COLUMN processing_jobs.raw_data IS 'JSONB containing ~5 opportunities to be processed through the V2 pipeline';
COMMENT ON COLUMN processing_jobs.processing_config IS 'Source configuration and processing instructions needed for pipeline execution';
COMMENT ON COLUMN processing_jobs.master_run_id IS 'Links to the master pipeline_runs record for aggregated metrics';
COMMENT ON COLUMN processing_jobs.retry_count IS 'Current number of retry attempts for failed jobs';
COMMENT ON COLUMN processing_jobs.max_retries IS 'Maximum retry attempts before marking job as permanently failed';

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS for security
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Basic read/write policies (adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON processing_jobs FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON processing_jobs FOR ALL USING (true);

-- =============================================================================
-- 5. UTILITY FUNCTIONS FOR JOB QUEUE MANAGEMENT
-- =============================================================================

-- Function to get the next pending job for processing
CREATE OR REPLACE FUNCTION get_next_pending_job()
RETURNS SETOF processing_jobs
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM processing_jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- Function to update job status with timestamp tracking
CREATE OR REPLACE FUNCTION update_job_status(
  job_id UUID,
  new_status TEXT,
  error_info JSONB DEFAULT NULL,
  processing_time INTEGER DEFAULT NULL,
  tokens_consumed INTEGER DEFAULT NULL,
  cost_estimate DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE processing_jobs
  SET 
    status = new_status,
    error_details = COALESCE(error_info, error_details),
    processing_time_ms = COALESCE(processing_time, processing_time_ms),
    tokens_used = COALESCE(tokens_consumed, tokens_used),
    estimated_cost_usd = COALESCE(cost_estimate, estimated_cost_usd),
    started_at = CASE 
      WHEN new_status = 'processing' AND started_at IS NULL THEN NOW()
      ELSE started_at
    END,
    completed_at = CASE 
      WHEN new_status IN ('completed', 'failed') AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    retry_count = CASE
      WHEN new_status = 'retrying' THEN retry_count + 1
      ELSE retry_count
    END
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$;

-- Function to get job queue status summary
CREATE OR REPLACE FUNCTION get_job_queue_status()
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  oldest_job TIMESTAMPTZ,
  newest_job TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    pj.status,
    COUNT(*) as count,
    MIN(pj.created_at) as oldest_job,
    MAX(pj.created_at) as newest_job
  FROM processing_jobs pj
  GROUP BY pj.status
  ORDER BY pj.status;
$$;

-- =============================================================================
-- 6. ENABLE REALTIME FOR LIVE JOB QUEUE MONITORING
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE processing_jobs;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Created job queue infrastructure with:
-- ✅ processing_jobs - Main job queue table for chunked processing
-- ✅ Performance indexes for queue operations and analytics
-- ✅ Utility functions for job management
-- ✅ RLS policies for security
-- ✅ Realtime subscriptions for live monitoring
-- ✅ Proper constraints and data validation
-- ✅ Comprehensive documentation