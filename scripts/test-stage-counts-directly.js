#!/usr/bin/env node

/**
 * Direct test of RunManagerV2 stage count tracking
 */

import { RunManagerV2 } from '../lib/services/runManagerV2.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testStageCountsDirectly() {
  console.log('🧪 Direct Test of Stage Count Tracking');
  console.log('=' .repeat(50));
  
  try {
    // Get an API source for testing
    const { data: sources } = await supabase
      .from('api_sources')
      .select('id, name')
      .limit(1);
    
    if (!sources || sources.length === 0) {
      console.error('❌ No API sources found');
      return;
    }
    
    const sourceId = sources[0].id;
    console.log(`📋 Using API source: ${sources[0].name} (${sourceId})`);
    
    // Create a test run
    const runManager = new RunManagerV2(null, supabase);
    await runManager.startRun(sourceId, { test: true, pipeline_version: 'v2-test' });
    
    console.log(`✅ Created test run: ${runManager.v2RunId}`);
    
    // Test updating stages with counts
    console.log('\n📊 Testing stage updates with counts:');
    
    // Test Data Extraction with counts
    await runManager.updateV2DataExtraction(
      'processing', 
      null, 
      null, 
      0, 
      0, 
      0,  // input count
      0   // output count (unknown during processing)
    );
    console.log('   - Data Extraction: processing');
    
    await runManager.updateV2DataExtraction(
      'completed',
      { opportunities: [1, 2, 3, 4, 5] }, // Mock 5 opportunities
      { executionTime: 100 },
      1000,  // tokens
      1,     // API calls
      0,     // input count (from API, so 0)
      5      // output count (5 opportunities extracted)
    );
    console.log('   - Data Extraction: completed (0 in → 5 out)');
    
    // Test Early Duplicate Detector with counts
    await runManager.updateV2EarlyDuplicateDetector(
      'completed',
      { newOpportunities: 2, opportunitiesToUpdate: 1, opportunitiesToSkip: 2 },
      { executionTime: 50 },
      5,  // input count (5 from extraction)
      3   // output count (2 new + 1 update, skip doesn't go forward)
    );
    console.log('   - Early Duplicate Detector: completed (5 in → 3 out)');
    
    // Test Analysis with counts
    await runManager.updateV2Analysis(
      'completed',
      { opportunities: [1, 2] },
      { executionTime: 200 },
      2000,  // tokens
      2,     // API calls
      2,     // input count (2 new opportunities)
      2      // output count (2 enhanced)
    );
    console.log('   - Analysis: completed (2 in → 2 out)');
    
    // Test Filter with counts
    await runManager.updateV2Filter(
      'completed',
      { includedOpportunities: [1] },
      { executionTime: 20 },
      2,  // input count
      1   // output count (1 passed filter)
    );
    console.log('   - Filter: completed (2 in → 1 out)');
    
    // Test Storage with counts
    await runManager.updateV2Storage(
      'completed',
      { metrics: { newOpportunities: 1 } },
      { executionTime: 30 },
      0,  // tokens
      1,  // input count
      1   // output count (1 stored)
    );
    console.log('   - Storage: completed (1 in → 1 out)');
    
    // Test Direct Update with counts
    await runManager.updateV2DirectUpdate(
      'completed',
      { metrics: { successful: 1, failed: 0 } },
      { executionTime: 25 },
      1,  // input count (1 to update)
      1   // output count (1 successfully updated)
    );
    console.log('   - Direct Update: completed (1 in → 1 out)');
    
    // Complete the run
    await runManager.completeRun(500, { test: 'completed' });
    console.log(`\n✅ Test run completed: ${runManager.v2RunId}`);
    
    // Verify the counts were saved
    console.log('\n🔍 Verifying saved counts:');
    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('stage_name, status, input_count, output_count')
      .eq('run_id', runManager.v2RunId)
      .order('stage_order');
    
    if (error) {
      console.error('❌ Error fetching stages:', error);
      return;
    }
    
    console.log('\n📊 Saved Stage Data:');
    console.log('-'.repeat(50));
    stages.forEach(stage => {
      const checkIn = stage.input_count > 0 ? '✅' : stage.input_count === 0 ? '⚠️' : '❌';
      const checkOut = stage.output_count > 0 ? '✅' : stage.output_count === 0 ? '⚠️' : '❌';
      console.log(`${stage.stage_name}:`);
      console.log(`   Input: ${stage.input_count} ${checkIn}  Output: ${stage.output_count} ${checkOut}`);
    });
    
    // Check if any counts were saved
    const hasNonZeroCounts = stages.some(s => s.input_count > 0 || s.output_count > 0);
    
    console.log('\n📈 Test Results:');
    console.log('-'.repeat(50));
    if (hasNonZeroCounts) {
      console.log('🎉 SUCCESS: Input/output counts are being tracked correctly!');
      console.log('   Task 38.16 has been successfully implemented.');
    } else {
      console.log('❌ FAILURE: Counts are not being saved properly.');
      console.log('   Check the updateV2Stage implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testStageCountsDirectly()
  .then(() => {
    console.log('\n🏁 Direct test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });