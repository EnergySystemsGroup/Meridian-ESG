/**
 * Create Test Jobs Script
 * 
 * Manually creates test jobs in the processing_jobs table for testing
 * the job queue processor proof of concept.
 */

import { JobQueueManager } from '../lib/services/jobQueueManager.js';
import { createSupabaseClient } from '../lib/supabase.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Create test API source and pipeline run for job prerequisites
 */
async function createTestPrerequisites() {
  const supabase = createSupabaseClient();
  
  const testSource = {
    id: crypto.randomUUID(),
    name: 'Test API Source for Job Queue',
    type: 'test-api',
    organization: 'Test Organization',
    url: 'https://api.test.example.com',
    api_endpoint: 'https://api.test.example.com/opportunities',
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
      test_mode: true
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
 * Generate realistic test data for opportunities
 */
function generateTestOpportunities(baseIndex, count = 5) {
  const opportunities = [];
  const agencies = ['EPA', 'DOE', 'NSF', 'NIH', 'USDA'];
  const types = ['Research Grant', 'Innovation Fund', 'Development Program', 'Infrastructure Grant', 'Education Initiative'];
  
  for (let i = 0; i < count; i++) {
    const oppIndex = baseIndex * count + i + 1;
    opportunities.push({
      id: `TEST-OPP-${oppIndex.toString().padStart(4, '0')}`,
      title: `${types[i % types.length]} ${oppIndex}`,
      description: `Test funding opportunity ${oppIndex} for demonstration of the job queue processing system. This opportunity focuses on innovative research and development in various fields.`,
      agency: agencies[i % agencies.length],
      amount: {
        min: 50000 + (i * 25000),
        max: 500000 + (i * 100000)
      },
      deadline: new Date(Date.now() + (30 + i * 10) * 24 * 60 * 60 * 1000).toISOString(),
      eligibility: ['small-business', 'research-institution', 'non-profit'],
      location: 'nationwide',
      category: 'research-development',
      source: 'test-api',
      posted_date: new Date(Date.now() - (5 + i) * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: true,
        chunk_index: baseIndex,
        item_index: i
      }
    });
  }
  
  return opportunities;
}

/**
 * Create processing configuration for test jobs
 */
function createTestProcessingConfig(source) {
  return {
    source: {
      id: source.id,
      name: source.name,
      api_endpoint: source.api_endpoint
    },
    instructions: {
      workflow: 'test_processing',
      test_mode: true,
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
      successRate: 0.9 // 90% success rate for testing
    }
  };
}

/**
 * Main function to create test jobs
 */
async function createTestJobs() {
  try {
    console.log('🧪 Creating test jobs for job queue processor...\n');
    
    // Create prerequisites
    console.log('📋 Creating test prerequisites...');
    const { testSource, testRun } = await createTestPrerequisites();
    console.log(`✅ Created test source: ${testSource.id}`);
    console.log(`✅ Created test run: ${testRun.id}\n`);
    
    // Create JobQueueManager
    const jobQueueManager = new JobQueueManager();
    
    // Create processing config
    const processingConfig = createTestProcessingConfig(testSource);
    
    // Create test jobs
    const numJobs = 8; // Create 8 jobs (40 total opportunities)
    console.log(`📦 Creating ${numJobs} test jobs with 5 opportunities each...`);
    
    const createdJobs = [];
    
    for (let i = 0; i < numJobs; i++) {
      console.log(`\n🔄 Creating job ${i + 1}/${numJobs}...`);
      
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
      
      console.log(`✅ Created job ${job.id}`);
      console.log(`   Chunk: ${job.chunk_index + 1}/${job.total_chunks}`);
      console.log(`   Opportunities: ${job.raw_data.length}`);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n🎉 Successfully created ${createdJobs.length} test jobs!`);
    console.log(`📊 Total opportunities queued: ${createdJobs.length * 5}`);
    
    // Get queue status
    const queueStatus = await jobQueueManager.getQueueStatus();
    console.log('\n📈 Current queue status:');
    queueStatus.forEach(status => {
      console.log(`   ${status.status}: ${status.count} jobs`);
    });
    
    console.log('\n🚀 Ready to test job processing!');
    console.log('Next steps:');
    console.log('1. Test locally: node scripts/testCronLocal.js');
    console.log('2. Test API: curl http://localhost:3000/api/cron/process-jobs');
    console.log('3. Deploy to Vercel to test cron automation');
    
    return {
      testSource,
      testRun,
      createdJobs,
      totalJobs: createdJobs.length,
      totalOpportunities: createdJobs.length * 5
    };
    
  } catch (error) {
    console.error('❌ Error creating test jobs:', error);
    process.exit(1);
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up existing test data...');
    
    const supabase = createSupabaseClient();
    
    // Clean up in reverse order of dependencies  
    await supabase.from('processing_jobs').delete().ilike('processing_config->>test_mode', 'true');
    await supabase.from('pipeline_runs').delete().ilike('run_configuration->>test_mode', 'true');
    await supabase.from('api_sources').delete().eq('name', 'Test API Source for Job Queue');
    
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

// Run the script
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanupTestData();
    return;
  }
  
  if (args.includes('--help')) {
    console.log('Usage: node scripts/createTestJobs.js [options]');
    console.log('Options:');
    console.log('  --cleanup    Clean up existing test data');
    console.log('  --help       Show this help message');
    return;
  }
  
  await createTestJobs();
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createTestJobs, cleanupTestData };