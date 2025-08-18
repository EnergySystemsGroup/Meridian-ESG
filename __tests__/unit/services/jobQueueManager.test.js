/**
 * Integration Tests for JobQueueManager - Real Database Testing Without Mocking
 * 
 * Tests the job queue system for V2 pipeline chunk processing using real Supabase database.
 * No mocking - tests actual database operations, job lifecycle, and data integrity.
 * 
 * Test Coverage:
 * 1. Job Creation with raw data chunks (5 opportunities each)
 * 2. FIFO Job Retrieval and status management
 * 3. Job Status Lifecycle (pending → processing → completed/failed)
 * 4. Master Run Progress Tracking and metrics
 * 5. Retry Logic and error handling
 * 6. Database constraints and foreign key relationships
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { JobQueueManager } from '../../../lib/services/jobQueueManager.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Create test Supabase client with real environment variables
function createTestSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('createTestSupabaseClient - URL:', supabaseUrl);
  console.log('createTestSupabaseClient - Key exists:', !!supabaseKey);
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing environment variables - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
  }
  
  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
    console.log('createClient returned:', !!client);
    console.log('client.from exists:', typeof client?.from);
    return client;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    throw error;
  }
}

// Clear test database tables
async function clearTestDatabase(supabase, tables = []) {
  const defaultTables = [
    'processing_jobs',
    'pipeline_runs',
    'api_sources'
  ];
  
  const tablesToClear = tables.length > 0 ? tables : defaultTables;
  
  for (const table of tablesToClear) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

// Create real test fixtures
const createTestApiSource = () => ({
  id: crypto.randomUUID(),
  name: 'Test API Source',
  type: 'API',
  organization: 'Test Org',
  url: 'https://api.test.gov/funding',
  api_endpoint: 'https://api.test.gov/funding/opportunities',
  status: 'active',
  created_at: new Date().toISOString()
});

const createTestPipelineRun = (sourceId) => ({
  id: crypto.randomUUID(),
  api_source_id: sourceId,
  status: 'processing',
  pipeline_version: 'v2.0',
  started_at: new Date().toISOString(),
  total_opportunities_processed: 0,
  run_configuration: { 
    version: 'v2.0',
    chunked_processing: true,
    chunk_size: 5
  }
});

const createTestRawDataChunk = (chunkSize = 5) => {
  const opportunities = [];
  for (let i = 0; i < chunkSize; i++) {
    opportunities.push({
      id: `opp_${i + 1}_${Date.now()}`,
      title: `Test Opportunity ${i + 1}`,
      description: `Test description for opportunity ${i + 1}`,
      source: 'test-api',
      amount: 50000 + (i * 10000),
      deadline: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(), // 30 days from now
      eligibility: ['small-business', 'research'],
      location: 'nationwide'
    });
  }
  return opportunities;
};

const createTestProcessingConfig = (source) => ({
  source: {
    id: source.id,
    name: source.name,
    api_endpoint: source.api_endpoint
  },
  instructions: {
    workflow: 'single_api',
    apiEndpoint: source.api_endpoint,
    requestConfig: { method: 'GET' },
    responseConfig: { format: 'json' }
  },
  chunkProcessing: {
    chunkSize: 5,
    timeoutMs: 60000,
    maxRetries: 3
  }
});

describe('JobQueueManager Integration Tests', () => {
  let supabase;
  let jobQueueManager;
  let testApiSource;
  let testPipelineRun;

  beforeAll(async () => {
    // Debug environment variables
    console.log('Environment variables in test:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
    
    // Create real Supabase client
    supabase = createTestSupabaseClient();
    console.log('Supabase client created:', !!supabase);
    console.log('Supabase from method:', typeof supabase.from);
    
    // Verify database connection
    const { error } = await supabase.from('processing_jobs').select('count').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  });

  beforeEach(async () => {
    // Create fresh JobQueueManager instance with test supabase client
    jobQueueManager = new JobQueueManager();
    // Override the supabase client with our test client
    jobQueueManager.supabase = supabase;
    
    // Create test data
    testApiSource = createTestApiSource();
    testPipelineRun = createTestPipelineRun(testApiSource.id);
    
    // Insert test prerequisites into database
    const { error: sourceError } = await supabase
      .from('api_sources')
      .insert(testApiSource);
    
    if (sourceError) {
      throw new Error(`Failed to create test API source: ${sourceError.message}`);
    }
    
    const { error: runError } = await supabase
      .from('pipeline_runs')
      .insert(testPipelineRun);
    
    if (runError) {
      throw new Error(`Failed to create test pipeline run: ${runError.message}`);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await clearTestDatabase(supabase, [
      'processing_jobs',
      'pipeline_runs',
      'api_sources'
    ]);
  });

  afterAll(async () => {
    // Final cleanup
    await clearTestDatabase(supabase, [
      'processing_jobs',
      'pipeline_runs', 
      'api_sources'
    ]);
  });

  describe('Job Creation and Storage', () => {
    it('should create job with 5-opportunity raw data chunk', async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      const job = await jobQueueManager.createJob(
        testApiSource.id,
        testPipelineRun.id,
        0, // chunk_index
        2, // total_chunks
        rawDataChunk,
        processingConfig
      );
      
      // Verify job was created correctly
      expect(job.id).toBeDefined();
      expect(job.source_id).toBe(testApiSource.id);
      expect(job.master_run_id).toBe(testPipelineRun.id);
      expect(job.chunk_index).toBe(0);
      expect(job.total_chunks).toBe(2);
      expect(job.status).toBe('pending');
      expect(job.retry_count).toBe(0);
      expect(job.max_retries).toBe(3);
      
      // Verify raw data chunk structure
      expect(Array.isArray(job.raw_data)).toBe(true);
      expect(job.raw_data).toHaveLength(5);
      expect(job.raw_data[0]).toHaveProperty('title');
      expect(job.raw_data[0]).toHaveProperty('description');
      expect(job.raw_data[0]).toHaveProperty('amount');
      
      // Verify processing config
      expect(job.processing_config).toHaveProperty('source');
      expect(job.processing_config.source.id).toBe(testApiSource.id);
      expect(job.processing_config).toHaveProperty('instructions');
      
      // Verify timestamps
      expect(job.created_at).toBeDefined();
      expect(job.started_at).toBeNull();
      expect(job.completed_at).toBeNull();
    });

    it('should create multiple jobs for different chunks', async () => {
      const totalChunks = 3;
      const jobs = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const rawDataChunk = createTestRawDataChunk(5);
        const processingConfig = createTestProcessingConfig(testApiSource);
        
        const job = await jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          totalChunks,
          rawDataChunk,
          processingConfig
        );
        
        jobs.push(job);
      }
      
      // Verify all jobs created with correct chunk indices
      expect(jobs).toHaveLength(3);
      jobs.forEach((job, index) => {
        expect(job.chunk_index).toBe(index);
        expect(job.total_chunks).toBe(totalChunks);
        expect(job.master_run_id).toBe(testPipelineRun.id);
      });
      
      // Verify database consistency
      const { data: dbJobs, error } = await supabase
        .from('processing_jobs')
        .select('*')
        .eq('master_run_id', testPipelineRun.id)
        .order('chunk_index', { ascending: true });
      
      expect(error).toBeNull();
      expect(dbJobs).toHaveLength(3);
      dbJobs.forEach((job, index) => {
        expect(job.chunk_index).toBe(index);
      });
    });

    it('should enforce database constraints on job creation', async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Test invalid source_id (foreign key constraint)
      await expect(
        jobQueueManager.createJob(
          crypto.randomUUID(), // non-existent source
          testPipelineRun.id,
          0,
          1,
          rawDataChunk,
          processingConfig
        )
      ).rejects.toThrow();
      
      // Test invalid master_run_id (foreign key constraint)  
      await expect(
        jobQueueManager.createJob(
          testApiSource.id,
          crypto.randomUUID(), // non-existent run
          0,
          1,
          rawDataChunk,
          processingConfig
        )
      ).rejects.toThrow();
      
      // Test invalid chunk_index (should be >= 0)
      await expect(
        jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          -1, // negative chunk index
          1,
          rawDataChunk,
          processingConfig
        )
      ).rejects.toThrow();
      
      // Test invalid total_chunks (should be > 0)
      await expect(
        jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          0,
          0, // zero total chunks
          rawDataChunk,
          processingConfig
        )
      ).rejects.toThrow();
    });
  });

  describe('Job Retrieval and FIFO Ordering', () => {
    it('should retrieve jobs in FIFO order (oldest first)', async () => {
      const jobs = [];
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create multiple jobs with slight time delays
      for (let i = 0; i < 3; i++) {
        const job = await jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          3,
          rawDataChunk,
          processingConfig
        );
        jobs.push(job);
        
        // Small delay to ensure different created_at timestamps
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Retrieve jobs and verify FIFO ordering
      const firstJob = await jobQueueManager.getNextPendingJob();
      expect(firstJob.id).toBe(jobs[0].id);
      expect(firstJob.chunk_index).toBe(0);
      
      // Update first job to processing so it's not returned again
      await jobQueueManager.updateJobStatus(firstJob.id, 'processing');
      
      const secondJob = await jobQueueManager.getNextPendingJob();
      expect(secondJob.id).toBe(jobs[1].id);
      expect(secondJob.chunk_index).toBe(1);
      
      // Update second job to completed
      await jobQueueManager.updateJobStatus(secondJob.id, 'completed');
      
      const thirdJob = await jobQueueManager.getNextPendingJob();
      expect(thirdJob.id).toBe(jobs[2].id);
      expect(thirdJob.chunk_index).toBe(2);
    });

    it('should return null when no pending jobs exist', async () => {
      const pendingJob = await jobQueueManager.getNextPendingJob();
      expect(pendingJob).toBeNull();
    });

    it('should skip jobs that are not pending', async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create jobs in different states
      const job1 = await jobQueueManager.createJob(
        testApiSource.id, testPipelineRun.id, 0, 3, rawDataChunk, processingConfig
      );
      const job2 = await jobQueueManager.createJob(
        testApiSource.id, testPipelineRun.id, 1, 3, rawDataChunk, processingConfig
      );
      const job3 = await jobQueueManager.createJob(
        testApiSource.id, testPipelineRun.id, 2, 3, rawDataChunk, processingConfig
      );
      
      // Update first two jobs to non-pending states
      await jobQueueManager.updateJobStatus(job1.id, 'completed');
      await jobQueueManager.updateJobStatus(job2.id, 'processing');
      
      // Should return the third job (only pending one)
      const nextJob = await jobQueueManager.getNextPendingJob();
      expect(nextJob.id).toBe(job3.id);
      expect(nextJob.status).toBe('pending');
    });
  });

  describe('Job Status Management and Lifecycle', () => {
    let testJob;
    
    beforeEach(async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      testJob = await jobQueueManager.createJob(
        testApiSource.id,
        testPipelineRun.id,
        0,
        1,
        rawDataChunk,
        processingConfig
      );
    });

    it('should update job status from pending to processing', async () => {
      const updatedJob = await jobQueueManager.updateJobStatus(
        testJob.id, 
        'processing'
      );
      
      expect(updatedJob.status).toBe('processing');
      expect(updatedJob.started_at).toBeDefined();
      expect(updatedJob.completed_at).toBeNull();
      
      // Verify in database
      const { data: dbJob } = await supabase
        .from('processing_jobs')
        .select('*')
        .eq('id', testJob.id)
        .single();
      
      expect(dbJob.status).toBe('processing');
      expect(dbJob.started_at).toBeDefined();
    });

    it('should update job status from processing to completed with metrics', async () => {
      // First set to processing
      await jobQueueManager.updateJobStatus(testJob.id, 'processing');
      
      // Then complete with metrics
      const updatedJob = await jobQueueManager.updateJobStatus(
        testJob.id, 
        'completed',
        {
          processingTimeMs: 45000,
          tokensUsed: 1250,
          estimatedCostUsd: 0.025
        }
      );
      
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.completed_at).toBeDefined();
      expect(updatedJob.processing_time_ms).toBe(45000);
      expect(updatedJob.tokens_used).toBe(1250);
      expect(parseFloat(updatedJob.estimated_cost_usd)).toBe(0.025);
    });

    it('should update job status to failed with error details', async () => {
      const errorDetails = {
        error: 'Processing timeout',
        stage: 'data_extraction',
        timestamp: new Date().toISOString()
      };
      
      const updatedJob = await jobQueueManager.updateJobStatus(
        testJob.id,
        'failed',
        { errorDetails }
      );
      
      expect(updatedJob.status).toBe('failed');
      expect(updatedJob.completed_at).toBeDefined();
      expect(updatedJob.error_details).toEqual(errorDetails);
    });

    it('should increment retry count when job marked for retry', async () => {
      // Mark as failed first
      await jobQueueManager.updateJobStatus(testJob.id, 'failed');
      
      // Then retry
      const retriedJob = await jobQueueManager.updateJobStatus(
        testJob.id,
        'retrying'
      );
      
      expect(retriedJob.status).toBe('pending'); // Should reset to pending
      expect(retriedJob.retry_count).toBe(1);
      expect(retriedJob.started_at).toBeNull(); // Should reset timestamps
      expect(retriedJob.completed_at).toBeNull();
    });
  });

  describe('Master Run Progress Tracking', () => {
    let testJobs;
    
    beforeEach(async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create 4 jobs for testing progress
      testJobs = [];
      for (let i = 0; i < 4; i++) {
        const job = await jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          4,
          rawDataChunk,
          processingConfig
        );
        testJobs.push(job);
      }
    });

    it('should get all jobs for a master run', async () => {
      const jobs = await jobQueueManager.getJobsByMasterRun(testPipelineRun.id);
      
      expect(jobs).toHaveLength(4);
      jobs.forEach((job, index) => {
        expect(job.master_run_id).toBe(testPipelineRun.id);
        expect(job.chunk_index).toBe(index); // Should be ordered by chunk_index
      });
    });

    it('should calculate master run progress correctly', async () => {
      // Complete 2 jobs, fail 1, leave 1 pending
      await jobQueueManager.updateJobStatus(testJobs[0].id, 'completed', {
        processingTimeMs: 30000,
        tokensUsed: 800,
        estimatedCostUsd: 0.02
      });
      await jobQueueManager.updateJobStatus(testJobs[1].id, 'completed', {
        processingTimeMs: 35000,
        tokensUsed: 900,
        estimatedCostUsd: 0.025
      });
      await jobQueueManager.updateJobStatus(testJobs[2].id, 'failed');
      // testJobs[3] remains pending
      
      const progress = await jobQueueManager.getMasterRunProgress(testPipelineRun.id);
      
      expect(progress.masterRunId).toBe(testPipelineRun.id);
      expect(progress.totalJobs).toBe(4);
      expect(progress.statusCounts.completed).toBe(2);
      expect(progress.statusCounts.failed).toBe(1);
      expect(progress.statusCounts.pending).toBe(1);
      expect(progress.statusCounts.processing).toBe(0);
      
      expect(progress.completionPercentage).toBe(50); // 2/4 completed
      expect(progress.isComplete).toBe(false);
      expect(progress.hasFailures).toBe(true);
      
      // Verify aggregated metrics
      expect(progress.metrics.totalProcessingTimeMs).toBe(65000); // 30000 + 35000
      expect(progress.metrics.totalTokensUsed).toBe(1700); // 800 + 900
      expect(parseFloat(progress.metrics.totalEstimatedCostUsd)).toBe(0.045); // 0.02 + 0.025
    });

    it('should detect when master run is complete', async () => {
      // Complete all jobs
      for (let i = 0; i < testJobs.length; i++) {
        await jobQueueManager.updateJobStatus(testJobs[i].id, 'completed');
      }
      
      const progress = await jobQueueManager.getMasterRunProgress(testPipelineRun.id);
      
      expect(progress.completionPercentage).toBe(100);
      expect(progress.isComplete).toBe(true);
      expect(progress.hasFailures).toBe(false);
      expect(progress.statusCounts.completed).toBe(4);
    });
  });

  describe('Retry Logic and Error Recovery', () => {
    let failedJobs;
    
    beforeEach(async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create jobs with different retry counts
      failedJobs = [];
      for (let i = 0; i < 3; i++) {
        const job = await jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          3,
          rawDataChunk,
          processingConfig
        );
        
        // Simulate different retry scenarios
        await jobQueueManager.updateJobStatus(job.id, 'failed');
        
        // Manually set retry counts
        await supabase
          .from('processing_jobs')
          .update({ retry_count: i }) // 0, 1, 2 retries
          .eq('id', job.id);
        
        failedJobs.push(job);
      }
    });

    it('should retry failed jobs under max retry limit', async () => {
      const retriedJobs = await jobQueueManager.retryFailedJobs(3);
      
      // Should retry jobs with retry_count < 3 (jobs with 0, 1, 2 retries)
      expect(retriedJobs).toHaveLength(3);
      
      // Verify jobs are reset to pending
      for (const retriedJob of retriedJobs) {
        expect(retriedJob.status).toBe('pending');
        expect(retriedJob.error_details).toBeNull();
        expect(retriedJob.started_at).toBeNull();
        expect(retriedJob.completed_at).toBeNull();
      }
    });

    it('should not retry jobs that exceed max retry limit', async () => {
      // Set one job to max retries
      await supabase
        .from('processing_jobs')
        .update({ retry_count: 3 })
        .eq('id', failedJobs[2].id);
      
      const retriedJobs = await jobQueueManager.retryFailedJobs(3);
      
      // Should only retry 2 jobs (those with retry_count < 3)
      expect(retriedJobs).toHaveLength(2);
      
      // Verify the job with max retries is not retried
      const { data: maxRetriedJob } = await supabase
        .from('processing_jobs')
        .select('*')
        .eq('id', failedJobs[2].id)
        .single();
      
      expect(maxRetriedJob.status).toBe('failed'); // Should remain failed
      expect(maxRetriedJob.retry_count).toBe(3);
    });

    it('should handle empty retry queue gracefully', async () => {
      // Complete all failed jobs first
      for (const job of failedJobs) {
        await jobQueueManager.updateJobStatus(job.id, 'completed');
      }
      
      const retriedJobs = await jobQueueManager.retryFailedJobs();
      expect(retriedJobs).toHaveLength(0);
    });
  });

  describe('Queue Status and Monitoring', () => {
    it('should get comprehensive queue status', async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create jobs in different states
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        const job = await jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          5,
          rawDataChunk,
          processingConfig
        );
        jobs.push(job);
      }
      
      // Set different statuses
      await jobQueueManager.updateJobStatus(jobs[0].id, 'processing');
      await jobQueueManager.updateJobStatus(jobs[1].id, 'completed');
      await jobQueueManager.updateJobStatus(jobs[2].id, 'failed');
      // jobs[3] and jobs[4] remain pending
      
      const queueStatus = await jobQueueManager.getQueueStatus();
      
      // Verify status counts
      const statusMap = {};
      queueStatus.forEach(status => {
        statusMap[status.status] = parseInt(status.count);
      });
      
      expect(statusMap.pending).toBe(2);
      expect(statusMap.processing).toBe(1);
      expect(statusMap.completed).toBe(1);
      expect(statusMap.failed).toBe(1);
    });
  });

  describe('Data Integrity and Performance', () => {
    it('should handle large raw data chunks without corruption', async () => {
      // Create larger chunk with more complex data
      const largeChunk = [];
      for (let i = 0; i < 5; i++) {
        largeChunk.push({
          id: `large_opp_${i}`,
          title: `Large Opportunity ${i}`.repeat(10), // Longer title
          description: `Very detailed description for opportunity ${i}. `.repeat(50), // ~2.5KB description
          metadata: {
            source: 'test-api',
            processed: false,
            tags: Array(20).fill().map((_, idx) => `tag${idx}`),
            nested: {
              level1: { level2: { level3: 'deep data' } }
            }
          },
          amount: 100000 + (i * 25000),
          eligibility_complex: {
            requirements: Array(10).fill().map((_, idx) => `Requirement ${idx}`),
            restrictions: Array(5).fill().map((_, idx) => `Restriction ${idx}`)
          }
        });
      }
      
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      const job = await jobQueueManager.createJob(
        testApiSource.id,
        testPipelineRun.id,
        0,
        1,
        largeChunk,
        processingConfig
      );
      
      // Verify data integrity
      expect(job.raw_data).toHaveLength(5);
      expect(job.raw_data[0].description.length).toBeGreaterThan(2000);
      expect(job.raw_data[0].metadata.tags).toHaveLength(20);
      expect(job.raw_data[0].metadata.nested.level1.level2.level3).toBe('deep data');
      
      // Retrieve and verify data persistence
      const retrievedJob = await jobQueueManager.getNextPendingJob();
      expect(retrievedJob.raw_data).toEqual(largeChunk);
    });

    it('should maintain performance with many concurrent jobs', async () => {
      const startTime = Date.now();
      const numJobs = 20;
      const rawDataChunk = createTestRawDataChunk(5);
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      // Create many jobs concurrently
      const createPromises = Array(numJobs).fill().map((_, i) => 
        jobQueueManager.createJob(
          testApiSource.id,
          testPipelineRun.id,
          i,
          numJobs,
          rawDataChunk,
          processingConfig
        )
      );
      
      const createdJobs = await Promise.all(createPromises);
      const creationTime = Date.now() - startTime;
      
      // Verify all jobs created successfully
      expect(createdJobs).toHaveLength(numJobs);
      createdJobs.forEach((job, index) => {
        expect(job.chunk_index).toBe(index);
        expect(job.status).toBe('pending');
      });
      
      // Performance check - should create 20 jobs in reasonable time
      expect(creationTime).toBeLessThan(5000); // Under 5 seconds
      
      // Test retrieval performance
      const retrievalStart = Date.now();
      const progress = await jobQueueManager.getMasterRunProgress(testPipelineRun.id);
      const retrievalTime = Date.now() - retrievalStart;
      
      expect(progress.totalJobs).toBe(numJobs);
      expect(retrievalTime).toBeLessThan(1000); // Under 1 second
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle job operations with non-existent job ID', async () => {
      const nonExistentId = crypto.randomUUID();
      
      await expect(
        jobQueueManager.updateJobStatus(nonExistentId, 'completed')
      ).rejects.toThrow();
    });

    it('should handle empty raw data chunks', async () => {
      const emptyChunk = [];
      const processingConfig = createTestProcessingConfig(testApiSource);
      
      const job = await jobQueueManager.createJob(
        testApiSource.id,
        testPipelineRun.id,
        0,
        1,
        emptyChunk,
        processingConfig
      );
      
      expect(job.raw_data).toHaveLength(0);
      expect(Array.isArray(job.raw_data)).toBe(true);
    });

    it('should handle null processing configuration gracefully', async () => {
      const rawDataChunk = createTestRawDataChunk(5);
      
      const job = await jobQueueManager.createJob(
        testApiSource.id,
        testPipelineRun.id,
        0,
        1,
        rawDataChunk,
        {} // Empty config
      );
      
      expect(job.processing_config).toEqual({});
    });
  });
});