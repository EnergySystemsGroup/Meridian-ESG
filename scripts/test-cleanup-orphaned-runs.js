#!/usr/bin/env node

/**
 * Test script for cleaning up orphaned runs
 * 
 * This script tests the new RunManagerV2.cleanupOrphanedRuns() function
 * by identifying and cleaning up runs stuck in 'started' or 'processing' status
 */

import { createClient } from '@supabase/supabase-js';
import { RunManagerV2 } from '../lib/services/runManagerV2.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCleanupOrphanedRuns() {
  console.log('🧹 Testing RunManagerV2 orphaned run cleanup...\n');
  
  try {
    // First, check what runs are currently stuck
    console.log('📊 Checking current stuck runs...');
    const { data: stuckRuns, error: checkError } = await supabase
      .from('pipeline_runs')
      .select('id, status, started_at, api_source_id')
      .in('status', ['started', 'processing'])
      .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Older than 30 minutes
      .order('started_at', { ascending: false });

    if (checkError) {
      throw checkError;
    }

    console.log(`Found ${stuckRuns.length} runs stuck in 'started' or 'processing' status for more than 30 minutes:`);
    
    if (stuckRuns.length > 0) {
      console.log('\nStuck runs:');
      stuckRuns.forEach((run, index) => {
        const age = Math.round((Date.now() - new Date(run.started_at).getTime()) / 1000 / 60);
        console.log(`  ${index + 1}. Run ${run.id} (${run.status}) - ${age} minutes old`);
      });
    }

    // Now test the cleanup function
    console.log('\n🧹 Running cleanup function...');
    const cleanupResult = await RunManagerV2.cleanupOrphanedRuns(supabase, 30 * 60 * 1000); // 30 minutes

    console.log(`\n✅ Cleanup completed:`);
    console.log(`   - Cleaned up: ${cleanupResult.cleaned} runs`);
    console.log(`   - Errors: ${cleanupResult.errors.length}`);

    if (cleanupResult.errors.length > 0) {
      console.log('\n❌ Cleanup errors:');
      cleanupResult.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. Run ${error.runId}: ${error.error.message || error.error}`);
      });
    }

    // Check the results
    console.log('\n📊 Checking remaining stuck runs...');
    const { data: remainingStuckRuns, error: finalCheckError } = await supabase
      .from('pipeline_runs')
      .select('id, status, started_at')
      .in('status', ['started', 'processing'])
      .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (finalCheckError) {
      throw finalCheckError;
    }

    console.log(`Remaining stuck runs after cleanup: ${remainingStuckRuns.length}`);

    if (remainingStuckRuns.length > 0) {
      console.log('\n⚠️ Some runs are still stuck:');
      remainingStuckRuns.forEach((run, index) => {
        const age = Math.round((Date.now() - new Date(run.started_at).getTime()) / 1000 / 60);
        console.log(`   ${index + 1}. Run ${run.id} (${run.status}) - ${age} minutes old`);
      });
    } else {
      console.log('✅ All orphaned runs have been cleaned up successfully!');
    }

    // Show some cleaned up runs as examples
    if (cleanupResult.cleaned > 0) {
      console.log('\n📝 Sample of cleaned up runs:');
      const { data: cleanedRuns, error: sampleError } = await supabase
        .from('pipeline_runs')
        .select('id, status, error_details, completed_at')
        .eq('status', 'failed')
        .not('error_details', 'is', null)
        .ilike('error_details->message', '%orphaned run%')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (!sampleError && cleanedRuns.length > 0) {
        cleanedRuns.forEach((run, index) => {
          const reason = run.error_details?.reason || 'unknown';
          console.log(`   ${index + 1}. Run ${run.id} - Status: ${run.status}, Reason: ${reason}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCleanupOrphanedRuns()
  .then(() => {
    console.log('\n🎉 Cleanup test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup test failed:', error);
    process.exit(1);
  });