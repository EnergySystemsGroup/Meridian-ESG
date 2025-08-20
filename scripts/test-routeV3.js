#!/usr/bin/env node

/**
 * Test RouteV3 Job Creation API
 * 
 * This script tests the new job-creation-only API route that creates jobs
 * without processing them, designed to work within Vercel's timeout limits.
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testRouteV3() {
  console.log('🧪 Testing RouteV3 Job Creation API\n');

  // Test with a known source ID - using a small test source to avoid timeout
  const sourceId = '7767eedc-8a09-4058-8837-fc8df8e437cb'; // Grants.gov
  
  try {
    console.log(`📡 Making request to RouteV3 for source: ${sourceId}`);
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/admin/funding-sources/${sourceId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chunkSize: 3,  // Smaller chunks for testing
        forceFullProcessing: false
      })
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  Request completed in ${duration}ms`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error('❌ Request failed');
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('\n✅ RouteV3 Job Creation Results:');
    console.log('════════════════════════════════');
    console.log(`Source: ${result.sourceName} (${result.sourceId})`);
    console.log(`Run ID: ${result.runId}`);
    console.log(`Pipeline: ${result.pipeline} v${result.version}`);
    console.log(`Status: ${result.status}`);
    
    console.log('\n📊 Summary:');
    console.log(`• Total Opportunities: ${result.summary.totalOpportunities}`);
    console.log(`• Chunks Created: ${result.summary.chunksCreated}`);
    console.log(`• Jobs Created: ${result.summary.jobsCreated}`);
    console.log(`• Chunk Size: ${result.summary.chunkSize}`);
    
    console.log('\n⚡ Performance Metrics:');
    console.log(`• Data Fetch: ${result.metrics.fetchTimeMs}ms`);
    console.log(`• Job Creation: ${result.metrics.jobCreationTimeMs}ms`);
    console.log(`• Total Time: ${result.metrics.totalTimeMs}ms`);
    console.log(`• API Calls: ${result.metrics.apiCalls}`);
    console.log(`• Response Size: ${(result.metrics.responseSize / 1024).toFixed(2)}KB`);
    
    console.log('\n📋 Created Jobs:');
    result.jobs.forEach((job, index) => {
      console.log(`  ${index + 1}. Job ${job.jobId} - Chunk ${job.chunkIndex + 1} (${job.opportunityCount} opps)`);
    });
    
    console.log('\n🔄 Next Steps:');
    console.log(`• Processing URL: ${result.nextSteps.processingUrl}`);
    console.log(`• Status URL: ${result.nextSteps.statusUrl}`);
    
    console.log('\n🎉 RouteV3 test completed successfully!');
    console.log(`Jobs are now queued and ready for background processing via cron.`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testRouteV3().catch(console.error);