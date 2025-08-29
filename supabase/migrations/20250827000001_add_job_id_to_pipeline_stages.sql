-- Add job_id column to pipeline_stages table to support separate stages per job
-- This enables tracking individual job performance without overwriting metrics

-- Add job_id column with foreign key reference to processing_jobs
ALTER TABLE pipeline_stages 
ADD COLUMN job_id UUID REFERENCES processing_jobs(id);

-- Add index for performance when querying stages by job
CREATE INDEX idx_pipeline_stages_job_id ON pipeline_stages(job_id);

-- Add comment for documentation
COMMENT ON COLUMN pipeline_stages.job_id IS 'References processing_jobs.id - enables separate pipeline stages per job chunk';