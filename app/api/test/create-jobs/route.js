/**
 * Create Test Jobs API Endpoint
 * 
 * Creates test jobs for staging/production testing of the job queue system.
 * POST /api/test/create-jobs
 */

import { JobQueueManager } from '../../../../lib/services/jobQueueManager.js';
import { createSupabaseClient } from '../../../../lib/supabase.js';
import crypto from 'crypto';

/**
 * Generate test opportunities data
 */
function generateTestOpportunities(baseIndex, count = 5) {
  const opportunities = [];
  const agencies = ['EPA', 'DOE', 'NSF', 'NIH', 'USDA'];
  const types = ['Research Grant', 'Innovation Fund', 'Development Program', 'Infrastructure Grant', 'Education Initiative'];
  
  for (let i = 0; i < count; i++) {
    const oppIndex = baseIndex * count + i + 1;
    opportunities.push({
      id: `STAGING-OPP-${oppIndex.toString().padStart(4, '0')}`,
      title: `${types[i % types.length]} ${oppIndex}`,
      description: `Staging test funding opportunity ${oppIndex} for job queue system validation.`,
      agency: agencies[i % agencies.length],
      amount: {
        min: 50000 + (i * 25000),
        max: 500000 + (i * 100000)
      },
      deadline: new Date(Date.now() + (30 + i * 10) * 24 * 60 * 60 * 1000).toISOString(),
      eligibility: ['small-business', 'research-institution', 'non-profit'],
      location: 'nationwide',
      category: 'research-development',
      source: 'staging-test',
      posted_date: new Date(Date.now() - (5 + i) * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: true,
        staging: true,
        chunk_index: baseIndex,
        item_index: i
      }
    });
  }
  
  return opportunities;
}

/**
 * Create test prerequisites
 */
async function createTestPrerequisites() {
  const supabase = createSupabaseClient();
  
  const testSource = {
    id: crypto.randomUUID(),
    name: 'Staging Test API Source',
    type: 'staging-test',
    organization: 'Test Organization',
    url: 'https://staging.test.example.com',
    api_endpoint: 'https://staging.test.example.com/opportunities',
    auth_type: 'none',
    active: true
  };
  
  const testRun = {
    id: crypto.randomUUID(),
    api_source_id: testSource.id,
    status: 'processing',
    pipeline_version: 'v2.0',
    started_at: new Date().toISOString(),
    total_opportunities_processed: 0,
    run_configuration: {
      version: 'v2.0',
      chunked_processing: true,
      chunk_size: 5,
      test_mode: true,
      staging_test: true
    }
  };
  
  // Insert test source
  const { error: sourceError } = await supabase
    .from('api_sources')
    .insert(testSource);
  
  if (sourceError && !sourceError.message.includes('duplicate')) {
    throw new Error(`Failed to create test source: ${sourceError.message}`);
  }
  
  // Insert test run
  const { error: runError } = await supabase
    .from('pipeline_runs')
    .insert(testRun);
  
  if (runError && !runError.message.includes('duplicate')) {
    throw new Error(`Failed to create test run: ${runError.message}`);
  }
  
  return { testSource, testRun };
}

/**
 * POST /api/test/create-jobs
 */
export async function POST(request) {
  const startTime = Date.now();
  
  try {
    console.log('[CreateTestJobs] 🧪 Creating test jobs for staging...');
    
    // Get parameters from request
    const body = await request.json().catch(() => ({}));
    const numJobs = body.numJobs || 5; // Default to 5 jobs instead of 8 for faster testing
    
    // Create prerequisites
    console.log('[CreateTestJobs] 📋 Creating test prerequisites...');
    const { testSource, testRun } = await createTestPrerequisites();
    
    // Create JobQueueManager
    const jobQueueManager = new JobQueueManager();
    
    // Create processing config
    const processingConfig = {
      source: {
        id: testSource.id,
        name: testSource.name,
        api_endpoint: testSource.api_endpoint
      },
      instructions: {
        workflow: 'staging_test_processing',
        test_mode: true,
        staging_test: true,
        chunk_processing: true
      },
      chunkProcessing: {
        chunkSize: 5,
        timeoutMs: 60000,
        maxRetries: 3
      },
      testConfig: {
        simulateProcessing: true,
        processingTimeMs: 2000,
        successRate: 0.9
      }
    };
    
    // Create test jobs
    console.log(`[CreateTestJobs] 📦 Creating ${numJobs} test jobs...`);
    const createdJobs = [];
    
    for (let i = 0; i < numJobs; i++) {
      console.log(`[CreateTestJobs] 🔄 Creating job ${i + 1}/${numJobs}...`);
      
      // Generate test data for this chunk
      const testOpportunities = generateTestOpportunities(i, 5);
      
      // Create the job
      const job = await jobQueueManager.createJob(
        testSource.id,
        testRun.id,
        i, // chunk_index
        numJobs, // total_chunks
        testOpportunities,
        processingConfig
      );
      
      createdJobs.push(job);
      console.log(`[CreateTestJobs] ✅ Created job ${job.id} (chunk ${i + 1}/${numJobs})`);
    }
    
    // Get queue status
    const queueStatus = await jobQueueManager.getQueueStatus();
    const executionTime = Date.now() - startTime;
    
    console.log(`[CreateTestJobs] 🎉 Successfully created ${createdJobs.length} test jobs in ${executionTime}ms`);
    
    return Response.json({
      success: true,
      message: `Created ${createdJobs.length} test jobs for staging testing`,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      testSource: {
        id: testSource.id,
        name: testSource.name
      },
      testRun: {
        id: testRun.id,
        status: testRun.status
      },
      jobs: {
        created: createdJobs.length,
        totalOpportunities: createdJobs.length * 5,
        jobIds: createdJobs.map(job => ({
          id: job.id,
          chunkIndex: job.chunk_index,
          totalChunks: job.total_chunks
        }))
      },
      queueStatus,
      nextSteps: [
        `GET /api/cron/process-jobs - Process jobs manually`,
        `POST /api/cron/process-jobs {"action": "status"} - Check queue status`,
        `Wait 2 minutes for automatic Vercel cron processing`
      ]
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CreateTestJobs] ❌ Error creating test jobs:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime
    }, { status: 500 });
  }
}

/**
 * GET /api/test/create-jobs - Show API info
 */
export async function GET() {
  return Response.json({
    endpoint: '/api/test/create-jobs',
    method: 'POST',
    description: 'Creates test jobs for staging job queue testing',
    parameters: {
      numJobs: 'Number of jobs to create (default: 5)'
    },
    example: {
      request: 'POST /api/test/create-jobs',
      body: '{"numJobs": 5}'
    },
    relatedEndpoints: {
      processJobs: 'GET /api/cron/process-jobs',
      checkStatus: 'POST /api/cron/process-jobs {"action": "status"}'
    }
  });
}